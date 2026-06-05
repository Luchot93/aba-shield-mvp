import React, { useState } from 'react';
import { Ico } from '../../components/icons.jsx';
import StaffCard from './components/StaffCard.jsx';
import InvitePanel from './components/InvitePanel.jsx';
import BulkInvitePanel from './components/BulkInvitePanel.jsx';
import { isAdmin } from '../../utils/permissions.js';

export default function StaffPage({ staff, setStaff, clients, currentUser, onSelectClient }) {
  const [tab,            setTab]            = useState('all');
  const [search,         setSearch]         = useState('');
  const [filter,         setFilter]         = useState('all');
  const [sort,           setSort]           = useState('name');   // UX7: sort control
  const [showInvite,     setShowInvite]     = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [invites,        setInvites]        = useState([]);
  const [toast,          setToast]          = useState(null);

  const today  = Date.now();
  const warn60 = today + 60 * 24 * 60 * 60 * 1000;

  // P1: configurable toast duration
  const showToast = (msg, duration = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };

  const enriched = staff.map(s => ({
    ...s,
    active_case_count: clients.filter(c => c.bcba_id === s.id || c.rbt_id === s.id).length,
  }));

  // S3: BCaBAs are now included in the BCBAs tab (they were previously invisible)
  const byTab = enriched.filter(s =>
    tab === 'all'   ? true :
    tab === 'bcbas' ? (s.role === 'bcba' || s.role === 'bcaba') :
    tab === 'rbts'  ? s.role === 'rbt' : true
  );

  const searched = search.trim()
    ? byTab.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.cert_number||'').toLowerCase().includes(search.toLowerCase()) ||
        (s.npi||'').includes(search.trim())
      )
    : byTab;

  // UX1: "available" filter still filters by active status (label change only)
  const filtered = filter === 'available'
    ? searched.filter(s => s.status === 'active')
    : filter === 'expiring'
    ? searched.filter(s => {
        const exp = new Date(s.cert_expiry).getTime();
        return exp >= today && exp <= warn60;
      })
    : searched;

  // UX7: sort
  const sortedList = [...filtered].sort((a, b) => {
    if (sort === 'expiry') {
      const ae = a.cert_expiry || '9999-99-99';
      const be = b.cert_expiry || '9999-99-99';
      return ae < be ? -1 : ae > be ? 1 : 0;
    }
    if (sort === 'cases') return b.active_case_count - a.active_case_count;
    return a.name.localeCompare(b.name);
  });

  const handleEdit = (id, data) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  // handleInvite — duplicate check is done inside InvitePanel (via existingEmails prop)
  const handleInvite = form => {
    const initials = form.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const newStaff = {
      id:                 `s_${Date.now()}`,
      name:               form.name,
      initials,
      email:              form.email,
      phone:              form.phone || '',
      role:               form.role,
      cert_number:        form.cert_number || '',
      cert_expiry:        form.cert_expiry || '',
      cert_effective_date:'',
      npi:                form.npi || '',
      caqh_id:            '',
      hire_date:          form.hire_date || '',
      supervisor:         '',
      title:              '',
      status:             'pending',
    };
    setStaff(prev => [...prev, newStaff]);
    const inv = {
      id:         `inv_${Date.now()}`,
      name:       form.name,
      email:      form.email,
      role:       form.role,
      invited_at: new Date().toISOString(),
    };
    setInvites(prev => [inv, ...prev]);
    showToast(`${form.name} invited as ${form.role.toUpperCase()}`);
  };

  // S2: Fix stale closure — capture email BEFORE any state mutations
  const handleRevoke = id => {
    const email = invites.find(i => i.id === id)?.email;
    setInvites(prev => prev.filter(i => i.id !== id));
    if (email) {
      setStaff(prev => prev.filter(s => s.email?.toLowerCase() !== email.toLowerCase()));
    }
  };

  // P1: Toast duration scales with import size (150 ms per record, capped at 8 s)
  const handleBulkImport = ({ staffRecords, inviteRecords }) => {
    setStaff(prev => [...prev, ...staffRecords]);
    setInvites(prev => [...inviteRecords, ...prev]);
    setShowBulkImport(false);
    const count    = staffRecords.length;
    const duration = Math.max(3000, Math.min(count * 150, 8000));
    showToast(`${count} staff member${count !== 1 ? 's' : ''} imported`, duration);
  };

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalActive  = enriched.filter(s => s.status === 'active').length;
  // UX3: count only invites actively sent through the invite flow, not seed data
  const totalPending = invites.length;
  const totalCases   = enriched.reduce((sum, s) => sum + s.active_case_count, 0);
  const expiringSoon = enriched.filter(s => { const e = new Date(s.cert_expiry).getTime(); return e >= today && e <= warn60; }).length;

  // UX2: Dynamic tab counts (BCaBAs count with BCBAs)
  const countBcbas = enriched.filter(s => s.role === 'bcba' || s.role === 'bcaba').length;
  const countRbts  = enriched.filter(s => s.role === 'rbt').length;

  // UX6: Smart subtitle — lists every role that exists
  const countBcba  = enriched.filter(s => s.role === 'bcba').length;
  const countBcaba = enriched.filter(s => s.role === 'bcaba').length;
  const countRbt   = enriched.filter(s => s.role === 'rbt').length;
  const countAdmin = enriched.filter(s => s.role === 'admin').length;
  const subtitleParts = [
    countBcba  && `${countBcba} BCBA${countBcba  !== 1 ? 's' : ''}`,
    countBcaba && `${countBcaba} BCaBA${countBcaba !== 1 ? 's' : ''}`,
    countRbt   && `${countRbt} RBT${countRbt   !== 1 ? 's' : ''}`,
    countAdmin && `${countAdmin} Admin${countAdmin !== 1 ? 's' : ''}`,
  ].filter(Boolean);

  // S1: Pass existing email set to InvitePanel for duplicate detection
  const existingEmails = new Set(staff.map(s => s.email?.toLowerCase()).filter(Boolean));

  const TABS = [
    ['all',   'All'],
    ['bcbas', countBcbas ? `BCBAs (${countBcbas})` : 'BCBAs'],
    ['rbts',  countRbts  ? `RBTs (${countRbts})`   : 'RBTs'],
  ];

  // UX1: "Available" → "Active" (key unchanged so existing filter state still works)
  const CHIPS = [
    { key:'all',       label:'All'          },
    { key:'available', label:'Active'       },
    { key:'expiring',  label:'Cert expiring'},
  ];

  return (
    <div data-testid="staff-page">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>Staff</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {enriched.length} team member{enriched.length !== 1 ? 's' : ''}{subtitleParts.length ? ` · ${subtitleParts.join(' · ')}` : ''}
          </p>
        </div>
        {isAdmin(currentUser?.role) && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBulkImport(true)} data-testid="bulk-import-btn"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-700 border border-teal-200 bg-white rounded-xl hover:bg-teal-50 transition-colors">
              <Ico.Upload/> Import Staff
            </button>
            <button onClick={() => setShowInvite(true)} data-testid="invite-btn"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
              style={{ background:'#0D9488' }}>
              <Ico.Plus/> Invite Staff
            </button>
          </div>
        )}
      </div>

      {/* Stats strip — UX3: added "Invite Pending" cell, clickable for admins */}
      <div className="flex items-center gap-0 mb-6 bg-white rounded-xl border border-stone-200 divide-x divide-stone-100 overflow-hidden">
        {[
          { label:'Active Staff',   value:totalActive,  sub:`of ${enriched.length} total`,  color:'#059669' },
          { label:'Total Cases',    value:totalCases,   sub:'across all staff',              color:'#0D9488' },
          { label:'Cert Expiring',  value:expiringSoon, sub:'within 60 days',               color:'#D97706' },
          {
            label:'Invite Pending', value:totalPending, sub:'awaiting acceptance',           color:'#7C3AED',
            onClick: isAdmin(currentUser?.role) ? () => setShowInvite(true) : undefined,
          },
        ].map((s, i) => (
          <div key={i}
            onClick={s.onClick}
            className={`flex-1 flex items-center justify-center gap-3 px-5 py-3.5${s.onClick ? ' cursor-pointer hover:bg-stone-50 transition-colors' : ''}`}>
            <span className="text-2xl font-bold leading-none flex-shrink-0" style={{ color:s.color, fontFamily:'Syne, sans-serif' }}>{s.value}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700 leading-tight">{s.label}</div>
              <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + search + chips + sort */}
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
            placeholder="Name, cert #, or NPI…"
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
        {/* UX7: Sort dropdown */}
        <select value={sort} onChange={e => setSort(e.target.value)}
          data-testid="staff-sort"
          className="ml-auto text-xs font-medium px-3 py-1.5 border border-stone-200 rounded-lg bg-white text-slate-600 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 cursor-pointer">
          <option value="name">Sort: Name A–Z</option>
          <option value="expiry">Sort: Cert expiry</option>
          <option value="cases">Sort: Most cases</option>
        </select>
      </div>

      {/* Grid */}
      {sortedList.length === 0
        ? <div className="py-16 text-center text-sm text-slate-400" data-testid="staff-empty">No staff match your search.</div>
        : <div className="grid gap-3" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))' }} data-testid="staff-grid">
            {sortedList.map(s => (
              <StaffCard key={s.id} member={s} clients={clients} onEdit={handleEdit} currentUser={currentUser} onSelectClient={onSelectClient}/>
            ))}
          </div>
      }

      {/* Invite panel — S1: existingEmails prop for duplicate detection */}
      {showInvite && (
        <InvitePanel
          onClose={() => setShowInvite(false)}
          onInvite={handleInvite}
          pendingInvites={invites}
          onRevoke={handleRevoke}
          existingEmails={existingEmails}
        />
      )}

      {showBulkImport && (
        <BulkInvitePanel
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          existingStaff={staff}
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
