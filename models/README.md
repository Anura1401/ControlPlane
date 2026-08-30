# ControlPlane.ai Model Registry

This directory contains model configuration registries and cached offline models.

## Registered Models
1. **PII Classification**: `iiiorg/piiranha-v1-detect-personal-information`
2. **Toxicity Detection**: `unitary/toxic-bert`
3. **Prompt Injection**: `protectai/deberta-v3-base-prompt-injection-v2`
4. **Bias Classification**: `distilbert-base-uncased` fine-tuned for decision context
5. **Claims Verification (NLI)**: `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`
6. **Embeddings**: `BAAI/bge-base-en-v1.5`
7. **Risk Calibrator**: Calibrated XGBoost classifier trained on local scenarios.

All model licensing, versions, and tasks are defined in `registry.json`.
