import React, { useState } from 'react';
import { Evaluation } from '../types/controlplane';
import { ChevronDown, ChevronUp, AlertCircle, Shield, FileText, Settings, Database, Activity, CheckSquare } from 'lucide-react';

interface EvaluationTraceProps {
  evaluation: Evaluation;
  onBackToList: () => void;
  onOpenReview: (requestId: string) => void;
}

export const EvaluationTrace: React.FC<EvaluationTraceProps> = ({
  evaluation,
  onBackToList,
  onOpenReview
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    request: true,
    policy: true,
    tier0: true,
    router: true,
    tier1: true,
    action: true,
    risk: true,
    policy_engine: true
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const decisionColors = {
    ALLOW: 'bg-green-500/10 text-green-400 border border-green-500/20',
    MODIFY: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    ESCALATE: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    BLOCK: 'bg-red-500/10 text-red-400 border border-red-500/20'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-darkBorder pb-4 space-y-4 md:space-y-0">
        <div>
          <button onClick={onBackToList} className="text-xs text-darkTextSecondary hover:text-darkTextPrimary transition-colors flex items-center space-x-1 mb-2">
            <span>← Back to Evaluations</span>
          </button>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold tracking-tight text-darkTextPrimary">Trace Log {evaluation.request_id}</h1>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${decisionColors[evaluation.decision]}`}>
              {evaluation.decision}
            </span>
          </div>
          <p className="text-xs text-darkTextSecondary mt-1">Audit log mapping for {evaluation.request.application_id} (timestamp: {evaluation.timestamp})</p>
        </div>

        {/* Global Summary Stats */}
        <div className="flex items-center space-x-4 bg-darkBg/60 border border-darkBorder p-3 rounded">
          <div className="text-center px-3 border-r border-darkBorder">
            <div className="text-[10px] text-darkTextSecondary uppercase">Calibrated Risk</div>
            <div className={`text-base font-semibold font-mono ${
              evaluation.severity === 'CRITICAL' ? 'text-riskCritical' :
              evaluation.severity === 'HIGH' ? 'text-riskHigh' :
              evaluation.severity === 'MEDIUM' ? 'text-riskMedium' : 'text-riskLow'
            }`}>{evaluation.overall_risk.toFixed(2)}</div>
          </div>
          <div className="text-center px-3 border-r border-darkBorder">
            <div className="text-[10px] text-darkTextSecondary uppercase">Confidence</div>
            <div className="text-base font-semibold text-darkTextPrimary font-mono">{(evaluation.risk_engine.confidence * 100).toFixed(0)}%</div>
          </div>
          <div className="text-center px-3">
            <div className="text-[10px] text-darkTextSecondary uppercase">Policy ID</div>
            <div className="text-base font-semibold text-blue-400 font-mono text-xs mt-1">{evaluation.policy_id}</div>
          </div>
        </div>
      </div>

      {/* Expandable Trace Pipeline */}
      <div className="space-y-4 max-w-4xl">
        
        {/* Stage 1: Request Payload */}
        <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
          <button onClick={() => toggleSection('request')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
            <div className="flex items-center space-x-2.5">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">01. Original Request Payload</span>
            </div>
            {openSections.request ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
          </button>
          
          {openSections.request && (
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-darkBorder/60 pb-3 text-darkTextSecondary">
                <div>Application: <span className="text-darkTextPrimary font-medium">{evaluation.request.application_id}</span></div>
                <div>Session ID: <span className="text-darkTextPrimary font-mono">{evaluation.request.session_id}</span></div>
                <div>LLM Model: <span className="text-darkTextPrimary font-mono">{evaluation.request.model_id}</span></div>
                <div>Task Type: <span className="text-darkTextPrimary font-mono">{evaluation.request.task_type}</span></div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">User Prompt</span>
                  <pre className="bg-darkBg p-3 rounded font-mono text-darkTextPrimary mt-1 border border-darkBorder whitespace-pre-wrap font-sans leading-relaxed">{evaluation.request.user_prompt}</pre>
                </div>
                {evaluation.request.llm_response && (
                  <div>
                    <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">LLM Response Response</span>
                    <pre className="bg-darkBg p-3 rounded font-mono text-darkTextPrimary mt-1 border border-darkBorder whitespace-pre-wrap font-sans leading-relaxed">{evaluation.request.llm_response}</pre>
                  </div>
                )}
                {evaluation.request.tool_call && (
                  <div className="bg-darkBg p-3 rounded border border-darkBorder flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-riskHigh font-mono block">INTERCEPTED TOOL CALL</span>
                      <span className="font-mono text-darkTextPrimary text-[13px]">{evaluation.request.tool_call.tool_name}</span>
                    </div>
                    <pre className="font-mono text-[11px] text-darkTextSecondary">{evaluation.request.tool_call.arguments}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stage 2: Policy Configuration */}
        <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
          <button onClick={() => toggleSection('policy')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
            <div className="flex items-center space-x-2.5">
              <Settings className="h-4 w-4 text-purple-500" />
              <span className="font-semibold">02. Policy Bindings</span>
            </div>
            {openSections.policy ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
          </button>
          
          {openSections.policy && (
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-darkTextSecondary block">Active Policy</span>
                <span className="font-medium text-darkTextPrimary font-mono">{evaluation.policy_id} (v{evaluation.policy_version})</span>
              </div>
              <div>
                <span className="text-darkTextSecondary block">Risk Profile</span>
                <span className="font-medium text-darkTextPrimary uppercase">high</span>
              </div>
              <div>
                <span className="text-darkTextSecondary block">Evidence Gating</span>
                <span className="font-medium text-darkTextPrimary">REQUIRED FOR FINANCE_CLAIM</span>
              </div>
              <div>
                <span className="text-darkTextSecondary block">Destructive Actions</span>
                <span className="font-medium text-red-400">Escalate & Review</span>
              </div>
            </div>
          )}
        </div>

        {/* Stage 3: Tier 0 Fast Checks */}
        <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
          <button onClick={() => toggleSection('tier0')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
            <div className="flex items-center space-x-2.5">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="font-semibold">03. Tier 0 Fast Checks (Parallel Detectors)</span>
            </div>
            {openSections.tier0 ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
          </button>
          
          {openSections.tier0 && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {evaluation.tier0.map((det, idx) => (
                  <div key={idx} className="border border-darkBorder bg-darkBg/40 p-3 rounded space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-darkTextPrimary">{det.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                        det.status === 'FAIL' ? 'bg-[#ef444415] text-riskCritical' :
                        det.status === 'ELEVATED' ? 'bg-[#f9731615] text-riskHigh' :
                        'bg-[#22c55e15] text-riskLow'
                      }`}>{det.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-darkTextSecondary">Score:</span>
                      <span className="font-mono text-darkTextPrimary font-medium">{det.score.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-darkTextSecondary leading-relaxed pt-1 border-t border-darkBorder/40">
                      {det.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stage 4: Risk Router Decision */}
        <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
          <button onClick={() => toggleSection('router')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold">04. Risk Router (Gating Logic)</span>
            </div>
            {openSections.router ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
          </button>
          
          {openSections.router && (
            <div className="p-4 space-y-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-darkTextSecondary">Deep Verification Required:</span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold ${evaluation.risk_router.deep_verify_required ? 'bg-[#f9731615] text-riskHigh border border-orange-500/10' : 'bg-green-500/10 text-green-400'}`}>
                  {evaluation.risk_router.deep_verify_required ? 'YES' : 'NO'}
                </span>
              </div>
              <div>
                <span className="text-darkTextSecondary block">Gating Reason:</span>
                <p className="text-darkTextPrimary font-medium mt-0.5">{evaluation.risk_router.reason}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stage 5: Tier 1 Deep Verification */}
        {evaluation.tier1 && (
          <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
            <button onClick={() => toggleSection('tier1')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
              <div className="flex items-center space-x-2.5">
                <Database className="h-4 w-4 text-riskHigh" />
                <span className="font-semibold">05. Tier 1 Deep Verification (NLI Grounding)</span>
              </div>
              {openSections.tier1 ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
            </button>
            
            {openSections.tier1 && (
              <div className="p-4 space-y-4 text-xs">
                <div>
                  <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">Claim Extraction</span>
                  <div className="bg-darkBg p-3 border border-darkBorder rounded mt-1 font-mono text-darkTextPrimary leading-relaxed">
                    "{evaluation.tier1.claims[0]?.text}"
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">Retrieval Context (Vector Chunk)</span>
                    {evaluation.tier1.verifications[0]?.evidence_chunks.length > 0 ? (
                      <div className="bg-darkBg p-3 border border-darkBorder rounded text-[11px] leading-relaxed space-y-2">
                        <div className="text-darkTextPrimary">"{evaluation.tier1.verifications[0].evidence_chunks[0].text}"</div>
                        <div className="flex items-center justify-between pt-1 border-t border-darkBorder/40 text-[10px] text-darkTextSecondary font-mono">
                          <span>Source: {evaluation.tier1.verifications[0].evidence_chunks[0].document_id}</span>
                          <span className="text-green-400">Cosine Sim: {evaluation.tier1.verifications[0].evidence_chunks[0].similarity.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-darkBg/40 border border-dashed border-darkBorder p-4 rounded text-center text-darkTextSecondary italic">
                        No references found. Verification verdict matches missing evidence threshold.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-darkTextSecondary uppercase font-semibold font-mono">NLI Verdict Gating</span>
                    {evaluation.tier1.verifications[0] && (
                      <div className="bg-darkBg p-3 border border-darkBorder rounded space-y-3">
                        <div className="flex items-center justify-between">
                          <span>Verification Verdict:</span>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                            evaluation.tier1.verifications[0].verdict === 'SUPPORTED' ? 'bg-[#22c55e15] text-riskLow border border-green-500/10' :
                            evaluation.tier1.verifications[0].verdict === 'CONTRADICTED' ? 'bg-[#ef444415] text-riskCritical border border-red-500/10' :
                            'bg-[#a1a1aa15] text-darkTextSecondary border border-darkBorder'
                          }`}>{evaluation.tier1.verifications[0].verdict}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Verifier Confidence:</span>
                          <span className="font-mono text-darkTextPrimary font-semibold">{(evaluation.tier1.verifications[0].confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-[10px] text-darkTextSecondary">
                          {evaluation.tier1.verifications[0].verdict === 'CONTRADICTED' ? 'Warning: LLM generation conflicts with active document base records.' :
                           evaluation.tier1.verifications[0].verdict === 'SUPPORTED' ? 'Grounding verification verified. Output release approved.' :
                           'Alert: Evidence query failed. Verdict set to UNKNOWN (no false markers assumed).'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 6: Tool Action Gating */}
        {evaluation.action_validator && (
          <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
            <button onClick={() => toggleSection('action')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
              <div className="flex items-center space-x-2.5">
                <CheckSquare className="h-4 w-4 text-red-400" />
                <span className="font-semibold">06. Action Validator (Tool Call Restrictions)</span>
              </div>
              {openSections.action ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
            </button>
            
            {openSections.action && (
              <div className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-darkBg/50 p-2 border border-darkBorder rounded">
                    <span className="text-[10px] text-darkTextSecondary block">IMPACT SCORE</span>
                    <span className="text-sm font-semibold text-darkTextPrimary font-mono">{evaluation.action_validator.impact.toFixed(2)}</span>
                  </div>
                  <div className="bg-darkBg/50 p-2 border border-darkBorder rounded">
                    <span className="text-[10px] text-darkTextSecondary block">REVERSIBILITY</span>
                    <span className="text-sm font-semibold text-darkTextPrimary font-mono">{evaluation.action_validator.reversibility.toFixed(2)}</span>
                  </div>
                  <div className="bg-darkBg/50 p-2 border border-darkBorder rounded">
                    <span className="text-[10px] text-darkTextSecondary block">AUTHORIZATION</span>
                    <span className={`text-sm font-semibold font-mono ${evaluation.action_validator.authorization_status === 'VALID' ? 'text-green-400' : 'text-red-400'}`}>{evaluation.action_validator.authorization_status}</span>
                  </div>
                  <div className="bg-darkBg/50 p-2 border border-darkBorder rounded">
                    <span className="text-[10px] text-darkTextSecondary block">EXTERNAL SIDE-EFFECTS</span>
                    <span className="text-sm font-semibold text-darkTextPrimary font-mono">{evaluation.action_validator.external_side_effect ? 'YES' : 'NO'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-[#ef444410] border border-[#ef444420] p-3 rounded">
                  <div>
                    <span className="text-[10px] text-darkTextSecondary">ACTION VALIDATION RESULT:</span>
                    <div className="font-semibold text-darkTextPrimary">Tool call requires administrative signature due to high impact score.</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded font-mono font-bold text-xs ${
                    evaluation.action_validator.validation_result === 'HIGH RISK' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400'
                  }`}>{evaluation.action_validator.validation_result}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 7: Risk Engine contributions (SHAP) */}
        <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
          <button onClick={() => toggleSection('risk')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
            <div className="flex items-center space-x-2.5">
              <Shield className="h-4 w-4 text-riskHigh" />
              <span className="font-semibold">07. Risk Engine (XGBoost Calibrated Risk Analysis)</span>
            </div>
            {openSections.risk ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
          </button>
          
          {openSections.risk && (
            <div className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center text-darkTextSecondary text-[10px] border-b border-darkBorder/40 pb-3">
                <div>OVERALL RISK: <span className="font-semibold font-mono text-darkTextPrimary text-xs">{evaluation.risk_engine.overall_risk.toFixed(2)}</span></div>
                <div>VERIFIER CONFIDENCE: <span className="font-semibold font-mono text-darkTextPrimary text-xs">{(evaluation.risk_engine.confidence * 100).toFixed(0)}%</span></div>
                <div>UNCERTAINTY: <span className="font-semibold font-mono text-darkTextPrimary text-xs">{(evaluation.risk_engine.uncertainty * 100).toFixed(0)}%</span></div>
              </div>

              {/* SHAP contributions */}
              <div className="space-y-3">
                <span className="text-[10px] text-darkTextSecondary uppercase font-semibold font-mono">Risk Engine Feature Contributions (SHAP-style)</span>
                <div className="space-y-2">
                  {evaluation.risk_engine.shap_contributions.map((s, idx) => (
                    <div key={idx} className="flex items-center space-x-4">
                      <div className="w-32 text-darkTextSecondary text-[11px] truncate">{s.feature}</div>
                      <div className="flex-1 h-3.5 bg-darkBg rounded overflow-hidden relative">
                        <div className="h-full bg-blue-500 rounded transition-all" style={{ width: `${s.contribution * 100}%` }} />
                      </div>
                      <span className="font-mono text-darkTextPrimary text-[11px] w-8 text-right">+{s.contribution.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stage 8: Policy Engine */}
        <div className="border border-darkBorder rounded bg-darkSurface overflow-hidden">
          <button onClick={() => toggleSection('policy_engine')} className="w-full flex items-center justify-between p-3.5 bg-darkBg/30 hover:bg-darkBg/50 transition-colors text-xs text-darkTextPrimary border-b border-darkBorder">
            <div className="flex items-center space-x-2.5">
              <Settings className="h-4 w-4 text-purple-400" />
              <span className="font-semibold">08. Policy Engine (YAML Mapped Rules)</span>
            </div>
            {openSections.policy_engine ? <ChevronUp className="h-4 w-4 text-darkTextSecondary" /> : <ChevronDown className="h-4 w-4 text-darkTextSecondary" />}
          </button>
          
          {openSections.policy_engine && (
            <div className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 text-darkTextSecondary border-b border-darkBorder/40 pb-3">
                <div>Mapped Policy: <span className="font-mono font-medium text-darkTextPrimary">{evaluation.policy_engine.policy_id} (v{evaluation.policy_engine.version})</span></div>
                <div>Resulting Decision: <span className="font-mono font-medium text-darkTextPrimary">{evaluation.policy_engine.decision}</span></div>
              </div>

              {evaluation.policy_engine.triggered_rules.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[10px] text-darkTextSecondary uppercase font-semibold font-mono">Triggered Compliance Rules</span>
                  <div className="space-y-2">
                    {evaluation.policy_engine.triggered_rules.map((rule, idx) => (
                      <div key={idx} className="bg-darkBg border border-darkBorder p-2.5 rounded flex items-start space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-darkSurface border border-darkBorder font-mono text-[10px] text-yellow-400">{rule.rule_id}</span>
                        <p className="text-[11px] text-darkTextPrimary flex-1 mt-0.5">{rule.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-green-400">All checks satisfied. No policy rules triggered.</div>
              )}
            </div>
          )}
        </div>

        {/* Final Decision Panel */}
        <div className="rounded-lg border border-darkBorder bg-darkSurface p-6 text-center space-y-4 max-w-4xl">
          <div className="space-y-1.5">
            <span className="text-[10px] text-darkTextSecondary uppercase tracking-widest font-semibold font-mono">Governed Output Action</span>
            <div className="text-xl font-bold tracking-tight text-darkTextPrimary">
              {evaluation.decision === 'ALLOW' ? 'RELEASE RESPONSE' :
               evaluation.decision === 'MODIFY' ? 'RESPONSE MODIFIED (REDACTED)' :
               evaluation.decision === 'ESCALATE' ? 'HUMAN REVIEW REQUIRED' : 'TRANSACTION BLOCKED'}
            </div>
            <p className="text-xs text-darkTextSecondary max-w-md mx-auto">{evaluation.policy_engine.reason}</p>
          </div>

          <div className="flex justify-center space-x-3">
            {evaluation.decision === 'ALLOW' && (
              <span className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-semibold rounded font-mono">
                ✓ Response Released
              </span>
            )}
            {evaluation.decision === 'MODIFY' && (
              <div className="space-y-2 w-full max-w-lg">
                <span className="px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-semibold rounded font-mono inline-block">
                  ✏️ Redacted Output Generated
                </span>
                <pre className="bg-darkBg p-3 rounded font-mono text-green-300 text-left border border-darkBorder text-[11px] whitespace-pre-wrap leading-relaxed mt-2">
                  {evaluation.request.modified_response}
                </pre>
              </div>
            )}
            {evaluation.decision === 'ESCALATE' && (
              <button
                onClick={() => onOpenReview(evaluation.request_id)}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-6 py-2.5 rounded cursor-pointer transition-all"
              >
                Open Review Queue
              </button>
            )}
            {evaluation.decision === 'BLOCK' && (
              <span className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold rounded font-mono">
                ✕ Content Blocked
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
