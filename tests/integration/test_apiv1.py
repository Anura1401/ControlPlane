import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_apiv1_evaluate_external_response_allow():
    with TestClient(app) as client:
        payload = {
            "application_id": "finance_support",
            "policy_id": "Finance-v2",
            "user_prompt": "Define compounding interest.",
            "llm_response": "Compounding interest is interest calculated on the initial principal and accumulated interest.",
            "generate_with_llm": False
        }
        response = client.post("/api/v1/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["decision"] == "ALLOW"
        assert data["application_id"] == "finance_support"
        assert data["policy_id"] == "finance_v1"
        assert "compounding interest" in data["final_response"].lower()

def test_apiv1_evaluate_external_response_redact():
    with TestClient(app) as client:
        payload = {
            "application_id": "default",
            "policy_id": "default",
            "user_prompt": "How do I dispute my invoice?",
            "llm_response": "Please email dispute-desk_99@billing-support.net to request review.",
            "generate_with_llm": False
        }
        response = client.post("/api/v1/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["decision"] == "MODIFY"
        assert "[REDACTED_EMAIL]" in data["final_response"]

def test_apiv1_evaluate_gemini_generation():
    with TestClient(app) as client:
        payload = {
            "application_id": "finance_support",
            "policy_id": "Finance-v2",
            "user_prompt": "What is compounding interest?",
            "generate_with_llm": True
        }
        response = client.post("/api/v1/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["decision"] == "ALLOW"
        assert data["llm"]["provider"] == "gemini"
        assert "compound interest" in data["final_response"].lower() or "compounding interest" in data["final_response"].lower()

def test_apiv1_evaluate_tool_action_block():
    with TestClient(app) as client:
        payload = {
            "application_id": "finance_support",
            "policy_id": "Finance-v2",
            "user_prompt": "Remove this item.",
            "tool_action": {
                "tool_name": "delete_record",
                "arguments": {"id": "L_99182"}
            },
            "generate_with_llm": False
        }
        response = client.post("/api/v1/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["decision"] == "BLOCK"
        assert data["action_validation"] is not None
        assert data["action_validation"]["authorized"] is False
        assert data["action_validation"]["risk"] >= 0.8
