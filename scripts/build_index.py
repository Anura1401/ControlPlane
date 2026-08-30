import os
import argparse
from pathlib import Path
from app.retrieval.indexer import FAISSIndexManager

def bootstrap_demo_docs(doc_dir: Path):
    """
    Creates dummy enterprise files with specific ground truth facts.
    """
    doc_dir.mkdir(exist_ok=True, parents=True)
    
    finance_doc = doc_dir / "finance_records.txt"
    if not finance_doc.exists():
        with open(finance_doc, "w") as f:
            f.write(
                "Company X Financial Audit Report 2025.\n"
                "Company X acquired Company Y for $1.4B in 2025. The transaction completed in Q3.\n"
                "Quarterly revenue for the fiscal year was $10B.\n"
                "Interest rate on business loan was 4.5%.\n"
            )
            
    hr_doc = doc_dir / "hr_records.txt"
    if not hr_doc.exists():
        with open(hr_doc, "w") as f:
            f.write(
                "Company X HR Operations Manual.\n"
                "Employee headcount at Company X was 12,000 as of last year.\n"
                "Candidate review processes must be completed within 14 business days.\n"
            )
            
    print(f"Bootstrapped demo documentation files in {doc_dir}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str, default="data/demo_docs")
    args = parser.parse_args()
    
    input_path = Path(args.input)
    
    # Bootstrap documents if they are empty
    bootstrap_demo_docs(input_path)
    
    # Collect all txt files
    docs = []
    for file in os.listdir(input_path):
        if file.endswith(".txt"):
            file_path = input_path / file
            print(f"Reading file: {file_path}")
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            docs.append({
                "document_id": file,
                "text": text,
                "metadata": {"source": str(file_path)}
            })
            
    if not docs:
        print(f"Error: No text files found in {input_path}")
        return
        
    print(f"Loaded {len(docs)} documents. Building FAISS index...")
    manager = FAISSIndexManager()
    manager.build_and_save(docs, app_id="finance_support")
    
    print("FAISS index construction complete. Ready for similarity retrieval.")

if __name__ == "__main__":
    main()
