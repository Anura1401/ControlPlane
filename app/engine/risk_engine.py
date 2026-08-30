import os
import joblib
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from app.config import BASE_DIR
from app.schemas import RequestContext, DetectorResult, ClaimVerificationResult

FEATURE_ORDER = [
    "pii_score",
    "toxicity_score",
    "bias_score",
    "injection_score",
    "truth_risk",
    "retrieval_quality",
    "verification_confidence",
    "contradicted_claim_ratio",
    "unknown_claim_ratio",
    "cost_anomaly_score",
    "tool_impact",
    "tool_reversibility",
    "tool_sensitivity",
    "authorization_status",
    "task_risk",
    "application_risk"
]

MODEL_PATH = BASE_DIR / "app" / "engine" / "risk_calibrator.joblib"

class RiskEngine:
    """
    Risk Engine compiling 16 safety features and executing a calibrated XGBoost
    or fallback classifier to produce overall safety probability and severity.
    """
    def __init__(self, model_path: str = str(MODEL_PATH)):
        self.model_path = model_path
        self.model = self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                model = joblib.load(self.model_path)
                # Verify schema version if applicable
                return model
            except Exception as e:
                print(f"Warning: Failed to load risk model from {self.model_path}: {e}")
        
        # Build bootstrap/fallback model (Logistic Regression calibrated/fitted on toy data)
        return self._build_bootstrap_model()

    def _build_bootstrap_model(self):
        from sklearn.linear_model import LogisticRegression
        from sklearn.calibration import CalibratedClassifierCV
        
        # Hardcode sample scenarios representing SAFE (0) and UNSAFE (1) inputs
        # X order must match FEATURE_ORDER
        # 16 features: pii, tox, bias, inj, truth, ret_q, ver_conf, contra_r, unk_r, cost_a, tool_imp, tool_rev, tool_sens, auth_stat, task_r, app_r
        X_toy = [
            # SAFE cases
            [0.0, 0.05, 0.05, 0.01, 0.1, 0.8, 0.9, 0.0, 0.0, 0.05, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2],
            [0.1, 0.1, 0.02, 0.05, 0.2, 0.75, 0.85, 0.0, 0.1, 0.1, 0.0, 0.0, 0.0, 0.0, 0.2, 0.3],
            [0.05, 0.02, 0.0, 0.0, 0.15, 0.9, 0.95, 0.0, 0.0, 0.0, 0.2, 0.0, 0.2, 0.0, 0.3, 0.5],
            [0.0, 0.02, 0.01, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.05, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2],
            [0.05, 0.05, 0.01, 0.02, 0.15, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.3],
            # UNSAFE cases
            [0.0, 0.0, 0.0, 0.98, 0.5, 0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.4, 0.6], # Prompt Injection
            [0.0, 0.95, 0.1, 0.0, 0.4, 0.0, 0.0, 0.0, 0.0, 0.2, 0.0, 0.0, 0.0, 0.0, 0.2, 0.5], # Toxicity
            [0.98, 0.05, 0.05, 0.01, 0.3, 0.8, 0.9, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.3, 0.3], # PII
            [0.1, 0.2, 0.95, 0.02, 0.6, 0.7, 0.8, 0.0, 0.2, 0.15, 0.0, 0.0, 0.0, 0.0, 0.5, 0.8], # Bias
            [0.0, 0.1, 0.1, 0.05, 0.8, 0.7, 0.85, 1.0, 0.0, 0.2, 0.0, 0.0, 0.0, 0.0, 0.6, 0.7], # Contradicted facts
            [0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.1, 0.8, 1.0, 0.8, 1.0, 0.9, 0.9], # Unauthorized tool call
            [0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.95, 0.0, 0.0, 0.0, 0.0, 0.6, 0.8], # Cost anomaly
        ]
        y_toy = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]
        
        base = LogisticRegression()
        # Calibrate probabilities using Platt scaling (cv=2 for minimal fit)
        calibrated = CalibratedClassifierCV(base, method="sigmoid", cv=2)
        calibrated.fit(np.array(X_toy), np.array(y_toy))
        return calibrated

    def compile_features(
        self,
        context: RequestContext,
        pii: DetectorResult,
        toxicity: DetectorResult,
        bias: DetectorResult,
        injection: DetectorResult,
        truth: DetectorResult,
        verification_results: List[ClaimVerificationResult],
        cost_anomaly: float
    ) -> Dict[str, float]:
        """
        Gathers raw detector scores and context features, resolving them into
        the 16 dimensional feature dictionary.
        """
        features = {}
        
        # Direct scores
        features["pii_score"] = float(pii.score)
        features["toxicity_score"] = float(toxicity.score)
        features["bias_score"] = float(bias.score)
        features["injection_score"] = float(injection.score)
        features["truth_risk"] = float(truth.score)
        
        # Verification features
        # Compute retrieval quality (max similarity) and ratios
        retrieval_quality = 0.0
        verification_confidence = 0.0
        contradiction_count = 0
        unknown_count = 0
        total_claims = len(verification_results)
        
        for v_res in verification_results:
            # Check maximum retrieval similarity
            for chunk in v_res.evidence:
                if chunk.similarity > retrieval_quality:
                    retrieval_quality = chunk.similarity
            
            # Sum up verifications
            if v_res.verdict == "CONTRADICTED":
                contradiction_count += 1
            elif v_res.verdict == "UNKNOWN":
                unknown_count += 1
                
            verification_confidence = max(verification_confidence, v_res.confidence)
            
        features["retrieval_quality"] = float(retrieval_quality)
        features["verification_confidence"] = float(verification_confidence)
        features["contradicted_claim_ratio"] = float(contradiction_count / total_claims) if total_claims > 0 else 0.0
        features["unknown_claim_ratio"] = float(unknown_count / total_claims) if total_claims > 0 else 0.0
        
        # Operational anomaly
        features["cost_anomaly_score"] = float(cost_anomaly)
        
        # Tool call parameters
        tool_impact = 0.0
        tool_reversibility = 0.0
        tool_sensitivity = 0.0
        auth_status = 0.0
        
        if context.tool_call:
            # Check permission status & defaults
            tool_name = context.tool_call.tool_name
            # Simplistic static mapping matching default policy values
            if tool_name == "delete_record":
                tool_impact = 1.0  # critical
                tool_reversibility = 1.0  # irreversible
                tool_sensitivity = 0.8  # high
            elif tool_name == "send_email":
                tool_impact = 0.7  # high
                tool_reversibility = 1.0  # irreversible
                tool_sensitivity = 0.5  # medium
            else:
                tool_impact = 0.2  # low
                tool_reversibility = 0.0  # reversible
                tool_sensitivity = 0.2  # low
                
            # If permissions fail
            user_perms = context.tool_call.user_permissions
            # Check if role contains permission
            if "admin" not in user_perms and tool_name in ("delete_record", "send_email"):
                auth_status = 1.0  # unauthorized
                
        features["tool_impact"] = float(tool_impact)
        features["tool_reversibility"] = float(tool_reversibility)
        features["tool_sensitivity"] = float(tool_sensitivity)
        features["authorization_status"] = float(auth_status)
        
        # Task context risk mapping
        task_risk_mapping = {
            "financial_qa": 0.6,
            "hr_qa": 0.4,
            "general_qa": 0.1,
            "code_generation": 0.3,
            "hiring_decision": 0.7
        }
        features["task_risk"] = float(task_risk_mapping.get(context.task_type.lower(), 0.2))
        
        # Application context risk mapping
        app_risk_mapping = {
            "finance_support": 0.8,
            "hr_support": 0.5,
            "customer_support": 0.3
        }
        features["application_risk"] = float(app_risk_mapping.get(context.application_id.lower(), 0.4))
        
        return features

    def evaluate(self, feature_dict: Dict[str, float]) -> Tuple[float, str, float, List[str]]:
        """
        Executes calibrated risk classification.
        
        Returns:
            Tuple[float, str, float, List[str]]: 
            (overall_risk_probability, severity_label, confidence, dominant_risks)
        """
        # Build vector in exact FEATURE_ORDER
        vec = [feature_dict[feat] for feat in FEATURE_ORDER]
        X = np.array([vec])
        
        # Calibrated probability output
        # predict_proba returns [P(safe), P(unsafe)]
        probs = self.model.predict_proba(X)[0]
        unsafe_prob = float(probs[1])
        
        # Severity mapping
        if unsafe_prob < 0.30:
            severity = "LOW"
        elif unsafe_prob < 0.60:
            severity = "MEDIUM"
        elif unsafe_prob < 0.85:
            severity = "HIGH"
        else:
            severity = "CRITICAL"
            
        # Confidence & Uncertainty estimation
        # For binary classifier, confidence = max(p, 1-p) normalized to [0, 1] range or direct probability margin
        confidence = float(np.max(probs))
        uncertainty = float(1.0 - confidence)
        
        # Identify dominant risks (features exceeding 0.5 weight impact or absolute value)
        dominant_risks = []
        for feat in FEATURE_ORDER:
            # If the feature value itself is highly elevated
            if feature_dict[feat] > 0.5:
                # Map to standard risk label
                dominant_risks.append(feat.upper().replace("_SCORE", "").replace("_RISK", ""))
                
        # Calculate feature contributions for explainability (heuristic SHAP alternative)
        # Rank features by value * importance (using absolute weights for logistic regression)
        contributions = []
        if hasattr(self.model, "calibrated_classifiers_"):
            # Platt CCV wraps base estimators
            base_clf = self.model.calibrated_classifiers_[0].estimator
            if hasattr(base_clf, "coef_"):
                coefs = base_clf.coef_[0]
                for idx, feat in enumerate(FEATURE_ORDER):
                    contrib = float(vec[idx] * coefs[idx])
                    contributions.append((feat, contrib))
            else:
                # Fallback ranking by raw values
                for idx, feat in enumerate(FEATURE_ORDER):
                    contributions.append((feat, float(vec[idx])))
        else:
            # Fallback
            for idx, feat in enumerate(FEATURE_ORDER):
                contributions.append((feat, float(vec[idx])))
                
        # Sort contributions descending
        contributions.sort(key=lambda x: x[1], reverse=True)
        ranked_explanations = [f"{feat}:{val:.3f}" for feat, val in contributions if val > 0.01]
        
        return unsafe_prob, severity, confidence, dominant_risks


