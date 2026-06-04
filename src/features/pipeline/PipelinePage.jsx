import React, { useState, useCallback } from 'react';
import { STAGES } from '../../constants/stages.js';
import { mkChecklist } from '../../constants/checklist.js';
import { getChecklistStatus } from '../../utils/checklist.js';
import { mkNotif } from '../../utils/notifications.js';
import { isAdmin } from '../../utils/permissions.js';
import { Ico } from '../../components/icons.jsx';
import KanbanColumn from './components/KanbanColumn.jsx';
import NewClientModal from './components/NewClientModal.jsx';

export default function PipelinePage({ clients, staff, setClients, setSelectedClient, currentUser, addNotif, onClientAdvanced, recentlyMovedId }) {
  const [showModal,      setShowModal]      = useState(false);
  const [newClientId,    setNewClientId]    = useState(null);
  const [summaryFilter,  setSummaryFilter]  = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');

  const pipelineClients = clients.filter(c => c.pipeline_entry);

  const today30 = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const summaryTotal   = pipelineClients.length;
  const summaryBlocked = pipelineClients.filter(c => {
    const st = getChecklistStatus(c, staff);
    return st && (st.type === 'missing' || st.type === 'waiting') && c.pipeline_entry;
  }).length;
  const summaryDenied  = pipelineClients.filter(c => c.stage === 'denied').length;
  const summaryReauth  = pipelineClients.filter(c => c.auth_expiry_date && new Date(c.auth_expiry_date).getTime() <= today30 && new Date(c.auth_expiry_date).getTime() > Date.now()).length;

  const afterSummary = pipelineClients.filter(c => {
    if (summaryFilter === 'all')     return true;
    if (summaryFilter === 'blocked') { const st = getChecklistStatus(c, staff); return st && (st.type === 'missing' || st.type === 'waiting'); }
    if (summaryFilter === 'denied')  return c.stage === 'denied';
    if (summaryFilter === 'reauth')  return c.auth_expiry_date && new Date(c.auth_expiry_date).getTime() <= today30 && new Date(c.auth_expiry_date).getTime() > Date.now();
    return true;
  });

  const displayClients = afterSummary
    .filter(c => {
      if (pipelineFilter === 'all')      return true;
      if (pipelineFilter === 'blockers') { const st = getChecklistStatus(c, staff); return st && (st.type === 'missing' || st.type === 'waiting'); }
      if (pipelineFilter === 'mycases')  return c.bcba_id === currentUser.id || c.rbt_id === currentUser.id;
      return true;
    })
    .filter(c => {
      if (!searchQuery.trim()) return true;
      return c.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const handleSaveClient = form => {
    const id = `c${Date.now()}`;
    const now = new Date().toISOString();
    setClients(prev => [...prev, {
      ...form,
      id, stage:'intake', source:'crm_created',
      stage_entered_at: now,
      pipeline_entry: true,
      denial_reason:null, bcba_id:null, rbt_id:null,
      auth_expiry_date:null, reauth_active:false,
      smart_assessment_session_id:null,
      checklist:mkChecklist(), documents:[], activity_log:[],
    }]);
    setShowModal(false);
    setNewClientId(id);
    setTimeout(() => setNewClientId(null), 3000);
  };

  const handleAddToPipeline = client => {
    setClients(prev => prev.map(c =>
      c.id === client.id
        ? { ...c, pipeline_entry:true, stage:'intake', stage_entered_at: new Date().toISOString() }
        : c
    ));
    setNewClientId(client.id);
    setTimeout(() => setNewClientId(null), 3000);
  };

  const handleAssignBCBA = useCallback((clientId, staffId) => {
    setClients(prev => prev.map(c => c.id===clientId ? { ...c, bcba_id:staffId } : c));
    if (staffId) {
      const s = staff.find(s => s.id === staffId);
      const c = clients.find(c => c.id === clientId);
      if (s && c) addNotif(mkNotif(`${s.name} assigned as BCBA to ${c.name}`, c.name, 'normal'));
    }
  }, [setClients, staff, clients, addNotif]);

  const handleAssignRBT = useCallback((clientId, staffId) => {
    setClients(prev => prev.map(c => c.id===clientId ? { ...c, rbt_id:staffId } : c));
    if (staffId) {
      const s = staff.find(s => s.id === staffId);
      const c = clients.find(c => c.id === clientId);
      if (s && c) addNotif(mkNotif(`${s.name} assigned as RBT to ${c.name}`, c.name, 'normal'));
    }
  }, [setClients, staff, clients, addNotif]);

  return (
    <div className="flex flex-col" style={{ height:'calc(100vh - 56px)' }}>
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-stone-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight" style={{ fontFamily:'Syne, sans-serif' }}>Pipeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {pipelineClients.length} clients · {STAGES.filter(s => pipelineClients.some(c => c.stage===s)).length} active stages
          </p>
        </div>
        {isAdmin(currentUser.role) && (
          <button
            onClick={() => setShowModal(true)}
            data-testid="new-client-btn"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background:'#0D9488', fontFamily:'DM Sans, sans-serif' }}>
            <Ico.Plus/> NEW CLIENT +
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-stone-100 flex-shrink-0 flex-wrap">
        {[
          { key:'all',     label:'Active',            count:summaryTotal,   testid:'summary-chip-total'   },
          { key:'blocked', label:'Blocked',          count:summaryBlocked, testid:'summary-chip-blocked' },
          { key:'denied',  label:'Denied',           count:summaryDenied,  testid:'summary-chip-denied'  },
          { key:'reauth',  label:'Reauth ≤30 days',  count:summaryReauth,  testid:'summary-chip-reauth'  },
        ].map(chip => {
          const active = summaryFilter === chip.key;
          return (
            <button
              key={chip.key}
              data-testid={chip.testid}
              onClick={() => setSummaryFilter(active ? 'all' : chip.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active ? 'text-white border-teal-600' : 'text-slate-700 border-stone-200 bg-white hover:border-teal-300 hover:text-teal-700'}`}
              style={active ? { background:'#0D9488' } : {}}>
              {chip.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-stone-100 text-slate-600'}`}>{chip.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-2 bg-white border-b border-stone-100 flex-shrink-0">
        {[
          { key:'all',      label:'All',            testid:'pipeline-filter-all'      },
          { key:'blockers', label:'Blockers only',  testid:'pipeline-filter-blockers' },
          { key:'mycases',  label:'My cases',       testid:'pipeline-filter-mycases'  },
        ].map(chip => {
          const active = pipelineFilter === chip.key;
          return (
            <button
              key={chip.key}
              data-testid={chip.testid}
              onClick={() => setPipelineFilter(chip.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${active ? 'text-white border-teal-600' : 'text-slate-600 border-stone-200 bg-white hover:border-teal-300 hover:text-teal-700'}`}
              style={active ? { background:'#0D9488' } : {}}>
              {chip.label}
            </button>
          );
        })}

        {/* Search */}
        <div className="relative" style={{ minWidth:'200px', maxWidth:'260px' }}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Ico.Search/>
          </div>
          <input
            data-testid="pipeline-search"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-stone-200 rounded-xl bg-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              data-testid="pipeline-search-clear"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <Ico.X/>
            </button>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 px-4 py-4 overflow-x-auto" style={{ overflowY:'hidden' }}>
        <div className="flex gap-3 h-full" style={{ minWidth:'max-content' }}>
          {STAGES.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              clients={displayClients.filter(c => c.stage===stage)}
              staff={staff}
              onAssignBCBA={handleAssignBCBA}
              onAssignRBT={handleAssignRBT}
              onSelectClient={setSelectedClient}
              newClientId={newClientId}
              recentlyMovedId={recentlyMovedId}
              currentUser={currentUser}
            />
          ))}
        </div>
      </div>

      {showModal && (
        <NewClientModal
          clients={clients}
          onSave={handleSaveClient}
          onClose={() => setShowModal(false)}
          onOpenClient={client => { setShowModal(false); setSelectedClient(client); }}
          onAddToPipeline={client => { handleAddToPipeline(client); setShowModal(false); }}
        />
      )}
    </div>
  );
}
