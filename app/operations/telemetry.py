import time
from typing import Dict, Any
from app.schemas import OperationsMetrics

class TelemetryTracker:
    """
    Utility for tracking prompt and output tokens, latency, cost, and retries.
    """
    def __init__(self):
        pass

    @staticmethod
    def calculate_cost(input_tokens: int, output_tokens: int, provider_model: str) -> float:
        """
        Estimate costs based on token count and model provider.
        """
        # Default rate per 1M tokens
        input_rate = 0.15 / 1000000
        output_rate = 0.60 / 1000000
        
        provider_model_lower = provider_model.lower()
        if "gpt-4" in provider_model_lower:
            input_rate = 5.00 / 1000000
            output_rate = 15.00 / 1000000
        elif "claude-3-opus" in provider_model_lower:
            input_rate = 15.00 / 1000000
            output_rate = 75.00 / 1000000
        elif "claude-3-sonnet" in provider_model_lower:
            input_rate = 3.00 / 1000000
            output_rate = 15.00 / 1000000
            
        cost = (input_tokens * input_rate) + (output_tokens * output_rate)
        return float(cost)

    @staticmethod
    def create_metrics(input_tokens: int, output_tokens: int, latency_ms: int, retries: int, provider_model: str = "default") -> OperationsMetrics:
        cost = TelemetryTracker.calculate_cost(input_tokens, output_tokens, provider_model)
        return OperationsMetrics(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            retries=retries,
            estimated_cost=cost
        )
