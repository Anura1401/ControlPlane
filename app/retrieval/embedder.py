import numpy as np
from app.config import MOCK_ML, EMBEDDING_MODEL_ID, DEVICE

_model = None

def get_model():
    global _model
    if _model is None:
        if MOCK_ML:
            _model = "MOCK"
        else:
            try:
                from sentence_transformers import SentenceTransformer
                _model = SentenceTransformer(EMBEDDING_MODEL_ID, device=DEVICE)
            except Exception as e:
                print(f"Warning: Failed to load embedding model {EMBEDDING_MODEL_ID}. Falling back to MOCK. Error: {e}")
                _model = "MOCK_FALLBACK"
    return _model

class Embedder:
    """
    Sentence Embedder wrapper for BAAI/bge-base-en-v1.5.
    """
    def __init__(self):
        pass

    def embed_query(self, text: str) -> np.ndarray:
        return self.embed_documents([text])[0]

    def embed_documents(self, texts: list) -> np.ndarray:
        model = get_model()
        if model in ("MOCK", "MOCK_FALLBACK"):
            # Deterministic pseudo-random embeddings for mock matching
            embeddings = []
            for text in texts:
                # Use string hashing to seed
                seed = sum(ord(c) for c in text) % (2**32)
                rng = np.random.default_rng(seed)
                vec = rng.normal(size=768)
                # Normalize vector to unit length
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                embeddings.append(vec)
            return np.array(embeddings, dtype=np.float32)
        else:
            # Generate real embeddings
            embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            return np.array(embeddings, dtype=np.float32)
