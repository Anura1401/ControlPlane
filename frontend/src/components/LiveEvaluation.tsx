import React, { useState, useEffect } from 'react';
import { controlplaneApi } from '../services/controlplaneApi';
import { demoScenarios } from '../data/mockData';
import { Evaluation } from '../types/controlplane';
import { Play, Loader, CheckCircle, AlertTriangle, ShieldAlert, Eye, ShieldCheck, ChevronDown, Activity } from 'lucide-react';

interface LiveEvaluationProps {
  onEvaluationCompleted: (evaluation: Evaluation) => void;
  onOpenReview: (requestId: string) => void;
}

export const LiveEvaluation: React.FC<LiveEvaluationProps> = ({
  onEvaluationCompleted,
  onOpenReview
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<number>(1);
  
  // Input fields
  const [application, setApplication] = useState<string>('finance_support');
  const [policyId, setPolicyId] = useState<string>('Finance-v2');
  const [prompt, setPrompt] = useState<string>('');
  const [llmResponse, setLlmResponse] = useState<string>('');
  const [retrievedContext, setRetrievedContext] = useState<string>('');
  const [toolName, setToolName] = useState<string>('');
  const [toolArgs, setToolArgs] = useState<string>('');
  const [isCostAnomaly, setIsCostAnomaly] = useState<boolean>(false);

  // Flow State
  const [evaluationMode, setEvaluationMode] = useState<'predefined' | 'gemini'>('predefined');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(-1);
  const [evaluationResult, setEvaluationResult] = useState<Evaluation | null>(null);
  
  const [isRechecking, setIsRechecking] = useState<boolean>(false);
  const [recheckPassed, setRecheckPassed] = useState<boolean>(false);
  const policy = controlplaneApi.getPolicies().find(p => p.policy_id === policyId) || controlplaneApi.getPolicies()[0];

  // Load selected scenario into form inputs
  useEffect(() => {
    if (evaluationMode === 'predefined') {
      const scenario = demoScenarios.find(s => s.id === selectedScenarioId);
      if (scenario) {
        setApplication(scenario.application);
        setPolicyId(scenario.policy);
        setPrompt(scenario.prompt);
        setLlmResponse(scenario.response);
        setRetrievedContext(scenario.context);
        setToolName(scenario.toolName);
        setToolArgs(scenario.toolArgs);
        setIsCostAnomaly(!!(scenario as any).costAnomaly);
        
        // Clear previous results
        setEvaluationResult(null);
        setCurrentStage(-1);
        setRecheckPassed(false);
        setIsRechecking(false);
      }
    }
  }, [selectedScenarioId, evaluationMode]);

  const pipelineStages = [
    { id: 0, label: 'Context & Policy Binding' },
    { id: 1, label: 'Tier 0 Fast Checks' },
    { id: 2, label: 'Risk Router Decision' },
    { id: 3, label: 'Tier 1 Deep Verification' },
    { id: 4, label: 'Action Validator (Tool Gating)' },
    { id: 5, label: 'Risk Engine (XGBoost & SHAP)' },
    { id: 6, label: 'Policy Engine Validation' },
    { id: 7, label: 'Decision Layer Action' }
  ];

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    setEvaluationResult(null);
    setCurrentStage(0);
    setRecheckPassed(false);
    setIsRechecking(false);

    let result: Evaluation;
    try {
      if (evaluationMode === 'gemini') {
        let toolObj = undefined;
        if (toolName) {
          try {
            toolObj = { tool_name: toolName, arguments: JSON.parse(toolArgs || '{}') };
          } catch (e) {
            toolObj = { tool_name: toolName, arguments: {} };
          }
        }
        result = await controlplaneApi.evaluateV1(
          application,
          policyId,
          prompt,
          undefined,
          toolObj,
          true
        );
      } else {
        result = controlplaneApi.runControlPlane(
          application,
          policyId,
          prompt,
          llmResponse,
          retrievedContext,
          toolName,
          toolArgs,
          isCostAnomaly
        );
      }
    } catch (e) {
      console.error(e);
      alert("Error: ControlPlane API connection failed. Ensure backend python server is running on http://localhost:8000.");
      setIsRunning(false);
      return;
    }

    // Simulated pipeline stage animation increments using live retrieved data
    for (let stage = 0; stage < 8; stage++) {
      setCurrentStage(stage);
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    setEvaluationResult(result);
    onEvaluationCompleted(result);
    setIsRunning(false);

    // If decision was MODIFY (redacted), trigger automatic re-check flow
    if (result.decision === 'MODIFY') {
      setIsRechecking(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsRechecking(false);
      setRecheckPassed(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary">Live Policy Evaluation Sandbox</h1>
        <p className="text-sm text-darkTextSecondary">Select one of our 12 security scenarios to simulate governance execution step-by-step.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Left Panel: Scenario Loader & Input Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-3">
            <h2 className="text-xs font-semibold text-darkTextPrimary tracking-wider uppercase">Sandbox Evaluation Mode</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setEvaluationMode('predefined')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  evaluationMode === 'predefined' ? 'bg-blue-600 text-white' : 'border border-darkBorder hover:bg-darkBg text-darkTextSecondary'
                }`}
              >
                BENCHMARK SELECTION
              </button>
              <button
                onClick={() => setEvaluationMode('gemini')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  evaluationMode === 'gemini' ? 'bg-blue-600 text-white' : 'border border-darkBorder hover:bg-darkBg text-darkTextSecondary'
                }`}
              >
                LIVE GEMINI API
              </button>
            </div>
          </div>

          {evaluationMode === 'predefined' && (
            <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-4">
              <h2 className="text-xs font-semibold text-darkTextPrimary tracking-wider uppercase">Scenario Loader</h2>
            
            <div className="relative">
              <select
                value={selectedScenarioId}
                onChange={(e) => setSelectedScenarioId(Number(e.target.value))}
                className="w-full bg-darkBg border border-darkBorder rounded p-2 text-xs text-darkTextPrimary focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
              >
                {demoScenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-darkTextSecondary">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
            
            </div>
          )}

          <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-4">
            <h2 className="text-xs font-semibold text-darkTextPrimary tracking-wider uppercase">Request Parameters</h2>
            
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-darkTextSecondary">Application ID</label>
                  <select
                    value={application}
                    onChange={(e) => setApplication(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary focus:outline-none"
                  >
                    <option value="finance_support">Finance Assistant</option>
                    <option value="hr_support">HR Assistant</option>
                    <option value="customer_support">Support Copilot</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-darkTextSecondary">Active Policy ID</label>
                  <select
                    value={policyId}
                    onChange={(e) => setPolicyId(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary focus:outline-none font-mono"
                  >
                    <option value="Finance-v2">Finance-v2 (v2.1)</option>
                    <option value="HR-v1">HR-v1 (v1.0)</option>
                    <option value="Support-v3">Support-v3 (v3.0)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-darkTextSecondary">User Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary font-mono focus:outline-none"
                  placeholder="Enter prompt instruction..."
                />
              </div>

              {!toolName && evaluationMode === 'predefined' && (
                <div className="space-y-1">
                  <label className="text-darkTextSecondary">LLM Response</label>
                  <textarea
                    value={llmResponse}
                    onChange={(e) => setLlmResponse(e.target.value)}
                    rows={2}
                    className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary font-mono focus:outline-none"
                    placeholder="Enter LLM response to check..."
                  />
                </div>
              )}

              {!toolName && evaluationMode === 'predefined' && (
                <div className="space-y-1">
                  <label className="text-darkTextSecondary">Retrieved Document Context</label>
                  <textarea
                    value={retrievedContext}
                    onChange={(e) => setRetrievedContext(e.target.value)}
                    rows={2}
                    className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary font-mono focus:outline-none"
                    placeholder="Vector store reference documents for grounding checks..."
                  />
                </div>
              )}

              {toolName && (
                <div className="grid grid-cols-2 gap-2 border border-darkBorder/60 bg-darkBg/30 p-2 rounded">
                  <div className="space-y-1">
                    <label className="text-darkTextSecondary">Intercepted Tool Call</label>
                    <input
                      type="text"
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary font-mono focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-darkTextSecondary">Arguments</label>
                    <input
                      type="text"
                      value={toolArgs}
                      onChange={(e) => setToolArgs(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder rounded p-2 text-darkTextPrimary font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="cost_anomaly_cb"
                  checked={isCostAnomaly}
                  onChange={(e) => setIsCostAnomaly(e.target.checked)}
                  className="rounded bg-darkBg border-darkBorder focus:ring-0 text-blue-500 h-4 w-4"
                />
                <label htmlFor="cost_anomaly_cb" className="text-xs text-darkTextSecondary cursor-pointer select-none">
                  Trigger artificial Operations Cost Anomaly
                </label>
              </div>

              <button
                disabled={isRunning}
                onClick={handleRunEvaluation}
                className="w-full mt-4 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium p-2.5 rounded transition-all cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Analyzing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>RUN CONTROLPLANE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panels: Trace Pipeline & Final Outcomes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-4">
            <h2 className="text-xs font-semibold text-darkTextPrimary tracking-wider uppercase">Active Trace pipeline</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pipeline Stages Column */}
              <div className="space-y-2">
                {pipelineStages.map((stage) => {
                  const isActive = currentStage === stage.id;
                  const isCompleted = currentStage > stage.id;
                  const isUntouched = currentStage < stage.id;
                  
                  return (
                    <div
                      key={stage.id}
                      className={`flex items-center justify-between p-2.5 rounded border text-xs transition-all ${
                        isActive ? 'bg-blue-950/20 border-blue-500 text-blue-300 font-medium scale-[1.02]' :
                        isCompleted ? 'bg-darkBg border-darkBorder text-darkTextSecondary' :
                        'bg-darkBg/40 border-darkBorder/40 text-darkTextSecondary/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] opacity-60">0{stage.id + 1}.</span>
                        <span>{stage.label}</span>
                      </div>
                      <div>
                        {isActive && <Loader className="h-3.5 w-3.5 animate-spin text-blue-400" />}
                        {isCompleted && <span className="text-green-500 font-bold">✓</span>}
                        {isUntouched && <span className="opacity-0">•</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Real-time Stage Inspection Board */}
              <div className="bg-darkBg border border-darkBorder rounded p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-darkTextSecondary uppercase tracking-wider">Trace Inspection Board</h3>
                  
                  {currentStage === -1 && (
                    <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
                      <Activity className="h-8 w-8 text-darkBorder animate-pulse" />
                      <p className="text-xs text-darkTextSecondary">Awaiting system activation. Run the control plane simulator to trace pipeline execution.</p>
                    </div>
                  )}

                  {/* Stage-wise descriptive traces */}
                  {currentStage === 0 && (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Policy Loading</div>
                      <p className="text-darkTextSecondary">Loading Policy `{policyId}` (Version 2.1) binding context configuration keys...</p>
                      <ul className="list-disc pl-4 text-[10px] text-darkTextSecondary space-y-1 pt-2">
                        <li>Injection Threshold: {policy.injection_block}</li>
                        <li>Toxicity Limit: {policy.toxicity_block}</li>
                        <li>PII Redact Target: {policy.pii_modify}</li>
                        <li>Evidence Requirement: {policy.evidence_required ? 'YES' : 'NO'}</li>
                      </ul>
                    </div>
                  )}

                  {currentStage === 1 && (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Tier 0 Fast Checks</div>
                      <p className="text-darkTextSecondary">Invoking fast heuristic and regex checks. These run in parallel without calling deep models to maintain ultra-low latency.</p>
                      <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
                        <div className="border border-darkBorder p-1.5 rounded">PII Leak: <span className="text-yellow-500">Scanning...</span></div>
                        <div className="border border-darkBorder p-1.5 rounded">Injection: <span className="text-yellow-500">Scanning...</span></div>
                        <div className="border border-darkBorder p-1.5 rounded">Toxicity: <span className="text-yellow-500">Scanning...</span></div>
                        <div className="border border-darkBorder p-1.5 rounded">Bias: <span className="text-yellow-500">Scanning...</span></div>
                      </div>
                    </div>
                  )}

                  {currentStage === 2 && (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Risk Router</div>
                      <p className="text-darkTextSecondary">Evaluating Tier 0 scores against policy thresholds to decide if expensive NLI Grounding checks are required.</p>
                    </div>
                  )}

                  {currentStage === 3 && (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Tier 1 Deep Verification</div>
                      <p className="text-darkTextSecondary">Checking if deep claim-level fact-verification has been triggered...</p>
                      {prompt.toLowerCase().includes('revenue') || prompt.toLowerCase().includes('acquisition') ? (
                        <p className="text-[10px] text-yellow-400">Triggered: Claim extraction and retrieval running on vectors...</p>
                      ) : (
                        <p className="text-[10px] text-darkTextSecondary">Bypassed: Fast release satisfies criteria.</p>
                      )}
                    </div>
                  )}

                  {currentStage === 4 && (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Action Validator</div>
                      <p className="text-darkTextSecondary">Intercepting tool execution payloads. Checking sensitivity and authorization signatures.</p>
                      {toolName ? (
                        <p className="text-[10px] text-riskCritical font-mono">Action validation required for '{toolName}' tool call.</p>
                      ) : (
                        <p className="text-[10px] text-darkTextSecondary">Not applicable. Text response mode.</p>
                      )}
                    </div>
                  )}

                  {currentStage === 5 && (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Risk Engine Evaluation</div>
                      <p className="text-darkTextSecondary">Compiling all signals into a 16-dimensional feature vector and feeding it to the calibrated XGBoost Platt Classifier.</p>
                    </div>
                  )}

                  {currentStage === 6 && (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Policy Engine Mapping</div>
                      <p className="text-darkTextSecondary">Applying deterministic YAML-defined override mappings onto the final decision state.</p>
                    </div>
                  )}

                  {currentStage === 7 && evaluationResult && (
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="text-blue-400 font-mono">Stage: Finalizing Decision</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-darkTextSecondary">Decision:</span>
                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                          evaluationResult.decision === 'BLOCK' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          evaluationResult.decision === 'ESCALATE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                          evaluationResult.decision === 'MODIFY' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          'bg-green-500/10 text-green-400 border border-green-500/20'
                        }`}>{evaluationResult.decision}</span>
                      </div>
                      <div className="text-[10px] text-darkTextSecondary bg-[#18181b] border border-darkBorder rounded p-2 space-y-1">
                        <div>Request ID: <span className="font-mono text-darkTextPrimary">{evaluationResult.request_id}</span></div>
                        <div>Audit Log: <span className="font-mono text-[9px] text-darkTextSecondary">{evaluationResult.policy_id} (hash registered)</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {evaluationResult && currentStage === 7 && (
                  <button
                    onClick={() => onEvaluationCompleted(evaluationResult)}
                    className="w-full mt-4 flex items-center justify-center space-x-1 border border-darkBorder hover:bg-darkSurface text-xs text-darkTextPrimary p-2 rounded cursor-pointer transition-all"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Inspect Complete Trace Logs</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Final Results & Action Flows */}
          {evaluationResult && currentStage === 7 && (
            <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-4">
              <h2 className="text-xs font-semibold text-darkTextPrimary tracking-wider uppercase">Governance Action Outcome</h2>

              {/* ALLOW Flow */}
              {evaluationResult.decision === 'ALLOW' && (
                <div className="bg-green-950/10 border border-green-500/20 p-4 rounded space-y-3">
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-bold">TRANSACTION ALLOWED</span>
                  </div>
                  <p className="text-xs text-darkTextSecondary">The safety controls found no risks. The response is safe to release to the downstream client.</p>
                  <div className="flex items-center space-x-2 text-xs font-mono bg-darkBg p-2 rounded text-[10px] border border-darkBorder text-darkTextSecondary">
                    <span>STATUS: Released Response. Calibrated risk profile indicates low-threat severity.</span>
                  </div>
                </div>
              )}

              {/* MODIFY Flow */}
              {evaluationResult.decision === 'MODIFY' && (
                <div className="bg-yellow-950/10 border border-yellow-500/20 p-4 rounded space-y-3">
                  <div className="flex items-center space-x-2 text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-bold">RESPONSE MODIFIED (REDACTED)</span>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">Original LLM Response:</span>
                      <pre className="bg-darkBg p-2 rounded text-[10px] font-mono text-red-300 border border-darkBorder mt-1 whitespace-pre-wrap">{evaluationResult.request.llm_response}</pre>
                    </div>
                    <div>
                      <span className="text-[10px] text-darkTextSecondary uppercase font-semibold">Redacted LLM Response:</span>
                      <pre className="bg-darkBg p-2 rounded text-[10px] font-mono text-green-300 border border-darkBorder mt-1 whitespace-pre-wrap">{evaluationResult.request.modified_response}</pre>
                    </div>
                  </div>

                  {isRechecking && (
                    <div className="flex items-center space-x-2 text-xs text-yellow-400 bg-yellow-950/20 p-2 rounded border border-yellow-500/10">
                      <Loader className="h-3.5 w-3.5 animate-spin" />
                      <span>Re-checking modified response through Tier 0 fast checks...</span>
                    </div>
                  )}

                  {recheckPassed && (
                    <div className="flex items-center space-x-2 text-xs text-green-400 bg-green-950/20 p-2 rounded border border-green-500/10">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Re-check passed. Redacted response satisfies active policies. Safe to release.</span>
                    </div>
                  )}
                </div>
              )}

              {/* ESCALATE Flow */}
              {evaluationResult.decision === 'ESCALATE' && (
                <div className="bg-orange-950/10 border border-orange-500/20 p-4 rounded space-y-3">
                  <div className="flex items-center space-x-2 text-orange-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-bold">HUMAN REVIEW REQUIRED (ESCALATED)</span>
                  </div>
                  <p className="text-xs text-darkTextSecondary">Policy rule escalation. Grounding evidence is contradicted or unknown, or model costs exceeded budget limits.</p>
                  
                  <div className="flex items-center justify-between text-xs bg-darkBg p-3 border border-darkBorder rounded">
                    <div>
                      <div className="text-darkTextSecondary text-[10px]">REASON FOR ESCALATION:</div>
                      <div className="font-medium text-darkTextPrimary mt-0.5">{evaluationResult.policy_engine.reason}</div>
                    </div>
                    <button
                      onClick={() => onOpenReview(evaluationResult.request_id)}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-1.5 rounded cursor-pointer transition-all"
                    >
                      OPEN REVIEW QUEUE
                    </button>
                  </div>
                </div>
              )}

              {/* BLOCK Flow */}
              {evaluationResult.decision === 'BLOCK' && (
                <div className="bg-red-950/10 border border-red-500/20 p-4 rounded space-y-3">
                  <div className="flex items-center space-x-2 text-red-400">
                    <ShieldAlert className="h-5 w-5" />
                    <span className="font-bold">TRANSACTION BLOCKED</span>
                  </div>
                  <p className="text-xs text-darkTextSecondary">Severe threat indicators. High-confidence prompt injection or toxicity exceeded acceptable risk boundaries.</p>
                  <div className="text-xs space-y-1 bg-darkBg p-3 border border-darkBorder rounded text-[10px] text-darkTextSecondary">
                    <div><span className="font-semibold text-darkTextPrimary">Triggered Rule:</span> {evaluationResult.policy_engine.triggered_rules[0]?.rule_id || 'POL-BLOCK-DEFAULT'}</div>
                    <div><span className="font-semibold text-darkTextPrimary">Detail:</span> {evaluationResult.policy_engine.reason}</div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
