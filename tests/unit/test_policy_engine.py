import pytest
from app.engine.policy_engine import PolicyEngine
from app.schemas import RequestContext, DetectorResult

def test_policy_validation_success():
    engine = PolicyEngine()
    policy = {
        "policy_id": "test_policy",
        "version": "1.0.0",
        "thresholds": {
            "injection_block": 0.95,
            "toxicity_block": 0.95
        },
        "actions": {
            "default": "ALLOW",
            "high_confidence_injection": "BLOCK"
        }
    }
    
    # Should not raise any exception
    engine.validate_policy(policy, "test_file.yaml")

def test_policy_validation_failure_version():
    engine = PolicyEngine()
    
    # Invalid semantic version
    policy = {
        "policy_id": "test_policy",
        "version": "1.0",
        "thresholds": {},
        "actions": {}
    }
    with pytest.raises(ValueError, match="Invalid or missing semantic version"):
        engine.validate_policy(policy, "test_file.yaml")

def test_policy_validation_failure_threshold():
    engine = PolicyEngine()
    
    # Threshold outside [0, 1]
    policy = {
        "policy_id": "test_policy",
        "version": "1.0.0",
        "thresholds": {
            "injection_block": 1.5
        },
        "actions": {}
    }
    with pytest.raises(ValueError, match="must be within"):
        engine.validate_policy(policy, "test_file.yaml")

def test_policy_validation_failure_action():
    engine = PolicyEngine()
    
    # Unknown action value
    policy = {
        "policy_id": "test_policy",
        "version": "1.0.0",
        "thresholds": {},
        "actions": {
            "default": "UNKNOWN_ACTION_VALUE"
        }
    }
    with pytest.raises(ValueError, match="Unknown decision value"):
        engine.validate_policy(policy, "test_file.yaml")
