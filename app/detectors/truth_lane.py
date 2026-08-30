import time
import re
from app.detectors.base import BaseDetector
from app.schemas import RequestContext, DetectorResult

class TruthLane(BaseDetector):
    """
    Heuristic Truth-Risk gate (No ML).
    Calculates truth_risk based on evidence availability, claim-like language,
    and uncertainty/hedging heuristics.
    """
    
    def __init__(self):
        pass

    def detect(self, context: RequestContext) -> DetectorResult:
        start_time = time.time()
        
        response_text = context.llm_response or ""
        
        # Heuristic 1: Uncertainty / Hedging words
        uncertainty_keywords = [
            r"\bmaybe\b", r"\bperhaps\b", r"\bprobably\b", r"\bpossibly\b", 
            r"\bunsure\b", r"\bnot sure\b", r"\bapproximate(ly)?\b", r"\bmight\b",
            r"\bI believe\b", r"\bI think\b", r"\bconditional(ly)?\b"
        ]
        uncertainty_count = 0
        for kw in uncertainty_keywords:
            if re.search(kw, response_text, re.IGNORECASE):
                uncertainty_count += 1
                
        # Heuristic 2: Claim-like/Factual indicators (numbers, dates, names, currency)
        # Numbers: e.g. "$1.4B", "12,000", "2025"
        has_numbers = bool(re.search(r"\b\d+[\d,.]*\b", response_text))
        has_currency = bool(re.search(r"[\$\£\€\¥]\s?\d+", response_text))
        has_fact_keywords = bool(re.search(r"\b(acquired|revenue|headcount|fiscal|profit|loss|price|agreed|contract|policy)\b", response_text, re.IGNORECASE))
        
        # Heuristic 3: Evidence context availability
        # If retrieved context is missing or empty, it increases risk for facts
        has_evidence = len(context.retrieved_context) > 0
        
        # Score calculation
        # Baseline
        score = 0.1
        
        # If it sounds like a claim (has numbers, currency, or factual keywords)
        if has_numbers or has_currency or has_fact_keywords:
            score += 0.3
            
        # If it contains uncertainty hedging
        if uncertainty_count > 0:
            score += min(0.3, uncertainty_count * 0.15)
            
        # If claims are present but there is no grounding retrieved context
        if (has_numbers or has_currency) and not has_evidence:
            score += 0.3
            
        score = min(1.0, max(0.0, score))
        
        categories = []
        if has_numbers or has_currency:
            categories.append("numerical_claims")
        if uncertainty_count > 0:
            categories.append("hedging_present")
        if not has_evidence:
            categories.append("no_grounding_context")
            
        latency = int((time.time() - start_time) * 1000)
        
        return DetectorResult(
            detector="truth",
            model_id="heuristic-truth-lane",
            model_version="1.0.0",
            score=score,
            threshold_used=0.0,  # to be filled by Policy
            categories=categories,
            spans=[],
            status="OK",
            latency_ms=latency
        )
