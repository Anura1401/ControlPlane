from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class OperationsMetrics(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    retries: int = 0
    estimated_cost: float = 0.0

class ToolCall(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    user_role: Optional[str] = "user"
    user_permissions: List[str] = Field(default_factory=list)

class RequestContext(BaseModel):
    request_id: str
    application_id: str
    policy_id: Optional[str] = None
    policy_version: Optional[str] = None
    task_type: str
    user_prompt: str
    retrieved_context: List[str] = Field(default_factory=list)
    llm_response: Optional[str] = None
    tool_call: Optional[ToolCall] = None
    operations: OperationsMetrics = Field(default_factory=OperationsMetrics)

class DetectorSpan(BaseModel):
    start: int
    end: int
    entity_type: str
    text: Optional[str] = None

class DetectorResult(BaseModel):
    detector: str  # pii|toxicity|bias|injection|truth|cost
    model_id: str
    model_version: str
    score: float
    threshold_used: float
    categories: List[str] = Field(default_factory=list)
    spans: List[DetectorSpan] = Field(default_factory=list)
    status: str  # OK|ERROR|SKIPPED
    latency_ms: int = 0

class EvidenceChunk(BaseModel):
    document_id: str
    chunk_id: str
    text: str
    similarity: float

class ClaimVerificationResult(BaseModel):
    claim_id: str
    claim: str
    evidence: List[EvidenceChunk] = Field(default_factory=list)
    retrieval_status: str  # FOUND|NONE
    verdict: str  # SUPPORTED|CONTRADICTED|UNKNOWN
    confidence: float

class FinalDecision(BaseModel):
    request_id: str
    decision: str  # ALLOW|MODIFY|ESCALATE|BLOCK
    overall_risk: float
    severity: str  # LOW|MEDIUM|HIGH|CRITICAL
    confidence: float
    uncertainty: float
    dominant_risks: List[str] = Field(default_factory=list)
    policy_id: str
    policy_version: str
    reasons: List[str] = Field(default_factory=list)
    audit_id: str
    modified_response: Optional[str] = None
    modified_tool_call: Optional[ToolCall] = None
