import os
import json
import numpy as np
from pathlib import Path
from app.retrieval.embedder import Embedder
from app.config import FAISS_INDEX_DIR

# Import faiss with fallback
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("Warning: faiss-cpu is not installed. Falling back to NumPy-based vector search.")

class FAISSIndexManager:
    """
    FAISS index builder & metadata manifest.
    Creates and persists indices and metadata.
    """
    def __init__(self, index_dir: Path = FAISS_INDEX_DIR):
        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(exist_ok=True, parents=True)
        self.index_path = self.index_dir / "index.faiss"
        self.manifest_path = self.index_dir / "manifest.json"
        
        self.embedder = Embedder()
        self.index = None
        # In NumPy fallback mode, we store embeddings in a list/array
        self.numpy_embeddings = None
        self.manifest = {}  # ID (str) -> dict metadata

    def build_and_save(self, documents: list, app_id: str = "default"):
        """
        documents: list of dict with "text", "document_id", "metadata"
        """
        chunks = []
        chunk_metadata = []
        
        # Basic chunker (sentences or fixed character window)
        for doc in documents:
            doc_id = doc.get("document_id", "unknown_doc")
            text = doc.get("text", "")
            meta = doc.get("metadata", {})
            
            # Simple chunking by paragraph or length
            sentences = re_split_sentences(text)
            for idx, sent in enumerate(sentences):
                sent = sent.strip()
                if len(sent) < 10:
                    continue
                chunks.append(sent)
                chunk_metadata.append({
                    "document_id": doc_id,
                    "chunk_id": f"chunk_{idx}",
                    "text": sent,
                    "metadata": meta,
                    "app_id": app_id
                })
                
        if not chunks:
            print("No text chunks generated. Skipping indexing.")
            return

        # Embed chunks
        vectors = self.embedder.embed_documents(chunks)
        dim = vectors.shape[1]
        
        # Save manifest
        self.manifest = {str(i): meta for i, meta in enumerate(chunk_metadata)}
        with open(self.manifest_path, "w") as f:
            json.dump(self.manifest, f, indent=2)

        # Save index
        if FAISS_AVAILABLE:
            # We use Inner Product (IP) since vectors are normalized (Cosine Similarity)
            self.index = faiss.IndexFlatIP(dim)
            self.index.add(vectors)
            faiss.write_index(self.index, str(self.index_path))
        else:
            self.numpy_embeddings = vectors
            np.save(str(self.index_path) + ".npy", self.numpy_embeddings)
            
        print(f"Indexed {len(chunks)} chunks for application '{app_id}' and saved to {self.index_dir}")

    def load(self) -> bool:
        if not self.manifest_path.exists():
            return False
            
        with open(self.manifest_path, "r") as f:
            self.manifest = json.load(f)
            
        if FAISS_AVAILABLE and self.index_path.exists():
            self.index = faiss.read_index(str(self.index_path))
            return True
        elif Path(str(self.index_path) + ".npy").exists():
            self.numpy_embeddings = np.load(str(self.index_path) + ".npy")
            return True
            
        return False

    def search(self, query: str, k: int = 3) -> list:
        """
        Returns: list of EvidenceChunk (as dict)
        """
        if not self.manifest:
            if not self.load():
                return []
                
        # Mock Search Override for testing keyword similarity without heavy models
        from app.config import MOCK_ML
        if MOCK_ML:
            results = []
            query_clean = query.lower()
            query_tokens = set(re.findall(r"\b\w{3,}\b", query_clean))
            
            for idx, meta in self.manifest.items():
                doc_text = meta["text"].lower()
                doc_tokens = set(re.findall(r"\b\w{3,}\b", doc_text))
                overlap = query_tokens.intersection(doc_tokens)
                
                # Compute overlap score
                score = 0.1
                if query_tokens:
                    score += 0.8 * (len(overlap) / len(query_tokens))
                    
                # Direct keyword matching overrides
                keywords = ["revenue", "acquired", "acquisition", "headcount", "employees", "rate", "loan"]
                for kw in keywords:
                    if kw in query_clean and kw in doc_text:
                        score = max(score, 0.85)
                        
                results.append({
                    "document_id": meta["document_id"],
                    "chunk_id": meta["chunk_id"],
                    "text": meta["text"],
                    "similarity": float(score)
                })
                
            results.sort(key=lambda x: x["similarity"], reverse=True)
            return results[:k]

        query_vector = self.embedder.embed_query(query).reshape(1, -1)
        
        if FAISS_AVAILABLE and self.index is not None:
            # Search FAISS index
            similarities, indices = self.index.search(query_vector, k)
            results = []
            for sim, idx in zip(similarities[0], indices[0]):
                if idx == -1 or str(idx) not in self.manifest:
                    continue
                meta = self.manifest[str(idx)]
                results.append({
                    "document_id": meta["document_id"],
                    "chunk_id": meta["chunk_id"],
                    "text": meta["text"],
                    "similarity": float(sim)
                })
            return results
        elif self.numpy_embeddings is not None:
            # NumPy fallback matrix multiplication
            # query_vector is 1 x D, numpy_embeddings is N x D
            sims = np.dot(self.numpy_embeddings, query_vector.T).flatten()
            top_k_indices = np.argsort(sims)[::-1][:k]
            results = []
            for idx in top_k_indices:
                meta = self.manifest[str(idx)]
                results.append({
                    "document_id": meta["document_id"],
                    "chunk_id": meta["chunk_id"],
                    "text": meta["text"],
                    "similarity": float(sims[idx])
                })
            return results
            
        return []

def re_split_sentences(text: str) -> list:
    # A simple deterministic sentence splitter using regex
    # Matches periods followed by spaces and capitals
    sentence_end = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s')
    sentences = sentence_end.split(text)
    return [s for s in sentences if s.strip()]
import re
