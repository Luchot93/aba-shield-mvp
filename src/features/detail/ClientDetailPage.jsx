import React, { useState, useEffect, useRef } from 'react';
import { STAGES, SM, NEXT_STAGE } from '../../constants/stages.js';
import { REAUTH_ITEMS, getStageItems } from '../../constants/checklist.js';
import { itemComplete, itemBlocks } from '../../utils/checklist.js';
import { mkNotif } from '../../utils/notifications.js';
import { isAdmin, canEdit } from '../../utils/permissions.js';
import { Ico } from '../../components/icons.jsx';
import StagePill from '../../components/StagePill.jsx';
import Avatar from '../../components/Avatar.jsx';
import PlanDraftInlinePanel from './PlanDraftInlinePanel.jsx';
import PlanDraftPreview from './PlanDraftPreview.jsx';
import { buildGraphsFromSession } from '../../features/assessment/graphBuilder.js';

export default function ClientDetailPage({ clientId, clients, staff, setClients, onBack, backLabel, currentUser, addNotif, onClientAdvanced, onOpenAssessment }) {
  const client = clients.find(c => c.id === clientId);
  const [confirmAdvance, setConfirmAdvance] = useState(null);
  const [confirmDeny,    setConfirmDeny]    = useState(false);
  const [denyReason,     setDenyReason]     = useState('');
  const [openPicker,     setOpenPicker]     = useState(null);
  const [formDrafts,     setFormDrafts]     = useState({});
  const [savedFields,    setSavedFields]    = useState(new Set());
  const [viewStage,      setViewStage]      = useState(null);
  const [noteText,       setNoteText]       = useState('');
  const [activeTab,      setActiveTab]      = useState('notes');
  const pickerRef = useRef(null);
  const saveTimers = useRef({});

  // Plan Draft — expandable inline panels (default open when session exists)
  const isPlanDraft = client?.stage === 'plan_draft';
  // Plan tab + inline panels persist for all stages at or after plan_draft (read-only past plan_draft)
  const PLAN_VISIBLE_STAGES = new Set(['plan_draft','submitted','denied','authorized','staffing','services']);
  const hasPlanSession = PLAN_VISIBLE_STAGES.has(client?.stage) && !!client?.assessment_session;

  const ALL_PLAN_ITEMS = ['medical_necessity','skill_targets','behavior_goals','intervention_strategies','baseline_graphs'];

  // Lazy init: open all panels if we're already in plan_draft on mount.
  // The useEffect below handles the transition case (stage advances in the same session).
  const [expandedPlanItems, setExpandedPlanItems] = useState(() =>
    hasPlanSession ? new Set(ALL_PLAN_ITEMS) : new Set()
  );
  const [planGraphs, setPlanGraphs] = useState(null);

  // When the stage advances to plan_draft within the same mounted session,
  // expand all panels and start graph generation.
  useEffect(() => {
    if (!hasPlanSession) return;
    setExpandedPlanItems(prev => prev.size === ALL_PLAN_ITEMS.length ? prev : new Set(ALL_PLAN_ITEMS));
    let cancelled = false;
    buildGraphsFromSession(client.assessment_session)
      .then(g => { if (!cancelled) setPlanGraphs(g); })
      .catch(err => { console.error('Graph generation failed:', err); if (!cancelled) setPlanGraphs({}); });
    return () => { cancelled = true; };
  }, [hasPlanSession, client.assessment_session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openPicker) return;
    const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpenPicker(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [openPicker]);

  // Auto-switch tab when entering/leaving read-only mode.
  useEffect(() => {
    if (viewStage !== null) {
      setActiveTab('documents');
    } else {
      setActiveTab('notes');
    }
  }, [viewStage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!client) return null;

  const userCanEdit = canEdit(currentUser.role, client, currentUser.id);

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
  const visibleDocs = client.documents;

  /* ── mutation helpers ── */
  const patchClient = patch =>
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, ...patch } : c));

  const patchCL = (sec, key, val) =>
    setClients(prev => prev.map(c => {
      if (c.id !== client.id) return c;
      return { ...c, checklist: { ...c.checklist, [sec]: { ...c.checklist[sec], [key]: val } } };
    }));

  const pushDoc = (type, label, dataUrl) => {
    const doc = { id:`doc_${Date.now()}`, type, label, uploaded_at:new Date().toISOString(), by:currentUser.name, stage:client.stage, ...(dataUrl ? { dataUrl } : {}) };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, documents:[...c.documents, doc] } : c));
  };

  const pushLog = action => {
    const entry = { id:`log_${Date.now()}`, action, ts:new Date().toISOString(), by:currentUser.name };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, activity_log:[entry, ...c.activity_log] } : c));
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const note = { id:`note_${Date.now()}`, text:noteText.trim(), author:currentUser.name, timestamp:new Date().toISOString(), stage:client.stage };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, case_notes:[note, ...(c.case_notes||[])] } : c));
    setNoteText('');
  };

  const doAdvance = toStage => {
    patchClient({ stage: toStage, stage_entered_at: new Date().toISOString() });
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

  const doDeny = () => {
    const reason = denyReason.trim();
    patchClient({ stage: 'denied', stage_entered_at: new Date().toISOString(), denial_reason: reason || null });
    const entry = { id:`log_${Date.now()}`, action:'Moved to Denied', ...(reason ? { reason } : {}), ts:new Date().toISOString(), by:currentUser.name };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, activity_log:[entry, ...c.activity_log] } : c));
    addNotif(mkNotif(`${client.name} — Authorization denied by insurer`, client.name, 'urgent'));
    if (onClientAdvanced) onClientAdvanced(client.id);
    setConfirmDeny(false);
    setDenyReason('');
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
        {isAdmin(currentUser.role) && (
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

            {item.type === 'file_upload' && (
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm ${clVal === true ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.label}</span>
                {clVal === true
                  ? <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg flex-shrink-0"
                      style={{ background:'rgba(20,184,166,0.1)', color:'#0D9488', border:'1px solid rgba(20,184,166,0.25)' }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Uploaded
                    </span>
                  : readOnly
                    ? <span className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 bg-stone-50 border border-stone-200 rounded-lg flex-shrink-0">Not uploaded</span>
                    : <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-600 bg-white hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 cursor-pointer transition-all flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 10l-4-4-4 4M12 6v10"/>
                        </svg>
                        Upload
                        <input
                          type="file"
                          accept={item.accept ?? '.docx,.pdf'}
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              patchCL(item.clSec, item.key, true);
                              pushDoc(item.docType ?? item.key, file.name, reader.result);
                              pushLog(`Uploaded: ${item.label} — ${file.name}`);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                }
              </div>
            )}

            {item.type === 'form_field' && (() => {
              const draft    = formDrafts[item.key] !== undefined ? formDrafts[item.key] : (clVal ?? '');
              const isDirty  = formDrafts[item.key] !== undefined && formDrafts[item.key] !== (clVal ?? '');
              const savedVal = clVal ?? '';
              const justSaved = savedFields.has(item.key);

              const handleSave = () => {
                patchCL(item.clSec, item.key, draft);
                setFormDrafts(d => { const n = { ...d }; delete n[item.key]; return n; });
                if (draft !== savedVal) pushLog(`Updated: ${item.label}`);
                // Flash "Saved" for 2 seconds
                setSavedFields(prev => new Set(prev).add(item.key));
                clearTimeout(saveTimers.current[item.key]);
                saveTimers.current[item.key] = setTimeout(() => {
                  setSavedFields(prev => { const n = new Set(prev); n.delete(item.key); return n; });
                }, 2000);
              };

              return (
                <div>
                  <label className="text-sm text-slate-800 block mb-1.5">{item.label}</label>
                  {readOnly
                    ? <span className="text-sm text-slate-600 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg block max-w-xs" style={{ fontFamily:'DM Mono, monospace' }}>
                        {savedVal || <span className="text-slate-400 italic">—</span>}
                      </span>
                    : <>
                        <div className="flex items-center gap-2">
                          <input type={item.fieldType || 'text'} value={draft}
                            onChange={e => setFormDrafts(d => ({ ...d, [item.key]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                            data-testid={`detail-field-${item.key}`}
                            placeholder={item.fieldType === 'number' ? '0' : 'Enter…'}
                            className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"/>
                          <button
                            onClick={handleSave}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex-shrink-0 ${
                              justSaved
                                ? 'text-white border-emerald-500'
                                : isDirty
                                  ? 'text-white border-teal-600 hover:opacity-90'
                                  : 'text-slate-500 border-stone-200 hover:bg-stone-50'
                            }`}
                            style={justSaved ? { background:'#10B981' } : isDirty ? { background:'#0D9488' } : {}}>
                            {justSaved ? '✓ Saved' : 'Save'}
                          </button>
                        </div>
                        {/* Saved confirmation line */}
                        {justSaved && savedVal && (
                          <p className="mt-1.5 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            Saved: <span style={{ fontFamily:'DM Mono, monospace' }}>{savedVal}</span>
                          </p>
                        )}
                        {!justSaved && savedVal && !isDirty && (
                          <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            Current value: <span style={{ fontFamily:'DM Mono, monospace' }}>{savedVal}</span>
                          </p>
                        )}
                      </>
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

            {item.type === 'smart_auto' && (() => {
              const hasSession = !!client.assessment_session;
              const isOpen = expandedPlanItems.has(item.key);
              return (
                <div className="min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-800 flex-1 min-w-0">{item.label}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hasSession
                        ? <span className="text-xs font-medium px-2 py-1 rounded-lg border bg-teal-50 border-teal-200 text-teal-700 whitespace-nowrap">Generated from assessment</span>
                        : <span className="text-xs font-medium px-2 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 whitespace-nowrap">Pending Smart Assessment</span>
                      }
                      {hasSession && (
                        <button
                          onClick={() => setExpandedPlanItems(prev => {
                            const next = new Set(prev);
                            isOpen ? next.delete(item.key) : next.add(item.key);
                            return next;
                          })}
                          className="p-1 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                          <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {isOpen && client.assessment_session && (
                    <PlanDraftInlinePanel
                      itemKey={item.key}
                      session={client.assessment_session}
                      graphs={planGraphs}
                    />
                  )}
                </div>
              );
            })()}

            {item.type === 'bridge' && (() => {
              const session = client.assessment_session;
              const hasContent = session && (session.sectionsWithData > 0 || session.status === 'in_progress');
              const isComplete = !!client.smart_assessment_session_id;
              return (
                <div>
                  <div className="text-sm text-slate-800 mb-2">{item.label}</div>
                  {isComplete
                    ? <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg" data-testid="session-linked-badge">
                        <Ico.Link/>
                        <span className="text-sm font-semibold text-teal-700">Session linked</span>
                        <span className="text-[10px] text-teal-500 ml-auto" style={{ fontFamily:'DM Mono, monospace' }}>{client.smart_assessment_session_id}</span>
                      </div>
                    : readOnly
                      ? <span className="text-sm text-slate-400 italic">No session linked</span>
                      : hasContent
                        ? <button data-testid="continue-smart-assessment"
                            onClick={() => {
                              pushLog('Smart Assessment continued');
                              onOpenAssessment?.(client.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                            style={{ background:'linear-gradient(135deg,#0D9488,#0F766E)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Continue Smart Assessment →
                          </button>
                        : <button data-testid="open-smart-assessment"
                            onClick={() => {
                              pushLog('Smart Assessment opened');
                              onOpenAssessment?.(client.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                            style={{ background:'linear-gradient(135deg,#7C3AED,#5B21B6)' }}>
                            Open Smart Assessment →
                          </button>}
                </div>
              );
            })()}

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
                      {!isReadOnly && isAdmin(currentUser.role) && (
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
        <div className="grid gap-6 overflow-hidden" style={{ gridTemplateColumns:'1fr 380px' }}>

          {/* left: checklist */}
          <div className="space-y-4 min-w-0 overflow-hidden">
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

            <div className="bg-white rounded-xl border border-stone-200 flex flex-col" data-testid="checklist-panel">
              {/* Card header */}
              <div className="px-5 py-4 border-b border-stone-100 flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-slate-900 flex-1" style={{ fontFamily:'Syne, sans-serif' }}>
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
                  {!isReadOnly && !userCanEdit && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">Read only</span>
                  )}
                </div>
                {displayItems.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">{completeCount} of {displayItems.length} complete</p>
                )}
              </div>

              {/* Scrollable checklist items */}
              <div className="flex-1 overflow-y-auto px-5">
                {displayItems.length === 0
                  ? <p className="py-6 text-sm text-center text-slate-400">No checklist items.</p>
                  : displayItems.map(item => <React.Fragment key={item.key}>{CheckRow({ item, readOnly: isReadOnly || !userCanEdit })}</React.Fragment>)}
              </div>

              {/* Pinned advance / resolution footer — hidden in read-only mode or for non-editors */}
              {!isReadOnly && userCanEdit && client.stage !== 'denied' && nextStage && (
                <div className="flex-shrink-0 border-t border-stone-100 p-4 space-y-2">
                  <button data-testid="advance-btn"
                    disabled={!canAdvance}
                    onClick={() => canAdvance && setConfirmAdvance(nextStage)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${canAdvance ? 'text-white shadow-sm hover:opacity-90' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
                    style={canAdvance ? { background:'#0D9488' } : {}}>
                    {canAdvance ? `Advance to ${SM[nextStage].label} →` : 'Complete all items to advance'}
                  </button>
                  {hasBlock && <p className="text-xs text-red-600 text-center mt-2">⚠ One or more items are blocking advance</p>}
                  {(client.stage === 'submitted' || client.stage === 'auth_assessment') && (
                    <button data-testid="deny-btn"
                      onClick={() => setConfirmDeny(true)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-all">
                      Mark as Denied
                    </button>
                  )}
                </div>
              )}

              {!isReadOnly && userCanEdit && client.stage === 'denied' && (() => {
                const deniedItems = getStageItems('denied');
                const deniedAllDone = deniedItems.every(it => itemComplete(it, client, staff));
                return (
                  <div className="flex-shrink-0 border-t border-stone-100 p-4">
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
          </div>

          {/* right: tabbed context panel */}
          <div className="bg-white rounded-xl border border-stone-200 flex flex-col overflow-hidden" style={{ alignSelf:'start' }}>
            {/* Tab bar */}
            <div className="flex border-b border-stone-100 flex-shrink-0">
              {[
                { key:'notes',     label:'Notes',     count:(client.case_notes||[]).length },
                { key:'documents', label:'Documents',  count:visibleDocs.length },
                { key:'activity',  label:'Activity',   count:client.activity_log.length },
                ...(hasPlanSession
                  ? [{ key:'plan', label:'Plan', count:0 }]
                  : []),
              ].map(tab => (
                <button key={tab.key}
                  data-testid={`detail-tab-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-teal-500 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      activeTab === tab.key ? 'bg-teal-100 text-teal-700' : 'bg-stone-100 text-slate-500'
                    }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight:'calc(100vh - 320px)' }}>

              {/* Notes tab */}
              {activeTab === 'notes' && (
                <>
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
                  <div className="divide-y divide-stone-50" data-testid="case-notes-list">
                    {(client.case_notes||[]).length === 0
                      ? <p className="px-4 py-5 text-xs text-center text-slate-400 italic">No case notes yet. Add the first note above.</p>
                      : (client.case_notes||[]).map(n => (
                        <div key={n.id} className="px-4 py-3">
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <p className="text-[10px] text-slate-400" style={{ fontFamily:'DM Mono, monospace' }}>
                              {n.author} · {new Date(n.timestamp).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </p>
                            {n.stage && SM[n.stage] && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${SM[n.stage].pill}`}>
                                {SM[n.stage].label}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </>
              )}

              {/* Documents tab */}
              {activeTab === 'documents' && (
                <>
                  <div className="divide-y divide-stone-50" data-testid="documents-panel">
                  {visibleDocs.length === 0
                    ? <p className="px-4 py-5 text-xs text-center text-slate-400">No documents uploaded yet.</p>
                    : visibleDocs.map(d => (
                      <div key={d.id} className="px-4 py-2.5 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {d.type === 'assessment_draft' && (
                              <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background:'#FEF3C7', color:'#92400E', border:'1px solid #FDE68A' }}>Draft</span>
                            )}
                            {d.type === 'final_assessment' && (
                              <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background:'rgba(20,184,166,0.1)', color:'#0D9488', border:'1px solid rgba(20,184,166,0.3)' }}>Final</span>
                            )}
                            <span className="text-xs font-medium text-slate-700 truncate">{d.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-400" style={{ fontFamily:'DM Mono, monospace' }}>
                            {new Date(d.uploaded_at).toLocaleDateString()} · {d.by}{d.stage && d.stage !== client.stage ? ` · ${SM[d.stage]?.label ?? d.stage}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const a = document.createElement('a');
                            if (d.dataUrl) {
                              a.href = d.dataUrl;
                              a.download = d.label;
                            } else {
                              const blob = new Blob([`Document: ${d.label}\nUploaded: ${new Date(d.uploaded_at).toLocaleString()}\nBy: ${d.by}`], { type:'text/plain' });
                              const url = URL.createObjectURL(blob);
                              a.href = url; a.download = `${d.label.replace(/\s+/g,'_')}.txt`;
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                            }
                            a.click();
                          }}
                          className="flex-shrink-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors leading-none">
                          <span className="flex items-center" style={{ lineHeight:0 }}><Ico.Download/></span>
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div className="divide-y divide-stone-50" data-testid="activity-log">
                  {client.activity_log.length === 0
                    ? <p className="px-4 py-5 text-xs text-center text-slate-400">No activity yet.</p>
                    : client.activity_log.map(e => {
                        const isStageMove = e.action.startsWith('Moved to');
                        if (isStageMove) return (
                          <div key={e.id} className="px-4 py-3 bg-teal-50 flex items-start gap-2.5">
                            <span className="mt-0.5 flex-shrink-0 text-teal-500 text-sm leading-none">→</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-teal-800">{e.action}</div>
                              {e.reason && (
                                <div className="flex items-start gap-1 mt-1.5 text-xs text-red-600">
                                  <span className="flex-shrink-0 leading-tight">✕</span>
                                  <span>{e.reason}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-teal-600/70 mt-1" style={{ fontFamily:'DM Mono, monospace' }}>
                                {new Date(e.ts).toLocaleDateString()} · {e.by}
                              </div>
                            </div>
                          </div>
                        );
                        return (
                          <div key={e.id} className="px-4 py-2.5">
                            <div className="text-xs text-slate-700">{e.action}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontFamily:'DM Mono, monospace' }}>
                              {new Date(e.ts).toLocaleDateString()} · {e.by}
                            </div>
                          </div>
                        );
                      })}
                </div>
              )}

              {/* Plan tab — Plan Draft summary with assessment data */}
              {activeTab === 'plan' && hasPlanSession && (
                <PlanDraftPreview
                  session={client.assessment_session}
                  graphs={planGraphs}
                  documents={client.documents}
                />
              )}

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

      {/* ── deny confirmation dialog ── */}
      {confirmDeny && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-slate-900 mb-1" style={{ fontFamily:'Syne, sans-serif' }}>Mark as Denied</h3>
            <p className="text-sm text-slate-500 mb-4">
              Move <strong>{client.name}</strong> to the Denied stage. This will be logged in the activity history.
            </p>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Denial reason <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
            <textarea
              value={denyReason}
              onChange={e => setDenyReason(e.target.value)}
              placeholder="e.g. Medical necessity not established, missing documentation…"
              rows={3}
              className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 resize-none placeholder:text-slate-400 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setConfirmDeny(false); setDenyReason(''); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-600 border border-stone-200 hover:bg-stone-50">Cancel</button>
              <button data-testid="confirm-deny" onClick={doDeny}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Confirm Denial</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
