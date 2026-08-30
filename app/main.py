import logging
import random
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import (
    RequestContext,
    FinalDecision,
    EvaluationRequest,
    APIv1EvaluationResponse,
    ToolCall,
    LLMDetails,
    DetectorSummary,
    Tier0Summary,
    RiskRouterSummary,
    EvidenceSummary,
    ClaimVerificationSummary,
    Tier1Summary,
    ToolValidationSummary,
    RiskEngineSummary,
    PolicySummary
)
from app.orchestrator import PlatformOrchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

app = FastAPI(
    title="ControlPlane.ai",
    description="Enterprise AI Safety, Risk Detection & Policy Enforcement Platform",
    version="1.0.0"
)

# Enable CORS for local dashboards and external chatbot integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate orchestrator once at startup
orchestrator = None

@app.on_event("startup")
async def startup_event():
    global orchestrator
    orchestrator = PlatformOrchestrator()
    logging.info("ControlPlane.ai services initialized successfully.")

@app.post("/evaluate", response_model=FinalDecision)
async def evaluate(req: RequestContext) -> FinalDecision:
    """
    Evaluates request context safety risk policies and returns final decision (ALLOW, MODIFY, ESCALATE, BLOCK).
    Used by existing unit test suites and integration files.
    """
    if orchestrator is None:
        raise HTTPException(status_code=503, detail="Governance engine is not ready.")
    try:
        decision = await orchestrator.execute(req)
        return decision
    except Exception as e:
        logging.error(f"Error evaluating request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Governance evaluation failure: {str(e)}")

@app.post("/api/v1/evaluate", response_model=APIv1EvaluationResponse)
async def evaluate_v1(req: EvaluationRequest) -> APIv1EvaluationResponse:
    """
    Model-agnostic evaluation API endpoint for enterprise chatbot integration.
    """
    if orchestrator is None:
        raise HTTPException(status_code=503, detail="Governance engine is not ready.")
    try:
        request_id = f"CP-{random.randint(10000, 99999)}"
        
        # Parse task type dynamically based on app ID to select context baselines
        app_id_lower = req.application_id.lower()
        if "finance" in app_id_lower:
            task_type = "financial_qa"
        elif "hr" in app_id_lower:
            task_type = "hiring_decision"
        else:
            task_type = "general_qa"
            
        tool_call_obj = None
        if req.tool_action:
            tool_call_obj = ToolCall(
                tool_name=req.tool_action.get("tool_name", ""),
                arguments=req.tool_action.get("arguments", {}),
                user_role="user",
                user_permissions=[]
            )
            
        ctx = RequestContext(
            request_id=request_id,
            application_id=req.application_id,
            policy_id=req.policy_id,
            task_type=task_type,
            user_prompt=req.user_prompt,
            llm_response=req.llm_response,
            tool_call=tool_call_obj,
            generate_with_llm=req.generate_with_llm or False
        )
        
        # Run orchestrator
        dec = await orchestrator.execute(ctx)
        
        # Helper mappings for response contracts
        llm_details = None
        if req.generate_with_llm:
            llm_details = LLMDetails(
                provider=getattr(dec, "llm_provider", "gemini"),
                model=getattr(dec, "llm_model", "gemini-1.5-flash"),
                response=dec.modified_response if dec.decision == "MODIFY" and dec.modified_response else (dec.llm_response_text or ""),
                input_tokens=getattr(dec, "llm_input_tokens", 0),
                output_tokens=getattr(dec, "llm_output_tokens", 0),
                latency_ms=getattr(dec, "llm_latency_ms", 0)
            )
        else:
            llm_details = LLMDetails(
                provider="external",
                model="unknown",
                response=dec.modified_response if dec.decision == "MODIFY" and dec.modified_response else (req.llm_response or ""),
                input_tokens=0,
                output_tokens=0,
                latency_ms=0
            )
            
        def map_detector(det_res) -> DetectorSummary:
            if not det_res:
                return DetectorSummary(score=0.0, severity="LOW", detected=False)
            score = float(det_res.score)
            severity = "LOW"
            if score >= 0.85:
                severity = "HIGH"
            elif score >= 0.50:
                severity = "MEDIUM"
            return DetectorSummary(
                score=score,
                severity=severity,
                detected=bool(score >= det_res.threshold_used),
                details=det_res.categories
            )

        t0_sum = Tier0Summary(
            pii=map_detector(getattr(dec, "pii_res", None)),
            injection=map_detector(getattr(dec, "inj_res", None)),
            toxicity=map_detector(getattr(dec, "tox_res", None)),
            bias=map_detector(getattr(dec, "bias_res", None)),
            truth=map_detector(getattr(dec, "truth_res", None))
        )
        
        router_sum = RiskRouterSummary(
            tier_1_required=bool(getattr(dec, "deep_verify", False)),
            reason=[getattr(dec, "gating_reason", "")] if getattr(dec, "gating_reason", None) else []
        )
        
        v_results = getattr(dec, "verification_results", [])
        claims_list = [v.claim for v in v_results]
        
        verifications = []
        evidence_list = []
        for v in v_results:
            ev_summaries = []
            for ev in v.evidence:
                ev_sum = EvidenceSummary(
                    document_id=ev.document_id,
                    text=ev.text,
                    similarity=float(ev.similarity)
                )
                ev_summaries.append(ev_sum)
                if not any(e.document_id == ev.document_id for e in evidence_list):
                    evidence_list.append(ev_sum)
                    
            verifications.append(ClaimVerificationSummary(
                claim_id=v.claim_id,
                claim=v.claim,
                verdict=v.verdict,
                confidence=float(v.confidence),
                evidence=ev_summaries
            ))
            
        t1_sum = Tier1Summary(
            claims=claims_list,
            verification=verifications,
            evidence=evidence_list
        )
        
        action_val = None
        act_res = getattr(dec, "action_res", None)
        if act_res and req.tool_action:
            action_val = ToolValidationSummary(
                authorized=bool(act_res.get("authorization_status") == "AUTHORIZED"),
                risk=float(act_res.get("action_risk", 0.0)),
                reason=[f"Action '{req.tool_action.get('tool_name')}' status is {act_res.get('authorization_status')}. Impact: {act_res.get('impact')}."]
            )
            
        risk_score = float(dec.overall_risk)
        risk_level = "LOW"
        if risk_score >= 0.85:
            risk_level = "HIGH"
        elif risk_score >= 0.30:
            risk_level = "MEDIUM"
            
        explanations = []
        features_dict = getattr(dec, "features", {})
        if features_dict:
            for feat, val in features_dict.items():
                if val > 0.4:
                    explanations.append(f"{feat} feature value: {val:.2f}")
                    
        risk_sum = RiskEngineSummary(
            risk_score=risk_score,
            risk_level=risk_level,
            explanations=explanations
        )
        
        policy_sum = PolicySummary(
            policy_id=dec.policy_id,
            triggered_rules=[]
        )
        if dec.decision != "ALLOW":
            policy_sum.triggered_rules.append({
                "rule_id": dec.policy_id,
                "decision": dec.decision,
                "reason": ", ".join(dec.reasons)
            })
            
        final_resp_text = dec.modified_response if dec.decision == "MODIFY" and dec.modified_response else (dec.llm_response_text or req.llm_response or "")

        return APIv1EvaluationResponse(
            request_id=dec.request_id,
            application_id=req.application_id,
            policy_id=dec.policy_id,
            llm=llm_details,
            tier_0=t0_sum,
            risk_router=router_sum,
            tier_1=t1_sum,
            action_validation=action_val,
            risk_engine=risk_sum,
            policy=policy_sum,
            decision=dec.decision,
            final_response=final_resp_text,
            audit_id=dec.audit_id
        )
    except Exception as e:
        logging.error(f"Error evaluating V1 request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Governance evaluation failure: {str(e)}")

@app.get("/health")
async def health():
    """
    Returns platform health status.
    """
    return {"status": "ok", "service": "ControlPlane.ai", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
