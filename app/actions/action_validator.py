from typing import Dict, Any, Optional
from app.schemas import RequestContext, ToolCall

# Default static registry mapping tool names to security characteristics
TOOL_REGISTRY = {
    "send_email": {
        "impact": "high",
        "reversible": False,
        "sensitivity": "medium",
        "authorization_required": True,
        "required_permission": "admin"
    },
    "delete_record": {
        "impact": "critical",
        "reversible": False,
        "sensitivity": "high",
        "authorization_required": True,
        "required_permission": "admin"
    },
    "read_public_data": {
        "impact": "low",
        "reversible": True,
        "sensitivity": "low",
        "authorization_required": False,
        "required_permission": None
    }
}

class ActionValidator:
    """
    Validates tool/action calls against static security policies.
    """
    def __init__(self, registry: Optional[Dict[str, Dict[str, Any]]] = None):
        self.registry = registry or TOOL_REGISTRY

    def validate(self, context: RequestContext) -> Dict[str, Any]:
        """
        Validates the proposed tool call.
        
        Returns:
            Dict: action_risk, impact, reversibility, sensitivity, authorization_status
        """
        if not context.tool_call:
            return {
                "action_risk": 0.0,
                "impact": "none",
                "reversibility": True,
                "sensitivity": "none",
                "authorization_status": "NOT_APPLICABLE"
            }
            
        tool_name = context.tool_call.tool_name
        
        # Check if tool is registered
        if tool_name not in self.registry:
            return {
                "action_risk": 1.0,
                "impact": "unknown",
                "reversibility": False,
                "sensitivity": "critical",
                "authorization_status": "UNAUTHORIZED"  # Unknown tools are blocked by default (fail-closed)
            }
            
        spec = self.registry[tool_name]
        
        impact = spec["impact"]
        reversible = spec["reversible"]
        sensitivity = spec["sensitivity"]
        auth_req = spec["authorization_required"]
        req_perm = spec["required_permission"]
        
        # Calculate numerical action risk score
        risk_map = {"low": 0.1, "medium": 0.4, "high": 0.8, "critical": 1.0}
        action_risk = risk_map.get(impact, 0.5)
        if not reversible:
            action_risk = min(1.0, action_risk + 0.1)
            
        # Check authorization
        auth_status = "AUTHORIZED"
        if auth_req and req_perm:
            user_perms = context.tool_call.user_permissions or []
            if req_perm not in user_perms and "admin" not in user_perms:
                auth_status = "UNAUTHORIZED"
                action_risk = 1.0  # Elevate risk to maximum on auth failure
                
        return {
            "action_risk": float(action_risk),
            "impact": impact,
            "reversibility": reversible,
            "sensitivity": sensitivity,
            "authorization_status": auth_status
        }
