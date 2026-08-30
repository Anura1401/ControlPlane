import time
from typing import List
from app.detectors.base import BaseDetector
from app.schemas import RequestContext, DetectorResult
from app.config import MOCK_ML, INJECTION_MODEL_ID, DEVICE

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
                _pipeline = pipeline(
                    "text-classification",
                    model=INJECTION_MODEL_ID,
                    device=device_idx
                )
            except Exception as e:
                print(f"Warning: Failed to load Prompt Injection model {INJECTION_MODEL_ID}. Falling back to MOCK. Error: {e}")
                _pipeline = "MOCK_FALLBACK"
    return _pipeline

class InjectionDetector(BaseDetector):
    """
    Prompt Injection detector using protectai/deberta-v3-base-prompt-injection-v2.
    Evaluates prompt, retrieved documents, tool outputs, and external content.
    """
    
    def __init__(self):
        pass

    def _mock_detect(self, texts: List[str]) -> float:
        # Check surfaces for common injection attack signatures
        injection_indicators = [
            "ignore previous instructions",
            "ignore the above instructions",
            "ignore previous rules",
            "ignore the security rules",
            "system override",
            "system prompt",
            "you are now a",
            "bypass safety",
            "jailbreak",
            "dan mode",
            "do anything now",
            "reveal your rules",
            "forget your policy",
            "overwrite instructions"
        ]
        
        max_prob = 0.01
        for text in texts:
            if not text:
                continue
            text_lower = text.lower()
            for indicator in injection_indicators:
                if indicator in text_lower:
                    max_prob = max(max_prob, 0.98)
                    break
        return max_prob

    def detect(self, context: RequestContext) -> DetectorResult:
        start_time = time.time()
        
        # Collect all surfaces that can be influenced by attackers
        surfaces = []
        if context.user_prompt:
            surfaces.append(("prompt", context.user_prompt))
        if context.retrieved_context:
            for i, doc in enumerate(context.retrieved_context):
                surfaces.append((f"retrieved_context_{i}", doc))
        if context.tool_call:
            surfaces.append(("tool_call", str(context.tool_call.arguments)))
            
        if not surfaces:
            return DetectorResult(
                detector="injection",
                model_id=INJECTION_MODEL_ID,
                model_version="1.0.0" if not MOCK_ML else "mock-1.0.0",
                score=0.0,
                threshold_used=0.0,
                categories=[],
                spans=[],
                status="OK",
                latency_ms=0
            )

        pipe = get_pipeline()
        status = "OK"
        model_version = "deberta-v3-base-prompt-injection-v2"
        max_prob = 0.0
        flagged_categories = []
        
        try:
            if pipe in ("MOCK", "MOCK_FALLBACK"):
                max_prob = self._mock_detect([text for _, text in surfaces])
                model_version = "mock-injection-detector"
            else:
                model_version = getattr(pipe.model.config, "_name_or_path", INJECTION_MODEL_ID)
                # Run pipeline on each surface and take the max score for injection label
                # protectai model has labels: INJECTION and SAFE (or injection/safe or similar)
                for source_name, text in surfaces:
                    # Truncate text to avoid model context issues
                    truncated_text = text[:1024]
                    res = pipe(truncated_text)
                    if isinstance(res, list) and len(res) > 0:
                        pred = res[0]
                        label = pred.get("label", "").upper()
                        score = float(pred.get("score", 0.0))
                        
                        # Calculate injection score
                        # Some versions output INJECTION and SAFE. If SAFE, injection score = 1 - score.
                        if "INJECTION" in label:
                            inj_score = score
                        elif "SAFE" in label or "BENIGN" in label:
                            inj_score = 1.0 - score
                        else:
                            # Fallback if label is index-based or other label
                            inj_score = score if label == "LABEL_1" else (1.0 - score)
                            
                        if inj_score > max_prob:
                            max_prob = inj_score
                            flagged_categories = [f"{source_name}:{inj_score:.4f}"]
        except Exception as e:
            max_prob = self._mock_detect([text for _, text in surfaces])
            status = "ERROR"
            model_version = f"error-fallback-heuristic: {str(e)[:50]}"
            
        latency = int((time.time() - start_time) * 1000)
        
        return DetectorResult(
            detector="injection",
            model_id=INJECTION_MODEL_ID,
            model_version=model_version,
            score=max_prob,
            threshold_used=0.0,  # to be filled by Policy
            categories=flagged_categories,
            spans=[],
            status=status,
            latency_ms=latency
        )
