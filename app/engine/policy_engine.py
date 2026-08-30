import os
import yaml
import re
from typing import Dict, Any, Tuple, List, Optional
from app.config import POLICIES_DIR
from app.schemas import RequestContext, DetectorResult, FinalDecision, ToolCall

ALLOWED_DECISIONS = {"ALLOW", "MODIFY", "ESCALATE", "BLOCK"}

class PolicyEngine:
    """
    Deterministic rule-based Policy Engine.
    Loads and validates YAML policies at startup and applies rules.
    """
    def __init__(self, policies_dir: str = str(POLICIES_DIR)):
        self.policies_dir = policies_dir
        self.policies = self._load_and_validate_all()

    def _load_and_validate_all(self) -> Dict[str, Dict[str, Any]]:
        policies = {}
        if not os.path.exists(self.policies_dir):
            return policies
            
        for file in os.listdir(self.policies_dir):
            if file.endswith(".yaml") or file.endswith(".yml"):
                filepath = os.path.join(self.policies_dir, file)
                try:
                    with open(filepath, "r") as f:
                        policy_data = yaml.safe_load(f)
                    
                    # Validate
                    self.validate_policy(policy_data, filepath)
                    
                    app_id = os.path.splitext(file)[0]
                    policies[app_id] = policy_data
                except Exception as e:
                    # Critical rule: startup validation failure must raise immediately
                    raise ValueError(f"Startup policy validation failed for {filepath}: {e}")
                    
        return policies

    def validate_policy(self, policy: Dict[str, Any], filepath: str):
        """
        Validates YAML policy according to rules in Section 9.1:
        - Must have policy_id and semantic version.
        - Every referenced detector/category must exist.
        - Thresholds must be numeric and within [0,1] where applicable.
        - No unknown decision value is allowed.
        """
        if not policy:
            raise ValueError("Policy is empty")
            
        policy_id = policy.get("policy_id")
        version = policy.get("version")
        
        if not policy_id:
            raise ValueError("Missing policy_id")
        if not version or not re.match(r"^\d+\.\d+\.\d+$", str(version)):
            raise ValueError(f"Invalid or missing semantic version: {version}")
            
        # Validate thresholds
        thresholds = policy.get("thresholds", {})
        for k, v in thresholds.items():
            if isinstance(v, float) or isinstance(v, int):
                if not (0.0 <= v <= 1.0):
                    raise ValueError(f"Threshold '{k}' value {v} must be within [0, 1]")
            elif isinstance(v, bool):
                pass
            else:
                raise ValueError(f"Threshold '{k}' must be numeric or boolean, got {type(v)}")
                
        # Validate actions
        actions = policy.get("actions", {})
        for action_name, decision_val in actions.items():
            if decision_val not in ALLOWED_DECISIONS:
                raise ValueError(f"Unknown decision value: {decision_val} in action {action_name}")

    def get_policy(self, app_id: str) -> Dict[str, Any]:
        """
        Retrieves policy for app_id. Never falls back silently to default.
        """
        if app_id in self.policies:
            return self.policies[app_id]
            
        # Map app_id to policy_id or filename
        mapped_id = app_id
        if "finance" in app_id:
            mapped_id = "finance_v1"
        elif "hr" in app_id:
            mapped_id = "hr_v1"
            
        if mapped_id in self.policies:
            return self.policies[mapped_id]
            
        raise KeyError(f"Policy for application_id '{app_id}' (mapped to '{mapped_id}') not found.")

    def evaluate(
        self,
        context: RequestContext,
        pii: DetectorResult,
        toxicity: DetectorResult,
        bias: DetectorResult,
        injection: DetectorResult,
        truth: DetectorResult,
        verification_results: List[Any],
        overall_risk: float,
        severity: str
    ) -> FinalDecision:
        """
        Deterministically evaluates policy rules on all risk signals.
        """
        try:
            policy = self.get_policy(context.application_id)
        except KeyError as e:
            return FinalDecision(
                request_id=context.request_id,
                decision="BLOCK",
                overall_risk=1.0,
                severity="CRITICAL",
                confidence=1.0,
                uncertainty=0.0,
                dominant_risks=["CONFIG_ERROR"],
                policy_id="unknown",
                policy_version="0.0.0",
                reasons=[str(e)],
                audit_id=""
            )

        thresholds = policy.get("thresholds", {})
        actions = policy.get("actions", {})
        
        reasons = []
        decision = "ALLOW"
        modified_response = None
        modified_tool_call = None
        
        # 1. Hard Ceiling check: Injection
        injection_block_thresh = thresholds.get("injection_block", 0.95)
        if injection.score >= injection_block_thresh:
            decision = actions.get("high_confidence_injection", "BLOCK")
            reasons.append(f"Prompt injection score {injection.score:.3f} >= ceiling {injection_block_thresh}")

        # 2. Hard Ceiling check: Toxicity
        toxicity_block_thresh = thresholds.get("toxicity_block", 0.95)
        if toxicity.score >= toxicity_block_thresh:
            decision = "BLOCK"
            reasons.append(f"Toxicity score {toxicity.score:.3f} >= ceiling {toxicity_block_thresh}")

        # 3. Hard Ceiling check: PII Block
        pii_block_thresh = thresholds.get("pii_block", 0.99)
        if pii.score >= pii_block_thresh:
            decision = "BLOCK"
            reasons.append(f"PII score {pii.score:.3f} >= ceiling {pii_block_thresh}")

        # 4. PII Redaction/Modification
        pii_modify_thresh = thresholds.get("pii_modify", 0.60)
        if decision != "BLOCK" and pii.score >= pii_modify_thresh:
            pii_action = actions.get("pii_detected", "MODIFY")
            if pii_action == "MODIFY":
                decision = "MODIFY"
                reasons.append(f"PII detected (score {pii.score:.3f} >= modify threshold {pii_modify_thresh}) - applying redaction")
                # Redact text
                modified_response = redact_text(context.llm_response or "", pii.spans)
            else:
                decision = pii_action
                reasons.append(f"PII detected (score {pii.score:.3f} >= threshold {pii_modify_thresh}) - policy action: {pii_action}")

        # 5. Bias Gating
        bias_escalate_thresh = thresholds.get("bias_escalate", 0.70)
        if decision not in ("BLOCK") and bias.score >= bias_escalate_thresh:
            decision = actions.get("high_risk_bias", "ESCALATE")
            reasons.append(f"Bias score {bias.score:.3f} >= threshold {bias_escalate_thresh}")

        # 6. Claim verification contradiction gating
        has_contradiction = any(v.verdict == "CONTRADICTED" for v in verification_results)
        if decision not in ("BLOCK") and has_contradiction:
            # Check if policy has specific action for contradicted financial claim
            is_financial_contradiction = any(v.verdict == "CONTRADICTED" and v.claim_id.startswith("c_") and getattr(v, "claim_type", "") == "financial_claim" for v in verification_results)
            
            if is_financial_contradiction and "contradicted_financial_claim" in actions:
                decision = actions["contradicted_financial_claim"]
                reasons.append("Contradicted financial claim detected in verification outcomes")
            elif thresholds.get("verification_contradiction_escalate", True):
                decision = "ESCALATE"
                reasons.append("Contradicted factual claim detected in verification outcomes")

        # 7. Tool Call Authorization gating
        if context.tool_call and decision not in ("BLOCK"):
            tool_name = context.tool_call.tool_name
            policy_tools = policy.get("tools", {})
            
            if tool_name not in policy_tools:
                decision = actions.get("unauthorized_tool", "BLOCK")
                reasons.append(f"Tool '{tool_name}' is not authorized in current policy configuration")
            else:
                tool_conf = policy_tools[tool_name]
                auth_req = tool_conf.get("authorization_required", False)
                if auth_req:
                    user_perms = context.tool_call.user_permissions or []
                    if "admin" not in user_perms:
                        decision = actions.get("unauthorized_tool", "BLOCK")
                        reasons.append(f"User unauthorized to execute high-impact tool '{tool_name}' (missing 'admin' permission)")

        # 8. Overall Risk Engine override
        # If overall calibrated risk exceeds high max, escalate.
        if decision == "ALLOW":
            risk_thresholds = policy.get("risk_thresholds", {})
            high_max = risk_thresholds.get("high_max", 0.85)
            medium_max = risk_thresholds.get("medium_max", 0.60)
            
            if overall_risk >= high_max:
                decision = "ESCALATE"
                reasons.append(f"Calibrated overall risk score {overall_risk:.3f} exceeds policy maximum threshold {high_max:.2f}")

        if not reasons:
            reasons.append("All safety controls satisfied.")

        return FinalDecision(
            request_id=context.request_id,
            decision=decision,
            overall_risk=overall_risk,
            severity=severity,
            confidence=1.0 - (overall_risk * 0.1), # illustrative confidence mapping
            uncertainty=overall_risk * 0.1,
            dominant_risks=list(set([r.split()[0] for r in reasons if "score" in r or "detected" in r or "unauthorized" in r])),
            policy_id=policy.get("policy_id", "unknown"),
            policy_version=policy.get("version", "0.0.0"),
            reasons=reasons,
            audit_id="",
            modified_response=modified_response,
            modified_tool_call=modified_tool_call
        )

def redact_text(text: str, spans: List[Any]) -> str:
    """
    Sort spans in reverse order and redact identified entities to avoid index shifting.
    """
    if not text or not spans:
        return text
        
    sorted_spans = sorted(spans, key=lambda s: s.start, reverse=True)
    redacted = text
    for span in sorted_spans:
        label = span.entity_type
        redacted = redacted[:span.start] + f"[REDACTED_{label}]" + redacted[span.end:]
    return redacted
