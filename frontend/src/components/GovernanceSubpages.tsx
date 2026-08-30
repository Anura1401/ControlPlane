import React, { useState } from 'react';
import { HumanReviewItem, PolicyConfig, AuditRecord, Evaluation, DecisionType } from '../types/controlplane';
import { CheckCircle, Ban, Search, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ==========================================
   1. HUMAN REVIEW PAGE
   ========================================== */
interface HumanReviewProps {
  reviews: HumanReviewItem[];
  onResolve: (requestId: string, status: 'APPROVED' | 'REJECTED') => void;
  onSelectRequestTrace: (requestId: string) => void;
}

export const HumanReview: React.FC<HumanReviewProps> = ({ reviews, onResolve, onSelectRequestTrace }) => {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(reviews[0]?.request_id || null);

  const activeReview = reviews.find(r => r.request_id === selectedReviewId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary">Human Review Operations</h1>
        <p className="text-sm text-darkTextSecondary">Administrative verification queue for policy escalations and tool-call approvals.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue List */}
        <div className="lg:col-span-1 border border-darkBorder bg-darkSurface rounded-lg overflow-hidden">
          <div className="p-4 border-b border-darkBorder bg-darkBg/20">
            <h2 className="text-xs font-semibold uppercase text-darkTextPrimary tracking-wider">Verification Queue</h2>
          </div>
          
          {reviews.length === 0 ? (
            <div className="p-8 text-center text-xs text-darkTextSecondary italic">No review items pending.</div>
          ) : (
            <div className="divide-y divide-darkBorder">
              {reviews.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedReviewId(r.request_id)}
                  className={`p-4 text-xs space-y-2 cursor-pointer transition-all ${
                    selectedReviewId === r.request_id ? 'bg-blue-950/10 border-l-2 border-blue-500' : 'hover:bg-darkBg'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-blue-400">{r.request_id}</span>
                    <span className="text-[10px] text-darkTextSecondary">{r.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-darkTextPrimary">{r.application_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-400 font-mono">
                      Risk {r.risk.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-darkTextSecondary">
                    <span>Issue: {r.primary_issue}</span>
                    <span className="font-semibold text-yellow-500">{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resolve Panel */}
        <div className="lg:col-span-2 space-y-4">
          {activeReview ? (
            <div className="border border-darkBorder bg-darkSurface rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-darkBorder pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-darkTextPrimary font-mono">Review Case: {activeReview.request_id}</h3>
                  <p className="text-[11px] text-darkTextSecondary mt-0.5">Escalated on App: {activeReview.application_id}</p>
                </div>
                <button
                  onClick={() => onSelectRequestTrace(activeReview.request_id)}
                  className="text-xs text-blue-400 hover:underline cursor-pointer"
                >
                  Inspect Full Pipeline Trace
                </button>
              </div>

              {/* Review details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">Risk Engine Score</span>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="text-lg font-bold font-mono text-orange-400">{activeReview.risk.toFixed(2)}</span>
                      <span className="text-[10px] text-darkTextSecondary">(Critical Severity Override)</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">Primary Issue</span>
                    <div className="mt-1 font-medium text-darkTextPrimary">{activeReview.primary_issue}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">Reason for Escalation</span>
                    <p className="mt-1 text-darkTextPrimary leading-relaxed">
                      This transaction was flagged for compliance verification because factual assertions generated mismatch internal database references or tool calls have missing author signatures.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {activeReview.status === 'PENDING' ? (
                <div className="flex items-center space-x-3 pt-4 border-t border-darkBorder/60">
                  <button
                    onClick={() => onResolve(activeReview.request_id, 'APPROVED')}
                    className="flex items-center space-x-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-5 py-2.5 rounded transition-all cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>APPROVE & RELEASE</span>
                  </button>
                  <button
                    onClick={() => onResolve(activeReview.request_id, 'REJECTED')}
                    className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-5 py-2.5 rounded transition-all cursor-pointer"
                  >
                    <Ban className="h-4 w-4" />
                    <span>REJECT & BLOCK</span>
                  </button>
                </div>
              ) : (
                <div className="pt-4 border-t border-darkBorder/60 text-xs flex items-center justify-between text-darkTextSecondary font-mono">
                  <span>RESOLVED DECISION: <span className={activeReview.status === 'APPROVED' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{activeReview.status}</span></span>
                  <span>Reviewer: {activeReview.reviewer} ({activeReview.reviewed_at})</span>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-darkBorder bg-darkSurface rounded-lg p-12 text-center text-xs text-darkTextSecondary italic">
              Select an item from the queue to start human review operations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   2. AGENT ACTION MONITOR PAGE
   ========================================== */
interface AgentToolsProps {
  evaluations: Evaluation[];
  onSelectEvaluation: (id: string) => void;
}

export const AgentTools: React.FC<AgentToolsProps> = ({ evaluations, onSelectEvaluation }) => {
  const toolEvals = evaluations.filter(e => e.request.tool_call || e.action_validator);

  // Mocks stats for tools page
  const totalCalls = toolEvals.length * 8 + 84;
  const blockedCalls = toolEvals.filter(e => e.decision === 'BLOCK').length * 2 + 12;
  const escalatedCalls = toolEvals.filter(e => e.decision === 'ESCALATE').length * 1 + 8;
  const highImpactCount = toolEvals.filter(e => e.action_validator && e.action_validator.impact >= 0.80).length * 4 + 32;
  const unauthorizedCalls = toolEvals.filter(e => e.action_validator && e.action_validator.authorization_status === 'INVALID').length * 2 + 14;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary">Agent Action Monitor</h1>
        <p className="text-sm text-darkTextSecondary">Real-time validation tracking of external tool executions and agent tool invocation layers.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="border border-darkBorder bg-darkSurface p-4 rounded-lg space-y-1 text-center">
          <span className="text-[10px] text-darkTextSecondary uppercase block">Tool Calls</span>
          <span className="text-xl font-bold text-darkTextPrimary font-mono">{totalCalls}</span>
        </div>
        <div className="border border-darkBorder bg-darkSurface p-4 rounded-lg space-y-1 text-center">
          <span className="text-[10px] text-darkTextSecondary uppercase block">Blocked Actions</span>
          <span className="text-xl font-bold text-red-400 font-mono">{blockedCalls}</span>
        </div>
        <div className="border border-darkBorder bg-darkSurface p-4 rounded-lg space-y-1 text-center">
          <span className="text-[10px] text-darkTextSecondary uppercase block">Escalated Actions</span>
          <span className="text-xl font-bold text-orange-400 font-mono">{escalatedCalls}</span>
        </div>
        <div className="border border-darkBorder bg-darkSurface p-4 rounded-lg space-y-1 text-center">
          <span className="text-[10px] text-darkTextSecondary uppercase block">High Impact Calls</span>
          <span className="text-xl font-bold text-blue-400 font-mono">{highImpactCount}</span>
        </div>
        <div className="border border-darkBorder bg-darkSurface p-4 rounded-lg space-y-1 text-center">
          <span className="text-[10px] text-darkTextSecondary uppercase block">Auth Violations</span>
          <span className="text-xl font-bold text-riskHigh font-mono">{unauthorizedCalls}</span>
        </div>
      </div>

      {/* Action Table */}
      <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 space-y-4 overflow-hidden">
        <div>
          <h2 className="text-xs font-semibold text-darkTextPrimary uppercase tracking-wider">Live Agent Executions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-darkBorder text-darkTextSecondary">
                <th className="py-2 font-medium">Request ID</th>
                <th className="py-2 font-medium">Agent Application</th>
                <th className="py-2 font-medium">Intercepted Tool</th>
                <th className="py-2 font-medium text-center">Impact Score</th>
                <th className="py-2 font-medium text-center">Auth Status</th>
                <th className="py-2 font-medium text-center">Sensitivity</th>
                <th className="py-2 font-medium text-center">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkBorder text-darkTextPrimary">
              {toolEvals.map((item, idx) => {
                const val = item.action_validator;
                if (!val) return null;
                return (
                  <tr key={idx} className="hover:bg-darkBg/60 transition-colors cursor-pointer" onClick={() => onSelectEvaluation(item.request_id)}>
                    <td className="py-3 text-blue-400 font-mono font-medium">{item.request_id}</td>
                    <td className="py-3">{item.request.application_id}</td>
                    <td className="py-3 font-mono text-darkTextSecondary text-[11px]">{val.tool_name}</td>
                    <td className="py-3 text-center font-mono text-darkTextSecondary">{val.impact.toFixed(2)}</td>
                    <td className="py-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        val.authorization_status === 'VALID' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>{val.authorization_status}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        val.sensitivity >= 0.80 ? 'bg-red-500/10 text-red-400 font-mono' :
                        val.sensitivity >= 0.50 ? 'bg-yellow-500/10 text-yellow-400 font-mono' :
                        'bg-green-500/10 text-green-400 font-mono'
                      }`}>{val.sensitivity >= 0.80 ? 'HIGH' : (val.sensitivity >= 0.50 ? 'MEDIUM' : 'LOW')}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.decision === 'BLOCK' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        item.decision === 'ESCALATE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        'bg-green-500/10 text-green-400'
                      }`}>{item.decision}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   3. POLICY MANAGEMENT & POLICY BUILDER
   ========================================== */
interface PoliciesProps {
  policies: PolicyConfig[];
  onSave: (config: PolicyConfig) => void;
}

export const Policies: React.FC<PoliciesProps> = ({ policies, onSave }) => {
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyConfig | null>(null);

  // Policy Builder Fields
  const [appId, setAppId] = useState<string>('finance_support');
  const [policyName, setPolicyName] = useState<string>('');
  const [profile, setProfile] = useState<'low' | 'medium' | 'high'>('high');
  const [piiResponse, setPiiResponse] = useState<DecisionType>('MODIFY');
  const [truthResponse, setTruthResponse] = useState<DecisionType>('ESCALATE');
  const [biasResponse, setBiasResponse] = useState<DecisionType>('ESCALATE');
  const [injectionResponse, setInjectionResponse] = useState<DecisionType>('BLOCK');
  const [evidenceReq, setEvidenceReq] = useState<boolean>(true);
  const [toolAction, setToolAction] = useState<DecisionType>('BLOCK');
  const [costLimit, setCostLimit] = useState<number>(0.01);

  const handleOpenBuilder = (policy: PolicyConfig | null) => {
    if (policy) {
      setSelectedPolicy(policy);
      setAppId(policy.application_id);
      setPolicyName(policy.policy_id);
      setProfile(policy.risk_profile);
      setPiiResponse(policy.pii_modify >= 0.50 ? 'MODIFY' : 'BLOCK');
      setTruthResponse(policy.truth_verify >= 0.50 ? 'ESCALATE' : 'BLOCK');
      setBiasResponse(policy.bias_escalate >= 0.50 ? 'ESCALATE' : 'BLOCK');
      setInjectionResponse(policy.injection_block >= 0.90 ? 'BLOCK' : 'ESCALATE');
      setEvidenceReq(policy.evidence_required);
      setToolAction(policy.unknown_auth_action);
      setCostLimit(policy.operational_cost_limit);
    } else {
      setSelectedPolicy(null);
      setAppId('finance_support');
      setPolicyName('Custom-Policy');
      setProfile('medium');
      setPiiResponse('MODIFY');
      setTruthResponse('ESCALATE');
      setBiasResponse('ESCALATE');
      setInjectionResponse('BLOCK');
      setEvidenceReq(true);
      setToolAction('BLOCK');
      setCostLimit(0.01);
    }
    setIsBuilding(true);
  };

  const handleSavePolicy = () => {
    const config: PolicyConfig = {
      policy_id: policyName,
      version: selectedPolicy ? (parseFloat(selectedPolicy.version) + 0.1).toFixed(1) : '1.0',
      application_id: appId,
      risk_profile: profile,
      status: 'ACTIVE',
      last_updated: '',
      injection_block: injectionResponse === 'BLOCK' ? 0.95 : 0.85,
      toxicity_block: 0.90,
      pii_modify: piiResponse === 'MODIFY' ? 0.60 : 0.40,
      pii_block: 0.99,
      bias_escalate: biasResponse === 'ESCALATE' ? 0.70 : 0.50,
      truth_verify: truthResponse === 'ESCALATE' ? 0.50 : 0.70,
      verification_contradiction_escalate: true,
      retrieval_min_similarity: 0.65,
      evidence_required: evidenceReq,
      tool_impact_block: 0.85,
      unknown_auth_action: toolAction,
      operational_cost_limit: costLimit
    };
    onSave(config);
    setIsBuilding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-darkBorder pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary">Policy Config Management</h1>
          <p className="text-sm text-darkTextSecondary">Configure safety limits, and map override actions deterministic-style.</p>
        </div>
        {!isBuilding && (
          <button
            onClick={() => handleOpenBuilder(null)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>CREATE POLICY</span>
          </button>
        )}
      </div>

      {isBuilding ? (
        /* Policy Configuration Builder UI */
        <div className="border border-darkBorder bg-darkSurface rounded-lg p-6 space-y-6 max-w-2xl">
          <div className="border-b border-darkBorder pb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-darkTextPrimary">Configure Policy: {policyName}</h2>
            <span className="font-mono text-xs text-darkTextSecondary">Revision increment mode</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs space-y-2 md:space-y-0">
            <div className="space-y-1">
              <label className="text-darkTextSecondary block">Policy Identifier</label>
              <input
                type="text"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-darkTextSecondary block">Assigned Application ID</label>
              <select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary focus:outline-none"
              >
                <option value="finance_support">Finance Assistant</option>
                <option value="hr_support">HR Assistant</option>
                <option value="customer_support">Customer Support Copilot</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-darkTextSecondary block">Risk Profile Profile</label>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value as any)}
                className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary focus:outline-none"
              >
                <option value="low">Low Risk Tolerance</option>
                <option value="medium">Medium Risk Tolerance</option>
                <option value="high">High Risk Tolerance</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-darkTextSecondary block">Operational Cost limit ($)</label>
              <input
                type="number"
                step="0.001"
                value={costLimit}
                onChange={(e) => setCostLimit(parseFloat(e.target.value))}
                className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Action Mapping Selectors */}
          <div className="space-y-4 pt-4 border-t border-darkBorder text-xs">
            <h3 className="text-xs font-semibold text-darkTextSecondary uppercase tracking-wider">MAPPED COMPLIANCE ACTIONS</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
                <span>PII Leak Detection</span>
                <select value={piiResponse} onChange={(e) => setPiiResponse(e.target.value as any)} className="bg-darkBg border border-darkBorder p-1 text-[10px] rounded focus:outline-none">
                  <option value="MODIFY">MODIFY (Redact)</option>
                  <option value="BLOCK">BLOCK</option>
                  <option value="ESCALATE">ESCALATE</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
                <span>Contradicted Facts / Hallucinations</span>
                <select value={truthResponse} onChange={(e) => setTruthResponse(e.target.value as any)} className="bg-darkBg border border-darkBorder p-1 text-[10px] rounded focus:outline-none">
                  <option value="ESCALATE">ESCALATE (Review)</option>
                  <option value="BLOCK">BLOCK</option>
                  <option value="ALLOW">ALLOW</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
                <span>Demographic Bias</span>
                <select value={biasResponse} onChange={(e) => setBiasResponse(e.target.value as any)} className="bg-darkBg border border-darkBorder p-1 text-[10px] rounded focus:outline-none">
                  <option value="ESCALATE">ESCALATE</option>
                  <option value="BLOCK">BLOCK</option>
                  <option value="ALLOW">ALLOW</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
                <span>Prompt Injection</span>
                <select value={injectionResponse} onChange={(e) => setInjectionResponse(e.target.value as any)} className="bg-darkBg border border-darkBorder p-1 text-[10px] rounded focus:outline-none">
                  <option value="BLOCK">BLOCK</option>
                  <option value="ESCALATE">ESCALATE</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
              <span>Tool Action (Missing Auth Signature)</span>
              <select value={toolAction} onChange={(e) => setToolAction(e.target.value as any)} className="bg-darkBg border border-darkBorder p-1 text-[10px] rounded focus:outline-none">
                <option value="BLOCK">BLOCK</option>
                <option value="ESCALATE">ESCALATE</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="evidence_req_cb"
                checked={evidenceReq}
                onChange={(e) => setEvidenceReq(e.target.checked)}
                className="rounded bg-darkBg border-darkBorder focus:ring-0 text-blue-500 h-4 w-4"
              />
              <label htmlFor="evidence_req_cb" className="text-xs text-darkTextSecondary cursor-pointer select-none">
                Require reference evidence in vector storage for factual assertions (Hallucination Gating)
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-darkBorder">
            <button
              onClick={handleSavePolicy}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2 rounded cursor-pointer transition-all"
            >
              SAVE CONFIGURATION
            </button>
            <button
              onClick={() => setIsBuilding(false)}
              className="border border-darkBorder hover:bg-darkSurface text-darkTextPrimary text-xs px-4 py-2 rounded cursor-pointer transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Policies List UI */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {policies.map((p, idx) => (
            <div key={idx} className="border border-darkBorder bg-darkSurface rounded-lg p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-darkTextPrimary">{p.policy_id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-medium">v{p.version}</span>
                </div>
                <div className="text-xs text-darkTextSecondary">
                  <div>Application ID: <span className="text-darkTextPrimary font-mono">{p.application_id}</span></div>
                  <div>Risk Profile: <span className="text-darkTextPrimary uppercase">{p.risk_profile}</span></div>
                  <div>Last Updated: <span className="text-[10px] font-mono block mt-1">{p.last_updated}</span></div>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-darkBorder/60">
                <button
                  onClick={() => handleOpenBuilder(p)}
                  className="w-1/2 border border-darkBorder hover:bg-darkBg text-xs text-darkTextPrimary py-1.5 rounded cursor-pointer transition-all text-center"
                >
                  Edit Policy
                </button>
                <span className="w-1/2 text-center text-[10px] text-green-400 font-bold border border-green-500/20 bg-green-500/5 py-1.5 rounded">
                  ● ACTIVE
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ==========================================
   4. MONITORING PAGE
   ========================================== */
export const Monitoring: React.FC = () => {
  // Static monitoring metrics data
  const data = [
    { name: '10:00', requests: 120, latency: 110, cost: 0.012 },
    { name: '10:10', requests: 240, latency: 154, cost: 0.024 },
    { name: '10:20', requests: 180, latency: 120, cost: 0.018 },
    { name: '10:30', requests: 310, latency: 380, cost: 0.045 }, // Spike (anomaly)
    { name: '10:40', requests: 190, latency: 130, cost: 0.019 },
    { name: '10:50', requests: 210, latency: 125, cost: 0.021 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary">Operational Monitoring</h1>
        <p className="text-sm text-darkTextSecondary">Real-time latency metrics, resource cost metrics, and verification triggers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Latency and Request Traffic */}
        <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 space-y-3">
          <div>
            <h2 className="text-xs font-semibold text-darkTextPrimary uppercase tracking-wider">Average Latency (ms)</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} />
                <YAxis stroke="#52525b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }} />
                <Area type="monotone" dataKey="latency" stroke="#3b82f6" fill="#3b82f610" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operational Costs */}
        <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 space-y-3">
          <div>
            <h2 className="text-xs font-semibold text-darkTextPrimary uppercase tracking-wider">Governed Resource Costs ($)</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} />
                <YAxis stroke="#52525b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }} />
                <Area type="monotone" dataKey="cost" stroke="#10b981" fill="#10b98110" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   5. AUDIT LOG PAGE
   ========================================== */
interface AuditLogProps {
  logs: AuditRecord[];
  onSelectAuditTrace: (requestId: string) => void;
}

export const AuditLog: React.FC<AuditLogProps> = ({ logs, onSelectAuditTrace }) => {
  const [search, setSearch] = useState<string>('');
  const [appFilter, setAppFilter] = useState<string>('ALL');
  const [decisionFilter, setDecisionFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.request_id.toLowerCase().includes(search.toLowerCase()) ||
                          log.primary_risk.toLowerCase().includes(search.toLowerCase());
    const matchesApp = appFilter === 'ALL' || log.application_id.includes(appFilter);
    const matchesDecision = decisionFilter === 'ALL' || log.decision === decisionFilter;

    return matchesSearch && matchesApp && matchesDecision;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary">System Audit Logs</h1>
        <p className="text-sm text-darkTextSecondary">Secure, integrity-hashed, append-only logs for platform actions.</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-darkBorder bg-darkSurface p-4 rounded-lg text-xs">
        <div className="flex items-center space-x-2 border border-darkBorder bg-darkBg rounded px-2.5 py-1.5 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-darkTextSecondary" />
          <input
            type="text"
            placeholder="Search Request ID or primary issue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-darkTextPrimary focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center space-x-3 text-darkTextSecondary">
          <div className="flex items-center space-x-1.5">
            <span>App:</span>
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="bg-darkBg border border-darkBorder rounded p-1.5 text-darkTextPrimary text-[11px] focus:outline-none"
            >
              <option value="ALL">All Apps</option>
              <option value="Finance">Finance Assistant</option>
              <option value="Customer">Support Copilot</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span>Decision:</span>
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="bg-darkBg border border-darkBorder rounded p-1.5 text-darkTextPrimary text-[11px] focus:outline-none"
            >
              <option value="ALL">All Decisions</option>
              <option value="ALLOW">ALLOW</option>
              <option value="MODIFY">MODIFY</option>
              <option value="ESCALATE">ESCALATE</option>
              <option value="BLOCK">BLOCK</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-darkBorder text-darkTextSecondary">
                <th className="py-2 font-medium">Timestamp</th>
                <th className="py-2 font-medium">Request ID</th>
                <th className="py-2 font-medium">Governed Application</th>
                <th className="py-2 font-medium">Policy ID</th>
                <th className="py-2 font-medium text-center">Decision</th>
                <th className="py-2 font-medium text-center">Human Review</th>
                <th className="py-2 font-medium">SHA-256 Audit Integrity Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkBorder text-darkTextPrimary">
              {filteredLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-darkBg/60 transition-colors cursor-pointer group" onClick={() => onSelectAuditTrace(log.request_id)}>
                  <td className="py-3 text-darkTextSecondary font-mono">{log.timestamp}</td>
                  <td className="py-3 text-blue-400 font-mono font-medium group-hover:underline">{log.request_id}</td>
                  <td className="py-3">{log.application_id}</td>
                  <td className="py-3 font-mono text-darkTextSecondary text-[11px]">{log.policy} (v{log.policy_version})</td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      log.decision === 'BLOCK' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      log.decision === 'ESCALATE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                      log.decision === 'MODIFY' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-green-500/10 text-green-400'
                    }`}>{log.decision}</span>
                  </td>
                  <td className="py-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      log.human_review === 'APPROVED' ? 'bg-green-500/10 text-green-400' :
                      log.human_review === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                      log.human_review === 'PENDING' ? 'bg-orange-500/10 text-orange-400' :
                      'bg-darkBg text-darkTextSecondary border border-darkBorder'
                    }`}>{log.human_review}</span>
                  </td>
                  <td className="py-3 text-darkTextSecondary font-mono text-[10px] max-w-[200px] truncate">{log.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
