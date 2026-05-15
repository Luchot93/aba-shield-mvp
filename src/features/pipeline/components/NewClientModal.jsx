import React, { useState, useEffect, useRef } from 'react';
import { Ico } from '../../../components/icons.jsx';
import StagePill from '../../../components/StagePill.jsx';

const EMPTY_FORM = {
  name:'', dob:'', phone:'', address:'',
  insurer_name:'', member_id:'', group_number:'',
  referring_provider:'', referral_date: new Date().toISOString().split('T')[0],
};

export default function NewClientModal({ clients, onSave, onClose, onOpenClient, onAddToPipeline }) {
  const [search,         setSearch]         = useState('');
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [autoFilled,     setAutoFilled]     = useState(false);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [errors,         setErrors]         = useState({});
  const [duplicate,      setDuplicate]      = useState(null);
  const [dirClient,      setDirClient]      = useState(null);
  const searchRef = useRef(null);

  const searchResults = search.length >= 2
    ? clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dob.includes(search)
      ).slice(0, 5)
    : [];

  const handleSearchSelect = c => {
    setSearch(c.name);
    setShowSearchDrop(false);
    setDuplicate(null);

    if (!c.pipeline_entry) {
      setDirClient(c);
      setAutoFilled(false);
      return;
    }

    setDirClient(null);
    setAutoFilled(true);
    setForm({
      name: c.name, dob: c.dob, phone: c.phone||'', address: c.address||'',
      insurer_name: c.insurer_name, member_id: c.member_id,
      group_number: c.group_number||'', referring_provider: c.referring_provider||'',
      referral_date: new Date().toISOString().split('T')[0],
    });
  };

  const setField = (k, v) => {
    setForm(f => ({ ...f, [k]:v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]:null }));
    if (k==='name' || k==='dob') { setAutoFilled(false); setDirClient(null); }
  };

  // Duplicate detection — only fires for pipeline clients (pipeline_entry:true)
  useEffect(() => {
    if (autoFilled || dirClient) { setDuplicate(null); return; }
    if (form.name && form.dob) {
      const match = clients.find(c =>
        c.pipeline_entry &&
        c.name.toLowerCase() === form.name.toLowerCase() && c.dob === form.dob
      );
      if (match) { setDuplicate({ client: match, reason: 'name_dob' }); return; }
    }
    if (form.member_id) {
      const match = clients.find(c =>
        c.pipeline_entry &&
        c.member_id.toLowerCase() === form.member_id.toLowerCase()
      );
      if (match) { setDuplicate({ client: match, reason: 'member_id' }); return; }
    }
    setDuplicate(null);
  }, [form.name, form.dob, form.member_id, autoFilled, dirClient, clients]);

  const validate = () => {
    const req = { name:'Client name', dob:'Date of birth', insurer_name:'Insurer name', member_id:'Member ID' };
    const errs = {};
    Object.entries(req).forEach(([k, label]) => { if (!form[k]) errs[k] = `${label} is required`; });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    const freshDup = (() => {
      if (form.name && form.dob) {
        const m = clients.find(c => c.pipeline_entry && c.name.toLowerCase() === form.name.toLowerCase() && c.dob === form.dob);
        if (m) return { client: m, reason: 'name_dob' };
      }
      if (form.member_id) {
        const m = clients.find(c => c.pipeline_entry && c.member_id.toLowerCase() === form.member_id.toLowerCase());
        if (m) return { client: m, reason: 'member_id' };
      }
      return null;
    })();
    if (freshDup) { setDuplicate(freshDup); setAutoFilled(false); return; }
    if (validate()) onSave({ ...form });
  };

  const handleOpenExisting = () => { onOpenClient(duplicate.client); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.45)' }}>
      <div data-testid="new-client-modal" className="bg-white rounded-2xl shadow-2xl w-full mx-4 flex flex-col overflow-hidden" style={{ maxWidth:'520px', maxHeight:'90vh' }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>New Client</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-slate-500">
            <Ico.X/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2.5 border border-stone-200 rounded-xl bg-stone-50 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
              <Ico.Search/>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search existing clients by name or DOB…"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSearchDrop(true); }}
                onFocus={() => setShowSearchDrop(true)}
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                data-testid="client-search"
              />
            </div>
            {showSearchDrop && searchResults.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                {searchResults.map(c => (
                  <button key={c.id} onClick={() => handleSearchSelect(c)}
                    data-testid={`search-result-${c.id}`}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 text-left border-b border-stone-50 last:border-0">
                    <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold flex-shrink-0 ${c.pipeline_entry ? 'bg-teal-50 border-teal-100 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {c.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.dob} · {c.insurer_name}</div>
                    </div>
                    {c.pipeline_entry
                      ? <StagePill stage={c.stage}/>
                      : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">Directory</span>
                    }
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Directory client — offer to add to pipeline */}
          {dirClient && (
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 mb-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                Client found in directory
              </div>
              <p className="text-xs text-slate-600 mb-3">
                <span className="font-semibold">{dirClient.name}</span> · {dirClient.dob} · {dirClient.insurer_name}<br/>
                This client is in the system but has no active pipeline entry.
              </p>
              <div className="flex items-center gap-2">
                <button
                  data-testid="add-to-pipeline-btn"
                  onClick={() => { onAddToPipeline(dirClient); onClose(); }}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90"
                  style={{ background:'#0D9488' }}>
                  + Add to Pipeline
                </button>
                <button
                  onClick={() => { setDirClient(null); setSearch(''); }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50">
                  Create new instead
                </button>
              </div>
            </div>
          )}

          {/* Auto-fill banner */}
          {autoFilled && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
              <Ico.Check/> Demographics auto-filled from existing record.
            </div>
          )}

          {/* Duplicate warning */}
          {duplicate && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 mb-1">
                <Ico.Warn/>
                {duplicate.reason === 'name_dob'
                  ? 'A client with this name and date of birth already exists.'
                  : 'A client with this member ID already exists.'}
              </div>
              <p className="text-xs text-slate-500 mb-1 font-medium">{duplicate.client.name} · {duplicate.client.dob} · {duplicate.client.insurer_name}</p>
              <button onClick={handleOpenExisting}
                className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">
                Open existing record
              </button>
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key:'name',               label:'Client Name',       type:'text',   required:true,  col:'col-span-2' },
              { key:'dob',                label:'Date of Birth',     type:'date',   required:true,  col:'' },
              { key:'phone',              label:'Phone',             type:'tel',    required:false, col:'' },
              { key:'insurer_name',       label:'Insurer Name',      type:'text',   required:true,  col:'' },
              { key:'member_id',          label:'Member ID',         type:'text',   required:true,  col:'' },
              { key:'group_number',       label:'Group Number',      type:'text',   required:false, col:'' },
              { key:'referring_provider', label:'Referring Provider',type:'text',   required:false, col:'' },
              { key:'address',            label:'Address',           type:'text',   required:false, col:'col-span-2' },
              { key:'referral_date',      label:'Referral Date',     type:'date',   required:false, col:'' },
            ].map(({ key, label, type, required, col }) => (
              <div key={key} className={col}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setField(key, e.target.value)}
                  data-testid={`field-${key}`}
                  className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-all
                    ${errors[key]
                      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-100'
                      : 'border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100'}`}
                />
                {errors[key] && <p className="text-[10px] text-red-500 mt-0.5">{errors[key]}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-stone-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} data-testid="save-client"
            className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{ background:'#0D9488' }}>
            Save Client
          </button>
        </div>
      </div>
    </div>
  );
}
