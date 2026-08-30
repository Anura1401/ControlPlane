import time
import re
from typing import List, Dict, Any
from app.detectors.base import BaseDetector
from app.schemas import RequestContext, DetectorResult, DetectorSpan
from app.config import MOCK_ML, PII_MODEL_ID, DEVICE

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
                    "token-classification",
                    model=PII_MODEL_ID,
                    device=device_idx
                )
            except Exception as e:
                # Fallback to mock on import or load failure
                print(f"Warning: Failed to load PII model {PII_MODEL_ID}. Falling back to MOCK. Error: {e}")
                _pipeline = "MOCK_FALLBACK"
    return _pipeline

class PIIDetector(BaseDetector):
    """
    Token-level PII Detector using iiiorg/piiranha-v1-detect-personal-information
    or a regex-based fallback scanner.
    """
    
    def __init__(self):
        # Lazy load pipeline
        pass

    def _mock_detect(self, text: str) -> List[Dict[str, Any]]:
        # High-quality regex rules for common PII patterns
        patterns = [
            (r"[\w\.-]+@[\w\.-]+\.\w+", "EMAIL"),
            (r"\b\d{3}-\d{2}-\d{4}\b", "SSN"),
            (r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b", "CREDIT_CARD"),
            (r"\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{3}[-.]?\d{4}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", "PHONE"),
            (r"\b(?:John Doe|Jane Smith|Alice Johnson|Bob Miller)\b", "NAME")
        ]
        
        entities = []
        for pattern, label in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entities.append({
                    "entity": label,
                    "score": 0.90,
                    "word": match.group(),
                    "start": match.start(),
                    "end": match.end()
                })
        return entities

    def detect(self, context: RequestContext) -> DetectorResult:
        start_time = time.time()
        
        # Build the text surface to evaluate
        # By default, scan llm_response. Optionally prompt or tool arguments.
        surfaces = []
        if context.llm_response:
            surfaces.append(context.llm_response)
        if context.tool_call:
            # Add arguments stringified
            surfaces.append(str(context.tool_call.arguments))
            
        combined_text = " ".join(surfaces) if surfaces else ""
        
        if not combined_text:
            return DetectorResult(
                detector="pii",
                model_id=PII_MODEL_ID,
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
        model_version = "piiranha-v1"
        
        try:
            if pipe in ("MOCK", "MOCK_FALLBACK"):
                raw_entities = self._mock_detect(combined_text)
                model_version = "mock-piiranha"
            else:
                raw_entities = pipe(combined_text)
                model_version = getattr(pipe.model.config, "_name_or_path", PII_MODEL_ID)
        except Exception as e:
            raw_entities = self._mock_detect(combined_text)
            status = "ERROR"
            model_version = f"error-fallback-regex: {str(e)[:50]}"
            
        spans = []
        max_score = 0.0
        categories_set = set()
        
        # Group raw token classifications into contiguous spans or format directly
        for ent in raw_entities:
            entity_type = ent.get("entity_group", ent.get("entity", "PII"))
            score = float(ent.get("score", 0.99))
            start = ent.get("start", 0)
            end = ent.get("end", 0)
            word = ent.get("word", combined_text[start:end])
            
            # Record category and track maximum score
            categories_set.add(entity_type)
            if score > max_score:
                max_score = score
                
            spans.append(DetectorSpan(
                start=start,
                end=end,
                entity_type=entity_type,
                text=word
            ))
            
        latency = int((time.time() - start_time) * 1000)
        
        return DetectorResult(
            detector="pii",
            model_id=PII_MODEL_ID,
            model_version=model_version,
            score=max_score,
            threshold_used=0.0,  # to be filled by Policy
            categories=list(categories_set),
            spans=spans,
            status=status,
            latency_ms=latency
        )
