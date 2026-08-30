import time
import re
from typing import List, Dict, Any
from app.detectors.base import BaseDetector
from app.schemas import RequestContext, DetectorResult, DetectorSpan
from app.config import MOCK_ML, BIAS_MODEL_ID, DEVICE

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
                    model=BIAS_MODEL_ID,
                    device=device_idx
                )
            except Exception as e:
                print(f"Warning: Failed to load Bias model {BIAS_MODEL_ID}. Falling back to MOCK. Error: {e}")
                _pipeline = "MOCK_FALLBACK"
    return _pipeline

class BiasDetector(BaseDetector):
    """
    Decision-context bias detector classifying legitimate criterion vs proxy/discriminatory reasoning.
    Categorizes bias such as gender, age, disability, ethnicity/race, or socioeconomic proxy.
    """
    
    def __init__(self):
        pass

    def _mock_detect(self, text: str) -> Dict[str, Any]:
        # Simple high-quality rules for decision-context bias detection
        rules = [
            (r"\bmaternity leave\b", "gender", "pregnancy/gender proxy bias"),
            (r"\bover 50\b", "age", "age retirement proxy bias"),
            (r"\bretire soon\b", "age", "age retirement proxy bias"),
            (r"\blower-income neighborhood\b", "socioeconomic", "geographical socioeconomic proxy bias"),
            (r"\bzip code\b", "socioeconomic", "geographical proxy bias"),
            (r"\bdisabled\b", "disability", "disability bias")
        ]
        
        max_score = 0.05
        categories = []
        spans = []
        
        for pattern, cat, description in rules:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                max_score = max(max_score, 0.95)
                categories.append(f"{cat}:{description}")
                spans.append(DetectorSpan(
                    start=match.start(),
                    end=match.end(),
                    entity_type=cat,
                    text=match.group()
                ))
                
        # If it contains decision words combined with discriminatory attributes, confirm bias
        if "reject" in text.lower() or "deny" in text.lower():
            if categories:
                max_score = max(max_score, 0.98)
                
        return {
            "score": max_score,
            "categories": categories,
            "spans": spans
        }

    def detect(self, context: RequestContext) -> DetectorResult:
        start_time = time.time()
        
        # Bias checks LLM responses in decision context
        text_to_check = context.llm_response or ""
        
        if not text_to_check:
            return DetectorResult(
                detector="bias",
                model_id=BIAS_MODEL_ID,
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
        model_version = "distilbert-bias"
        
        score = 0.0
        categories = []
        spans = []
        
        try:
            if pipe in ("MOCK", "MOCK_FALLBACK"):
                mock_res = self._mock_detect(text_to_check)
                score = mock_res["score"]
                categories = mock_res["categories"]
                spans = mock_res["spans"]
                model_version = "mock-bias-detector"
            else:
                model_version = getattr(pipe.model.config, "_name_or_path", BIAS_MODEL_ID)
                # Call fine-tuned DistilBERT
                res = pipe(text_to_check[:512])
                if res and isinstance(res, list):
                    pred = res[0]
                    pred_label = pred.get("label", "").upper()
                    pred_score = float(pred.get("score", 0.0))
                    
                    # Assume model trained with label mapping: LABEL_1 is DISCRIMINATORY, LABEL_0 is LEGITIMATE
                    if "DISCRIMINATORY" in pred_label or pred_label == "LABEL_1":
                        score = pred_score
                        categories = ["discriminatory_reasoning"]
                    else:
                        score = 1.0 - pred_score if pred_label == "LABEL_0" else pred_score
                        categories = ["legitimate_criterion"]
        except Exception as e:
            mock_res = self._mock_detect(text_to_check)
            score = mock_res["score"]
            categories = mock_res["categories"]
            spans = mock_res["spans"]
            status = "ERROR"
            model_version = f"error-fallback-rule: {str(e)[:50]}"
            
        latency = int((time.time() - start_time) * 1000)
        
        return DetectorResult(
            detector="bias",
            model_id=BIAS_MODEL_ID,
            model_version=model_version,
            score=score,
            threshold_used=0.0,  # to be filled by Policy
            categories=categories,
            spans=spans,
            status=status,
            latency_ms=latency
        )
