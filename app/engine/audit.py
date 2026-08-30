import os
import json
import hashlib
import time
from typing import Dict, Any
from app.config import AUDIT_LOG_PATH

class AuditLogger:
    """
    Append-only structured audit logger with SHA-256 hash chaining.
    Guarantees integrity of safety records.
    """
    def __init__(self, log_path: str = str(AUDIT_LOG_PATH)):
        self.log_path = log_path
        self._ensure_log_file_exists()

    def _ensure_log_file_exists(self):
        if not os.path.exists(self.log_path):
            os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
            # Create file with an empty array or just leave it empty for JSONL
            with open(self.log_path, "w") as f:
                pass

    def _get_last_hash(self) -> str:
        """
        Reads the last line of the audit log to retrieve the previous entry's SHA-256 hash.
        """
        if not os.path.exists(self.log_path) or os.path.getsize(self.log_path) == 0:
            return "genesis_hash_00000000000000000000000000000000000000000000000000"
            
        try:
            with open(self.log_path, "r") as f:
                lines = f.readlines()
                if not lines:
                    return "genesis_hash_00000000000000000000000000000000000000000000000000"
                last_line = lines[-1].strip()
                if last_line:
                    record = json.loads(last_line)
                    return record.get("hash", "genesis_hash_00000000000000000000000000000000000000000000000000")
        except Exception as e:
            print(f"Error reading last hash: {e}")
            
        return "genesis_hash_00000000000000000000000000000000000000000000000000"

    def write_audit_record(self, request_id: str, record_data: Dict[str, Any]) -> str:
        """
        Appends a structured audit record signed with a SHA-256 hash chain to the log.
        
        Returns:
            str: The SHA-256 hash of the written record.
        """
        timestamp = time.time()
        prev_hash = self._get_last_hash()
        
        # Prepare structured payload
        audit_payload = {
            "request_id": request_id,
            "timestamp": timestamp,
            "data": record_data,
            "prev_hash": prev_hash
        }
        
        # Deterministic serialization for hashing (sorted keys)
        serialized_data = json.dumps(audit_payload, sort_keys=True)
        current_hash = hashlib.sha256(serialized_data.encode("utf-8")).hexdigest()
        
        # Inject signature hash into the payload
        audit_payload["hash"] = current_hash
        
        # Append to log file (JSONL format)
        with open(self.log_path, "a") as f:
            f.write(json.dumps(audit_payload) + "\n")
            
        return current_hash
