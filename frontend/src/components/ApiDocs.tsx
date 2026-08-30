import { useState } from 'react';
import { Copy, Check, Code, Terminal } from 'lucide-react';

export const ApiDocs = () => {
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'node'>('curl');
  const [copied, setCopied] = useState<boolean>(false);

  const curlCode = `curl -X POST "http://localhost:8000/api/v1/evaluate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "application_id": "finance_assistant",
    "policy_id": "Finance-v2",
    "user_prompt": "What is Omega Global dividend payout rate?",
    "llm_response": "Omega dividend yield payout rate was reported as 1.2%.",
    "tool_action": null,
    "generate_with_llm": false
  }'`;

  const pythonCode = `import requests

url = "http://localhost:8000/api/v1/evaluate"
payload = {
    "application_id": "finance_assistant",
    "policy_id": "Finance-v2",
    "user_prompt": "Delete this billing invoice record.",
    "tool_action": {
        "tool_name": "delete_record",
        "arguments": {"id": "L_99182"}
    },
    "generate_with_llm": False
}

response = requests.post(url, json=payload)
result = response.json()

print(f"Decision: {result['decision']}")
print(f"Risk Score: {result['risk_engine']['risk_score']}")
print(f"Authorized: {result['action_validation']['authorized']}")`;

  const nodeCode = `const url = 'http://localhost:8000/api/v1/evaluate';
const payload = {
  application_id: 'finance_assistant',
  policy_id: 'Finance-v2',
  user_prompt: 'Compare Omega Global yields.',
  generate_with_llm: true // Generates response with Gemini and runs safety pipeline
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => {
  console.log('Governance Decision:', data.decision);
  console.log('Engine Risk Level:', data.risk_engine.risk_level);
  console.log('Sanitized Response:', data.final_response);
});`;

  const handleCopy = () => {
    const text = activeTab === 'curl' ? curlCode : (activeTab === 'python' ? pythonCode : nodeCode);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-darkTextPrimary flex items-center space-x-2">
          <Terminal className="h-6 w-6 text-blue-500" />
          <span>API Integration Documentation</span>
        </h1>
        <p className="text-sm text-darkTextSecondary mt-1">
          ControlPlane.ai exposes a model-agnostic, reusable JSON REST API to evaluate safety, redactions, and permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 space-y-2">
          <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">ENDPOINT</div>
          <div className="text-xs font-mono font-bold bg-darkBg px-2 py-1 rounded select-all text-darkTextPrimary">
            POST /api/v1/evaluate
          </div>
          <p className="text-[11px] text-darkTextSecondary">
            Sends user instructions, chatbot responses, and tool requests directly to the policy engine.
          </p>
        </div>

        <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 space-y-2">
          <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest">EVALUATION MODES</div>
          <div className="text-xs font-semibold text-darkTextPrimary">
            External Chatbots or Live LLM
          </div>
          <p className="text-[11px] text-darkTextSecondary">
            Support pre-generated responses or enable <code className="font-mono text-blue-400 text-[10px]">generate_with_llm: true</code> to call Gemini.
          </p>
        </div>

        <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 space-y-2">
          <div className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">GOVERNANCE OUTCOME</div>
          <div className="text-xs font-semibold text-darkTextPrimary">
            ALLOW | MODIFY | ESCALATE | BLOCK
          </div>
          <p className="text-[11px] text-darkTextSecondary">
            Returns real-time decisions, redacted responses, claim grounding, and tool safety checks.
          </p>
        </div>
      </div>

      {/* Code Snippets Section */}
      <div className="border border-darkBorder bg-darkSurface rounded-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-darkBorder bg-darkBg/60 px-4 py-2">
          <div className="flex space-x-2 text-xs">
            <button
              onClick={() => setActiveTab('curl')}
              className={`px-3 py-1 rounded font-medium cursor-pointer transition-all ${
                activeTab === 'curl' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary'
              }`}
            >
              cURL
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1 rounded font-medium cursor-pointer transition-all ${
                activeTab === 'python' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary'
              }`}
            >
              Python
            </button>
            <button
              onClick={() => setActiveTab('node')}
              className={`px-3 py-1 rounded font-medium cursor-pointer transition-all ${
                activeTab === 'node' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary'
              }`}
            >
              Node.js
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 text-[10px] text-darkTextSecondary hover:text-darkTextPrimary px-2 py-1 rounded border border-darkBorder hover:bg-darkBg/80 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 bg-darkBg text-xs font-mono overflow-x-auto text-darkTextPrimary whitespace-pre select-text">
          {activeTab === 'curl' && curlCode}
          {activeTab === 'python' && pythonCode}
          {activeTab === 'node' && nodeCode}
        </div>
      </div>

      {/* JSON Schema Definition */}
      <div className="border border-darkBorder bg-darkSurface rounded-lg p-4 space-y-4">
        <h2 className="text-xs font-semibold text-darkTextPrimary tracking-wider uppercase flex items-center space-x-1.5">
          <Code className="h-4 w-4 text-blue-400" />
          <span>API Response Schema Contracts</span>
        </h2>

        <div className="space-y-3 text-xs">
          <div className="border-l-2 border-blue-500 pl-3 py-1 space-y-1">
            <div className="font-semibold text-darkTextPrimary font-mono">llm: &#123; provider: string, model: string, response: string, input_tokens: number, ... &#125;</div>
            <p className="text-[11px] text-darkTextSecondary">
              Holds token metadata and latency of Gemini response generation if evaluated with LLM.
            </p>
          </div>

          <div className="border-l-2 border-green-500 pl-3 py-1 space-y-1">
            <div className="font-semibold text-darkTextPrimary font-mono">tier_0: &#123; pii, injection, toxicity, bias, truth &#125;</div>
            <p className="text-[11px] text-darkTextSecondary">
              Each detector contains score metrics, detections, and matched metadata details (PII spans, entity category).
            </p>
          </div>

          <div className="border-l-2 border-purple-500 pl-3 py-1 space-y-1">
            <div className="font-semibold text-darkTextPrimary font-mono">risk_router: &#123; tier_1_required: boolean, reason: string[] &#125;</div>
            <p className="text-[11px] text-darkTextSecondary">
              Dynamic router outcome deciding if prompt/truth severity requires launching vector DB verification.
            </p>
          </div>

          <div className="border-l-2 border-orange-500 pl-3 py-1 space-y-1">
            <div className="font-semibold text-darkTextPrimary font-mono">action_validation: &#123; authorized: boolean, risk: number, reason: string[] &#125;</div>
            <p className="text-[11px] text-darkTextSecondary">
              Verifies intercepted tool actions against corporate authorization rights.
            </p>
          </div>

          <div className="border-l-2 border-red-500 pl-3 py-1 space-y-1">
            <div className="font-semibold text-darkTextPrimary font-mono">decision: "ALLOW" | "MODIFY" | "ESCALATE" | "BLOCK"</div>
            <p className="text-[11px] text-darkTextSecondary">
              Final policy decision code. <code className="font-mono text-orange-400">MODIFY</code> returns redacted text in <code className="font-mono text-orange-400">final_response</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
