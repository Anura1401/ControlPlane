import logging
from typing import Dict, Any, Tuple
from app.schemas import RequestContext, DetectorResult

logger = logging.getLogger("controlplane.router")

class RiskRouter:
    """
    Decides whether expensive Tier-1 claim verification should run, 
    or if we bypass it (due to low risk or short-circuit ceilings).
    """
    def __init__(self):
        pass

    def route(
        self,
        context: RequestContext,
        policy: Dict[str, Any],
        injection_result: DetectorResult,
        toxicity_result: DetectorResult,
        bias_result: DetectorResult,
        truth_result: DetectorResult
    ) -> Tuple[bool, str]:
        """
        Gating logic for Tier-1 verification.
        
        Returns:
            Tuple[bool, str]: (deep_verification_required, routing_reason)
        """
        # Retrieve thresholds from policy (with default fallbacks)
        thresholds = policy.get("thresholds", {})
        requirements = policy.get("requirements", {})
        
        inj_ceiling = thresholds.get("injection_block", 0.95)
        tox_ceiling = thresholds.get("toxicity_block", 0.95)
        bias_threshold = thresholds.get("bias_escalate", 0.70)
        truth_threshold = thresholds.get("truth_verify", 0.50)
        
        always_verify = requirements.get("always_verify", False)
        require_evidence_for = requirements.get("require_evidence_for", [])
        
        # 1. Check Short-circuit: high confidence hard-ceiling events go straight to decisioning
        if injection_result.score >= inj_ceiling:
            reason = f"Short-circuit: Prompt injection score {injection_result.score:.2f} >= ceiling {inj_ceiling:.2f}"
            logger.info(f"request_id={context.request_id} route=SHORT_CIRCUIT reason='{reason}'")
            return False, reason
            
        if toxicity_result.score >= tox_ceiling:
            reason = f"Short-circuit: Toxicity score {toxicity_result.score:.2f} >= ceiling {tox_ceiling:.2f}"
            logger.info(f"request_id={context.request_id} route=SHORT_CIRCUIT reason='{reason}'")
            return False, reason

        # 2. Check Gating rules for Deep Verification
        if always_verify:
            reason = "Gating rule: policy.always_verify = true"
            logger.info(f"request_id={context.request_id} route=DEEP_VERIFY reason='{reason}'")
            return True, reason
            
        if truth_result.score >= truth_threshold:
            reason = f"Gating rule: truth_risk {truth_result.score:.2f} > threshold {truth_threshold:.2f}"
            logger.info(f"request_id={context.request_id} route=DEEP_VERIFY reason='{reason}'")
            return True, reason
            
        if bias_result.score >= bias_threshold:
            reason = f"Gating rule: bias_score {bias_result.score:.2f} > threshold {bias_threshold:.2f}"
            logger.info(f"request_id={context.request_id} route=DEEP_VERIFY reason='{reason}'")
            return True, reason
            
        if context.task_type in require_evidence_for:
            reason = f"Gating rule: task_type '{context.task_type}' requires evidence"
            logger.info(f"request_id={context.request_id} route=DEEP_VERIFY reason='{reason}'")
            return True, reason
            
        # If no gating rules are hit, skip verification
        reason = "Gating rule: No verification gates triggered. Risk scores are within limits."
        logger.info(f"request_id={context.request_id} route=SKIP_VERIFY reason='{reason}'")
        return False, reason
