import time
from typing import List, Dict, Any
from app.detectors.base import BaseDetector
from app.schemas import RequestContext, DetectorResult
from app.config import MOCK_ML, TOXICITY_MODEL_ID, DEVICE

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
                # toxic-bert outputs multi-label predictions
                _pipeline = pipeline(
                    "text-classification",
                    model=TOXICITY_MODEL_ID,
                    top_k=None,
                    device=device_idx
                )
            except Exception as e:
                print(f"Warning: Failed to load Toxicity model {TOXICITY_MODEL_ID}. Falling back to MOCK. Error: {e}")
                _pipeline = "MOCK_FALLBACK"
    return _pipeline

class ToxicityDetector(BaseDetector):
    """
    Multi-label safety and toxicity detector using unitary/toxic-bert.
    """
    
    def __init__(self):
        pass

    def _mock_detect(self, text: str) -> List[Dict[str, Any]]:
        # Hardcoded dictionary for basic rule-based testing
        keywords = {
            "kill": ("threat", 0.98),
            "destroy": ("threat", 0.85),
            "hate": ("identity_hate", 0.90),
            "obscene": ("obscene", 0.95),
            "insult": ("insult", 0.80),
            "toxic": ("toxic", 0.85),
            "idiot": ("insult", 0.92),
            "asshole": ("obscene", 0.99),
        }
        
        scores = {
            "toxic": 0.01,
            "severe_toxic": 0.001,
            "obscene": 0.01,
            "threat": 0.001,
            "insult": 0.01,
            "identity_hate": 0.001
        }
        
        # Check text for matches
        text_lower = text.lower()
        for word, (label, val) in keywords.items():
            if word in text_lower:
                scores[label] = max(scores[label], val)
                scores["toxic"] = max(scores["toxic"], min(0.99, val * 0.9))
                if val > 0.9:
                    scores["severe_toxic"] = max(scores["severe_toxic"], val * 0.8)
                    
        return [{"label": k, "score": v} for k, v in scores.items()]

    def detect(self, context: RequestContext) -> DetectorResult:
        start_time = time.time()
        
        # Run on response text, optionally user prompt
        surfaces = []
        if context.llm_response:
            surfaces.append(context.llm_response)
        if context.user_prompt:
            # Optionally check prompt
            surfaces.append(context.user_prompt)
            
        combined_text = " ".join(surfaces) if surfaces else ""
        
        if not combined_text:
            return DetectorResult(
                detector="toxicity",
                model_id=TOXICITY_MODEL_ID,
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
        model_version = "toxic-bert"
        
        try:
            if pipe in ("MOCK", "MOCK_FALLBACK"):
                predictions = self._mock_detect(combined_text)
                model_version = "mock-toxic-bert"
            else:
                # Transformers pipeline with top_k=None returns list of dicts: [{'label': ..., 'score': ...}, ...]
                res = pipe(combined_text)
                if isinstance(res, list) and len(res) > 0:
                    if isinstance(res[0], list):
                        predictions = res[0]
                    else:
                        predictions = res
                else:
                    predictions = []
                model_version = getattr(pipe.model.config, "_name_or_path", TOXICITY_MODEL_ID)
        except Exception as e:
            predictions = self._mock_detect(combined_text)
            status = "ERROR"
            model_version = f"error-fallback-keyword: {str(e)[:50]}"
            
        categories = []
        max_score = 0.0
        
        # Aggregate scores. For toxic-bert, labels are: toxic, severe_toxic, obscene, threat, insult, identity_hate.
        for pred in predictions:
            label = pred.get("label", "").lower()
            score = float(pred.get("score", 0.0))
            # Format categories list as key=val
            categories.append(f"{label}:{score:.4f}")
            if score > max_score:
                max_score = score
                
        latency = int((time.time() - start_time) * 1000)
        
        return DetectorResult(
            detector="toxicity",
            model_id=TOXICITY_MODEL_ID,
            model_version=model_version,
            score=max_score,
            threshold_used=0.0,  # policy set
            categories=categories,
            spans=[],
            status=status,
            latency_ms=latency
        )
