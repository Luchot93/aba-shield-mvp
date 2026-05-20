import React, { useState } from 'react';
import { Ico } from '../../components/icons.jsx';
import StaffCard from './components/StaffCard.jsx';
import InvitePanel from './components/InvitePanel.jsx';

export default function StaffPage({ staff, setStaff, clients, currentUser, onSelectClient }) {
  const [tab,        setTab]        = useState('all');
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [showInvite, setShowInvite] = useState(false);
  const [invites,    setInvites]    = useState([]);
  const [toast,      setToast]      = useState(null);

  const today  = Date.now();
  const warn60 = today + 60 * 24 * 60 * 60 * 1000;

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const enriched = staff.map(s => ({
    ...s,
    active_case_count: clients.filter(c => c.bcba_id === s.id || c.rbt_id === s.id).length,
  }));

  const byTab = enriched.filter(s =>
    tab === 'all'   ? true :
    tab === 'bcbas' ? s.role === 'bcba' :
    tab === 'rbts'  ? s.role === 'rbt'  : true
  );

  const searched = search.trim()
    ? byTab.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.cert_number||'').toLowerCase().includes(search.toLowerCase())
      )
    : byTab;

  const filtered = filter === 'available'
    ? searched.filter(s => s.status === 'active')
    : filter === 'expiring'
    ? searched.filter(s => {
        const exp = new Date(s.cert_expiry).getTime();
        return exp >= today && exp <= warn60;
      })
    : searched;

  const handleEdit = (id, data) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  const handleInvite = form => {
    const initials = form.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const newStaff = {
      id: `s_${Date.now()}`,
      name: form.name, initials, email: form.email, role: form.role,
      cert_number: form.cert_number || '', cert_expiry: form.cert_expiry || '',
      status: 'pending',
    };
    setStaff(prev => [...prev, newStaff]);
    const inv = { id:`inv_${Date.now()}`, name:form.name, email:form.email, role:form.role, invited_at: new Date().toISOString() };
    setInvites(prev => [inv, ...prev]);
    showToast(`${form.name} invited as ${form.role.toUpperCase()}`);
  };

  const handleRevoke = id => {
    setInvites(prev => prev.filter(i => i.id !== id));
    setStaff(prev => prev.filter(s => s.email !== invites.find(i=>i.id===id)?.email));
  };

  const totalActive  = enriched.filter(s => s.status === 'active').length;
  const totalCases   = enriched.reduce((sum, s) => sum + s.active_case_count, 0);
  const expiringSoon = enriched.filter(s => { const e=new Date(s.cert_expiry).getTime(); return e >= today && e <= warn60; }).length;

  const TABS  = [['all','All'],['bcbas','BCBAs'],['rbts','RBTs']];
  const CHIPS = [
    { key:'all',       label:'All'          },
    { key:'available', label:'Available'    },
    { key:'expiring',  label:'Cert expiring'},
  ];

  return (
    <div data-testid="staff-page">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>Staff</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {enriched.length} team members · {enriched.filter(s=>s.role==='bcba').length} BCBAs · {enriched.filter(s=>s.role==='rbt').length} RBTs
          </p>
        </div>
        {currentUser?.role === 'admin' && (
          <button onClick={() => setShowInvite(true)} data-testid="invite-btn"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
            style={{ background:'#0D9488' }}>
            <Ico.Plus/> Invite Staff
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label:'Active Staff',   value:totalActive,  sub:`of ${enriched.length} total`, color:'#059669' },
          { label:'Total Cases',    value:totalCases,   sub:'across all staff',             color:'#0D9488' },
          { label:'Cert Expiring',  value:expiringSoon, sub:'within 60 days',              color:'#D97706' },
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 px-5 py-4">
            <div className="text-3xl font-bold" style={{ color:s.color, fontFamily:'Syne, sans-serif' }}>{s.value}</div>
            <div className="text-sm font-medium text-slate-800 mt-0.5">{s.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs + search + chips */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-0.5 bg-stone-100 rounded-lg p-0.5">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} data-testid={`tab-${key}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1" style={{ minWidth:'200px', maxWidth:'280px' }}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Ico.Search/></div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name or cert number…"
            data-testid="staff-search"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl bg-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 placeholder:text-slate-400"/>
        </div>
        <div className="flex items-center gap-1.5">
          {CHIPS.map(c => (
            <span key={c.key} className={c.key === 'expiring' ? 'relative group/certchip' : undefined}>
              <button onClick={() => setFilter(c.key)} data-testid={`staff-filter-${c.key}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  filter === c.key
                    ? 'text-white border-teal-600'
                    : 'text-slate-600 border-stone-200 bg-white hover:border-teal-300 hover:text-teal-700'
                }`}
                style={filter === c.key ? { background:'#0D9488' } : {}}>
                {c.label}
              </button>
              {c.key === 'expiring' && (
                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-64 rounded-md bg-slate-700 px-2.5 py-1.5 text-[10px] leading-snug text-slate-100 opacity-0 group-hover/certchip:opacity-100 transition-opacity duration-150 z-50 shadow-lg text-center whitespace-normal">
                  Professional certification only (BCBA or RBT credential). Staff training deadlines are tracked separately.
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-700"/>
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0
        ? <div className="py-16 text-center text-sm text-slate-400" data-testid="staff-empty">No staff match your search.</div>
        : <div className="grid gap-3" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))' }} data-testid="staff-grid">
            {filtered.map(s => (
              <StaffCard key={s.id} member={s} clients={clients} onEdit={handleEdit} currentUser={currentUser} onSelectClient={onSelectClient}/>
            ))}
          </div>
      }

      {/* Invite panel */}
      {showInvite && (
        <InvitePanel
          onClose={() => setShowInvite(false)}
          onInvite={handleInvite}
          pendingInvites={invites}
          onRevoke={handleRevoke}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-medium z-[100]"
          style={{ background:'#0F766E', color:'#fff' }} data-testid="staff-toast">
          <Ico.Check/> {toast}
        </div>
      )}
    </div>
  );
}
