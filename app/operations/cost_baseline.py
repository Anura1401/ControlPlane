import json
import os
from pathlib import Path
from typing import Dict, Any, List
import numpy as np
from app.config import DATA_DIR
from app.schemas import RequestContext

HISTORY_FILE = DATA_DIR / "operations_history.json"

class CostBaseline:
    """
    Tracks historical operational costs and calculates a rolling P95 anomaly score.
    No ML models are used; it uses running statistics over history.
    """
    def __init__(self, history_path: Path = HISTORY_FILE):
        self.history_path = Path(history_path)
        self.history = self._load_history()

    def _load_history(self) -> List[Dict[str, Any]]:
        if not self.history_path.exists():
            return []
        try:
            with open(self.history_path, "r") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_history(self):
        try:
            with open(self.history_path, "w") as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f"Error saving operations history: {e}")

    def update_and_calculate_anomaly(self, app_id: str, task_type: str, current_cost: float) -> Dict[str, Any]:
        """
        Calculates the cost anomaly score based on P95 threshold of matching application + task_type,
        then appends current_cost to history.
        """
        # Filter history for matches
        matches = [h for h in self.history if h.get("app_id") == app_id and h.get("task_type") == task_type]
        costs = [m.get("cost", 0.0) for m in matches]
        
        anomaly_score = 0.0
        p95 = 0.0
        median = 0.0
        
        # We need a minimum number of samples to establish a baseline
        if len(costs) >= 5:
            costs_arr = np.array(costs)
            p95 = float(np.percentile(costs_arr, 95))
            median = float(np.median(costs_arr))
            
            if current_cost > p95:
                # Anomaly score escalates based on how much it exceeds P95
                if p95 > 0:
                    anomaly_score = min(1.0, current_cost / (p95 * 1.5))
                else:
                    anomaly_score = 1.0
            elif current_cost > median:
                # Standard elevated cost
                if p95 > median:
                    anomaly_score = 0.5 * ((current_cost - median) / (p95 - median))
                else:
                    anomaly_score = 0.1
            else:
                anomaly_score = 0.0
        else:
            # Baseline bootstrapping phase
            anomaly_score = 0.0
            
        # Append current run to history
        self.history.append({
            "app_id": app_id,
            "task_type": task_type,
            "cost": current_cost,
            "timestamp": os.getenv("CURRENT_TIME", str(time_time()))
        })
        # Keep rolling window of last 1000 items
        if len(self.history) > 1000:
            self.history = self.history[-1000:]
            
        self._save_history()
        
        return {
            "cost_anomaly_score": float(anomaly_score),
            "p95": float(p95),
            "median": float(median),
            "sample_count": len(costs)
        }

def time_time():
    import time
    return time.time()
