import os
import sys
import json
from pathlib import Path
from app.config import MOCK_ML

def main():
    registry_path = Path("models/registry.json")
    if not registry_path.exists():
        print("Error: models/registry.json not found.")
        sys.exit(1)
        
    with open(registry_path, "r") as f:
        registry = json.load(f)
        
    print("--- ControlPlane.ai Model Verification & Download Manager ---")
    
    if MOCK_ML:
        print("MOCK_ML=true environment flag detected. Skipping actual Hugging Face model downloads.")
        print("Verifying registry mappings...")
        for key, spec in registry.items():
            print(f"  [OK] Model '{key}' -> HuggingFace: {spec['huggingface_id']} (Mock Mode enabled)")
        print("All models verified successfully in mock configurations.")
        return

    # Real download
    try:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoModelForTokenClassification
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("Error: transformers or sentence-transformers is not installed. Run pip install -r requirements.txt first.")
        sys.exit(1)
        
    for key, spec in registry.items():
        hf_id = spec["huggingface_id"]
        task = spec["task"]
        
        if hf_id == "local-trained":
            print(f"Model '{key}' is locally trained. Skipping HF download.")
            continue
            
        print(f"Downloading/loading model '{key}' ({hf_id}) for task '{task}'...")
        try:
            if key == "pii":
                # Token classification
                AutoTokenizer.from_pretrained(hf_id)
                AutoModelForTokenClassification.from_pretrained(hf_id)
            elif key in ("toxicity", "injection", "bias", "claim_verifier"):
                # Sequence classification
                AutoTokenizer.from_pretrained(hf_id)
                AutoModelForSequenceClassification.from_pretrained(hf_id)
            elif key == "embeddings":
                # Embeddings
                SentenceTransformer(hf_id)
            print(f"  [SUCCESS] Model '{key}' is verified and cached.")
        except Exception as e:
            print(f"  [ERROR] Failed to download model '{key}' ({hf_id}): {e}")
            print("Please check your internet connection or Hugging Face access.")
            
    print("Model verification and download process complete.")

if __name__ == "__main__":
    main()
