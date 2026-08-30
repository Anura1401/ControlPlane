import os
from pathlib import Path
import torch

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Parse and load .env variables programmatically to ensure runtime availability
env_path = BASE_DIR / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

# Environment flags
MOCK_ML = os.getenv("MOCK_ML", "true").lower() in ("true", "1", "yes")

# Model configurations
PII_MODEL_ID = os.getenv("PII_MODEL_ID", "iiiorg/piiranha-v1-detect-personal-information")
TOXICITY_MODEL_ID = os.getenv("TOXICITY_MODEL_ID", "unitary/toxic-bert")
INJECTION_MODEL_ID = os.getenv("INJECTION_MODEL_ID", "protectai/deberta-v3-base-prompt-injection-v2")
BIAS_MODEL_ID = os.getenv("BIAS_MODEL_ID", "distilbert-base-uncased")
VERIFIER_MODEL_ID = os.getenv("VERIFIER_MODEL_ID", "MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli")
EMBEDDING_MODEL_ID = os.getenv("EMBEDDING_MODEL_ID", "BAAI/bge-base-en-v1.5")

# Device config
DEFAULT_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DEVICE = os.getenv("DEVICE", DEFAULT_DEVICE)

# Logging and Persistence
AUDIT_LOG_PATH = Path(os.getenv("AUDIT_LOG_PATH", str(DATA_DIR / "audit_log.jsonl")))
AUDIT_LOG_PATH.parent.mkdir(exist_ok=True)

FAISS_INDEX_DIR = Path(os.getenv("FAISS_INDEX_DIR", str(DATA_DIR / "indices")))
FAISS_INDEX_DIR.mkdir(exist_ok=True, parents=True)

POLICIES_DIR = BASE_DIR / "policies"
POLICIES_DIR.mkdir(exist_ok=True)

# Port and Host settings
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
