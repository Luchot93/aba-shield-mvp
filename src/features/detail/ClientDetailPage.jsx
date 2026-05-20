import React, { useState, useEffect, useRef } from 'react';
import { STAGES, SM, NEXT_STAGE } from '../../constants/stages.js';
import { REAUTH_ITEMS, getStageItems } from '../../constants/checklist.js';
import { itemComplete, itemBlocks } from '../../utils/checklist.js';
import { mkNotif } from '../../utils/notifications.js';
import { Ico } from '../../components/icons.jsx';
import StagePill from '../../components/StagePill.jsx';
import Avatar from '../../components/Avatar.jsx';

export default function ClientDetailPage({ clientId, clients, staff, setClients, onBack, backLabel, currentUser, addNotif, onClientAdvanced }) {
  const client = clients.find(c => c.id === clientId);
  const [confirmAdvance, setConfirmAdvance] = useState(null);
  const [openPicker,     setOpenPicker]     = useState(null);
  const [formDrafts,     setFormDrafts]     = useState({});
  const [viewStage,      setViewStage]      = useState(null);
  const [noteText,       setNoteText]       = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!openPicker) return;
    const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpenPicker(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [openPicker]);

  if (!client) return null;

  const bcba  = staff.find(s => s.id === client.bcba_id);
  const rbt   = staff.find(s => s.id === client.rbt_id);
  const bcbas = staff.filter(s => s.role === 'bcba');
  const rbts  = staff.filter(s => s.role === 'rbt');
  const isReadOnly   = viewStage !== null;
  const stageToShow  = isReadOnly ? viewStage : client.stage;
  const nextStage    = NEXT_STAGE[client.stage];
  const isReauthSvc  = !isReadOnly && client.stage === 'services' && client.reauth_active;
  const displayItems = isReauthSvc ? REAUTH_ITEMS : getStageItems(stageToShow);
  const completeCount = displayItems.filter(it => itemComplete(it, client, staff)).length;
  const allDone   = displayItems.length > 0 && completeCount === displayItems.length;
  const hasBlock  = displayItems.some(it => itemBlocks(it, client, staff));
  const canAdvance = !isReadOnly && allDone && !hasBlock && !!nextStage && client.stage !== 'denied';
  const visibleDocs = isReadOnly
    ? client.documents.filter(d => d.stage === viewStage)
    : client.documents;

  /* ── mutation helpers ── */
  const patchClient = patch =>
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, ...patch } : c));

  const patchCL = (sec, key, val) =>
    setClients(prev => prev.map(c => {
      if (c.id !== client.id) return c;
      return { ...c, checklist: { ...c.checklist, [sec]: { ...c.checklist[sec], [key]: val } } };
    }));

  const pushDoc = (type, label) => {
    const doc = { id:`doc_${Date.now()}`, type, label, uploaded_at:new Date().toISOString(), by:currentUser.name, stage:client.stage };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, documents:[...c.documents, doc] } : c));
  };

  const pushLog = action => {
    const entry = { id:`log_${Date.now()}`, action, ts:new Date().toISOString(), by:currentUser.name };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, activity_log:[entry, ...c.activity_log] } : c));
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const note = { id:`note_${Date.now()}`, text:noteText.trim(), author:currentUser.name, timestamp:new Date().toISOString() };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, case_notes:[note, ...(c.case_notes||[])] } : c));
    setNoteText('');
  };

  const doAdvance = toStage => {
    patchClient({ stage: toStage });
    pushLog(`Moved to ${SM[toStage].label}`);
    const isAuth = toStage === 'authorized';
    addNotif(mkNotif(
      isAuth
        ? `${client.name} — Authorization approved, ready for staffing`
        : `${client.name} moved to ${SM[toStage].label}`,
      client.name,
      'normal'
    ));
    if (onClientAdvanced) onClientAdvanced(client.id);
    setConfirmAdvance(null);
    onBack();
  };

  /* ── inline staff picker dropdown ── */
  const PickerDrop = ({ id, pool }) => openPicker !== id ? null : (
    <div ref={pickerRef}
      className="absolute z-30 top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden"
      style={{ width:'220px' }}>
      {pool.map(s => (
        <button key={s.id}
          onClick={() => {
            if (id.includes('bcba')) patchClient({ bcba_id: s.id });
            else patchClient({ rbt_id: s.id });
            pushLog(`${id.includes('bcba') ? 'BCBA' : 'RBT'} changed to ${s.name}`);
            setOpenPicker(null);
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-stone-50 text-left border-b border-stone-50 last:border-0">
          <Avatar initials={s.initials} role={s.role} size="sm"/>
          <div>
            <div className="text-sm font-medium text-slate-800">{s.name}</div>
            <div className="text-xs text-slate-400">{s.active_case_count} active cases</div>
          </div>
        </button>
      ))}
    </div>
  );

  /* ── assign picker inside checklist item ── */
  const AssignPicker = ({ item }) => {
    const assignedId = item.role === 'bcba' ? client.bcba_id : client.rbt_id;
    const assigned   = staff.find(s => s.id === assignedId);
    const pool       = item.role === 'bcba' ? bcbas : rbts;
    const pid        = `cl_${item.role}`;
    return assigned ? (
      <div className="flex items-center gap-2">
        <Avatar initials={assigned.initials} role={item.role} size="sm"/>
        <span className="text-sm text-slate-700">{assigned.name}</span>
        {currentUser.role === 'admin' && (
          <div className="relative">
            <button onClick={() => setOpenPicker(p => p === pid ? null : pid)}
              className="text-xs text-teal-600 hover:text-teal-800 underline">Change</button>
            <PickerDrop id={pid} pool={pool}/>
          </div>
        )}
      </div>
    ) : (
      <div className="relative inline-block">
        <button onClick={() => setOpenPicker(p => p === pid ? null : pid)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100">
          <Ico.Plus/> Assign {item.role.toUpperCase()}
        </button>
        {openPicker === pid && (
          <div ref={pickerRef}
            className="absolute z-30 top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden"
            style={{ width:'220px' }}>
            {pool.map(s => (
              <button key={s.id}
                onClick={() => {
                  if (item.role === 'bcba') {
                    patchClient({ bcba_id: s.id });
                    addNotif(mkNotif(`${s.name} assigned as BCBA to ${client.name}`, client.name, 'normal'));
                  } else {
                    patchClient({ rbt_id: s.id });
                    addNotif(mkNotif(`${s.name} assigned as RBT to ${client.name}`, client.name, 'normal'));
                  }
                  patchCL(item.clSec, item.key, true);
                  pushLog(`${item.role.toUpperCase()} assigned: ${s.name}`);
                  setOpenPicker(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-stone-50 text-left border-b border-stone-50 last:border-0">
                <Avatar initials={s.initials} role={s.role} size="sm"/>
                <div>
                  <div className="text-sm font-medium text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.active_case_count} active cases</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── single checklist row ── */
  const CheckRow = ({ item, readOnly }) => {
    const complete = itemComplete(item, client, staff);
    const blocks   = !readOnly && itemBlocks(item, client, staff);
    const clVal    = client.checklist[item.clSec]?.[item.key];

    return (
      <div className={`py-3.5 border-b border-stone-100 last:border-0 ${blocks ? 'bg-red-50/40 -mx-5 px-5 rounded' : ''}`}>
          <div className="flex-1 min-w-0">
            {item.type === 'checkbox' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {readOnly
                    ? <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${complete ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white'}`}>
                        {complete && <span style={{ color:'#fff', fontSize:'9px', fontWeight:700 }}>✓</span>}
                      </span>
                    : <input type="checkbox" checked={!!clVal}
                        onChange={e => { patchCL(item.clSec, item.key, e.target.checked); if (e.target.checked) pushLog(`Checked: ${item.label}`); }}
                        className="w-4 h-4 rounded accent-teal-600 cursor-pointer flex-shrink-0"/>
                  }
                  <span className={`text-sm leading-snug ${complete ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.label}</span>
                  {!readOnly && item.mandatory && !complete && <span className="text-[10px] font-bold text-red-600 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded ml-1 flex-shrink-0">MANDATORY</span>}
                </div>
                {complete && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:'#14B8A6' }}>
                    <span style={{ color:'#fff', fontSize:'11px', fontWeight:700 }}>✓</span>
                  </div>
                )}
              </div>
            )}

            {item.type === 'upload' && (
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm ${complete ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.label}</span>
                {complete
                  ? <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg flex-shrink-0">
                      <span style={{ fontSize:'11px' }}>✓</span> Uploaded
                    </span>
                  : readOnly
                    ? <span className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 bg-stone-50 border border-stone-200 rounded-lg flex-shrink-0">Not uploaded</span>
                    : <button data-testid={`upload-${item.key}`}
                        onClick={() => { patchCL(item.clSec, item.key, true); pushDoc(item.key, item.label); pushLog(`Uploaded: ${item.label}`); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 flex-shrink-0">
                        <Ico.Upload/> Upload
                      </button>
                }
              </div>
            )}

            {item.type === 'form_field' && (() => {
              const draft = formDrafts[item.key] !== undefined ? formDrafts[item.key] : (clVal ?? '');
              const isDirty = formDrafts[item.key] !== undefined && formDrafts[item.key] !== (clVal ?? '');
              const savedVal = clVal ?? '';
              return (
                <div>
                  <label className="text-sm text-slate-800 block mb-1.5">{item.label}</label>
                  {readOnly
                    ? <span className="text-sm text-slate-600 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg block max-w-xs" style={{ fontFamily:'DM Mono, monospace' }}>
                        {savedVal || <span className="text-slate-400 italic">—</span>}
                      </span>
                    : <div className="flex items-center gap-2">
                        <input type={item.fieldType || 'text'} value={draft}
                          onChange={e => setFormDrafts(d => ({ ...d, [item.key]: e.target.value }))}
                          data-testid={`detail-field-${item.key}`}
                          placeholder={item.fieldType === 'number' ? '0' : 'Enter…'}
                          className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                        <button
                          onClick={() => {
                            patchCL(item.clSec, item.key, draft);
                            setFormDrafts(d => { const n = { ...d }; delete n[item.key]; return n; });
                            if (draft !== savedVal) pushLog(`Updated: ${item.label}`);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex-shrink-0 ${isDirty ? 'text-white border-teal-600 hover:opacity-90' : 'text-slate-500 border-stone-200 hover:bg-stone-50'}`}
                          style={isDirty ? { background:'#0D9488' } : {}}>
                          Save
                        </button>
                      </div>
                  }
                </div>
              );
            })()}

            {item.type === 'assign' && (() => {
              if (readOnly) {
                const assignedId = item.role === 'bcba' ? client.bcba_id : client.rbt_id;
                const assigned   = staff.find(s => s.id === assignedId);
                return assigned
                  ? <div className="flex items-center gap-2">
                      <Avatar initials={assigned.initials} role={item.role} size="sm"/>
                      <span className="text-sm text-slate-700">{assigned.name}</span>
                    </div>
                  : <span className="text-sm text-slate-400">Not assigned</span>;
              }
              return <AssignPicker item={item}/>;
            })()}

            {item.type === 'auto' && (() => {
              let display = ''; let cc = 'bg-teal-50 border-teal-200 text-teal-700';
              if (item.always) {
                display = `${client.name} · ${client.dob}`;
              } else if (item.bcbaAuto) {
                display = bcba ? bcba.name : 'Not assigned';
                if (!bcba) cc = 'bg-amber-50 border-amber-200 text-amber-700';
              } else if (item.rbtCert) {
                const rm = staff.find(s => s.id === client.rbt_id);
                if (!rm) { display = 'No RBT assigned'; cc = 'bg-slate-100 border-slate-200 text-slate-500'; }
                else {
                  const exp = new Date(rm.cert_expiry) <= new Date();
                  display = `Expires ${rm.cert_expiry}`;
                  if (exp) cc = 'bg-red-50 border-red-200 text-red-700';
                }
              } else if (item.rbtCreds) {
                display = client.rbt_id ? 'On file' : '—';
                if (!client.rbt_id) cc = 'bg-slate-100 border-slate-200 text-slate-400';
              }
              return (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-800">{item.label}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg border flex-shrink-0 ${cc}`}>{display}</span>
                </div>
              );
            })()}

            {item.type === 'smart_auto' && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-800">{item.label}</span>
                {client.smart_assessment_session_id
                  ? <span className="text-xs font-medium px-2 py-1 rounded-lg border bg-teal-50 border-teal-200 text-teal-700 flex-shrink-0">Generated from assessment</span>
                  : <span className="text-xs font-medium px-2 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 flex-shrink-0">Pending Smart Assessment</span>}
              </div>
            )}

            {item.type === 'bridge' && (
              <div>
                <div className="text-sm text-slate-800 mb-2">{item.label}</div>
                {client.smart_assessment_session_id
                  ? <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg" data-testid="session-linked-badge">
                      <Ico.Link/>
                      <span className="text-sm font-semibold text-teal-700">Session linked</span>
                      <span className="text-[10px] text-teal-500 ml-auto" style={{ fontFamily:'DM Mono, monospace' }}>{client.smart_assessment_session_id}</span>
                    </div>
                  : readOnly
                    ? <span className="text-sm text-slate-400 italic">No session linked</span>
                    : <button data-testid="open-smart-assessment"
                        onClick={() => {
                          const sid = `session_${Date.now()}`;
                          patchClient({ smart_assessment_session_id: sid });
                          patchCL(item.clSec, item.key, true);
                          pushLog('Smart Assessment session linked');
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                        style={{ background:'linear-gradient(135deg,#7C3AED,#5B21B6)' }}>
                        Open Smart Assessment →
                      </button>}
              </div>
            )}

            {item.type === 'dated' && (() => {
              const dateVal = client.checklist[item.clSec]?.[item.dateKey] ?? '';
              const isOld   = dateVal && (Date.now() - new Date(dateVal).getTime()) > 365*24*60*60*1000;
              return (
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    {readOnly
                      ? <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${complete ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white'}`}>
                          {complete && <span style={{ color:'#fff', fontSize:'9px', fontWeight:700 }}>✓</span>}
                        </span>
                      : <input type="checkbox" checked={!!clVal}
                          onChange={e => { patchCL(item.clSec, item.key, e.target.checked); if (e.target.checked) pushLog(`Checked: ${item.label}`); }}
                          className="w-4 h-4 rounded accent-teal-600 cursor-pointer"/>
                    }
                    <span className={`text-sm ${complete ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    {readOnly
                      ? <span className="text-xs text-slate-600 px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg" style={{ fontFamily:'DM Mono, monospace' }}>{dateVal || '—'}</span>
                      : <input type="date" value={dateVal}
                          onChange={e => patchCL(item.clSec, item.dateKey, e.target.value)}
                          className={`text-xs px-2.5 py-1.5 border rounded-lg outline-none focus:border-teal-400 ${isOld ? 'border-red-300 bg-red-50 text-red-700' : 'border-stone-200'}`}/>
                    }
                    {isOld && <span className="text-xs text-red-600 font-medium">⚠ Over 12 months ago</span>}
                  </div>
                </div>
              );
            })()}

            {item.note && <p className="text-[11px] text-slate-400 mt-1.5">{item.note}</p>}
          </div>
      </div>
    );
  };

  /* ── render ── */
  return (
    <div data-testid="client-detail-modal" className="fixed inset-0 z-40 overflow-y-auto" style={{ background:'#F8F7F4' }}>

      {/* ── sticky header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <button data-testid="detail-back-btn" onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700 mb-3 transition-colors">
            <Ico.ArrowLeft/> {backLabel || 'Back to pipeline'}
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                style={{ background:'#F0FDFA', color:'#0F766E', border:'2px solid #CCFBF1' }}>
                {client.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>{client.name}</h1>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400" style={{ fontFamily:'DM Mono, monospace' }}>
                  <span>{client.dob}</span><span>·</span><span>{client.insurer_name}</span><span>·</span><span>{client.member_id}</span>
                </div>
              </div>
            </div>
            <StagePill stage={client.stage}/>
          </div>

          {/* staff row */}
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-stone-100 flex-wrap">
            {[{ label:'BCBA', person:bcba, pool:bcbas, pid:'hdr_bcba' }, { label:'RBT', person:rbt, pool:rbts, pid:'hdr_rbt' }].map(({ label, person, pool, pid }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                {person
                  ? <>
                      <Avatar initials={person.initials} role={person.role} size="sm"/>
                      <span className="text-sm text-slate-700">{person.name}</span>
                      {!isReadOnly && currentUser.role === 'admin' && (
                        <div className="relative">
                          <button onClick={() => setOpenPicker(p => p === pid ? null : pid)}
                            className="text-xs text-teal-600 hover:text-teal-800 underline">Change</button>
                          <PickerDrop id={pid} pool={pool}/>
                        </div>
                      )}
                    </>
                  : <span className="text-sm text-slate-400">Not assigned</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── stage stepper ── */}
      <div className="bg-white border-b border-stone-200 overflow-x-auto">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="flex items-center min-w-max">
            {STAGES.map((s, i) => {
              const curIdx   = STAGES.indexOf(client.stage);
              const isCur    = s === client.stage;
              const isDone   = i < curIdx && s !== 'denied';
              const isViewed = viewStage === s;
              const m = SM[s];
              return (
                <div key={s} className="flex items-center">
                  <div
                    onClick={() => isDone ? setViewStage(isViewed ? null : s) : undefined}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all
                      ${isCur ? 'text-white' : isDone ? 'text-teal-700 bg-teal-50 cursor-pointer hover:bg-teal-100' : 'text-slate-400'}
                      ${isViewed ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    style={isCur ? { background: m.dot } : {}}>
                    {isDone && <span style={{ fontSize:'10px' }}>✓</span>}
                    {m.label}
                  </div>
                  {i < STAGES.length - 1 && <span className="mx-0.5 text-slate-300"><Ico.ChevronRight/></span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── body ── */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid gap-6" style={{ gridTemplateColumns:'1fr 300px' }}>

          {/* left: checklist */}
          <div className="space-y-4">
            {isReadOnly && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-amber-600 text-sm">🔍</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-amber-800">Viewing: {SM[viewStage]?.label}</span>
                  <span className="ml-2 text-xs text-amber-600 font-medium px-1.5 py-0.5 bg-amber-100 rounded">Read only</span>
                </div>
                <button onClick={() => setViewStage(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors flex-shrink-0">
                  <Ico.X/> Back to current stage
                </button>
              </div>
            )}

            {isReauthSvc && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2 mb-3 flex items-center gap-2">
                <span className="text-teal-600 text-base leading-none">↻</span>
                <span className="text-sm font-semibold text-teal-700">Reauthorization cycle active</span>
                {client.auth_expiry_date && (
                  <span className="ml-auto text-xs text-teal-600">Auth expires {client.auth_expiry_date}</span>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl border border-stone-200" data-testid="checklist-panel">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>
                  {isReadOnly
                    ? `${SM[viewStage]?.label} checklist`
                    : client.stage === 'denied'
                    ? 'Resolution checklist'
                    : isReauthSvc
                    ? 'Reauthorization cycle'
                    : nextStage
                    ? `To advance to ${SM[nextStage].label}`
                    : 'Services'}
                </h2>
                {displayItems.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">{completeCount} of {displayItems.length} complete</p>
                )}
              </div>
              <div className="px-5">
                {displayItems.length === 0
                  ? <p className="py-6 text-sm text-center text-slate-400">No checklist items.</p>
                  : displayItems.map(item => <React.Fragment key={item.key}>{CheckRow({ item, readOnly: isReadOnly })}</React.Fragment>)}
              </div>
            </div>

            {/* advance / resolution buttons — hidden in read-only mode */}
            {!isReadOnly && client.stage !== 'denied' && nextStage && (
              <div>
                <button data-testid="advance-btn"
                  disabled={!canAdvance}
                  onClick={() => canAdvance && setConfirmAdvance(nextStage)}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${canAdvance ? 'text-white shadow-sm hover:opacity-90' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
                  style={canAdvance ? { background:'#0D9488' } : {}}>
                  {canAdvance ? `Advance to ${SM[nextStage].label} →` : 'Complete all items to advance'}
                </button>
                {hasBlock && <p className="text-xs text-red-600 text-center mt-2">⚠ One or more items are blocking advance</p>}
              </div>
            )}

            {!isReadOnly && client.stage === 'denied' && (() => {
              const deniedItems = getStageItems('denied');
              const deniedAllDone = deniedItems.every(it => itemComplete(it, client, staff));
              return (
                <div>
                  <div className="flex gap-3">
                    <button data-testid="resolve-authorized"
                      disabled={!deniedAllDone}
                      onClick={() => deniedAllDone && setConfirmAdvance('authorized')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${deniedAllDone ? 'text-white hover:opacity-90' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
                      style={deniedAllDone ? { background:'#059669' } : {}}>
                      Move to Authorized →
                    </button>
                    <button data-testid="resolve-submitted" onClick={() => setConfirmAdvance('submitted')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background:'#D97706' }}>
                      Return to Submitted →
                    </button>
                  </div>
                  {!deniedAllDone && (
                    <p className="text-xs text-slate-400 text-center mt-2">Complete all items above to resolve</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* right: activity + docs */}
          <div className="space-y-4">
            {/* Case Notes */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
                </svg>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Case Notes</h3>
              </div>

              {/* Input row */}
              <div className="px-4 pt-3 pb-3 border-b border-stone-100">
                <div className="flex gap-2 items-start">
                  <textarea
                    data-testid="case-note-input"
                    rows={3}
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
                    placeholder="Add a case note…"
                    className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 resize-none placeholder:text-slate-400 text-slate-700 leading-relaxed"
                  />
                  <button
                    data-testid="add-note-btn"
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    style={{ background:'#0D9488' }}>
                    Add Note
                  </button>
                </div>
              </div>

              {/* Notes list */}
              <div className="divide-y divide-stone-50 max-h-72 overflow-y-auto" data-testid="case-notes-list">
                {(client.case_notes||[]).length === 0
                  ? <p className="px-4 py-5 text-xs text-center text-slate-400 italic">No case notes yet. Add the first note above.</p>
                  : (client.case_notes||[]).map((n, i) => (
                    <div key={n.id} className="px-4 py-3">
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                      <p className="text-[10px] text-slate-400 mt-1.5" style={{ fontFamily:'DM Mono, monospace' }}>
                        {n.author} · {new Date(n.timestamp).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Activity</h3>
              </div>
              <div className="divide-y divide-stone-50 max-h-72 overflow-y-auto" data-testid="activity-log">
                {client.activity_log.length === 0
                  ? <p className="px-4 py-5 text-xs text-center text-slate-400">No activity yet.</p>
                  : client.activity_log.map(e => (
                    <div key={e.id} className="px-4 py-2.5">
                      <div className="text-xs text-slate-700">{e.action}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontFamily:'DM Mono, monospace' }}>
                        {new Date(e.ts).toLocaleDateString()} · {e.by}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Documents</h3>
              </div>
              <div className="divide-y divide-stone-50 max-h-72 overflow-y-auto" data-testid="documents-panel">
                {visibleDocs.length === 0
                  ? <p className="px-4 py-5 text-xs text-center text-slate-400">{isReadOnly ? 'No documents uploaded in this stage.' : 'No documents uploaded yet.'}</p>
                  : visibleDocs.map(d => (
                    <div key={d.id} className="px-4 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">{d.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontFamily:'DM Mono, monospace' }}>
                          {new Date(d.uploaded_at).toLocaleDateString()} · {d.by}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const blob = new Blob([`Document: ${d.label}\nUploaded: ${new Date(d.uploaded_at).toLocaleString()}\nBy: ${d.by}`], { type:'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = `${d.label.replace(/\s+/g,'_')}.txt`;
                          a.click(); URL.revokeObjectURL(url);
                        }}
                        className="flex-shrink-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors leading-none">
                        <span className="flex items-center" style={{ lineHeight:0 }}><Ico.Download/></span>
                        <span>Download</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── advance confirmation dialog ── */}
      {confirmAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-slate-900 mb-2" style={{ fontFamily:'Syne, sans-serif' }}>Confirm stage change</h3>
            <p className="text-sm text-slate-600 mb-5">
              Move <strong>{client.name}</strong> to <strong>{SM[confirmAdvance].label}</strong>?
            </p>
            <div className="flex gap-3">
              <button data-testid="confirm-cancel" onClick={() => setConfirmAdvance(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-600 border border-stone-200 hover:bg-stone-50">Cancel</button>
              <button data-testid="confirm-advance" onClick={() => doAdvance(confirmAdvance)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background:'#0D9488' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
