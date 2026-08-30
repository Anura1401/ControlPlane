import { useState } from 'react';
import { controlplaneApi } from './services/controlplaneApi';
import { Evaluation } from './types/controlplane';
import { Overview } from './components/Overview';
import { LiveEvaluation } from './components/LiveEvaluation';
import { EvaluationTrace } from './components/EvaluationTrace';
import { HumanReview, AgentTools, Policies, Monitoring, AuditLog } from './components/GovernanceSubpages';
import { Shield, Radio, Activity, CheckSquare, Settings, BarChart2, FileText, Search, User, Terminal } from 'lucide-react';
import { ApiDocs } from './components/ApiDocs';

function App() {
  const [currentPage, setCurrentPage] = useState<string>('overview');
  
  // Database states
  const [evaluations, setEvaluations] = useState<Evaluation[]>(controlplaneApi.getEvaluations());
  const [policies, setPolicies] = useState(controlplaneApi.getPolicies());
  const [auditLogs, setAuditLogs] = useState(controlplaneApi.getAuditLogs());
  const [reviews, setReviews] = useState(controlplaneApi.getHumanReviews());

  // Deep trace viewer mapping
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);

  // Sync states from API helper
  const syncDatabases = () => {
    setEvaluations([...controlplaneApi.getEvaluations()]);
    setPolicies([...controlplaneApi.getPolicies()]);
    setAuditLogs([...controlplaneApi.getAuditLogs()]);
    setReviews([...controlplaneApi.getHumanReviews()]);
  };

  const handleSelectTrace = (requestId: string) => {
    setSelectedEvaluationId(requestId);
    setCurrentPage('evaluation_trace');
  };

  const handleFilterByCategory = (category: string) => {
    // Navigate to audit log and filter or search for category
    setCurrentPage('audit_log');
  };

  const handleEvaluationComplete = (ev: Evaluation) => {
    syncDatabases();
  };

  const handleResolveReview = (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    controlplaneApi.resolveHumanReview(requestId, status);
    syncDatabases();
  };

  const handleSavePolicy = (config: any) => {
    controlplaneApi.savePolicy(config);
    syncDatabases();
  };

  // Selected Evaluation object
  const activeTrace = evaluations.find(e => e.request_id === selectedEvaluationId);

  return (
    <div className="flex h-screen bg-darkBg text-darkTextPrimary overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 border-r border-darkBorder bg-darkBg justify-between">
        <div className="space-y-6 pt-5">
          <div className="flex items-center space-x-2 px-5 pb-2 border-b border-darkBorder/40">
            <Shield className="h-6 w-6 text-blue-500" />
            <span className="font-bold tracking-tight text-darkTextPrimary text-base">CONTROLPLANE.AI</span>
          </div>
          
          <nav className="space-y-1.5 px-3 text-xs">
            <button
              onClick={() => { setCurrentPage('overview'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'overview' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => { setCurrentPage('live_evaluation'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'live_evaluation' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <Radio className="h-4 w-4 text-blue-400" />
              <span>Live Evaluation</span>
            </button>

            <button
              onClick={() => { setCurrentPage('human_review'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'human_review' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              <div className="flex-1 flex justify-between items-center">
                <span>Human Review</span>
                {reviews.filter(r => r.status === 'PENDING').length > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-orange-600 text-white font-bold font-mono">
                    {reviews.filter(r => r.status === 'PENDING').length}
                  </span>
                )}
              </div>
            </button>

            <button
              onClick={() => { setCurrentPage('agent_tools'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'agent_tools' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Agent / Tools</span>
            </button>

            <button
              onClick={() => { setCurrentPage('policies'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'policies' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Policies</span>
            </button>

            <button
              onClick={() => { setCurrentPage('monitoring'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'monitoring' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              <span>Monitoring</span>
            </button>

            <button
              onClick={() => { setCurrentPage('audit_log'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'audit_log' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Audit Log</span>
            </button>

            <button
              onClick={() => { setCurrentPage('api_docs'); setSelectedEvaluationId(null); }}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded font-medium transition-all ${
                currentPage === 'api_docs' ? 'bg-darkBorder text-darkTextPrimary' : 'text-darkTextSecondary hover:text-darkTextPrimary hover:bg-darkSurface/55'
              }`}
            >
              <Terminal className="h-4 w-4 text-blue-400" />
              <span>API Documentation</span>
            </button>
          </nav>
        </div>

        {/* Operational Status */}
        <div className="p-4 border-t border-darkBorder/40 text-[10px] text-darkTextSecondary space-y-1 bg-darkBg/60">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-semibold text-darkTextPrimary">All systems operational</span>
          </div>
          <div>ControlPlane Platform v2.1.0</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header stats bar */}
        <header className="flex items-center justify-between border-b border-darkBorder bg-darkBg px-6 py-3.5 text-xs">
          <div className="flex items-center space-x-6">
            <div className="font-semibold text-darkTextPrimary tracking-wider uppercase md:hidden flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <span>CP.AI</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-6 text-darkTextSecondary">
              <div>Env: <span className="font-bold text-darkTextPrimary font-mono">DEMO</span></div>
              <div className="h-4 border-r border-darkBorder" />
              <div>Policy: <span className="font-bold text-darkTextPrimary font-mono">Finance-v2</span></div>
              <div className="h-4 border-r border-darkBorder" />
              <div>Model: <span className="font-bold text-darkTextPrimary font-mono">Demo Model</span></div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 border border-darkBorder bg-darkSurface rounded px-2.5 py-1">
              <Search className="h-3.5 w-3.5 text-darkTextSecondary" />
              <input type="text" placeholder="Search Audit Logs..." className="bg-transparent focus:outline-none text-[11px] text-darkTextPrimary w-36" />
            </div>

            <div className="relative">
              <button className="flex items-center space-x-1 border border-darkBorder hover:bg-darkSurface p-1.5 rounded cursor-pointer transition-all">
                <User className="h-4 w-4 text-darkTextSecondary" />
                <span className="hidden lg:inline text-[10px] font-medium pr-1">Admin Session</span>
              </button>
            </div>
          </div>
        </header>

        {/* View Router */}
        <div className="flex-1 overflow-y-auto p-6 bg-darkBg">
          
          {currentPage === 'overview' && (
            <Overview
              evaluations={evaluations}
              onSelectEvaluation={handleSelectTrace}
              onFilterByRiskCategory={handleFilterByCategory}
            />
          )}

          {currentPage === 'live_evaluation' && (
            <LiveEvaluation
              onEvaluationCompleted={handleEvaluationComplete}
              onOpenReview={handleSelectTrace}
            />
          )}

          {currentPage === 'evaluation_trace' && activeTrace && (
            <EvaluationTrace
              evaluation={activeTrace}
              onBackToList={() => setCurrentPage('overview')}
              onOpenReview={(id) => { setSelectedEvaluationId(id); setCurrentPage('human_review'); }}
            />
          )}

          {currentPage === 'human_review' && (
            <HumanReview
              reviews={reviews}
              onResolve={handleResolveReview}
              onSelectRequestTrace={handleSelectTrace}
            />
          )}

          {currentPage === 'agent_tools' && (
            <AgentTools
              evaluations={evaluations}
              onSelectEvaluation={handleSelectTrace}
            />
          )}

          {currentPage === 'policies' && (
            <Policies
              policies={policies}
              onSave={handleSavePolicy}
            />
          )}

          {currentPage === 'monitoring' && (
            <Monitoring />
          )}

          {currentPage === 'audit_log' && (
            <AuditLog
              logs={auditLogs}
              onSelectAuditTrace={handleSelectTrace}
            />
          )}

          {currentPage === 'api_docs' && (
            <ApiDocs />
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
