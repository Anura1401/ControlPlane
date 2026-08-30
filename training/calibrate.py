import argparse
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.calibration import calibration_curve
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="app/engine/risk_calibrator.joblib")
    parser.add_argument("--data", type=str, default="data/risk_training_rows.csv")
    args = parser.parse_args()
    
    print(f"Loading data from {args.data}...")
    df = pd.read_csv(args.data)
    X = df[FEATURE_ORDER]
    y = df["label"]
    
    # Split to get validation/calibration set
    _, X_val, _, y_val = train_test_split(X, y, test_size=0.3, stratify=y, random_state=42)
    
    print(f"Loading model from {args.model}...")
    calibrated_model = joblib.load(args.model)
    
    # Predict probabilities
    probs = calibrated_model.predict_proba(X_val)[:, 1]
    
    # Compute calibration curve
    prob_true, prob_pred = calibration_curve(y_val, probs, n_bins=5)
    
    # Calculate metrics
    ece = calculate_ece(probs, y_val.values)
    brier = np.mean((probs - y_val.values) ** 2)
    
    print("\n--- Calibration Metrics Report ---")
    print(f"Brier Score: {brier:.4f}")
    print(f"Expected Calibration Error (ECE): {ece:.4f}")
    print("\nBin Probabilities (True vs Pred):")
    for true, pred in zip(prob_true, prob_pred):
        print(f"  True: {true:.3f} | Pred: {pred:.3f}")
    print("----------------------------------\n")

if __name__ == "__main__":
    main()
