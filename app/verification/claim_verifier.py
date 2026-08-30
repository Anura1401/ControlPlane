import time
from typing import List, Dict, Any
from app.schemas import ClaimVerificationResult, EvidenceChunk
from app.config import MOCK_ML, VERIFIER_MODEL_ID, DEVICE

_pipeline = None

def get_pipeline():
    global _pipeline
    if _pipeline is None:
        if MOCK_ML:
            _pipeline = "MOCK"
        else:
            try:
                from transformers import pipeline
                device_idx = 0 if DEVICE == "cuda" else -1
                # NLI zero-shot classification / sequence-classification pipeline
                _pipeline = pipeline(
                    "text-classification",
                    model=VERIFIER_MODEL_ID,
                    device=device_idx
                )
            except Exception as e:
                print(f"Warning: Failed to load Claim Verifier model {VERIFIER_MODEL_ID}. Falling back to MOCK. Error: {e}")
                _pipeline = "MOCK_FALLBACK"
    return _pipeline

class ClaimVerifier:
    """
    NLI-based Claim Verifier utilizing MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli.
    Classifies claim-evidence pairs as SUPPORTED, CONTRADICTED, or UNKNOWN.
    """
    
    def __init__(self):
        pass

    def _mock_verify_pair(self, claim: str, evidence: str) -> tuple:
        """
        Mock NLI classification. Returns (verdict, confidence).
        Identifies exact number/value differences for CONTRADICTED,
        exact matches for SUPPORTED, and missing facts for UNKNOWN.
        """
        claim_clean = claim.lower()
        evidence_clean = evidence.lower()
        
        # Check for numerical values in claim
        claim_nums = re_find_numbers(claim_clean)
        evidence_nums = re_find_numbers(evidence_clean)
        
        # If numbers mismatch between claim and evidence, flag contradiction
        if claim_nums and evidence_nums:
            # Check if there is a number in claim that is NOT in evidence
            # (indicating contradiction if they talk about the same subject)
            mismatch = False
            for num in claim_nums:
                if num not in evidence_nums:
                    # Verify they are talking about the same subject
                    # E.g. "revenue" or "headcount" or "acquisition"
                    keywords = ["revenue", "price", "headcount", "acquired", "acquisition", "rate", "year"]
                    if any(k in claim_clean and k in evidence_clean for k in keywords):
                        mismatch = True
                        break
            if mismatch:
                return "CONTRADICTED", 0.95
                
            # If numbers match exactly and share key subjects
            if all(num in evidence_nums for num in claim_nums):
                return "SUPPORTED", 0.98

        # Keyword matching / token overlap fallback
        claim_tokens = set(re_tokenize(claim_clean))
        evidence_tokens = set(re_tokenize(evidence_clean))
        overlap = claim_tokens.intersection(evidence_tokens)
        
        # Ignore small stop words in overlap
        meaningful_overlap = {t for t in overlap if len(t) > 3}
        meaningful_claim_tokens = {t for t in claim_tokens if len(t) > 3}
        
        if meaningful_claim_tokens and len(meaningful_overlap) / len(meaningful_claim_tokens) > 0.6:
            return "SUPPORTED", 0.85
        elif meaningful_overlap:
            return "UNKNOWN", 0.50
            
        return "UNKNOWN", 0.90

    def verify_claim(self, claim: str, evidence_list: List[EvidenceChunk]) -> ClaimVerificationResult:
        """
        Verifies a single claim against a list of evidence chunks.
        """
        if not evidence_list:
            return ClaimVerificationResult(
                claim_id="",
                claim=claim,
                evidence=[],
                retrieval_status="NONE",
                verdict="UNKNOWN",
                confidence=0.5
            )
            
        pipe = get_pipeline()
        
        results = []
        for chunk in evidence_list:
            verdict = "UNKNOWN"
            confidence = 0.5
            
            if pipe in ("MOCK", "MOCK_FALLBACK"):
                verdict, confidence = self._mock_verify_pair(claim, chunk.text)
            else:
                try:
                    # Model expects premise (evidence) and hypothesis (claim) concatenated or as pair
                    # Standard HF text-classification with pair inputs: pipe({"text": premise, "text_pair": hypothesis})
                    payload = {"text": chunk.text, "text_pair": claim}
                    res = pipe(payload)
                    
                    if res:
                        pred_label = res.get("label", "").lower()
                        pred_score = float(res.get("score", 0.5))
                        
                        # MoritzLaurer labels can be entailment, neutral, contradiction
                        # Map:
                        # entailment / supports -> SUPPORTED
                        # neutral / not_enough_info -> UNKNOWN
                        # contradiction / refutes -> CONTRADICTED
                        if "entail" in pred_label or "support" in pred_label:
                            verdict = "SUPPORTED"
                        elif "contradict" in pred_label or "refut" in pred_label:
                            verdict = "CONTRADICTED"
                        else:
                            verdict = "UNKNOWN"
                            
                        confidence = pred_score
                except Exception as e:
                    # Fallback on inference error
                    verdict, confidence = self._mock_verify_pair(claim, chunk.text)
                    confidence = min(confidence, 0.80)  # penalize confidence on fallback
                    
            results.append((verdict, confidence, chunk))
            
        # worst-case aggregation for contradictions
        # If any chunk contradicts, the verdict is CONTRADICTED.
        # If no contradictions but some are supported, the verdict is SUPPORTED.
        # Otherwise, UNKNOWN.
        contradictions = [r for r in results if r[0] == "CONTRADICTED"]
        supported = [r for r in results if r[0] == "SUPPORTED"]
        
        if contradictions:
            # Select contradiction with highest confidence
            worst_c = max(contradictions, key=lambda x: x[1])
            verdict = "CONTRADICTED"
            confidence = worst_c[1]
        elif supported:
            # Select supported with highest confidence
            best_s = max(supported, key=lambda x: x[1])
            verdict = "SUPPORTED"
            confidence = best_s[1]
        else:
            verdict = "UNKNOWN"
            confidence = 0.6  # Default confidence for unknown
            
        return ClaimVerificationResult(
            claim_id="",
            claim=claim,
            evidence=evidence_list,
            retrieval_status="FOUND",
            verdict=verdict,
            confidence=confidence
        )

# Helper functions for mock verifier
import re
def re_find_numbers(text: str) -> list:
    # Match numbers like "$1.4B", "$10B", "12,000", "2025"
    return re.findall(r"\$?\b\d+[\d,.]*[kmb]?\b", text)

def re_tokenize(text: str) -> list:
    return re.findall(r"\b\w{3,}\b", text)
