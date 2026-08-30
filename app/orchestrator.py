import asyncio
import logging
from typing import Dict, Any, List
from app.schemas import RequestContext, DetectorResult, FinalDecision, ClaimVerificationResult
from app.detectors.pii_detector import PIIDetector
from app.detectors.toxicity_detector import ToxicityDetector
from app.detectors.bias_detector import BiasDetector
from app.detectors.injection_detector import InjectionDetector
from app.detectors.truth_lane import TruthLane
from app.retrieval.retriever import Retriever
from app.verification.claim_extractor import ClaimExtractor
from app.verification.claim_verifier import ClaimVerifier
from app.operations.cost_baseline import CostBaseline
from app.actions.action_validator import ActionValidator
from app.engine.risk_router import RiskRouter
from app.engine.risk_engine import RiskEngine
from app.engine.policy_engine import PolicyEngine
from app.engine.audit import AuditLogger

logger = logging.getLogger("controlplane.orchestrator")

class PlatformOrchestrator:
    """
    End-to-end platform coordinator executing Tier-0 safety, Tier-1 verification gating,
    Action validation, Risk/Policy evaluations, re-runs on modifications, and audit logging.
    """
    def __init__(self):
        self.pii_detector = PIIDetector()
        self.toxicity_detector = ToxicityDetector()
        self.bias_detector = BiasDetector()
        self.injection_detector = InjectionDetector()
        self.truth_lane = TruthLane()
        
        self.retriever = Retriever()
        self.claim_extractor = ClaimExtractor()
        self.claim_verifier = ClaimVerifier()
        
        self.cost_baseline = CostBaseline()
        self.action_validator = ActionValidator()
        self.risk_router = RiskRouter()
        self.risk_engine = RiskEngine()
        self.policy_engine = PolicyEngine()
        self.audit_logger = AuditLogger()

    async def execute(self, context: RequestContext) -> FinalDecision:
        """
        Coordinates full governance checks on request.
        """
        # Resolve policy first to attach policy_id & policy_version
        try:
            policy = self.policy_engine.get_policy(context.application_id)
            context.policy_id = policy.get("policy_id")
            context.policy_version = policy.get("version")
        except Exception as e:
            # Config error - fail closed
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
                reasons=[f"Configuration Error: {str(e)}"],
                audit_id=""
            )

        # 1. Run Tier-0 Responsibility Detectors concurrently
        pii_task = asyncio.to_thread(self.pii_detector.detect, context)
        tox_task = asyncio.to_thread(self.toxicity_detector.detect, context)
        bias_task = asyncio.to_thread(self.bias_detector.detect, context)
        inj_task = asyncio.to_thread(self.injection_detector.detect, context)
        truth_task = asyncio.to_thread(self.truth_lane.detect, context)
        
        pii_res, tox_res, bias_res, inj_res, truth_res = await asyncio.gather(
            pii_task, tox_task, bias_task, inj_task, truth_task
        )
        
        # 2. Run Operations monitor & Action validator
        cost_meta = self.cost_baseline.update_and_calculate_anomaly(
            context.application_id, context.task_type, context.operations.estimated_cost
        )
        cost_anomaly_score = cost_meta.get("cost_anomaly_score", 0.0)
        
        action_res = self.action_validator.validate(context)
        
        # 3. Risk Gating
        deep_verify, gating_reason = self.risk_router.route(
            context, policy, inj_res, tox_res, bias_res, truth_res
        )
        
        verification_results: List[ClaimVerificationResult] = []
        retrieval_status = "NONE"
        
        # Check if deep verification is required
        if deep_verify and context.llm_response:
            claims = self.claim_extractor.extract(context.llm_response)
            if not claims:
                retrieval_status = "NO_CLAIMS"
            else:
                retrieval_status = "FOUND"
                # Parse policy retrieval thresholds
                sim_threshold = policy.get("thresholds", {}).get("retrieval_min_similarity", 0.65)
                
                # Verify each claim
                for claim_dict in claims:
                    # Retrieve matching passages
                    evidence_chunks = self.retriever.retrieve(
                        claim_dict["text"], threshold=sim_threshold
                    )
                    
                    # Verify using NLI
                    v_res = self.claim_verifier.verify_claim(claim_dict["text"], evidence_chunks)
                    v_res.claim_id = claim_dict["claim_id"]
                    verification_results.append(v_res)
                    
        # 4. Evaluate overall calibrated risk
        features = self.risk_engine.compile_features(
            context=context,
            pii=pii_res,
            toxicity=tox_res,
            bias=bias_res,
            injection=inj_res,
            truth=truth_res,
            verification_results=verification_results,
            cost_anomaly=cost_anomaly_score
        )
        
        overall_risk, severity, confidence, dominant_risks = self.risk_engine.evaluate(features)
        
        # 5. Evaluate policy actions
        decision_record = self.policy_engine.evaluate(
            context=context,
            pii=pii_res,
            toxicity=tox_res,
            bias=bias_res,
            injection=inj_res,
            truth=truth_res,
            verification_results=verification_results,
            overall_risk=overall_risk,
            severity=severity
        )
        
        # 6. Re-run flow if output is modified
        # "MODIFY re-runs safety detectors before release. Never trust a rewrite without re-evaluation."
        if decision_record.decision == "MODIFY" and decision_record.modified_response:
            logger.info(f"request_id={context.request_id} action=MODIFY rewrite_re_evaluation=START")
            
            # Create a modified request context
            mod_ctx = RequestContext(
                request_id=context.request_id,
                application_id=context.application_id,
                policy_id=context.policy_id,
                policy_version=context.policy_version,
                task_type=context.task_type,
                user_prompt=context.user_prompt,
                retrieved_context=context.retrieved_context,
                llm_response=decision_record.modified_response,
                tool_call=context.tool_call,
                operations=context.operations
            )
            
            # Re-run detectors
            m_pii_task = asyncio.to_thread(self.pii_detector.detect, mod_ctx)
            m_tox_task = asyncio.to_thread(self.toxicity_detector.detect, mod_ctx)
            m_bias_task = asyncio.to_thread(self.bias_detector.detect, mod_ctx)
            m_inj_task = asyncio.to_thread(self.injection_detector.detect, mod_ctx)
            
            m_pii, m_tox, m_bias, m_inj = await asyncio.gather(
                m_pii_task, m_tox_task, m_bias_task, m_inj_task
            )
            
            # Re-compile features
            m_features = self.risk_engine.compile_features(
                context=mod_ctx,
                pii=m_pii,
                toxicity=m_tox,
                bias=m_bias,
                injection=m_inj,
                truth=truth_res, # reuse truth
                verification_results=verification_results, # reuse verification
                cost_anomaly=cost_anomaly_score
            )
            
            m_overall_risk, m_severity, m_confidence, m_dominant_risks = self.risk_engine.evaluate(m_features)
            
            # Re-evaluate policy
            final_decision = self.policy_engine.evaluate(
                context=mod_ctx,
                pii=m_pii,
                toxicity=m_tox,
                bias=m_bias,
                injection=m_inj,
                truth=truth_res,
                verification_results=verification_results,
                overall_risk=m_overall_risk,
                severity=m_severity
            )
            # Make sure it keeps the redacted text and decision code is MODIFY if rewrite is safe
            final_decision.modified_response = decision_record.modified_response
            if final_decision.decision == "ALLOW":
                final_decision.decision = "MODIFY"
            decision_record = final_decision
            
        # 7. Audit log writing
        audit_record = {
            "application_id": context.application_id,
            "policy_id": context.policy_id,
            "policy_version": context.policy_version,
            "decision": decision_record.decision,
            "overall_risk": decision_record.overall_risk,
            "severity": decision_record.severity,
            "confidence": decision_record.confidence,
            "reasons": decision_record.reasons,
            "detector_scores": {
                "pii": pii_res.score,
                "toxicity": tox_res.score,
                "bias": bias_res.score,
                "injection": inj_res.score,
                "truth": truth_res.score,
                "cost_anomaly": cost_anomaly_score
            },
            "gating": {
                "deep_verify_required": deep_verify,
                "reason": gating_reason,
                "retrieval_status": retrieval_status
            },
            "features": features,
            "claims_verified": [
                {
                    "claim": v.claim,
                    "verdict": v.verdict,
                    "confidence": v.confidence,
                    "evidence_count": len(v.evidence)
                } for v in verification_results
            ]
        }
        
        audit_hash = self.audit_logger.write_audit_record(context.request_id, audit_record)
        decision_record.audit_id = f"sha256-{audit_hash}"
        
        return decision_record
