import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, f1_score, confusion_matrix, accuracy_score
from app.engine.risk_engine import FEATURE_ORDER

def calculate_ece(probs, y_true, n_bins=10) -> float:
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        in_bin = (probs >= bin_lower) & (probs < bin_upper)
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(y_true[in_bin])
            avg_confidence_in_bin = np.mean(probs[in_bin])
            ece += prop_in_bin * np.abs(avg_confidence_in_bin - accuracy_in_bin)
    return float(ece)

def main():
    model_path = "app/engine/risk_calibrator.joblib"
    data_path = "data/risk_training_rows.csv"
    
    if not os.path.exists(model_path):
        print(f"Error: Calibrated model not found at {model_path}. Run training first.")
        return
    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}.")
        return
        
    print(f"Evaluating model '{model_path}' on dataset '{data_path}'...")
    df = pd.read_csv(data_path)
    X = df[FEATURE_ORDER]
    y = df["label"]
    
    # Load model
    model = joblib.load(model_path)
    
    probs = model.predict_proba(X)[:, 1]
    preds = (probs >= 0.5).astype(int)
    
    # Compute metrics
    acc = accuracy_score(y, preds)
    auroc = roc_auc_score(y, probs)
    macro_f1 = f1_score(y, preds, average="macro")
    brier = np.mean((probs - y.values) ** 2)
    ece = calculate_ece(probs, y.values)
    cm = confusion_matrix(y, preds)
    
    print("\n================== EVALUATION REPORT ==================")
    print(f"Accuracy:                 {acc:.4f}")
    print(f"AUROC:                    {auroc:.4f}")
    print(f"Macro-F1 Score:           {macro_f1:.4f}")
    print(f"Brier Score (MSE):        {brier:.4f}")
    print(f"Expected Calibration Error (ECE): {ece:.4f}")
    print("\nConfusion Matrix:")
    print(f"  True Negatives (Safe):  {cm[0][0]}")
    print(f"  False Positives (Alarm): {cm[0][1]}")
    print(f"  False Negatives (Miss):  {cm[1][0]}")
    print(f"  True Positives (Block):  {cm[1][1]}")
    print("========================================================\n")
    
    # Save evaluation summary to disk
    eval_report = {
        "accuracy": acc,
        "auroc": auroc,
        "macro_f1": macro_f1,
        "brier_score": brier,
        "ece": ece,
        "confusion_matrix": cm.tolist()
    }
    with open("data/evaluation_report.json", "w") as f:
        json.dump(eval_report, f, indent=2)
    print("Saved evaluation metrics report to data/evaluation_report.json")

import json
if __name__ == "__main__":
    main()
