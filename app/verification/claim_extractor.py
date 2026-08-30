import re
from typing import List, Dict, Any
from app.schemas import RequestContext

class ClaimExtractor:
    """
    Deterministic claim extractor. Splits text into atomic sentences
    and filters out non-factual/conversational noise.
    """
    def __init__(self):
        # Match sentences ending with period, question mark, or exclamation
        self.sentence_splitter = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s')

    def extract(self, text: str) -> List[Dict[str, Any]]:
        """
        Splits text and filters for factual assertions.
        
        Returns:
            List[Dict]: Claims with claim_id, text, span, claim_type, confidence.
        """
        if not text:
            return []

        # Split text into sentences
        sentences = self.sentence_splitter.split(text)
        
        claims = []
        current_idx = 0
        claim_counter = 1
        
        for sent in sentences:
            start_pos = text.find(sent, current_idx)
            if start_pos == -1:
                start_pos = current_idx
            end_pos = start_pos + len(sent)
            current_idx = end_pos
            
            sent_clean = sent.strip()
            if not sent_clean:
                continue
                
            # Filter: Check if sentence is a factual assertion
            # Factual assertions usually contain numbers, currency symbols, or specific business keywords.
            # Avoid greeting/meta conversational filler.
            is_factual = False
            
            # Numbers or dates
            if re.search(r"\b\d+[\d,.]*\b", sent_clean):
                is_factual = True
            # Currency signs
            elif re.search(r"[\$\£\€\¥]", sent_clean):
                is_factual = True
            # Factual business keywords
            elif re.search(r"\b(acquired|revenue|headcount|fiscal|profit|loss|price|agreed|contract|policy|merger|acquisition|quarterly)\b", sent_clean, re.IGNORECASE):
                is_factual = True
            # General facts like "Company X is..."
            elif re.search(r"\b(is|was|are|were|has|have|had|produced|delivered|sold|founded)\b", sent_clean, re.IGNORECASE) and len(sent_clean.split()) > 4:
                # Long enough statement with a verb is likely a claim
                is_factual = True
                
            # Conversational filters (non-factual greetings)
            is_conversational = bool(re.search(r"^(hello|hi|sure|here is|let me|please|thank you|sorry|apologies|glad to|how can|what is|how do)\b", sent_clean, re.IGNORECASE))
            
            if is_factual and not is_conversational:
                # Classify claim type
                claim_type = "general_factual"
                if re.search(r"[\$\£\€\¥\b(revenue|profit|loss|price|acquisition|worth)\b]", sent_clean, re.IGNORECASE):
                    claim_type = "financial_claim"
                elif re.search(r"\b(should|recommend|suggest|propose|advise|must)\b", sent_clean, re.IGNORECASE):
                    claim_type = "recommendation"
                    
                claims.append({
                    "claim_id": f"c_{claim_counter:03d}",
                    "text": sent_clean,
                    "span": (start_pos, end_pos),
                    "claim_type": claim_type,
                    "confidence": 1.0
                })
                claim_counter += 1
                
        return claims
