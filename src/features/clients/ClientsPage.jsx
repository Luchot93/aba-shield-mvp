import React, { useState } from 'react';
import { STAGES } from '../../constants/stages.js';
import { mkChecklist } from '../../constants/checklist.js';
import { Ico } from '../../components/icons.jsx';
import StagePill from '../../components/StagePill.jsx';
import Avatar from '../../components/Avatar.jsx';
import NewClientModal from '../pipeline/components/NewClientModal.jsx';
import ImportPanel from './components/ImportPanel.jsx';

const FILTER_GROUPS = {
  all:            null,
  intake:         ['intake'],
  in_progress:    ['auth_assessment','assessment','plan_draft','submitted','authorized','staffing'],
  active_services:['services'],
  denied:         ['denied'],
};
const FILTER_LABELS = [
  { key:'all',            label:'All'             },
  { key:'intake',         label:'Intake'          },
  { key:'in_progress',    label:'In Progress'     },
  { key:'active_services',label:'Active Services' },
  { key:'denied',         label:'Denied'          },
];

function sortClients(arr, col, dir) {
  const d = dir === 'asc' ? 1 : -1;
  return [...arr].sort((a, b) => {
    let av, bv;
    switch (col) {
      case 'name':          av = a.name;                    bv = b.name;          break;
      case 'dob':           av = a.dob;                     bv = b.dob;           break;
      case 'insurer':       av = a.insurer_name;            bv = b.insurer_name;  break;
      case 'member_id':     av = a.member_id;               bv = b.member_id;     break;
      case 'stage':         return (STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)) * d;
      case 'bcba':          av = a.bcba_id || '';           bv = b.bcba_id || ''; break;
      case 'rbt':           av = a.rbt_id  || '';           bv = b.rbt_id  || ''; break;
      case 'referral_date': av = a.referral_date;           bv = b.referral_date; break;
      case 'source':        av = a.source;                  bv = b.source;        break;
      default:              return 0;
    }
    if (av < bv) return -1 * d;
    if (av > bv) return  1 * d;
    return 0;
  });
}

export default function ClientsPage({ clients, staff, setClients, setSelectedClient, currentUser }) {
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [sortCol,    setSortCol]    = useState('name');
  const [sortDir,    setSortDir]    = useState('asc');
  const [showNew,    setShowNew]    = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [toast,      setToast]      = useState(null);
  const isAdmin = currentUser.role === 'admin';

  const showToast = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d==='asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filteredByStage = FILTER_GROUPS[filter]
    ? clients.filter(c => FILTER_GROUPS[filter].includes(c.stage))
    : clients;

  const searched = search.trim()
    ? filteredByStage.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.member_id.toLowerCase().includes(search.toLowerCase()) ||
        c.insurer_name.toLowerCase().includes(search.toLowerCase())
      )
    : filteredByStage;

  const sorted = sortClients(searched, sortCol, sortDir);

  const SortIcon = ({ col }) => (
    sortCol === col
      ? <span className="ml-1 text-teal-600 text-xs">{sortDir==='asc' ? '↑' : '↓'}</span>
      : <span className="ml-1 text-slate-300 text-xs">↕</span>
  );

  const COLS = [
    { key:'name',          label:'Client'        },
    { key:'dob',           label:'DOB'           },
    { key:'insurer',       label:'Insurer'       },
    { key:'member_id',     label:'Member ID'     },
    { key:'stage',         label:'Stage'         },
    { key:'bcba',          label:'BCBA'          },
    { key:'rbt',           label:'RBT'           },
    { key:'referral_date', label:'Referral Date' },
    { key:'source',        label:'Source'        },
  ];

  return (
    <div data-testid="clients-page">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">{sorted.length} of {clients.length} clients · all stages</p>
        </div>
        {isAdmin && (
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
        <div className="relative" style={{ minWidth:'260px' }}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Ico.Search/></div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, member ID, insurer…"
            data-testid="clients-search"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl bg-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 text-slate-700 placeholder:text-slate-400"/>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_LABELS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} data-testid={`filter-${f.key}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                filter===f.key
                  ? 'text-white border-teal-600'
                  : 'text-slate-600 border-stone-200 bg-white hover:border-teal-300 hover:text-teal-700'
              }`}
              style={filter===f.key ? { background:'#0D9488' } : {}}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden" data-testid="clients-table">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth:'900px' }}>
            <thead>
              <tr style={{ background:'#FAFAF8', borderBottom:'1px solid #E7E5E0' }}>
                {COLS.map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)}
                    className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap">
                    {c.label}<SortIcon col={c.key}/>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0
                ? <tr><td colSpan={COLS.length} className="px-4 py-14 text-center text-sm text-slate-400">No clients found.</td></tr>
                : sorted.map(c => {
                    const bcba = staff.find(s => s.id === c.bcba_id);
                    const rbt  = staff.find(s => s.id === c.rbt_id);
                    return (
                      <tr key={c.id} onClick={() => setSelectedClient(c)}
                        data-testid={`client-row-${c.id}`}
                        className="hover:bg-teal-50/30 transition-colors cursor-pointer group"
                        style={{ borderBottom:'1px solid #F5F4F0' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                              style={{ background:'#F0FDFA', color:'#0F766E', border:'1px solid #CCFBF1' }}>
                              {c.name.split(' ').map(n=>n[0]).join('')}
                            </div>
                            <span className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors whitespace-nowrap">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap" style={{ fontFamily:'DM Mono, monospace' }}>{c.dob}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{c.insurer_name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap" style={{ fontFamily:'DM Mono, monospace' }}>{c.member_id}</td>
                        <td className="px-4 py-3"><StagePill stage={c.stage}/></td>
                        <td className="px-4 py-3">
                          {bcba
                            ? <div className="flex items-center gap-1.5"><Avatar initials={bcba.initials} role="bcba" size="sm"/><span className="text-xs text-slate-600 whitespace-nowrap">{bcba.name.replace('Dr. ','')}</span></div>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {rbt
                            ? <div className="flex items-center gap-1.5"><Avatar initials={rbt.initials} role="rbt" size="sm"/><span className="text-xs text-slate-600 whitespace-nowrap">{rbt.name}</span></div>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap" style={{ fontFamily:'DM Mono, monospace' }}>{c.referral_date}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.source === 'imported'
                              ? 'text-blue-700 bg-blue-50 border-blue-200'
                              : 'text-slate-600 bg-slate-50 border-slate-200'
                          }`}>
                            {c.source === 'imported' ? 'Imported' : 'CRM'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* New Client modal */}
      {showNew && (
        <NewClientModal
          clients={clients}
          onSave={data => {
            const nc = {
              id:`c_${Date.now()}`, ...data, stage:'intake',
              pipeline_entry: false,
              denial_reason:null, bcba_id:null, rbt_id:null,
              auth_expiry_date:null, reauth_active:false,
              smart_assessment_session_id:null,
              checklist:mkChecklist(), documents:[], activity_log:[],
            };
            setClients(prev => [nc, ...prev]);
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
          onOpenClient={c => { setShowNew(false); setSelectedClient(c); }}
          onAddToPipeline={() => {}}
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
            showToast(`${newClients.length} client${newClients.length!==1?'s':''} added to Intake`);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl text-sm font-medium z-[100]"
          style={{ background:'#0F766E', color:'#fff' }} data-testid="import-toast">
          <Ico.Check/> {toast.msg}
        </div>
      )}
    </div>
  );
}
