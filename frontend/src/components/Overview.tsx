import React from 'react';
import { Evaluation } from '../types/controlplane';
import { Shield, Ban, AlertTriangle, Edit3, DollarSign, Activity, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface OverviewProps {
  evaluations: Evaluation[];
  onSelectEvaluation: (id: string) => void;
  onFilterByRiskCategory: (category: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({
  evaluations,
  onSelectEvaluation,
  onFilterByRiskCategory
}) => {
  // Aggregate statistics from current evaluations database
  const totalRequests = evaluations.length * 312 + 1024; // Mock aggregation scaling
  const blockedCount = evaluations.filter(e => e.decision === 'BLOCK').length * 15 + 142;
  const escalatedCount = evaluations.filter(e => e.decision === 'ESCALATE').length * 22 + 204;
  const modifiedCount = evaluations.filter(e => e.decision === 'MODIFY').length * 18 + 312;
  const riskRate = (((blockedCount + escalatedCount) / totalRequests) * 100).toFixed(1);
  const estimatedCost = (totalRequests * 0.00015).toFixed(0);

  // Risk Distribution Chart Data
  const riskData = [
    { name: 'LOW', value: 72, color: '#22c55e' },
    { name: 'MEDIUM', value: 18, color: '#eab308' },
    { name: 'HIGH', value: 7, color: '#f97316' },
    { name: 'CRITICAL', value: 3, color: '#ef4444' },
  ];

  // Decision Distribution Chart Data
  const decisionData = [
    { name: 'ALLOW', value: 82, color: '#22c55e' },
    { name: 'MODIFY', value: 7, color: '#eab308' },
    { name: 'ESCALATE', value: 8, color: '#f97316' },
    { name: 'BLOCK', value: 3, color: '#ef4444' },
  ];

  // Risk Signals Breakdown Data
  const signalData = [
    { category: 'Hallucination', count: 184, fill: '#ef4444' },
    { category: 'Prompt Injection', count: 122, fill: '#f97316' },
    { category: 'PII Leak', count: 98, fill: '#eab308' },
    { category: 'Tool Risk', count: 76, fill: '#a1a1aa' },
    { category: 'Bias', count: 42, fill: '#3b82f6' },
    { category: 'Toxicity', count: 28, fill: '#ec4899' },
    { category: 'Cost Anomaly', count: 14, fill: '#14b8a6' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary">Overview</h1>
        <p className="text-sm text-darkTextSecondary">Governing LLM traffic, detecting compliance risks, and validating agent tools in real-time.</p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-2">
          <div className="flex items-center justify-between text-darkTextSecondary">
            <span className="text-xs font-medium">Total Requests</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-semibold">{totalRequests.toLocaleString()}</div>
          <div className="text-[10px] text-green-500 flex items-center">
            <span>↑ 12.4%</span>
            <span className="text-darkTextSecondary ml-1">vs last week</span>
          </div>
        </div>

        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-2">
          <div className="flex items-center justify-between text-darkTextSecondary">
            <span className="text-xs font-medium">Risk Rate</span>
            <AlertTriangle className="h-4 w-4 text-riskHigh" />
          </div>
          <div className="text-2xl font-semibold">{riskRate}%</div>
          <div className="text-[10px] text-red-500 flex items-center">
            <span>↑ 0.8%</span>
            <span className="text-darkTextSecondary ml-1">anomaly rate</span>
          </div>
        </div>

        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-2">
          <div className="flex items-center justify-between text-darkTextSecondary">
            <span className="text-xs font-medium">Blocked</span>
            <Ban className="h-4 w-4 text-riskCritical" />
          </div>
          <div className="text-2xl font-semibold">{blockedCount}</div>
          <div className="text-[10px] text-darkTextSecondary">
            <span>Prompt injection & toxicity</span>
          </div>
        </div>

        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-2">
          <div className="flex items-center justify-between text-darkTextSecondary">
            <span className="text-xs font-medium">Escalations</span>
            <Shield className="h-4 w-4 text-riskHigh" />
          </div>
          <div className="text-2xl font-semibold">{escalatedCount}</div>
          <div className="text-[10px] text-darkTextSecondary">
            <span>Awaiting human review</span>
          </div>
        </div>

        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-2">
          <div className="flex items-center justify-between text-darkTextSecondary">
            <span className="text-xs font-medium">Modified</span>
            <Edit3 className="h-4 w-4 text-riskMedium" />
          </div>
          <div className="text-2xl font-semibold">{modifiedCount}</div>
          <div className="text-[10px] text-darkTextSecondary">
            <span>PII redacted response</span>
          </div>
        </div>

        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-2">
          <div className="flex items-center justify-between text-darkTextSecondary">
            <span className="text-xs font-medium">Estimated Cost</span>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-semibold">${estimatedCost}</div>
          <div className="text-[10px] text-darkTextSecondary">
            <span>Cumulative token usage</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Risk & Decision Donut Charts */}
        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-darkTextPrimary">Risk Severity</h2>
            <p className="text-xs text-darkTextSecondary">Aggregated threat levels of incoming traffic.</p>
          </div>
          <div className="h-40 my-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={65} paddingAngle={3}>
                  {riskData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '4px', color: '#f4f4f5' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {riskData.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-darkTextSecondary">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-darkTextPrimary">Policy Decisions</h2>
            <p className="text-xs text-darkTextSecondary">Decisions mapped to governed transactions.</p>
          </div>
          <div className="h-40 my-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={65} paddingAngle={3}>
                  {decisionData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '4px', color: '#f4f4f5' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {decisionData.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-darkTextSecondary">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk-Adaptive Verification Routing (Tier 0 -> Tier 1) */}
        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-darkTextPrimary">Risk-Adaptive Verification</h2>
            <p className="text-xs text-darkTextSecondary">Deep verification is triggered only when fast checks indicate elevated risk.</p>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center py-4 space-y-4">
            <div className="w-full flex items-center justify-between text-xs px-2">
              <span className="text-darkTextSecondary">Tier 0 Fast Checks (All Requests)</span>
              <span className="font-semibold text-green-400">100%</span>
            </div>
            
            {/* Visual Pipeline routing */}
            <div className="relative w-full h-8 bg-darkBg border border-darkBorder rounded flex items-center justify-center">
              <span className="text-[10px] text-darkTextSecondary font-mono z-10">TIER 0 DETECTORS (PII, Injection, Toxicity...)</span>
            </div>

            <div className="flex w-full items-center justify-between text-xs text-darkTextSecondary py-1">
              <div className="flex flex-col items-center w-1/2 border-r border-darkBorder">
                <span className="font-semibold text-darkTextPrimary text-base">87%</span>
                <span className="text-[10px]">Tier 0 Fast Release (Allow/Modify)</span>
              </div>
              <div className="flex flex-col items-center w-1/2">
                <span className="font-semibold text-riskHigh text-base">13%</span>
                <span className="text-[10px]">Tier 1 Verification Triggered</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <div className="bg-[#22c55e10] border border-[#22c55e20] rounded p-2 text-center">
                <span className="text-[10px] text-green-400 block font-mono font-semibold">Tier 0 Auto Release</span>
                <span className="text-[9px] text-darkTextSecondary">Avg latency: ~45ms</span>
              </div>
              <div className="bg-[#f9731610] border border-[#f9731620] rounded p-2 text-center">
                <span className="text-[10px] text-riskHigh block font-mono font-semibold">Tier 1 NLI Grounding</span>
                <span className="text-[9px] text-darkTextSecondary">Avg latency: ~380ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Signals and Recent Evaluations Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Risk Signals */}
        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-4 xl:col-span-1">
          <div>
            <h2 className="text-sm font-semibold text-darkTextPrimary">Risk Signals (Aggregate)</h2>
            <p className="text-xs text-darkTextSecondary">Threat occurrences mapped by detector types. Click to filter.</p>
          </div>
          <div className="space-y-3">
            {signalData.map((item, idx) => (
              <div key={idx} className="space-y-1 cursor-pointer group" onClick={() => onFilterByRiskCategory(item.category)}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-darkTextSecondary group-hover:text-darkTextPrimary transition-colors">{item.category}</span>
                  <span className="font-mono text-darkTextPrimary">{item.count}</span>
                </div>
                <div className="h-2 w-full bg-darkBg rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-500 group-hover:brightness-110" style={{ width: `${(item.count / 200) * 100}%`, backgroundColor: item.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Evaluations */}
        <div className="rounded-lg border border-darkBorder bg-darkSurface p-4 space-y-4 xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-darkTextPrimary">Recent Evaluations</h2>
              <p className="text-xs text-darkTextSecondary">Real-time trace logs of governed LLM interactions.</p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-darkTextSecondary">
              <FileText className="h-4 w-4" />
              <span>Live Feed</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-darkBorder text-darkTextSecondary">
                  <th className="py-2 font-medium">Time</th>
                  <th className="py-2 font-medium">Request ID</th>
                  <th className="py-2 font-medium">Application</th>
                  <th className="py-2 font-medium text-center">Risk</th>
                  <th className="py-2 font-medium">Primary Risk</th>
                  <th className="py-2 font-medium text-center">Decision</th>
                  <th className="py-2 font-medium">Policy</th>
                  <th className="py-2 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-darkBorder">
                {evaluations.slice(0, 5).map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-darkBg transition-colors cursor-pointer group"
                    onClick={() => onSelectEvaluation(item.request_id)}
                  >
                    <td className="py-3 text-darkTextSecondary font-mono">{item.timestamp.substring(11, 16)}</td>
                    <td className="py-3 text-blue-400 font-mono font-medium group-hover:underline">{item.request_id}</td>
                    <td className="py-3 text-darkTextPrimary">{item.request.application_id}</td>
                    <td className="py-3 text-center font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.severity === 'CRITICAL' ? 'bg-[#ef444415] text-riskCritical' :
                        item.severity === 'HIGH' ? 'bg-[#f9731615] text-riskHigh' :
                        item.severity === 'MEDIUM' ? 'bg-[#eab30815] text-riskMedium' :
                        'bg-[#22c55e15] text-riskLow'
                      }`}>
                        {item.overall_risk.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 text-darkTextSecondary">{item.primary_risk}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.decision === 'BLOCK' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        item.decision === 'ESCALATE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        item.decision === 'MODIFY' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {item.decision}
                      </span>
                    </td>
                    <td className="py-3 text-darkTextSecondary font-mono">{item.policy_id}</td>
                    <td className="py-3 text-center text-darkTextPrimary font-medium">{item.action_taken}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
