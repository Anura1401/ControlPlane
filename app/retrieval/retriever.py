from typing import List, Optional
from app.retrieval.indexer import FAISSIndexManager
from app.schemas import EvidenceChunk

class Retriever:
    """
    Retriever class that wraps the index manager and enforces retrieval similarity thresholds.
    """
    def __init__(self, index_manager: Optional[FAISSIndexManager] = None):
        self.index_manager = index_manager or FAISSIndexManager()
        
    def retrieve(self, query: str, threshold: float = 0.65, k: int = 3) -> List[EvidenceChunk]:
        """
        Query FAISS index and gate results by similarity threshold.
        
        Args:
            query (str): The search text/claim.
            threshold (float): Similarity threshold below which matches are ignored.
            k (int): Top-k matches to retrieve.
            
        Returns:
            List[EvidenceChunk]: Matching chunks exceeding similarity threshold.
        """
        # Call search on index manager
        raw_matches = self.index_manager.search(query, k=k)
        
        valid_evidence = []
        for match in raw_matches:
            similarity = match["similarity"]
            # Critical rule: if similarity < retrieval_threshold, evidence = NONE
            if similarity >= threshold:
                valid_evidence.append(EvidenceChunk(
                    document_id=match["document_id"],
                    chunk_id=match["chunk_id"],
                    text=match["text"],
                    similarity=similarity
                ))
                
        return valid_evidence
