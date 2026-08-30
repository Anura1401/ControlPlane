from app.schemas import RequestContext, DetectorResult, FinalDecision, ToolCall, OperationsMetrics

def test_request_context_validation():
    data = {
        "request_id": "req_123",
        "application_id": "finance_support",
        "task_type": "financial_qa",
        "user_prompt": "What is the acquisition price?",
        "llm_response": "Company X acquired Company Y for $1.4B in 2025.",
        "operations": {
            "input_tokens": 100,
            "output_tokens": 50,
            "latency_ms": 200,
            "retries": 0,
            "estimated_cost": 0.0001
        }
    }
    
    ctx = RequestContext(**data)
    assert ctx.request_id == "req_123"
    assert ctx.operations.input_tokens == 100
    assert ctx.tool_call is None

def test_detector_result_validation():
    data = {
        "detector": "pii",
        "model_id": "piiranha",
        "model_version": "1.0.0",
        "score": 0.95,
        "threshold_used": 0.60,
        "categories": ["EMAIL"],
        "spans": [{"start": 10, "end": 20, "entity_type": "EMAIL", "text": "test@test.com"}],
        "status": "OK",
        "latency_ms": 15
    }
    
    res = DetectorResult(**data)
    assert res.detector == "pii"
    assert res.score == 0.95
    assert len(res.spans) == 1
    assert res.spans[0].text == "test@test.com"

def test_final_decision_validation():
    data = {
        "request_id": "req_123",
        "decision": "BLOCK",
        "overall_risk": 0.99,
        "severity": "CRITICAL",
        "confidence": 0.99,
        "uncertainty": 0.01,
        "dominant_risks": ["INJECTION"],
        "policy_id": "finance_v1",
        "policy_version": "1.0.0",
        "reasons": ["High prompt injection risk"],
        "audit_id": "audit_123"
    }
    
    decision = FinalDecision(**data)
    assert decision.decision == "BLOCK"
    assert decision.overall_risk == 0.99
    assert "INJECTION" in decision.dominant_risks
