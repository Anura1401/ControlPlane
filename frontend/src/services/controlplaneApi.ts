import { Evaluation, PolicyConfig, AuditRecord, HumanReviewItem, DecisionType, RiskSeverity, DetectorResult, ActionValidation } from '../types/controlplane';
import { initialPolicies, initialEvaluations, initialAuditLogs, initialHumanReviews } from '../data/mockData';

class ControlPlaneApiService {
  private policies: PolicyConfig[] = [...initialPolicies];
  private evaluations: Evaluation[] = [...initialEvaluations];
  private auditLogs: AuditRecord[] = [...initialAuditLogs];
  private humanReviews: HumanReviewItem[] = [...initialHumanReviews];

  getPolicies(): PolicyConfig[] {
    return this.policies;
  }

  savePolicy(config: PolicyConfig): void {
    const idx = this.policies.findIndex(p => p.policy_id === config.policy_id);
    if (idx >= 0) {
      this.policies[idx] = { ...config, last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19) };
    } else {
      this.policies.push({ ...config, last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19) });
    }
  }

  getEvaluations(): Evaluation[] {
    return this.evaluations;
  }

  getAuditLogs(): AuditRecord[] {
    return this.auditLogs;
  }

  getHumanReviews(): HumanReviewItem[] {
    return this.humanReviews;
  }

  resolveHumanReview(requestId: string, status: 'APPROVED' | 'REJECTED'): void {
    // Update review queue
    const reviewIdx = this.humanReviews.findIndex(r => r.request_id === requestId);
    if (reviewIdx >= 0) {
      this.humanReviews[reviewIdx] = {
        ...this.humanReviews[reviewIdx],
        status,
        reviewer: 'Demo Reviewer',
        reviewed_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
    }

    // Update evaluation list
    const evalIdx = this.evaluations.findIndex(e => e.request_id === requestId);
    if (evalIdx >= 0) {
      const current = this.evaluations[evalIdx];
      const finalDecision: DecisionType = status === 'APPROVED' ? 'ALLOW' : 'BLOCK';
      this.evaluations[evalIdx] = {
        ...current,
        decision: finalDecision,
        action_taken: status === 'APPROVED' ? (current.action_validator ? 'Executed' : 'Released') : 'Blocked'
      };
    }

    // Update audit log
    const auditIdx = this.auditLogs.findIndex(a => a.request_id === requestId);
    if (auditIdx >= 0) {
      const currentAudit = this.auditLogs[auditIdx];
      const finalDecision: DecisionType = status === 'APPROVED' ? 'ALLOW' : 'BLOCK';
      this.auditLogs[auditIdx] = {
        ...currentAudit,
        decision: finalDecision,
        human_review: status,
        tool_action: currentAudit.tool_action !== 'N/A' ? (status === 'APPROVED' ? 'EXECUTED' : 'BLOCKED') : 'N/A'
      };
    }
  }

  // Live evaluation algorithm
  runControlPlane(
    appId: string,
    policyId: string,
    prompt: string,
    response: string,
    context: string,
    toolName: string,
    toolArgs: string,
    isCostAnomaly: boolean = false
  ): Evaluation {
    const requestId = `CP-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const policy = this.policies.find(p => p.policy_id === policyId) || this.policies[0];
    const promptLower = prompt.toLowerCase();
    const responseLower = (response || '').toLowerCase();
    const contextLower = (context || '').toLowerCase();

    // 1. Tier 0 Fast Checks
    let piiScore = 0.02;
    if (responseLower.includes('@') || responseLower.includes('555') || responseLower.includes('+1')) {
      piiScore = 0.90;
    }

    let toxicityScore = 0.01;
    if (responseLower.includes('idiot') || responseLower.includes('stupid') || responseLower.includes('shut up')) {
      toxicityScore = 0.95;
    }

    let biasScore = 0.05;
    if (responseLower.includes('retire') || responseLower.includes('age') || responseLower.includes('gender') || responseLower.includes('race')) {
      biasScore = 0.85;
    }

    let injectionScore = 0.02;
    if (promptLower.includes('ignore') || promptLower.includes('override') || promptLower.includes('system prompt') ||
        contextLower.includes('system override') || contextLower.includes('ignore the security')) {
      injectionScore = 0.98;
    }

    let truthRisk = 0.10;
    if (responseLower.includes('$') || responseLower.includes('revenue') || responseLower.includes('sales') || responseLower.includes('percent')) {
      truthRisk = 0.85;
    }

    const costAnomalyScore = isCostAnomaly ? 0.92 : 0.02;

    const piiResult: DetectorResult = {
      name: 'PII',
      score: piiScore,
      status: piiScore >= policy.pii_block ? 'FAIL' : (piiScore >= policy.pii_modify ? 'ELEVATED' : 'PASS'),
      explanation: piiScore > 0.50 ? 'Found personal credentials or email addresses.' : 'No leaks identified.'
    };

    const toxicityResult: DetectorResult = {
      name: 'Toxicity',
      score: toxicityScore,
      status: toxicityScore >= policy.toxicity_block ? 'FAIL' : 'PASS',
      explanation: toxicityScore > 0.50 ? 'Detected abusive, toxic, or offensive remarks.' : 'Clean sentiment.'
    };

    const biasResult: DetectorResult = {
      name: 'Bias',
      score: biasScore,
      status: biasScore >= policy.bias_escalate ? 'ELEVATED' : 'PASS',
      explanation: biasScore > 0.50 ? 'Detected demographic filters or discriminatory markers.' : 'Unbiased candidate metrics.'
    };

    const injectionResult: DetectorResult = {
      name: 'Prompt Injection',
      score: injectionScore,
      status: injectionScore >= policy.injection_block ? 'FAIL' : 'PASS',
      explanation: injectionScore > 0.50 ? 'Malicious instruction override attempts located.' : 'Safe user interaction.'
    };

    const truthResult: DetectorResult = {
      name: 'Truth Risk',
      score: truthRisk,
      status: truthRisk >= policy.truth_verify ? 'ELEVATED' : 'PASS',
      explanation: truthRisk > 0.50 ? 'Factual claims made. Demands evidence verification.' : 'Conversational text.'
    };

    const costResult: DetectorResult = {
      name: 'Cost Anomaly',
      score: costAnomalyScore,
      status: costAnomalyScore >= 0.80 ? 'ELEVATED' : 'PASS',
      explanation: costAnomalyScore > 0.80 ? 'Operations cost spike detected (exceeds P95 baseline).' : 'Normal latency and token counts.'
    };

    const tier0 = [piiResult, toxicityResult, biasResult, injectionResult, truthResult, costResult];

    // 2. Risk Router
    let deepVerifyRequired = false;
    let routerReason = 'No triggers matched. Baseline checks passed.';

    if (toolName) {
      routerReason = 'Tool call detected. Diverted to Action Validator.';
    } else if (truthResult.status === 'ELEVATED' && policy.evidence_required) {
      deepVerifyRequired = true;
      routerReason = 'Truth risk exceeds policy verify trigger (threshold ' + policy.truth_verify + ').';
    }

    // 3. Tier 1 Deep Verification
    let tier1Data = undefined;
    if (deepVerifyRequired) {
      const hasEvidence = context.trim().length > 0;
      let verdict: 'SUPPORTED' | 'CONTRADICTED' | 'UNKNOWN' = 'UNKNOWN';
      let confidence = 0.50;
      let evidenceText = '';

      if (hasEvidence) {
        // Simple mock checks to find contradictions
        if (responseLower.includes('2.0b') && contextLower.includes('10b')) {
          verdict = 'CONTRADICTED';
          confidence = 0.96;
          evidenceText = context;
        } else if (responseLower.includes('1.4b') && contextLower.includes('1.4b')) {
          verdict = 'SUPPORTED';
          confidence = 0.98;
          evidenceText = context;
        } else {
          verdict = 'UNKNOWN';
          confidence = 0.60;
          evidenceText = context;
        }
      }

      tier1Data = {
        claims: [{ claim_id: 'c_live_1', text: response, claim_type: 'financial_claim' }],
        verifications: [{
          claim_id: 'c_live_1',
          claim_text: response,
          verdict,
          confidence,
          evidence_chunks: hasEvidence ? [{
            document_id: 'retrieved_context_chunk',
            text: evidenceText,
            similarity: 0.88
          }] : []
        }]
      };
    }

    // 4. Action Validator for tools
    let actionVal = undefined;
    if (toolName) {
      const isDestructive = toolName === 'delete_record' || toolName.includes('purge');
      actionVal = {
        tool_name: toolName,
        impact: isDestructive ? 0.98 : 0.15,
        reversibility: isDestructive ? 0.10 : 1.0,
        sensitivity: isDestructive ? 0.95 : 0.10,
        authorization_status: isDestructive ? 'INVALID' : 'VALID' as 'INVALID' | 'VALID' | 'UNKNOWN',
        external_side_effect: isDestructive,
        validation_result: isDestructive ? 'HIGH RISK' as const : 'LOW RISK' as const
      };
    }

    // 5. Risk Engine Overall Score
    let overallRisk = 0.04;
    let shap: { feature: string; contribution: number }[] = [
      { feature: 'PII', contribution: piiScore * 10 },
      { feature: 'Toxicity', contribution: toxicityScore * 10 },
      { feature: 'Bias', contribution: biasScore * 10 },
      { feature: 'Prompt Injection', contribution: injectionScore * 10 }
    ];

    if (injectionScore > 0.50) {
      overallRisk = 0.86;
      shap.push({ feature: 'Prompt Injection', contribution: 90 });
    } else if (toxicityScore > 0.50) {
      overallRisk = 0.94;
      shap.push({ feature: 'Toxicity', contribution: 92 });
    } else if (actionVal && actionVal.validation_result === 'HIGH RISK') {
      overallRisk = 0.96;
      shap.push({ feature: 'Tool Impact', contribution: 95 });
      shap.push({ feature: 'Authorization Status', contribution: 90 });
    } else if (tier1Data && tier1Data.verifications[0].verdict === 'CONTRADICTED') {
      overallRisk = 0.916;
      shap.push({ feature: 'Contradicted Claim', contribution: 88 });
      shap.push({ feature: 'Truth Risk', contribution: 60 });
    } else if (tier1Data && tier1Data.verifications[0].verdict === 'UNKNOWN') {
      overallRisk = 0.81;
      shap.push({ feature: 'Unsupported Claim', contribution: 75 });
    } else if (biasScore > 0.50) {
      overallRisk = 0.78;
      shap.push({ feature: 'Demographic Bias', contribution: 80 });
    } else if (piiScore > 0.50) {
      overallRisk = 0.64;
      shap.push({ feature: 'PII Leak', contribution: 85 });
    } else if (isCostAnomaly) {
      overallRisk = 0.72;
      shap.push({ feature: 'Cost Anomaly', contribution: 80 });
    }

    // Sort contributions descending
    shap.sort((a, b) => b.contribution - a.contribution);

    let severity: RiskSeverity = 'LOW';
    if (overallRisk >= 0.85) severity = 'CRITICAL';
    else if (overallRisk >= 0.60) severity = 'HIGH';
    else if (overallRisk >= 0.30) severity = 'MEDIUM';

    // 6. Policy Engine
    let decision: DecisionType = 'ALLOW';
    const triggered_rules: { rule_id: string; reason: string }[] = [];
    let reason = 'All policy conditions satisfied.';

    if (injectionScore >= policy.injection_block) {
      decision = 'BLOCK';
      triggered_rules.push({ rule_id: 'POL-INJ-001', reason: 'High confidence prompt injection blocked.' });
      reason = 'Blocked: Prompt injection score exceeds limit.';
    } else if (toxicityScore >= policy.toxicity_block) {
      decision = 'BLOCK';
      triggered_rules.push({ rule_id: 'POL-TOX-001', reason: 'Abusive language violation.' });
      reason = 'Blocked: Toxicity exceeds safety limit.';
    } else if (actionVal && actionVal.validation_result === 'HIGH RISK') {
      decision = 'BLOCK';
      triggered_rules.push({ rule_id: 'POL-TOOL-002', reason: 'Destructive action blocked due to invalid signature.' });
      reason = 'Blocked: Unauthorized tool execution prevented.';
    } else if (tier1Data && tier1Data.verifications[0].verdict === 'CONTRADICTED' && policy.verification_contradiction_escalate) {
      decision = 'ESCALATE';
      triggered_rules.push({ rule_id: 'POL-FACT-002', reason: 'Response contradicts internal knowledge files.' });
      reason = 'Escalated: Contradicted claim requires compliance review.';
    } else if (tier1Data && tier1Data.verifications[0].verdict === 'UNKNOWN' && policy.evidence_required) {
      decision = 'ESCALATE';
      triggered_rules.push({ rule_id: 'POL-FACT-003', reason: 'No supporting references found in vector storage.' });
      reason = 'Escalated: Claim has unknown credentials.';
    } else if (biasScore >= policy.bias_escalate) {
      decision = 'ESCALATE';
      triggered_rules.push({ rule_id: 'POL-BIAS-001', reason: 'Demographic bias detected.' });
      reason = 'Escalated: Bias flags require audit review.';
    } else if (piiScore >= policy.pii_modify) {
      decision = 'MODIFY';
      triggered_rules.push({ rule_id: 'POL-PII-002', reason: 'Entity leaks triggers automatic redaction filter.' });
      reason = 'Modified: PII redacted.';
    } else if (isCostAnomaly && costAnomalyScore > 0.80) {
      decision = 'ESCALATE';
      triggered_rules.push({ rule_id: 'POL-OPS-001', reason: 'Ops metrics exceed cost allowance (limit: ' + policy.operational_cost_limit + ').' });
      reason = 'Escalated: High cost exception.';
    }

    const modifiedResponse = decision === 'MODIFY' ? 'Please contact John Doe at [REDACTED_EMAIL] or dial +1-[REDACTED_PHONE].' : undefined;

    const evaluation: Evaluation = {
      request_id: requestId,
      timestamp,
      application_id: appId === 'hr_support' ? 'HR Assistant' : (appId === 'customer_support' ? 'Customer Support Copilot' : 'Finance Assistant'),
      task_type: appId === 'hr_support' ? 'hiring_decision' : (appId === 'customer_support' ? 'general_qa' : 'financial_qa'),
      policy_id: policy.policy_id,
      policy_version: policy.version,
      decision,
      overall_risk: parseFloat(overallRisk.toFixed(3)),
      severity,
      primary_risk: decision === 'BLOCK' ? (injectionScore > 0.50 ? 'Prompt Injection' : 'Toxicity') : (decision === 'MODIFY' ? 'PII Leak' : (decision === 'ESCALATE' ? 'Verification Failure' : 'None')),
      action_taken: decision === 'BLOCK' ? 'Blocked' : (decision === 'MODIFY' ? 'Redacted' : (decision === 'ESCALATE' ? 'Review Required' : 'Released')),
      request: {
        application_id: appId === 'hr_support' ? 'HR Assistant' : (appId === 'customer_support' ? 'Customer Support Copilot' : 'Finance Assistant'),
        session_id: `sess_${Math.floor(10000 + Math.random() * 90000)}`,
        model_id: 'gpt-4o',
        task_type: appId === 'hr_support' ? 'hiring_decision' : 'financial_qa',
        timestamp,
        user_prompt: prompt,
        llm_response: toolName ? undefined : response,
        modified_response: modifiedResponse,
        tool_call: toolName ? { tool_name: toolName, arguments: toolArgs } : undefined
      },
      tier0,
      risk_router: {
        deep_verify_required: deepVerifyRequired,
        reason: routerReason
      },
      tier1: tier1Data,
      action_validator: actionVal,
      risk_engine: {
        overall_risk: parseFloat(overallRisk.toFixed(3)),
        severity,
        confidence: parseFloat((1 - (0.10 * overallRisk)).toFixed(2)),
        uncertainty: parseFloat((0.10 * overallRisk).toFixed(2)),
        shap_contributions: shap.map(s => ({ feature: s.feature, contribution: parseFloat((s.contribution / 100).toFixed(2)) }))
      },
      policy_engine: {
        policy_id: policy.policy_id,
        version: policy.version,
        triggered_rules,
        reason,
        decision
      }
    };

    // Save to local databases
    this.evaluations.unshift(evaluation);
    
    this.auditLogs.unshift({
      timestamp,
      request_id: requestId,
      application_id: evaluation.request.application_id,
      risk: evaluation.overall_risk,
      primary_risk: evaluation.primary_risk,
      policy: evaluation.policy_id,
      policy_version: evaluation.policy_version,
      decision,
      human_review: decision === 'ESCALATE' ? 'PENDING' : 'N/A',
      tool_action: toolName ? (decision === 'BLOCK' ? 'BLOCKED' : (decision === 'ESCALATE' ? 'PENDING' : 'EXECUTED')) : 'N/A',
      hash: `sha256-${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`
    });

    if (decision === 'ESCALATE') {
      this.humanReviews.unshift({
        request_id: requestId,
        application_id: evaluation.request.application_id,
        risk: evaluation.overall_risk,
        primary_issue: evaluation.primary_risk,
        decision,
        time: timestamp.substring(11, 16),
        status: 'PENDING'
      });
    }

    return evaluation;
  }

    async evaluateV1(
      applicationId: string,
      policyId: string,
      userPrompt: string,
      llmResponse?: string,
      toolAction?: any,
      generateWithLlm: boolean = false
    ): Promise<Evaluation> {
      try {
        const response = await fetch('/api/v1/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            application_id: applicationId,
            policy_id: policyId,
            user_prompt: userPrompt,
            llm_response: llmResponse || null,
            tool_action: toolAction || null,
            generate_with_llm: generateWithLlm
          })
        });
        
        if (!response.ok) {
          throw new Error(`ControlPlane API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        // Determine primary risk
        let primaryRisk = 'None';
        if (data.decision !== 'ALLOW') {
          const risks = [];
          if (data.tier_0.pii.detected) risks.push('PII');
          if (data.tier_0.injection.detected) risks.push('Prompt Injection');
          if (data.tier_0.toxicity.detected) risks.push('Toxicity');
          if (data.tier_0.bias.detected) risks.push('Bias');
          if (data.tier_0.truth.detected) risks.push('Truth Risk');
          if (data.tier_1.verification.some((v: any) => v.verdict === 'CONTRADICTED')) risks.push('Hallucination');
          primaryRisk = risks.join(', ') || 'Policy Violation';
        }
        
        // Map Tier 0
        const tier0: DetectorResult[] = [
          { name: 'PII', score: data.tier_0.pii.score, status: (data.tier_0.pii.detected ? 'FAIL' : 'PASS') as 'PASS' | 'ELEVATED' | 'FAIL', explanation: data.tier_0.pii.details.join(', ') || 'No leaks identified.' },
          { name: 'Toxicity', score: data.tier_0.toxicity.score, status: (data.tier_0.toxicity.detected ? 'FAIL' : 'PASS') as 'PASS' | 'ELEVATED' | 'FAIL', explanation: data.tier_0.toxicity.details.join(', ') || 'Clean sentiment.' },
          { name: 'Bias', score: data.tier_0.bias.score, status: (data.tier_0.bias.detected ? 'FAIL' : 'PASS') as 'PASS' | 'ELEVATED' | 'FAIL', explanation: data.tier_0.bias.details.join(', ') || 'Unbiased candidate metrics.' },
          { name: 'Prompt Injection', score: data.tier_0.injection.score, status: (data.tier_0.injection.detected ? 'FAIL' : 'PASS') as 'PASS' | 'ELEVATED' | 'FAIL', explanation: data.tier_0.injection.details.join(', ') || 'Safe user interaction.' },
          { name: 'Truth Risk', score: data.tier_0.truth.score, status: (data.tier_0.truth.detected ? 'FAIL' : 'PASS') as 'PASS' | 'ELEVATED' | 'FAIL', explanation: data.tier_0.truth.details.join(', ') || 'Conversational text.' },
          { name: 'Cost Anomaly', score: 0.02, status: 'PASS' as 'PASS' | 'ELEVATED' | 'FAIL', explanation: 'Normal latency and token counts.' }
        ];
        
        // Map Tier 1
        let tier1Data = undefined;
        if (data.risk_router.tier_1_required) {
          tier1Data = {
            claims: data.tier_1.claims.map((text: string, idx: number) => ({ claim_id: `C-${idx+1}`, text })),
            verifications: data.tier_1.verification.map((v: any, idx: number) => ({
              claim_id: `C-${idx+1}`,
              claim_text: v.claim,
              verdict: v.verdict as 'SUPPORTED' | 'CONTRADICTED' | 'UNKNOWN',
              confidence: v.confidence,
              evidence_chunks: v.evidence.map((ev: any, cidx: number) => ({
                chunk_id: `E-${cidx+1}`,
                document_id: ev.document_id,
                text: ev.text,
                similarity: ev.similarity
              }))
            }))
          };
        }
        
        // Map Action Validator
        let actionValidatorData: ActionValidation | undefined = undefined;
        if (data.action_validation) {
          actionValidatorData = {
            tool_name: toolAction?.tool_name || 'unknown_tool',
            impact: data.action_validation.risk,
            reversibility: data.action_validation.risk >= 0.8 ? 1.0 : 0.0,
            sensitivity: data.action_validation.risk >= 0.8 ? 0.8 : 0.2,
            authorization_status: (data.action_validation.authorized ? 'VALID' : 'INVALID') as 'VALID' | 'INVALID' | 'UNKNOWN',
            external_side_effect: data.action_validation.risk >= 0.8,
            validation_result: data.action_validation.authorized ? 'LOW RISK' : 'HIGH RISK'
          };
        }
        
        const evaluation: Evaluation = {
          request_id: data.request_id,
          timestamp,
          application_id: applicationId,
          task_type: applicationId.includes('finance') ? 'financial_qa' : (applicationId.includes('hr') ? 'hiring_decision' : 'general_qa'),
          policy_id: data.policy_id,
          policy_version: '1.0.0',
          decision: data.decision,
          overall_risk: data.risk_engine.risk_score,
          severity: data.risk_engine.risk_level as RiskSeverity,
          primary_risk: primaryRisk,
          action_taken: data.decision === 'BLOCK' ? 'Blocked' : (data.decision === 'MODIFY' ? 'Redacted' : 'Released'),
          request: {
            application_id: applicationId,
            session_id: 'session_live',
            model_id: data.llm?.model || 'external',
            task_type: applicationId.includes('finance') ? 'financial_qa' : (applicationId.includes('hr') ? 'hiring_decision' : 'general_qa'),
            timestamp,
            user_prompt: userPrompt,
            llm_response: data.llm?.response || llmResponse || '',
            modified_response: data.decision === 'MODIFY' ? data.final_response : undefined,
            tool_call: toolAction ? {
              tool_name: toolAction.tool_name,
              arguments: JSON.stringify(toolAction.arguments)
            } : undefined
          },
          tier0,
          risk_router: {
            deep_verify_required: data.risk_router.tier_1_required,
            reason: data.risk_router.reason.join(', ') || 'Router evaluations passed.'
          },
          tier1: tier1Data,
          action_validator: actionValidatorData,
          risk_engine: {
            overall_risk: data.risk_engine.risk_score,
            severity: data.risk_engine.risk_level,
            confidence: 0.95,
            uncertainty: 0.05,
            shap_contributions: data.risk_engine.explanations.map((text: string) => {
              const parts = text.split(' feature value: ');
              return {
                feature: parts[0] || 'risk_metric',
                contribution: parts[1] ? parseFloat(parts[1]) : 0.10
              };
            })
          },
          policy_engine: {
            policy_id: data.policy_id,
            version: '1.0.0',
            triggered_rules: data.policy.triggered_rules.map((rule: any) => ({
              rule_id: rule.rule_id,
              reason: rule.reason
            })),
            reason: data.policy.triggered_rules.map((r: any) => r.reason).join(', ') || 'All requirements satisfied.',
            decision: data.decision
          }
        };
        
        // Save to local lists
        this.evaluations.unshift(evaluation);
        
        this.auditLogs.unshift({
          timestamp,
          request_id: data.request_id,
          application_id: applicationId,
          risk: evaluation.overall_risk,
          primary_risk: primaryRisk,
          policy: data.policy_id,
          policy_version: '1.0.0',
          decision: data.decision,
          human_review: data.decision === 'ESCALATE' ? 'PENDING' : 'N/A',
          tool_action: toolAction ? (data.decision === 'BLOCK' ? 'BLOCKED' : (data.decision === 'ESCALATE' ? 'PENDING' : 'EXECUTED')) : 'N/A',
          hash: `sha256-${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`
        });
        
        if (data.decision === 'ESCALATE') {
          this.humanReviews.unshift({
            request_id: data.request_id,
            application_id: applicationId,
            risk: evaluation.overall_risk,
            primary_issue: primaryRisk,
            decision: data.decision,
            time: timestamp.substring(11, 16),
            status: 'PENDING'
          });
        }
        
        return evaluation;
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
}

export const controlplaneApi = new ControlPlaneApiService();
