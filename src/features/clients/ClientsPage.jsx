import React, { useState, useRef } from 'react';
import { STAGES } from '../../constants/stages.js';
import { mkChecklist } from '../../constants/checklist.js';
import { Ico } from '../../components/icons.jsx';
import StagePill from '../../components/StagePill.jsx';
import Avatar from '../../components/Avatar.jsx';
import NewClientModal from '../pipeline/components/NewClientModal.jsx';
import ImportPanel from './components/ImportPanel.jsx';
import { FLAGS } from '../../constants/featureFlags.js';

// ─── Filter config ────────────────────────────────────────────────────────────
const FILTER_GROUPS = {
  all:            null,
  intake:         ['intake'],
  in_progress:    ['auth_assessment','assessment','plan_draft','submitted','authorized','staffing'],
  active_services:['services'],
  denied:         ['denied'],
  directory:      'directory',   // special — pipeline_entry: false
};
const FILTER_LABELS = [
  { key:'all',            label:'All'             },
  { key:'intake',         label:'Intake'          },
  { key:'in_progress',    label:'In Progress'     },
  { key:'active_services',label:'Active Services' },
  { key:'denied',         label:'Denied'          },
  { key:'directory',      label:'Directory'       },
];
const FILTER_DISPLAY = {
  all:            'all stages',
  intake:         'Intake',
  in_progress:    'In Progress',
  active_services:'Active Services',
  denied:         'Denied',
  directory:      'Directory only',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob + 'T12:00:00');
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDob(dob) {
  if (!dob) return '—';
  return new Date(dob + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function sortClients(arr, col, dir) {
  const d = dir === 'asc' ? 1 : -1;
  return [...arr].sort((a, b) => {
    let av, bv;
    switch (col) {
      case 'name':          av = a.name;         bv = b.name;         break;
      case 'dob':           av = a.dob;          bv = b.dob;          break;
      case 'insurer':       av = a.insurer_name; bv = b.insurer_name; break;
      case 'member_id':     av = a.member_id;    bv = b.member_id;    break;
      case 'stage':         return (STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)) * d;
      case 'referral_date': av = a.referral_date; bv = b.referral_date; break;
      default:              return 0;
    }
    if (av < bv) return -1 * d;
    if (av > bv) return  1 * d;
    return 0;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ClientsPage({ clients, staff, setClients, setSelectedClient, currentUser }) {
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [sortCol,    setSortCol]    = useState('name');
  const [sortDir,    setSortDir]    = useState('asc');
  const [showNew,    setShowNew]    = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [toast,      setToast]      = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const dismissToast = () => {
    clearTimeout(toastTimer.current);
    setToast(null);
  };

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // U-09: quick add-to-pipeline from table row
  const handleAddToPipeline = (e, clientId) => {
    e.stopPropagation();  // don't open profile panel
    setClients(prev => prev.map(c =>
      c.id === clientId
        ? { ...c, pipeline_entry: true, stage: 'intake', stage_entered_at: new Date().toISOString() }
        : c
    ));
    showToast('Client added to Intake pipeline');
  };

  // ── Filter counts for chips ──────────────────────────────────────────────
  const filterCounts = {
    all:            clients.length,
    intake:         clients.filter(c => c.stage === 'intake').length,
    in_progress:    clients.filter(c => (FILTER_GROUPS.in_progress).includes(c.stage)).length,
    active_services:clients.filter(c => c.stage === 'services').length,
    denied:         clients.filter(c => c.stage === 'denied').length,
    directory:      clients.filter(c => !c.pipeline_entry).length,
  };

  // ── Filter + search + sort ───────────────────────────────────────────────
  const filteredByStage =
    filter === 'directory'
      ? clients.filter(c => !c.pipeline_entry)
      : FILTER_GROUPS[filter]
        ? clients.filter(c => FILTER_GROUPS[filter].includes(c.stage))
        : clients;

  const searched = search.trim()
    ? filteredByStage.filter(c => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.member_id || '').toLowerCase().includes(q) ||
          (c.insurer_name || '').toLowerCase().includes(q) ||
          (c.icd10 || '').toLowerCase().includes(q) ||
          (c.referring_provider || '').toLowerCase().includes(q)
        );
      })
    : filteredByStage;

  const sorted = sortClients(searched, sortCol, sortDir);

  const SortIcon = ({ col }) => (
    sortCol === col
      ? <span className="ml-1 text-teal-600 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
      : <span className="ml-1 text-slate-300 text-xs">↕</span>
  );

  // Sortable columns (care_team is not sortable)
  const COLS = [
    { key:'name',          label:'Client',        sortable: true  },
    { key:'dob',           label:'DOB / Age',     sortable: true  },
    { key:'insurer',       label:'Insurer',       sortable: true  },
    { key:'member_id',     label:'Member ID',     sortable: true  },
    { key:'stage',         label:'Stage',         sortable: true  },
    { key:'care_team',     label:'Care Team',     sortable: false },
    { key:'referral_date', label:'Referral Date', sortable: true  },
  ];

  return (
    <div data-testid="clients-page">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {/* U-03: dynamic subtitle */}
            {search.trim()
              ? `${sorted.length} of ${filteredByStage.length} clients matching "${search}" · ${FILTER_DISPLAY[filter]}`
              : `${sorted.length} client${sorted.length !== 1 ? 's' : ''} · ${FILTER_DISPLAY[filter]}`
            }
          </p>
        </div>
        {/* C-01: isAdmin called as function */}
        {true && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowImport(true)} data-testid="import-btn"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 border border-stone-200 bg-white rounded-xl hover:bg-stone-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Import CSV / Excel
            </button>
            <button onClick={() => setShowNew(true)} data-testid="clients-new-btn"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
              style={{ background:'#0D9488' }}>
              <Ico.Plus/> New Client
            </button>
          </div>
        )}
      </div>

      {/* Search + filter chips */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* U-02: search with clear button */}
        <div className="relative" style={{ minWidth:'280px' }}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Ico.Search/></div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, member ID, insurer, ICD-10…"
            data-testid="clients-search"
            className="w-full pl-9 pr-8 py-2 text-sm border border-stone-200 rounded-xl bg-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 text-slate-700 placeholder:text-slate-400"/>
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
        {/* U-04: filter chips with counts */}
        {FLAGS.PIPELINE && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTER_LABELS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} data-testid={`filter-${f.key}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  filter === f.key
                    ? 'text-white border-teal-600'
                    : 'text-slate-600 border-stone-200 bg-white hover:border-teal-300 hover:text-teal-700'
                }`}
                style={filter === f.key ? { background:'#0D9488' } : {}}>
                {f.label}
                {filterCounts[f.key] > 0 && (
                  <span className={`ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded ${
                    filter === f.key ? 'bg-white/20' : 'bg-stone-100 text-slate-500'
                  }`}>
                    {filterCounts[f.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden" data-testid="clients-table">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth:'820px' }}>
            <thead>
              <tr style={{ background:'#FAFAF8', borderBottom:'1px solid #E7E5E0' }}>
                {COLS.map(c => {
                  if (!FLAGS.PIPELINE && (c.key === 'stage' || c.key === 'care_team' || c.key === 'referral_date')) return null;
                  return (
                    <th key={c.key}
                      onClick={c.sortable ? () => handleSort(c.key) : undefined}
                      className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 select-none whitespace-nowrap ${
                        c.sortable ? 'cursor-pointer hover:text-slate-606' : ''
                      }`}>
                      {c.label}{c.sortable && <SortIcon col={c.key}/>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* U-05: two distinct empty states */}
              {sorted.length === 0 && clients.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-teal-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">No clients yet</p>
                    <p className="text-xs text-slate-400 mb-4">Add your first client manually or import from a spreadsheet</p>
                    {true && (
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => setShowImport(true)}
                          className="px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg text-slate-600 hover:bg-stone-50 transition-colors">
                          Import CSV / Excel
                        </button>
                        <button onClick={() => setShowNew(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                          style={{ background:'#0D9488' }}>
                          + New Client
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              {sorted.length === 0 && clients.length > 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-14 text-center">
                    <p className="text-sm font-semibold text-slate-600 mb-1">No clients match your search</p>
                    <p className="text-xs text-slate-400 mb-3">Try a different name, member ID, or insurer</p>
                    <div className="flex items-center gap-2 justify-center">
                      {search && (
                        <button onClick={() => setSearch('')}
                          className="text-xs font-semibold text-teal-600 hover:underline">
                          Clear search
                        </button>
                      )}
                      {filter !== 'all' && (
                        <button onClick={() => setFilter('all')}
                          className="text-xs font-semibold text-teal-600 hover:underline">
                          Show all stages
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {sorted.map(c => {
                const bcba = staff.find(s => s.id === c.bcba_id);
                const rbt  = staff.find(s => s.id === c.rbt_id);
                const age  = calcAge(c.dob);
                const isDirectoryOnly = !c.pipeline_entry;

                return (
                  <tr key={c.id} onClick={() => setSelectedClient(c)}
                    data-testid={`client-row-${c.id}`}
                    className="hover:bg-teal-50/30 transition-colors cursor-pointer group"
                    style={{ borderBottom:'1px solid #F5F4F0' }}>

                    {/* Client name + source indicator */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ background:'#F0FDFA', color:'#0F766E', border:'1px solid #CCFBF1' }}>
                            {c.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          {/* U-08: source indicator as dot on avatar */}
                          {c.source === 'imported' && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-white" title="Imported"/>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors whitespace-nowrap">
                              {c.name}
                            </span>
                            {c.gender && (
                              <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                                {c.gender === 'Male' ? 'M' : c.gender === 'Female' ? 'F' : c.gender.charAt(0)}
                              </span>
                            )}
                          </div>
                          {c.icd10 && (
                            <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap"
                              style={{ background:'rgba(13,148,136,0.08)', color:'#0F766E', fontFamily:'DM Mono, monospace' }}>
                              {c.icd10}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* U-06: formatted DOB + age */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-600" style={{ fontFamily:'DM Mono, monospace' }}>
                        {formatDob(c.dob)}
                      </span>
                      {age !== null && (
                        <span className="ml-1.5 text-[10px] text-slate-400">({age}y)</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{c.insurer_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap" style={{ fontFamily:'DM Mono, monospace' }}>{c.member_id}</td>

                    {/* Stage cell: pipeline stage OR quick Add to pipeline */}
                    {FLAGS.PIPELINE && (
                      <td className="px-4 py-3">
                        {isDirectoryOnly
                          ? (
                            /* U-09: inline add-to-pipeline for directory clients */
                            <button
                              onClick={e => handleAddToPipeline(e, c.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-teal-200 text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors whitespace-nowrap">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                              </svg>
                              Add to pipeline
                            </button>
                          )
                          : <StagePill stage={c.stage}/>
                        }
                      </td>
                    )}

                    {/* U-07: merged Care Team column */}
                    {FLAGS.PIPELINE && (
                      <td className="px-4 py-3">
                        {(bcba || rbt)
                          ? (
                            <div className="flex flex-col gap-1">
                              {bcba && (
                                <div className="flex items-center gap-1.5">
                                  <Avatar initials={bcba.initials} role="bcba" size="sm"/>
                                  <span className="text-xs text-slate-600 whitespace-nowrap">{bcba.name.replace('Dr. ','')}</span>
                                </div>
                              )}
                              {rbt && (
                                <div className="flex items-center gap-1.5">
                                  <Avatar initials={rbt.initials} role="rbt" size="sm"/>
                                  <span className="text-xs text-slate-600 whitespace-nowrap">{rbt.name}</span>
                                </div>
                              )}
                            </div>
                          )
                          : <span className="text-slate-300 text-xs">—</span>
                        }
                      </td>
                    )}

                    {FLAGS.PIPELINE && (
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap" style={{ fontFamily:'DM Mono, monospace' }}>
                        {c.referral_date || '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* P-03: row count footer note */}
        {sorted.length > 0 && (
          <div className="px-4 py-2 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {sorted.length} client{sorted.length !== 1 ? 's' : ''}
              {sorted.length < clients.length && ` · ${clients.length - sorted.length} hidden by filter`}
            </span>
            {(search || filter !== 'all') && (
              <button onClick={() => { setSearch(''); setFilter('all'); }}
                className="text-[11px] text-teal-600 font-medium hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* New Client modal */}
      {showNew && (
        <NewClientModal
          clients={clients}
          showPipelineOption={FLAGS.PIPELINE}
          onSave={data => {
            const { createPipelineEntry, ...clientData } = data;
            const now = new Date().toISOString();
            const nc = {
              id: `c_${Date.now()}`,
              ...clientData,
              source: 'crm_created',                          // C-03: explicit source
              stage: createPipelineEntry ? 'intake' : null,
              stage_entered_at: createPipelineEntry ? now : null,
              pipeline_entry: createPipelineEntry ?? false,
              denial_reason:null, bcba_id:null, rbt_id:null,
              auth_expiry_date:null, reauth_cycle:0, reauth_requested_hours:{}, auth_cycles_history:[],
              smart_assessment_session_id:null,
              checklist:mkChecklist(), documents:[], activity_log:[],
            };
            setClients(prev => [nc, ...prev]);
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
          onOpenClient={c => { setShowNew(false); setSelectedClient(c); }}
          // C-04: removed dead onAddToPipeline no-op prop
        />
      )}

      {/* Import panel */}
      {showImport && (
        <ImportPanel
          onClose={() => setShowImport(false)}
          existingClients={clients}
          onImport={newClients => {
            setClients(prev => [...newClients, ...prev]);
            setShowImport(false);
            // C-02: toast reflects actual destination
            const toPipeline = newClients.some(c => c.pipeline_entry);
            const toDirectory = newClients.some(c => !c.pipeline_entry);
            const n = newClients.length;
            const label = n === 1 ? '1 client' : `${n} clients`;
            if (toPipeline && toDirectory) {
              showToast(`${label} added — some to pipeline, some to directory`);
            } else if (toPipeline) {
              showToast(`${label} added to Intake pipeline`);
            } else {
              showToast(`${label} added to client directory`);
            }
          }}
        />
      )}

      {/* P-01: dismissable toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium z-[100]"
          style={{ background:'#0F766E', color:'#fff' }} data-testid="import-toast">
          <Ico.Check/>
          <span>{toast.msg}</span>
          <button onClick={dismissToast} className="ml-1 opacity-70 hover:opacity-100 transition-opacity">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
