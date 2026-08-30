import os
import sys
from pathlib import Path
import argparse
import pandas as pd
import numpy as np
import joblib
import yaml
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, f1_score, brier_score_loss

# Feature order matching risk_engine.py
FEATURE_ORDER = [
    "pii_score",
    "toxicity_score",
    "bias_score",
    "injection_score",
    "truth_risk",
    "retrieval_quality",
    "verification_confidence",
    "contradicted_claim_ratio",
    "unknown_claim_ratio",
    "cost_anomaly_score",
    "tool_impact",
    "tool_reversibility",
    "tool_sensitivity",
    "authorization_status",
    "task_risk",
    "application_risk"
]

DEFAULT_CSV_PATH = "data/risk_training_rows.csv"
DEFAULT_OUTPUT_PATH = "app/engine/risk_calibrator.joblib"

def calculate_ece(probs, y_true, n_bins=10) -> float:
    """
    Computes Expected Calibration Error (ECE).
    """
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        
        # Identify points in this bin
        in_bin = (probs >= bin_lower) & (probs < bin_upper)
        prop_in_bin = np.mean(in_bin)
        
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(y_true[in_bin])
            avg_confidence_in_bin = np.mean(probs[in_bin])
            ece += prop_in_bin * np.abs(avg_confidence_in_bin - accuracy_in_bin)
            
    return float(ece)

def bootstrap_risk_dataset(csv_path: str):
    """
    Generates a high-quality dataset of 400 scenarios containing balanced feature mixtures
    representing safe operations (label=0) and policy violations / safety risks (label=1).
    """
    print(f"Bootstrapping synthetic risk training dataset containing 400 samples at {csv_path}...")
    np.random.seed(42)
    
    rows = []
    for i in range(400):
        # Determine case type (0 = safe, 1 = unsafe)
        label = np.random.choice([0, 1], p=[0.6, 0.4])
        
        # Base/default values
        row = {
            "pii_score": np.random.uniform(0.0, 0.3),
            "toxicity_score": np.random.uniform(0.0, 0.2),
            "bias_score": np.random.uniform(0.0, 0.3),
            "injection_score": np.random.uniform(0.0, 0.1),
            "truth_risk": np.random.uniform(0.1, 0.8),
            "retrieval_quality": np.random.uniform(0.7, 0.95),
            "verification_confidence": np.random.uniform(0.8, 0.98),
            "contradicted_claim_ratio": 0.0,
            "unknown_claim_ratio": np.random.uniform(0.0, 0.2),
            "cost_anomaly_score": np.random.uniform(0.0, 0.3),
            "tool_impact": 0.0,
            "tool_reversibility": 0.0,
            "tool_sensitivity": 0.0,
            "authorization_status": 0.0,
            "task_risk": np.random.uniform(0.1, 0.5),
            "application_risk": np.random.uniform(0.2, 0.6),
            "label": label
        }
        
        # Safe cases: 50% have verification run, 50% skip verification (features are 0)
        if label == 0 and np.random.rand() < 0.5:
            row["retrieval_quality"] = 0.0
            row["verification_confidence"] = 0.0
            row["unknown_claim_ratio"] = 0.0
            
        if label == 1:
            # Inject an unsafe risk pattern
            risk_type = np.random.choice(["injection", "toxicity", "pii", "bias", "contradiction", "auth_bypass", "anomaly"])
            if risk_type == "injection":
                row["injection_score"] = np.random.uniform(0.95, 1.0)
                row["retrieval_quality"] = 0.0
                row["verification_confidence"] = 0.0
                row["unknown_claim_ratio"] = 0.0
            elif risk_type == "toxicity":
                row["toxicity_score"] = np.random.uniform(0.95, 1.0)
                row["retrieval_quality"] = 0.0
                row["verification_confidence"] = 0.0
                row["unknown_claim_ratio"] = 0.0
            elif risk_type == "pii":
                row["pii_score"] = np.random.uniform(0.99, 1.0)
                row["retrieval_quality"] = 0.0
                row["verification_confidence"] = 0.0
                row["unknown_claim_ratio"] = 0.0
            elif risk_type == "bias":
                row["bias_score"] = np.random.uniform(0.75, 0.99)
            elif risk_type == "contradiction":
                row["contradicted_claim_ratio"] = np.random.uniform(0.5, 1.0)
                row["truth_risk"] = np.random.uniform(0.6, 0.9)
            elif risk_type == "auth_bypass":
                row["tool_impact"] = 1.0
                row["tool_reversibility"] = 1.0
                row["authorization_status"] = 1.0
                row["retrieval_quality"] = 0.0
                row["verification_confidence"] = 0.0
                row["unknown_claim_ratio"] = 0.0
            elif risk_type == "anomaly":
                row["cost_anomaly_score"] = np.random.uniform(0.9, 1.0)
                row["retrieval_quality"] = 0.0
                row["verification_confidence"] = 0.0
                row["unknown_claim_ratio"] = 0.0
                
        rows.append(row)
        
    df = pd.DataFrame(rows)
    df.to_csv(csv_path, index=False)
    print(f"Generated {len(df)} training samples.")

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="training/configs/risk_engine.yaml")
    parser.add_argument("--csv", type=str, default=None)
    return parser.parse_args()

def main():
    args = parse_args()
    
    # Load config parameters
    n_estimators = 100
    max_depth = 4
    learning_rate = 0.1
    output_path = DEFAULT_OUTPUT_PATH
    
    if os.path.exists(args.config):
        with open(args.config, "r") as f:
            config = yaml.safe_load(f)
            n_estimators = config.get("n_estimators", n_estimators)
            max_depth = config.get("max_depth", max_depth)
            learning_rate = config.get("learning_rate", learning_rate)
            output_path = config.get("output_path", output_path)
            
    csv_path = args.csv or DEFAULT_CSV_PATH
    if not os.path.exists(csv_path):
        bootstrap_risk_dataset(csv_path)
        
    # Read training data
    df = pd.read_csv(csv_path)
    
    # Ensure all required features are present
    for feat in FEATURE_ORDER:
        if feat not in df.columns:
            raise KeyError(f"Required feature '{feat}' missing from training dataset.")
            
    X = df[FEATURE_ORDER]
    y = df["label"]
    
    # Stratified Train/Val split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.25, stratify=y, random_state=42
    )
    
    print(f"Training shape: {X_train.shape}, Validation shape: {X_val.shape}")
    
    # Select classifier based on installation (XGBoost vs Logistic Regression fallback)
    try:
        from xgboost import XGBClassifier
        print("XGBClassifier detected. Training XGBoost Risk Model...")
        base_model = XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            eval_metric="logloss",
            random_state=42
        )
    except ImportError:
        from sklearn.linear_model import LogisticRegression
        print("XGBoost library not found. Falling back to LogisticRegression...")
        base_model = LogisticRegression(random_state=42, class_weight="balanced")
        
    # Calibrate probability using Platt scaling (sigmoid method)
    # Using 3-fold cross-validation calibration
    calibrated = CalibratedClassifierCV(base_model, method="sigmoid", cv=3)
    calibrated.fit(X_train, y_train)
    
    # Evaluate performance
    val_probs = calibrated.predict_proba(X_val)[:, 1]
    val_preds = (val_probs >= 0.5).astype(int)
    
    auroc = roc_auc_score(y_val, val_probs)
    macro_f1 = f1_score(y_val, val_preds, average="macro")
    brier = brier_score_loss(y_val, val_probs)
    ece = calculate_ece(val_probs, y_val.values)
    
    print("\n--- Calibration & Model Evaluation Results ---")
    print(f"Validation Accuracy:    {calibrated.score(X_val, y_val):.4f}")
    print(f"Validation AUROC:       {auroc:.4f}")
    print(f"Validation Macro-F1:    {macro_f1:.4f}")
    print(f"Brier score:            {brier:.4f}")
    print(f"Expected Calibration Error (ECE): {ece:.4f}")
    print("----------------------------------------------\n")
    
    # Ensure parent dir exists
    Path(output_path).parent.mkdir(exist_ok=True, parents=True)
    
    # Serialize model
    joblib.dump(calibrated, output_path)
    print(f"Saved calibrated risk engine model to {output_path}")

if __name__ == "__main__":
    main()
