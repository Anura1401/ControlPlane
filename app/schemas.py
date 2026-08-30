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
    generate_with_llm: Optional[bool] = False
    llm_provider: Optional[str] = "gemini"
    llm_model: Optional[str] = None
    llm_input_tokens: Optional[int] = 0
    llm_output_tokens: Optional[int] = 0
    llm_latency_ms: Optional[int] = 0


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

class EvaluationRequest(BaseModel):
    application_id: str
    policy_id: str
    user_prompt: str
    llm_response: Optional[str] = None
    tool_action: Optional[Dict[str, Any]] = None
    generate_with_llm: Optional[bool] = False

class LLMDetails(BaseModel):
    provider: str
    model: str
    response: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0

class DetectorSummary(BaseModel):
    score: float
    severity: str  # LOW|MEDIUM|HIGH
    detected: bool
    details: List[str] = Field(default_factory=list)

class Tier0Summary(BaseModel):
    pii: DetectorSummary
    injection: DetectorSummary
    toxicity: DetectorSummary
    bias: DetectorSummary
    truth: DetectorSummary

class RiskRouterSummary(BaseModel):
    tier_1_required: bool
    reason: List[str] = Field(default_factory=list)

class EvidenceSummary(BaseModel):
    document_id: str
    text: str
    similarity: float

class ClaimVerificationSummary(BaseModel):
    claim_id: str
    claim: str
    verdict: str  # SUPPORTED|CONTRADICTED|UNKNOWN
    confidence: float
    evidence: List[EvidenceSummary] = Field(default_factory=list)

class Tier1Summary(BaseModel):
    claims: List[str] = Field(default_factory=list)
    verification: List[ClaimVerificationSummary] = Field(default_factory=list)
    evidence: List[EvidenceSummary] = Field(default_factory=list)

class ToolValidationSummary(BaseModel):
    authorized: bool
    risk: float
    reason: List[str] = Field(default_factory=list)

class RiskEngineSummary(BaseModel):
    risk_score: float
    risk_level: str  # LOW|MEDIUM|HIGH
    explanations: List[str] = Field(default_factory=list)

class PolicySummary(BaseModel):
    policy_id: str
    triggered_rules: List[Dict[str, Any]] = Field(default_factory=list)

class APIv1EvaluationResponse(BaseModel):
    request_id: str
    application_id: str
    policy_id: str
    llm: Optional[LLMDetails] = None
    tier_0: Tier0Summary
    risk_router: RiskRouterSummary
    tier_1: Tier1Summary
    action_validation: Optional[ToolValidationSummary] = None
    risk_engine: RiskEngineSummary
    policy: PolicySummary
    decision: str  # ALLOW|MODIFY|ESCALATE|BLOCK
    final_response: str
    audit_id: str

