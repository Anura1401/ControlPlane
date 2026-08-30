export type DecisionType = 'ALLOW' | 'MODIFY' | 'ESCALATE' | 'BLOCK';
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DetectorResult {
  name: string;
  score: number;
  status: 'PASS' | 'ELEVATED' | 'FAIL';
  explanation: string;
}

export interface Claim {
  claim_id: string;
  text: string;
  claim_type?: string;
}

export interface Evidence {
  document_id: string;
  text: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface Verification {
  claim_id: string;
  claim_text: string;
  verdict: 'SUPPORTED' | 'CONTRADICTED' | 'UNKNOWN';
  confidence: number;
  evidence_chunks: Evidence[];
}

export interface ActionValidation {
  tool_name: string;
  impact: number;
  reversibility: number;
  sensitivity: number;
  authorization_status: 'VALID' | 'INVALID' | 'UNKNOWN';
  external_side_effect: boolean;
  validation_result: 'LOW RISK' | 'HIGH RISK';
}

export interface RiskEngineSHAP {
  feature: string;
  contribution: number; // relative weight or bar width
}

export interface RiskResult {
  overall_risk: number;
  severity: RiskSeverity;
  confidence: number;
  uncertainty: number;
  shap_contributions: RiskEngineSHAP[];
}

export interface PolicyTrigger {
  rule_id: string;
  reason: string;
}

export interface PolicyResult {
  policy_id: string;
  version: string;
  triggered_rules: PolicyTrigger[];
  reason: string;
  decision: DecisionType;
}

export interface RequestDetails {
  application_id: string;
  session_id: string;
  model_id: string;
  task_type: string;
  timestamp: string;
  user_prompt: string;
  llm_response?: string;
  modified_response?: string;
  tool_call?: {
    tool_name: string;
    arguments: string;
  };
}

export interface Evaluation {
  request_id: string;
  timestamp: string;
  application_id: string;
  task_type: string;
  policy_id: string;
  policy_version: string;
  decision: DecisionType;
  overall_risk: number;
  severity: RiskSeverity;
  primary_risk: string;
  action_taken: string;
  
  // Pipeline details
  request: RequestDetails;
  tier0: DetectorResult[];
  risk_router: {
    deep_verify_required: boolean;
    reason: string;
  };
  tier1?: {
    claims: Claim[];
    verifications: Verification[];
  };
  action_validator?: ActionValidation;
  risk_engine: RiskResult;
  policy_engine: PolicyResult;
}

export interface PolicyConfig {
  policy_id: string;
  version: string;
  application_id: string;
  risk_profile: 'low' | 'medium' | 'high';
  status: 'ACTIVE' | 'DRAFT';
  last_updated: string;
  
  // configurable thresholds
  injection_block: number;
  toxicity_block: number;
  pii_modify: number;
  pii_block: number;
  bias_escalate: number;
  truth_verify: number;
  verification_contradiction_escalate: boolean;
  retrieval_min_similarity: number;
  
  // configurable rules
  evidence_required: boolean;
  tool_impact_block: number;
  unknown_auth_action: DecisionType;
  operational_cost_limit: number;
}

export interface AuditRecord {
  timestamp: string;
  request_id: string;
  application_id: string;
  risk: number;
  primary_risk: string;
  policy: string;
  policy_version: string;
  decision: DecisionType;
  human_review: 'N/A' | 'PENDING' | 'APPROVED' | 'REJECTED';
  tool_action: 'N/A' | 'BLOCKED' | 'EXECUTED' | 'PENDING';
  hash: string;
}

export interface HumanReviewItem {
  request_id: string;
  application_id: string;
  risk: number;
  primary_issue: string;
  decision: DecisionType;
  time: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewer?: string;
  reviewed_at?: string;
}
