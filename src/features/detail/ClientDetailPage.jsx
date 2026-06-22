import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
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
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';
import BehaviorSessionLogPanel from './BehaviorSessionLogPanel.jsx';
import SkillSessionLogPanel    from './SkillSessionLogPanel.jsx';
import BehaviorSessionModal    from './BehaviorSessionModal.jsx';
import SkillSessionModal       from './SkillSessionModal.jsx';
import CaregiverTrainingLogPanel from './CaregiverTrainingLogPanel.jsx';
import CaregiverTrainingLogModal from './CaregiverTrainingLogModal.jsx';
import ReassessmentCyclePanel, { ReauthSubmissionChecklist } from './ReassessmentCyclePanel.jsx';

export default function ClientDetailPage({ clientId, clients, staff, setClients, onBack, backLabel, currentUser, addNotif, onClientAdvanced, onOpenAssessment, initialServicesTab }) {
  useBodyScrollLock();
  const client = clients.find(c => c.id === clientId);
  const [confirmAdvance, setConfirmAdvance] = useState(null);
  const [confirmDeny,    setConfirmDeny]    = useState(false);
  const [denyReason,     setDenyReason]     = useState('');
  const [openPicker,     setOpenPicker]     = useState(null);
  const [pickerAnchor,   setPickerAnchor]   = useState(null); // { top, left, role, pid, pool, item }
  const [formDrafts,     setFormDrafts]     = useState({});
  const [savedFields,    setSavedFields]    = useState(new Set());
  const [schedEdit,      setSchedEdit]      = useState(false);
  const [schedDraft,     setSchedDraft]     = useState('');
  const [viewStage,      setViewStage]      = useState(null);
  const [noteText,       setNoteText]       = useState('');
  const [activeTab,      setActiveTab]      = useState('notes');
  const [logSessionModalOpen,          setLogSessionModalOpen]          = useState(false);
  const [logSkillSessionModalOpen,     setLogSkillSessionModalOpen]     = useState(false);
  const [logCaregiverSessionModalOpen, setLogCaregiverSessionModalOpen] = useState(false);
  const [servicesTab,                  setServicesTab]                  = useState(initialServicesTab ?? 'sessions');
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
  const [reassessmentGraphs, setReassessmentGraphs] = useState(null);

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

  // Reassessment graphs — build when the Reassessment tab is active and a session exists.
  useEffect(() => {
    if (servicesTab !== 'reassessment') return;
    const activeSession = (client?.reassessment_sessions ?? []).at(-1);
    if (!activeSession) return;
    let cancelled = false;
    setReassessmentGraphs(null);
    buildGraphsFromSession(activeSession, {
      sessionLogs: client?.service_session_logs ?? [],
      ctLogs:      client?.caregiver_training_session_logs ?? [],
    })
      .then(g => { if (!cancelled) setReassessmentGraphs(g); })
      .catch(err => { console.error('Reassessment graph generation failed:', err); if (!cancelled) setReassessmentGraphs({}); });
    return () => { cancelled = true; };
  }, [servicesTab, (client?.reassessment_sessions ?? []).length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openPicker) return;
    const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) { setOpenPicker(null); setPickerAnchor(null); } };
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
  const serviceTabsActive = client.stage === 'services' && !isReadOnly;
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

  const pushDoc = (type, label, dataUrl, fieldLabel) => {
    const doc = { id:`doc_${Date.now()}`, type, label, uploaded_at:new Date().toISOString(), by:currentUser.name, stage:client.stage, ...(dataUrl ? { dataUrl } : {}), ...(fieldLabel ? { field: fieldLabel } : {}) };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, documents:[...c.documents, doc] } : c));
  };

  const pushLog = action => {
    const entry = { id:`log_${Date.now()}`, action, ts:new Date().toISOString(), by:currentUser.name };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, activity_log:[entry, ...c.activity_log] } : c));
  };

  /* ── session log handlers ── */
  const handleSaveSessionLog = newLog => {
    setClients(prev => prev.map(c =>
      c.id === client.id
        ? { ...c, service_session_logs: [...(c.service_session_logs ?? []), newLog] }
        : c,
    ));
    pushLog(`Behavior session #${newLog.sessionNumber} logged by ${newLog.rbtName}`);
    setLogSessionModalOpen(false);
  };

  const handleSaveSkillLog = newLog => {
    setClients(prev => prev.map(c =>
      c.id === client.id
        ? { ...c, service_session_logs: [...(c.service_session_logs ?? []), newLog] }
        : c,
    ));
    pushLog(`Skill session #${newLog.sessionNumber} logged by ${newLog.rbtName}`);
    setLogSkillSessionModalOpen(false);
  };

  const handleSaveCaregiverSessionLog = newLog => {
    setClients(prev => prev.map(c =>
      c.id === client.id
        ? { ...c, caregiver_training_session_logs: [...(c.caregiver_training_session_logs ?? []), newLog] }
        : c,
    ));
    pushLog(`Caregiver training session #${newLog.sessionNumber} logged by ${newLog.bcbaName}`);
    setLogCaregiverSessionModalOpen(false);
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
    // Simulate parent email notification when parent_email is set
    if (client.parent_email) {
      addNotif(mkNotif(
        `Email sent to ${client.parent_email} — ${client.name} stage update`,
        client.name,
        'normal'
      ));
    }
    if (onClientAdvanced) onClientAdvanced(client.id);
    setConfirmAdvance(null);
    onBack();
  };

  const doDeny = () => {
    const reason = denyReason.trim();
    patchClient({ stage: 'denied', stage_entered_at: new Date().toISOString(), denial_reason: reason || null, denial_from_stage: client.stage, denial_count: (client.denial_count ?? 0) + 1 });
    const entry = { id:`log_${Date.now()}`, action:'Moved to Denied', ...(reason ? { reason } : {}), ts:new Date().toISOString(), by:currentUser.name };
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, activity_log:[entry, ...c.activity_log] } : c));
    addNotif(mkNotif(`${client.name} — Authorization denied by insurer`, client.name, 'urgent'));
    if (onClientAdvanced) onClientAdvanced(client.id);
    setConfirmDeny(false);
    setDenyReason('');
    onBack();
  };

  // Return from denied → submitted: snapshot prior values, clear auth fields for new submission
  const SUBMITTED_AUTH_FIELDS = ['plan_submission_date','approval_uploaded','auth_reference_number','authorized_97153','authorized_97155','authorized_97156','auth_start_date','auth_end_date'];
  const doReturnFromDenied = (returnStage) => {
    if (returnStage === 'submitted') {
      // Snapshot the rejected submitted values before clearing
      const priorSnap = {};
      SUBMITTED_AUTH_FIELDS.forEach(k => {
        const v = client.checklist?.submitted?.[k];
        if (v !== undefined && v !== '' && v !== false) priorSnap[k] = v;
      });
      // Clear auth fields for fresh submission
      const cleared = {};
      SUBMITTED_AUTH_FIELDS.forEach(k => { cleared[k] = k === 'approval_uploaded' ? false : ''; });
      setClients(prev => prev.map(c => {
        if (c.id !== client.id) return c;
        return {
          ...c,
          stage: returnStage,
          stage_entered_at: new Date().toISOString(),
          submitted_prior: Object.keys(priorSnap).length ? priorSnap : c.submitted_prior,
          checklist: { ...c.checklist, submitted: { ...c.checklist.submitted, ...cleared } },
          activity_log: [{ id:`log_${Date.now()}`, action:'Returned to Submitted after denial — auth fields reset', ts:new Date().toISOString(), by:currentUser.name }, ...c.activity_log],
        };
      }));
      addNotif(mkNotif(`${client.name} — returned to Submitted for resubmission`, client.name, 'normal'));
    } else {
      doAdvance(returnStage);
      return;
    }
    if (onClientAdvanced) onClientAdvanced(client.id);
    setConfirmAdvance(null);
    onBack();
  };

  /* ── inline staff picker dropdown ── */
  const PickerDrop = ({ id, pool }) => openPicker !== id ? null : (
    <div ref={pickerRef}
      className="absolute z-30 top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl overflow-y-auto"
      style={{ width:'220px', maxHeight:'260px' }}>
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

  /* ── assign picker inside checklist item — portal-based to escape overflow clipping ── */
  const openPortalPicker = (e, role, pid, item) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pool = role === 'bcba' ? bcbas : rbts;
    setPickerAnchor({ top: rect.bottom + 4, left: rect.left, role, pid, pool, item });
    setOpenPicker(p => p === pid ? null : pid);
  };

  const AssignPicker = ({ item }) => {
    const assignedId = item.role === 'bcba' ? client.bcba_id : client.rbt_id;
    const assigned   = staff.find(s => s.id === assignedId);
    const pid        = `cl_${item.role}`;
    return assigned ? (
      <div className="flex items-center gap-2">
        <Avatar initials={assigned.initials} role={item.role} size="sm"/>
        <span className="text-sm text-slate-700">{assigned.name}</span>
        {isAdmin(currentUser.role) && (
          <button onClick={e => openPortalPicker(e, item.role, pid, item)}
            className="text-xs text-teal-600 hover:text-teal-800 underline">Change</button>
        )}
      </div>
    ) : (
      <button onClick={e => openPortalPicker(e, item.role, pid, item)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100">
        <Ico.Plus/> Assign {item.role.toUpperCase()}
      </button>
    );
  };

  /* ── single checklist row ── */
  const CheckRow = ({ item, readOnly }) => {
    const complete = itemComplete(item, client, staff);
    const blocks   = !readOnly && itemBlocks(item, client, staff);
    const clVal    = client.checklist[item.clSec]?.[item.key];

    if (item.type === 'section_label') return (
      <div className="flex items-center gap-2 -mx-5 px-5 pt-4 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{item.label}</span>
        <div className="flex-1 h-px bg-stone-150" style={{ background:'#e7e5e4' }}/>
      </div>
    );

    // ── Card-style checkbox ────────────────────────────────────────────────
    if (item.type === 'checkbox') {
      const assignedBcba = item.key === 'bcba_matches_auth' ? staff.find(s => s.id === client.bcba_id) : null;
      return (
        <div
          className={`mb-2 flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors select-none
            ${complete
              ? 'bg-emerald-50 border-emerald-200'
              : blocks
                ? 'bg-red-50/60 border-red-200'
                : 'bg-white border-stone-200 hover:border-teal-200 hover:bg-teal-50/30'
            } ${!readOnly ? 'cursor-pointer' : ''}`}
          onClick={!readOnly ? () => {
            const newVal = !clVal;
            patchCL(item.clSec, item.key, newVal);
            if (newVal) pushLog(`Checked: ${item.label}`);
          } : undefined}
        >
          <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors
            ${complete ? 'bg-teal-600 border-teal-600' : 'border-stone-300 bg-white'}`}>
            {complete && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-snug ${complete ? 'line-through text-slate-400' : 'text-slate-700'}`}>
              {item.label}
            </p>
            {item.sublabel && (
              <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{item.sublabel}</p>
            )}
            {item.note && (
              <p className="mt-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-100 rounded px-2 py-0.5 inline-block">{item.note}</p>
            )}
            {!readOnly && item.mandatory && !complete && (
              <span className="inline-block mt-1 text-[10px] font-bold text-red-600 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded">MANDATORY</span>
            )}
            {item.key === 'bcba_matches_auth' && (
              assignedBcba ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  Assigned: <span className="font-semibold text-slate-600">{assignedBcba.name}</span>
                  {assignedBcba.npi
                    ? <> · NPI <span style={{ fontFamily:'DM Mono, monospace' }} className="text-slate-500">{assignedBcba.npi}</span> — verify both match the authorization letter</>
                    : <> — verify name matches the authorization letter</>
                  }
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-600">No BCBA assigned — assign one first</p>
              )
            )}
          </div>
        </div>
      );
    }

    // ── Card-style upload ──────────────────────────────────────────────────
    if (item.type === 'upload') {
      return (
        <div className={`mb-2 flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors
          ${complete ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-stone-200'}`}>
          <p className={`text-sm font-semibold ${complete ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.label}</p>
          {complete
            ? <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg flex-shrink-0">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Uploaded
              </span>
            : readOnly
              ? <span className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 bg-stone-50 border border-stone-200 rounded-lg flex-shrink-0">Not uploaded</span>
              : <button data-testid={`upload-${item.key}`}
                  onClick={e => { e.stopPropagation(); patchCL(item.clSec, item.key, true); pushDoc(item.key, item.label); pushLog(`Uploaded: ${item.label}`); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-teal-700 border border-teal-300 bg-white hover:bg-teal-50 rounded-lg flex-shrink-0 transition-colors">
                  <Ico.Upload/> Upload
                </button>
          }
        </div>
      );
    }

    return (
      <div className={`py-3.5 border-b border-stone-100 last:border-0 ${blocks ? 'bg-red-50/40 -mx-5 px-5 rounded' : ''}`}>
          <div className="flex-1 min-w-0">
            {/* placeholder — checkbox and upload now handled above */}

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
                              pushDoc(item.docType ?? item.key, file.name, reader.result, item.label);
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
              // Auto-seed from plan_draft, assessment session, or client record
              let autoDefault = '';
              let autoDefaultSource = ''; // 'plan' | 'assessment' | 'client'

              if (item.planDraftKey) {
                const val = client.checklist?.plan_draft?.[item.planDraftKey];
                if (val) { autoDefault = String(val); autoDefaultSource = 'plan'; }
              }
              if (!autoDefault && item.sessionField && client.assessment_session) {
                const sec = client.assessment_session.sections?.[item.sessionField];
                if (item.sessionTransform === 'trainingFreqToHours') {
                  const freq = (sec?.trainingFrequency ?? '').toLowerCase();
                  if (freq.includes('2x') || freq.includes('twice'))     autoDefault = '8';
                  else if (freq.includes('1x') || freq.includes('once')) autoDefault = '4';
                  else if (freq.includes('month'))                        autoDefault = '2';
                }
                if (autoDefault) autoDefaultSource = 'assessment';
              }
              if (!autoDefault && item.authorizedHoursWeek) {
                const cptKey = item.authorizedHoursWeek === '97155' ? 'authorized_97155'
                             : item.authorizedHoursWeek === '97156' ? 'authorized_97156'
                             : 'authorized_97153';
                const h = parseFloat(client.checklist?.submitted?.[cptKey]) || 0;
                if (h > 0) { autoDefault = String(Math.round(h / 4.3)); autoDefaultSource = 'authorized'; }
              }
              if (!autoDefault && item.authorizedKey) {
                const val = client.checklist?.authorized?.[item.authorizedKey];
                if (val) { autoDefault = String(val); autoDefaultSource = 'authorized'; }
              }
              const clientDefault = item.clientFields
                ? item.clientFields.map(f => client[f] || '').filter(Boolean).join(item.clientFieldSep ?? ' ')
                : item.clientField ? (client[item.clientField] ?? '') : '';
              if (!autoDefault && clientDefault) { autoDefault = clientDefault; autoDefaultSource = 'client'; }
              const sessionDefaultSource = autoDefaultSource; // keep hint label alias
              const draft    = formDrafts[item.key] !== undefined ? formDrafts[item.key] : (clVal || autoDefault);
              const savedVal = clVal ?? '';
              // Dirty when user has typed something different, OR when an auto default
              // is pre-filled but hasn't been confirmed/saved to the checklist yet.
              const isDirty  = formDrafts[item.key] !== undefined
                ? formDrafts[item.key] !== savedVal
                : !!(autoDefault && !savedVal);
              const justSaved = savedFields.has(item.key);
              // Whether this field can auto-seed but the client record has no data for it
              const missingClientData = !!(item.clientFields?.length && !clientDefault && !savedVal);

              // Format HH:MM (24h) → "9:00 AM" for time fields
              const fmtTime = val => {
                if (!val || item.fieldType !== 'time') return val;
                const [h, m] = val.split(':').map(Number);
                if (isNaN(h) || isNaN(m)) return val;
                const ampm = h >= 12 ? 'PM' : 'AM';
                return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
              };

              const handleSave = () => {
                patchCL(item.clSec, item.key, draft);
                setFormDrafts(d => { const n = { ...d }; delete n[item.key]; return n; });
                if (draft !== savedVal) pushLog(`Updated: ${item.label} — ${fmtTime(draft) || draft}`);
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
                        {fmtTime(savedVal) || savedVal || <span className="text-slate-400 italic">—</span>}
                      </span>
                    : <>
                        <div className="flex items-center gap-2">
                          <input type={item.fieldType || 'text'} value={draft}
                            onChange={e => setFormDrafts(d => ({ ...d, [item.key]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                            data-testid={`detail-field-${item.key}`}
                            placeholder={item.placeholder ?? (item.fieldType === 'number' ? '0' : 'Enter…')}
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
                        {/* Saved confirmation */}
                        {justSaved && savedVal && (
                          <p className="mt-1.5 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            Saved: <span style={{ fontFamily:'DM Mono, monospace' }}>{fmtTime(savedVal) || savedVal}</span>
                          </p>
                        )}
                        {/* Existing saved value (not dirty, not just saved) */}
                        {!justSaved && savedVal && !isDirty && (
                          <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            Current: <span style={{ fontFamily:'DM Mono, monospace' }}>{savedVal}</span>
                          </p>
                        )}
                        {/* Pre-filled from assessment or client record but not yet saved */}
                        {!justSaved && autoDefault && !savedVal && (
                          <p className="mt-1 text-[11px] text-teal-600 font-medium flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Pre-filled from {autoDefaultSource === 'plan' ? 'Plan Draft' : autoDefaultSource === 'assessment' ? 'assessment' : autoDefaultSource === 'authorized' ? 'Authorized stage' : 'client record'} — confirm and save
                          </p>
                        )}
                        {/* Client record has no data for this field — manual entry needed */}
                        {!justSaved && missingClientData && (
                          <p className="mt-1 text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                            </svg>
                            Not on file — collect and enter manually
                          </p>
                        )}
                        {/* Previously rejected value — shown when returning to Submitted after denial */}
                        {item.clSec === 'submitted' && (() => {
                          const prior = client.submitted_prior?.[item.key];
                          if (!prior) return null;
                          return (
                            <p className="mt-1.5 text-[11px] text-red-500 flex items-center gap-1">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                              </svg>
                              Previously rejected: <span style={{ fontFamily:'DM Mono, monospace' }}>{String(prior)}</span>
                            </p>
                          );
                        })()}
                        {/* Per-CPT authorized hours hint — shown on each weekly scheduling field */}
                        {item.authorizedHoursWeek && (() => {
                          const sub = client.checklist?.submitted ?? {};
                          const cptKey = item.authorizedHoursWeek === '97155' ? 'authorized_97155'
                                       : item.authorizedHoursWeek === '97156' ? 'authorized_97156'
                                       : 'authorized_97153';
                          const monthly = parseFloat(sub[cptKey]) || 0;
                          if (!monthly) return null;
                          const weekly = Math.round(monthly / 4.3);
                          const cptLabel = item.authorizedHoursWeek === '97155' ? 'BCBA supervision'
                                         : item.authorizedHoursWeek === '97156' ? 'caregiver training'
                                         : 'direct therapy';
                          return (
                            <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                              <svg className="w-3 h-3 flex-shrink-0 text-teal-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              Authorized: <span className="text-slate-600 font-medium">{monthly}h/mo → ~{weekly}h/wk</span>
                              <span className="text-slate-400">({cptLabel})</span>
                            </p>
                          );
                        })()}
                        {/* Suggest date offset from another saved field (e.g. appeal_deadline from denial_date + 30) */}
                        {item.suggestFromField && !savedVal && !formDrafts[item.key] && (() => {
                          const sourceVal = client.checklist?.[item.clSec]?.[item.suggestFromField];
                          if (!sourceVal) return null;
                          const base = new Date(sourceVal + 'T00:00:00');
                          base.setDate(base.getDate() + (item.suggestOffsetDays ?? 30));
                          const suggested = base.toISOString().split('T')[0];
                          const fmtSuggested = base.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
                          return (
                            <button
                              onClick={() => {
                                patchCL(item.clSec, item.key, suggested);
                                pushLog(`Updated: ${item.label} — ${suggested}`);
                                setSavedFields(prev => new Set(prev).add(item.key));
                                clearTimeout(saveTimers.current[item.key]);
                                saveTimers.current[item.key] = setTimeout(() => {
                                  setSavedFields(prev => { const n = new Set(prev); n.delete(item.key); return n; });
                                }, 2000);
                              }}
                              className="mt-1.5 text-[11px] text-teal-600 hover:text-teal-800 font-medium underline flex items-center gap-1">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                              </svg>
                              Suggest: {fmtSuggested} ({item.suggestOffsetDays} days from denial date)
                            </button>
                          );
                        })()}

                        {/* Suggest 6-month plan period — shown on plan_start_date when both dates are empty */}
                        {item.suggestPeriod && !savedVal && !formDrafts[item.key] && (() => {
                          const today = new Date();
                          const end   = new Date(today); end.setMonth(end.getMonth() + 6);
                          const fmt   = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
                          const startIso = today.toISOString().split('T')[0];
                          const endIso   = end.toISOString().split('T')[0];
                          return (
                            <button
                              onClick={() => {
                                const endKey = item.suggestEndKey ?? 'plan_end_date';
                                patchCL(item.clSec, item.key, startIso);
                                patchCL(item.clSec, endKey, endIso);
                                pushLog(`Updated: ${item.label} — ${startIso} → ${endIso}`);
                                setSavedFields(prev => new Set(prev).add(item.key).add(endKey));
                                clearTimeout(saveTimers.current[`suggest_${item.key}`]);
                                saveTimers.current[`suggest_${item.key}`] = setTimeout(() => {
                                  setSavedFields(prev => { const n = new Set(prev); n.delete(item.key); n.delete(endKey); return n; });
                                }, 2000);
                              }}
                              className="mt-1.5 text-[11px] text-teal-600 hover:text-teal-800 font-medium underline flex items-center gap-1">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                              </svg>
                              Suggest 6-month period: {fmt(today)} → {fmt(end)}
                            </button>
                          );
                        })()}

                      </>
                  }
                </div>
              );
            })()}

            {item.type === 'assign' && (() => {
              if (readOnly) {
                const assignedId = item.role === 'bcba' ? client.bcba_id : client.rbt_id;
                const assigned   = staff.find(s => s.id === assignedId);
                return (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-800">{item.label}</span>
                    {assigned
                      ? <div className="flex items-center gap-2">
                          <Avatar initials={assigned.initials} role={item.role} size="sm"/>
                          <span className="text-sm text-slate-700">{assigned.name}</span>
                        </div>
                      : <span className="text-sm text-slate-400">Not assigned</span>
                    }
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-800">{item.label}</span>
                  <AssignPicker item={item}/>
                </div>
              );
            })()}

            {item.type === 'auto' && (() => {
              let display = ''; let cc = 'bg-teal-50 border-teal-200 text-teal-700';
              if (item.always) {
                const diagPart = client.icd10 ? `${client.diagnosis || 'ASD'} (${client.icd10})` : client.diagnosis || '';
                const parts = [client.dob, client.insurer_name, client.member_id, diagPart].filter(Boolean);
                display = parts.join(' · ') || client.name;
              } else if (item.planDraftHours) {
                const pd = client.checklist?.plan_draft ?? {};
                const parts = [
                  pd.hours_97153 && `97153: ${pd.hours_97153}h`,
                  pd.hours_97155 && `97155: ${pd.hours_97155}h`,
                  pd.hours_97156 && `97156: ${pd.hours_97156}h`,
                ].filter(Boolean);
                if (parts.length) {
                  display = parts.join(' · ');
                } else {
                  display = 'No hours set in Plan Draft';
                  cc = 'bg-amber-50 border-amber-200 text-amber-700';
                }
              } else if (item.intakeKey) {
                const done = !!client.checklist?.intake?.[item.intakeKey];
                display = done ? 'Uploaded in Intake' : 'Not uploaded yet';
                cc = done ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-amber-50 border-amber-200 text-amber-700';
              } else if (item.sessionKey) {
                const session = client.assessment_session;
                if (!session) {
                  display = 'Complete Smart Assessment first';
                  cc = 'bg-slate-100 border-slate-200 text-slate-500';
                } else {
                  const done = itemComplete(item, client, staff);
                  if (item.sessionKey === 'behaviors_any' && done) {
                    const count = session.sections?.behavior_targets?.behaviorTargets?.length ?? 0;
                    display = `${count} behavior${count !== 1 ? 's' : ''} identified`;
                  } else if (item.sessionKey === 'behaviors_baseline' && done) {
                    const count = session.sections?.behavior_targets?.behaviorTargets?.filter(b => b.baselineFrequency).length ?? 0;
                    display = `${count} with baseline data`;
                  } else {
                    display = done ? 'Captured in assessment' : 'Not yet recorded';
                    if (!done) cc = 'bg-amber-50 border-amber-200 text-amber-700';
                  }
                }
              } else if (item.bcbaAuto) {
                display = bcba ? bcba.name : 'Not assigned';
                if (!bcba) cc = 'bg-amber-50 border-amber-200 text-amber-700';
              } else if (item.rbtCert) {
                const rm = staff.find(s => s.id === client.rbt_id);
                if (!rm) { display = 'No RBT assigned'; cc = 'bg-slate-100 border-slate-200 text-slate-500'; }
                else {
                  const daysLeft = Math.ceil((new Date(rm.cert_expiry) - new Date()) / 86_400_000);
                  if (daysLeft <= 0) {
                    display = `Expired ${rm.cert_expiry}`;
                    cc = 'bg-red-50 border-red-200 text-red-700';
                  } else if (daysLeft <= 30) {
                    display = `⚠ Expires in ${daysLeft}d`;
                    cc = 'bg-amber-50 border-amber-300 text-amber-700';
                  } else {
                    display = `Expires ${rm.cert_expiry}`;
                  }
                }
              } else if (item.rbtCreds) {
                if (!client.rbt_id) {
                  display = 'No RBT assigned';
                  cc = 'bg-slate-100 border-slate-200 text-slate-500';
                } else {
                  const rm = staff.find(s => s.id === client.rbt_id);
                  if (!rm?.cert_number) {
                    display = 'Missing — add cert # on Staff page';
                    cc = 'bg-amber-50 border-amber-200 text-amber-700';
                  } else {
                    display = `On file · ${rm.cert_number}`;
                  }
                }
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

            {item.type === 'action' && item.id === 'start_reassessment' && (() => {
              const cycles = client?.reassessment_sessions ?? [];
              const n      = cycles.length;
              const latest = cycles[n - 1] ?? null;
              let label;
              if (n === 0)                          label = 'Start Reassessment →';
              else if (latest?.status !== 'complete') label = `Cycle ${n} in progress →`;
              else                                  label = `Cycle ${n} complete — Start Cycle ${n + 1} →`;
              return (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-800">{item.label}</span>
                  <button
                    onClick={() => onOpenAssessment?.({ type: 'reassessment', clientId: client.id })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#0D9488,#0F766E)' }}>
                    {label}
                  </button>
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

  /* ── portal picker dropdown — renders at document.body level to escape overflow clipping ── */
  const AssignPickerPortal = (pickerAnchor && openPicker === pickerAnchor.pid) ? ReactDOM.createPortal(
    <div ref={pickerRef}
      className="fixed bg-white border border-stone-200 rounded-xl shadow-xl overflow-y-auto"
      style={{ zIndex: 9999, top: pickerAnchor.top, left: pickerAnchor.left, width: '220px', maxHeight: '260px' }}>
      {pickerAnchor.pool.map(s => (
        <button key={s.id}
          onClick={() => {
            const { role, item } = pickerAnchor;
            if (role === 'bcba') {
              patchClient({ bcba_id: s.id });
              addNotif(mkNotif(`${s.name} assigned as BCBA to ${client.name}`, client.name, 'normal'));
            } else {
              patchClient({ rbt_id: s.id });
              addNotif(mkNotif(`${s.name} assigned as RBT to ${client.name}`, client.name, 'normal'));
            }
            if (item) patchCL(item.clSec, item.key, true);
            pushLog(`${role.toUpperCase()} assigned: ${s.name}`);
            setOpenPicker(null);
            setPickerAnchor(null);
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-stone-50 text-left border-b border-stone-50 last:border-0">
          <Avatar initials={s.initials} role={s.role} size="sm"/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-slate-800">{s.name}</span>
              {pickerAnchor?.role === 'rbt' && s.cert_expiry && (() => {
                const dLeft = Math.ceil((new Date(s.cert_expiry) - new Date()) / 86_400_000);
                if (dLeft <= 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Cert expired</span>;
                if (dLeft <= 30) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Exp. in {dLeft}d</span>;
                return null;
              })()}
            </div>
            <div className="text-xs text-slate-400">{s.active_case_count} active cases</div>
          </div>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

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

            {isReauthSvc && !serviceTabsActive && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2 mb-3 flex items-center gap-2">
                <span className="text-teal-600 text-base leading-none">↻</span>
                <span className="text-sm font-semibold text-teal-700">Reauthorization cycle active</span>
                {client.auth_expiry_date && (
                  <span className="ml-auto text-xs text-teal-600">Auth expires {client.auth_expiry_date}</span>
                )}
              </div>
            )}

            {!serviceTabsActive && (<div className="bg-white rounded-xl border border-stone-200 flex flex-col" data-testid="checklist-panel">
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

              {/* Auth summary banner — shown in Authorized stage */}
              {client.stage === 'authorized' && (() => {
                const sub = client.checklist?.submitted ?? {};
                const hasAny = sub.auth_reference_number || sub.auth_start_date || sub.auth_end_date || sub.authorized_97153 || sub.authorized_97155 || sub.authorized_97156;
                if (!hasAny) return null;
                const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
                const approvalDoc = client.documents?.findLast?.(d => d.type === 'auth_approval') ?? client.documents?.slice().reverse().find(d => d.type === 'auth_approval');
                return (
                  <div className="mx-5 mb-3 rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Authorization Summary</p>
                      {client.insurer_name && <span className="text-[11px] font-medium text-teal-700">{client.insurer_name}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {sub.auth_reference_number && (
                        <span className="text-xs text-slate-700">Auth # <span className="font-semibold" style={{ fontFamily:'DM Mono, monospace' }}>{sub.auth_reference_number}</span></span>
                      )}
                      {(sub.auth_start_date || sub.auth_end_date) && (
                        <span className="text-xs text-slate-700">Period <span className="font-semibold">{fmtDate(sub.auth_start_date)} → {fmtDate(sub.auth_end_date)}</span></span>
                      )}
                    </div>
                    {(sub.authorized_97153 || sub.authorized_97155 || sub.authorized_97156) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {sub.authorized_97153 && <span className="text-xs text-slate-600">97153 <span className="font-semibold text-teal-700">{sub.authorized_97153}h</span></span>}
                        {sub.authorized_97155 && <span className="text-xs text-slate-600">97155 <span className="font-semibold text-teal-700">{sub.authorized_97155}h</span></span>}
                        {sub.authorized_97156 && <span className="text-xs text-slate-600">97156 <span className="font-semibold text-teal-700">{sub.authorized_97156}h</span></span>}
                      </div>
                    )}
                    {approvalDoc && (
                      <div className="pt-1 border-t border-teal-200/60 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 truncate">📄 {approvalDoc.label}</span>
                        {approvalDoc.dataUrl
                          ? <a href={approvalDoc.dataUrl} download={approvalDoc.label}
                              className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 flex-shrink-0">↓ Download</a>
                          : <span className="text-[11px] text-slate-400 flex-shrink-0">Uploaded</span>
                        }
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Reauth countdown banner — shown in Services stage when auth end date is known */}
              {client.stage === 'services' && (() => {
                const authEnd = client.checklist?.submitted?.auth_end_date;
                if (!authEnd) return null;
                const daysLeft = Math.ceil((new Date(authEnd + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
                const color = daysLeft < 30 ? { bg:'#FEF2F2', border:'#FECACA', text:'#B91C1C', icon:'🔴' }
                            : daysLeft < 60 ? { bg:'#FFFBEB', border:'#FDE68A', text:'#B45309', icon:'⚠' }
                            : { bg:'#F8FAFC', border:'#E2E8F0', text:'#475569', icon:'📅' };
                const fmtEnd = new Date(authEnd + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
                return (
                  <div className="mx-5 mb-3 rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5"
                    style={{ background: color.bg, borderColor: color.border }}>
                    <span>{color.icon}</span>
                    <p className="text-xs font-semibold" style={{ color: color.text }}>
                      {daysLeft < 0
                        ? `Authorization expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
                        : daysLeft === 0
                        ? 'Authorization expires today'
                        : `Authorization expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                      } ({fmtEnd})
                    </p>
                  </div>
                );
              })()}

              {/* Staffing — editable session schedule (seeded from Authorized, overridable by coordinator) */}
              {client.stage === 'staffing' && (() => {
                const authSched  = client.checklist?.authorized?.schedule_template ?? '';
                const authLoc    = client.checklist?.authorized?.session_location  ?? '';
                const staffSched = client.checklist?.staffing?.schedule_template   ?? '';
                const staffLoc   = client.checklist?.staffing?.session_location    ?? '';
                // Display values: use staffing override if saved, else fall back to authorized
                const displaySched = staffSched || authSched;
                const displayLoc   = staffLoc   || authLoc;
                if (!authSched && !authLoc && !staffSched && !staffLoc) return null;

                const isConfirmed = !!staffSched || !!staffLoc;

                const handleOpenEdit = () => {
                  setSchedDraft(displaySched);
                  setSchedEdit(true);
                };
                const handleSaveSchedule = () => {
                  patchCL('staffing', 'schedule_template', schedDraft.trim());
                  pushLog(`Session schedule confirmed: ${schedDraft.trim()}`);
                  setSchedEdit(false);
                };

                return (
                  <div className="mx-5 mb-3 rounded-xl border border-slate-200 bg-stone-50 p-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {isConfirmed ? 'Confirmed schedule' : 'Planned from Authorized'}
                      </p>
                      {!schedEdit && (
                        <button
                          onClick={handleOpenEdit}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-teal-600 transition-colors font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                          </svg>
                          {isConfirmed ? 'Edit' : 'Adjust'}
                        </button>
                      )}
                    </div>

                    {schedEdit ? (
                      /* Edit mode */
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                            <svg className="inline w-3 h-3 mr-1 text-teal-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            Days &amp; times
                          </label>
                          <input
                            type="text"
                            value={schedDraft}
                            onChange={e => setSchedDraft(e.target.value)}
                            placeholder="e.g. Mon/Wed/Fri 9–1pm, Tue/Thu 10–12pm"
                            className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 bg-white"
                          />
                          {authSched && schedDraft !== authSched && (
                            <p className="mt-1 text-[10px] text-slate-400">
                              Authorized plan: <span className="font-medium text-slate-500">{authSched}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={handleSaveSchedule}
                            disabled={!schedDraft.trim()}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                            style={{ background: '#0D9488' }}>
                            Confirm schedule
                          </button>
                          <button
                            onClick={() => setSchedEdit(false)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-slate-500 hover:bg-stone-100 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div className="space-y-1">
                        {displaySched && (
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span className="text-xs text-slate-700 font-medium">{displaySched}</span>
                            {!staffSched && authSched && (
                              <span className="text-[10px] text-amber-600 font-medium ml-1">← from Authorized</span>
                            )}
                          </div>
                        )}
                        {displayLoc && (
                          <div className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                            <span className="text-xs text-slate-600">{displayLoc}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Staffing — caregiver contact card */}
              {client.stage === 'staffing' && (() => {
                // Primary contact from client record
                const primary = client.parent_name ? {
                  name:         client.parent_name,
                  relationship: client.parent_relationship ?? 'Guardian',
                  phone:        client.phone ?? null,
                  email:        client.parent_email ?? null,
                  role:         'Primary',
                } : null;
                // Additional contacts from assessment emergency contacts (exclude medical roles)
                const extraContacts = (client.assessment_session?.emergencyContacts ?? [])
                  .filter(c => c.role !== 'Medical')
                  .filter(c => !primary || c.name !== primary.name);
                if (!primary && !extraContacts.length) return null;
                const allContacts = [primary, ...extraContacts].filter(Boolean);
                return (
                  <div className="mx-5 mb-3 rounded-xl border border-slate-200 bg-stone-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Caregiver contacts</p>
                    <div className="space-y-2.5">
                      {allContacts.map((c, i) => (
                        <div key={i} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-700">{c.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{c.relationship}</span>
                              {c.role === 'Primary' && (
                                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">Primary</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {c.phone && (
                                <a href={`tel:${c.phone}`}
                                  className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-800 font-medium transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                  </svg>
                                  {c.phone}
                                </a>
                              )}
                              {c.email && (
                                <a href={`mailto:${c.email}`}
                                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-teal-600 font-medium transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                  </svg>
                                  {c.email}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
                const returnStage = client.denial_from_stage ?? 'submitted';
                const returnLabel = returnStage === 'auth_assessment' ? 'Auth Assessment' : 'Submitted';
                const isResubmit  = returnStage === 'submitted';
                return (
                  <div className="flex-shrink-0 border-t border-stone-100 p-4">
                    <button data-testid="resolve-return"
                      onClick={() => doReturnFromDenied(returnStage)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ background:'#D97706' }}>
                      Return to {returnLabel} →
                    </button>
                    {isResubmit && (
                      <p className="text-[11px] text-slate-400 text-center mt-2">Auth fields will be cleared for the new submission. Previous values will be saved as reference.</p>
                    )}
                  </div>
                );
              })()}
            </div>)}

            {/* ── In Services: 3-tab shell ── */}
            {serviceTabsActive && (
              <div className="bg-white rounded-xl border border-stone-200 flex flex-col" data-testid="services-tab-panel">

                {/* ── Tab panel header ── */}
                <div className="px-5 pt-4 pb-0 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 flex-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                      In Services
                    </h2>
                    {!userCanEdit && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">
                        Read only
                      </span>
                    )}
                  </div>

                  {/* Reauth countdown — uses submitted auth_end_date or falls back to auth_expiry_date */}
                  {(() => {
                    const authEnd = client.checklist?.submitted?.auth_end_date ?? client.auth_expiry_date;
                    if (!authEnd) return null;
                    const daysLeft = Math.ceil(
                      (new Date(authEnd + 'T00:00:00').getTime() - Date.now()) / 86_400_000,
                    );
                    const expired = daysLeft < 0;
                    const c =
                      expired || daysLeft < 30
                        ? { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', icon: '🔴' }
                        : daysLeft < 60
                        ? { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', icon: '⚠️' }
                        : { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', icon: '✅' };
                    const fmtEnd = new Date(authEnd + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    });
                    const daysText = expired
                      ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
                      : daysLeft === 0
                      ? 'Expires today'
                      : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
                    return (
                      <div
                        className="mb-3 rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5"
                        style={{ background: c.bg, borderColor: c.border }}
                      >
                        <span className="text-sm leading-none">{c.icon}</span>
                        <p className="text-xs font-semibold flex-1" style={{ color: c.text }}>
                          {daysText} ({fmtEnd})
                        </p>
                        {isReauthSvc && (
                          <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                            Reauthorization cycle active
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Tab bar */}
                  <div className="flex border-b border-stone-100 -mx-5 px-5">
                    {(() => {
                      const totalSessions =
                        (client.service_session_logs?.length ?? 0) +
                        (client.caregiver_training_session_logs?.length ?? 0);
                      const tabs = [
                        { key: 'sessions',      label: 'Session Logs',     count: totalSessions, badge: null },
                        { key: 'reassessment',  label: 'Reassessment',     count: (client.reassessment_sessions ?? []).length, badge: null },
                        { key: 'reauth',        label: 'Reauthorization',  count: 0, badge: isReauthSvc ? 'Active' : null },
                      ];
                      return tabs.map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setServicesTab(tab.key)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex-shrink-0 ${
                            servicesTab === tab.key
                              ? 'border-teal-500 text-teal-700'
                              : 'border-transparent text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {tab.label}
                          {tab.count > 0 && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                servicesTab === tab.key
                                  ? 'bg-teal-100 text-teal-700'
                                  : 'bg-stone-100 text-slate-500'
                              }`}
                            >
                              {tab.count}
                            </span>
                          )}
                          {tab.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      ));
                    })()}
                  </div>
                </div>

                {/* ── Tab 1: Session Logs ── */}
                {servicesTab === 'sessions' && (
                  <div className="p-4 space-y-3">
                    <BehaviorSessionLogPanel
                      client={client}
                      onLogSession={() => setLogSessionModalOpen(true)}
                    />
                    <SkillSessionLogPanel
                      client={client}
                      onLogSession={() => setLogSkillSessionModalOpen(true)}
                    />
                    <CaregiverTrainingLogPanel
                      client={client}
                      onLogSession={() => setLogCaregiverSessionModalOpen(true)}
                    />
                  </div>
                )}

                {/* ── Tab 2: Reauthorization ── */}
                {servicesTab === 'reauth' && (() => {
                  const completedReassessment = (client.reassessment_sessions ?? []).find(s => s.status === 'complete');
                  const updateSubmissionChecklist = (field, value) => setClients(prev => prev.map(c => {
                    if (c.id !== client.id) return c;
                    return {
                      ...c,
                      reassessment_sessions: (c.reassessment_sessions ?? []).map(s =>
                        s.id !== completedReassessment?.id ? s : {
                          ...s,
                          submissionChecklist: { ...(s.submissionChecklist ?? {}), [field]: value },
                        }
                      ),
                    };
                  }));

                  return (
                    <div className="flex-1 overflow-y-auto px-5 py-3">
                      {isReauthSvc ? (
                        <>
                          {/* Reassessment CPT hours requested — read-only reference from the reassessment doc */}
                          {(() => {
                            const reSession = (client.reassessment_sessions ?? []).find(s => s.status !== 'complete');
                            const rh = reSession?.cptHours;
                            if (!rh || !Object.values(rh).some(v => v)) return null;
                            return (
                              <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-2">
                                  Hours Requested in Reassessment
                                </p>
                                <div className="flex gap-4">
                                  {[
                                    { code: '97153', label: 'Direct' },
                                    { code: '97155', label: 'BCBA' },
                                    { code: '97156', label: 'Caregiver' },
                                  ].map(({ code, label }) => rh[code] ? (
                                    <div key={code} className="text-center">
                                      <p className="text-[11px] font-bold text-slate-700 tabular-nums">{rh[code]}h/mo</p>
                                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">{code}</p>
                                      <p className="text-[9px] text-slate-400">{label}</p>
                                    </div>
                                  ) : null)}
                                </div>
                              </div>
                            );
                          })()}
                          {REAUTH_ITEMS.map(item => (
                            <React.Fragment key={item.key ?? item.id}>
                              {CheckRow({ item, readOnly: !userCanEdit })}
                            </React.Fragment>
                          ))}
                        </>
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-3xl mb-3">↻</p>
                          <p className="text-sm font-semibold text-slate-700 mb-1">No active reauthorization cycle</p>
                          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                            The reauthorization cycle activates automatically when the current authorization is approaching its expiration date.
                          </p>
                        </div>
                      )}
                      {/* Submission checklist — shown once BCBA downloads the reassessment doc, regardless of reauth cycle state */}
                      {completedReassessment && (
                        <ReauthSubmissionChecklist
                          checklist={completedReassessment.submissionChecklist ?? {}}
                          onChange={updateSubmissionChecklist}
                          onUpload={e => { if (e.target.files?.length) updateSubmissionChecklist('finalUploaded', true); }}
                        />
                      )}
                    </div>
                  );
                })()}

                {/* ── Tab 3: Reassessment ── */}
                {servicesTab === 'reassessment' && (() => {
                  const cycles = client.reassessment_sessions ?? [];
                  const hasActive = cycles.some(s => s.status !== 'complete');
                  // A new reassessment can only start when no cycles exist yet.
                  // Once any cycle is completed, the next cycle is gated behind
                  // a new reauthorization + fresh session data — it cannot be
                  // started manually from this tab.
                  const allComplete = cycles.length > 0 && !hasActive;
                  const canStartNew = cycles.length === 0;

                  const fmtRDate = (d) => {
                    if (!d) return '';
                    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    });
                  };

                  const relRTime = (ts) => {
                    if (!ts) return '';
                    const diff = Date.now() - new Date(ts).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 2)  return 'just now';
                    if (mins < 60) return `${mins}m ago`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24)  return `${hrs}h ago`;
                    const days = Math.floor(hrs / 24);
                    return `${days}d ago`;
                  };

                  const rSectionsDone = (session) => {
                    if (!session?.sections) return { done: 0, total: 13 };
                    const done = Object.values(session.sections)
                      .filter(s => s.completionState !== 'empty').length;
                    return { done, total: 13 };
                  };

                  // ── Reauth urgency: days until auth expires ────────────────
                  const authEndRaw = client.checklist?.submitted?.auth_end_date ?? client.auth_expiry_date;
                  const daysUntilExpiry = authEndRaw
                    ? Math.ceil((new Date(authEndRaw + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
                    : null;
                  // Clinical norm: start reassessment 60 days before auth expires
                  const reauthWindowOpen = daysUntilExpiry !== null && daysUntilExpiry <= 60;

                  return (
                    <div className="px-5 py-4">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Reassessment Cycles
                        </p>
                        {/* Show "Continue" only for an active in-progress cycle.
                            Once all cycles are complete, no new cycle can be started
                            manually — the next cycle is triggered by reauthorization. */}
                        {hasActive && (
                          <button
                            onClick={() => onOpenAssessment?.({ type: 'reassessment', clientId: client.id })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ background: '#0D9488' }}
                          >
                            Continue Reassessment →
                          </button>
                        )}
                        {canStartNew && (
                          <button
                            onClick={() => onOpenAssessment?.({ type: 'reassessment', clientId: client.id })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ background: '#0D9488' }}
                          >
                            + Start Reassessment
                          </button>
                        )}
                      </div>

                      {/* 60-day reauth window notice — only relevant before any cycle exists */}
                      {reauthWindowOpen && canStartNew && (
                        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                          <span className="text-sm leading-none mt-0.5">⚠️</span>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            <span className="font-semibold">
                              {daysUntilExpiry <= 0 ? 'Authorization expired.' : 'Reassessment recommended.'}
                            </span>{' '}
                            {daysUntilExpiry <= 0
                              ? `Auth period ended ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) !== 1 ? 's' : ''} ago — start reassessment to support reauthorization.`
                              : `Authorization expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. Start the reassessment at least 60 days before expiry to allow time for submission and approval.`
                            }
                          </p>
                        </div>
                      )}

                      {/* Completed-cycle notice — next cycle gated behind reauth */}
                      {allComplete && (
                        <div className="mb-4 rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 flex items-start gap-2">
                          <span className="text-sm leading-none mt-0.5">✓</span>
                          <p className="text-xs text-teal-800 leading-relaxed">
                            <span className="font-semibold">Reassessment complete.</span>{' '}
                            The next reassessment cycle will begin after the client is reauthorized and new session data has been collected for the new authorization period.
                          </p>
                        </div>
                      )}

                      {cycles.length === 0 ? (
                        /* ── Empty state ── */
                        <div className="py-10 text-center">
                          <p className="text-2xl mb-2">📊</p>
                          <p className="text-sm font-semibold text-slate-700 mb-1">No reassessment cycles yet</p>
                          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto mb-5">
                            Start a reassessment when the authorization period is approaching renewal.
                          </p>
                          <button
                            onClick={() => onOpenAssessment?.({ type: 'reassessment', clientId: client.id })}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ background: '#0D9488' }}
                          >
                            Start Reassessment →
                          </button>
                        </div>
                      ) : (
                        /* ── Cycle cards ── */
                        <div className="space-y-4">
                          {[...cycles].reverse().map((session, idx) => {
                            const cycleNumber = cycles.length - idx;
                            const isComplete  = session.status === 'complete';
                            const authFrom    = fmtRDate(session.authPeriodStart);
                            const authTo      = fmtRDate(session.authPeriodEnd);
                            const authLine    = authFrom || authTo ? `${authFrom} – ${authTo}` : null;
                            const { done, total } = rSectionsDone(session);
                            const pct = Math.round((done / total) * 100);

                            return (
                              <div
                                key={session.id ?? idx}
                                className="ml-1"
                                style={{ borderLeft: '2px solid #14B8A6', paddingLeft: '12px' }}
                              >
                                {/* Connector row */}
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-teal-400 font-bold text-sm select-none">›</span>
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                                    style={{ background: '#0D9488' }}
                                  >
                                    Reassessment
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-slate-500 border border-stone-200">
                                    Cycle {cycleNumber}
                                  </span>
                                </div>

                                {/* Card — only clickable when the cycle is still in progress */}
                                <div
                                  onClick={!isComplete ? () => onOpenAssessment?.({ type: 'reassessment', clientId: client.id }) : undefined}
                                  className={`bg-white border border-stone-200 rounded-xl p-4 transition-all duration-150 ${
                                    !isComplete ? 'cursor-pointer hover:shadow-md hover:-translate-y-px' : 'cursor-default'
                                  }`}
                                >
                                  {/* Row 1: title + status badge */}
                                  <div className="flex items-center justify-between gap-3 mb-1">
                                    <span className="text-sm font-semibold text-slate-700">
                                      Reassessment · Cycle {cycleNumber}
                                    </span>
                                    <span
                                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                        isComplete
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {!isComplete && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                                      )}
                                      {isComplete ? 'Completed' : 'In progress'}
                                    </span>
                                  </div>

                                  {/* Row 2: auth period */}
                                  {authLine && (
                                    <div
                                      className="text-xs text-slate-400 mb-1"
                                      style={{ fontFamily: 'DM Mono, monospace' }}
                                    >
                                      Auth period: {authLine}
                                    </div>
                                  )}

                                  {/* Row 3: BCBA + relative time */}
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-sm text-slate-500 truncate">
                                      {bcba?.name ?? 'Unassigned'}
                                    </span>
                                    <span
                                      className="text-xs text-slate-400 flex-shrink-0"
                                      style={{ fontFamily: 'DM Mono, monospace' }}
                                    >
                                      {relRTime(session.updatedAt)}
                                    </span>
                                  </div>

                                  {/* Row 4: progress bar */}
                                  <div
                                    className="w-full rounded-full mb-3 overflow-hidden"
                                    style={{ height: '4px', background: '#E7E5E4' }}
                                  >
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${pct}%`, background: '#14B8A6' }}
                                    />
                                  </div>

                                  {/* Row 5: section count + CTA */}
                                  <div className="flex items-center gap-3">
                                    <span
                                      className="text-xs text-slate-400 flex-1"
                                      style={{ fontFamily: 'DM Mono, monospace' }}
                                    >
                                      {done}/{total} sections with data
                                    </span>
                                    {isComplete ? (
                                      <span className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-3 py-1">
                                        View
                                      </span>
                                    ) : (
                                      <span
                                        className="text-xs font-semibold text-white rounded-lg px-3 py-1"
                                        style={{ background: '#0D9488' }}
                                      >
                                        Continue →
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* ── Reassessment Cycle Summary Panel ── */}
                                <ReassessmentCyclePanel
                                  session={session}
                                  client={client}
                                  graphs={reassessmentGraphs}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            )}
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
                    : visibleDocs.map(d => {
                      // Human-readable field label: prefer stored field prop, fall back to formatting d.type
                      const fmtType = (t = '') => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                      const fieldLabel = d.type === 'assessment_draft' ? null
                        : d.type === 'final_assessment' ? null
                        : (d.field || fmtType(d.type));
                      return (
                      <div key={d.id} className="px-4 py-2.5 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            {d.type === 'assessment_draft' && (
                              <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background:'#FEF3C7', color:'#92400E', border:'1px solid #FDE68A' }}>Draft</span>
                            )}
                            {d.type === 'final_assessment' && (
                              <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background:'rgba(20,184,166,0.1)', color:'#0D9488', border:'1px solid rgba(20,184,166,0.3)' }}>Final</span>
                            )}
                            {fieldLabel && (
                              <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-slate-500 border border-stone-200">{fieldLabel}</span>
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
                      );
                    })}
                  </div>
                </>
              )}

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div className="divide-y divide-stone-50" data-testid="activity-log">
                  {client.activity_log.length === 0
                    ? <p className="px-4 py-5 text-xs text-center text-slate-400">No activity yet.</p>
                    : client.activity_log.map(e => {
                        const isStageMove = e.action?.startsWith('Moved to');
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

      {/* ── session log modals ── */}
      {logSessionModalOpen && (
        <BehaviorSessionModal
          client={client}
          currentUser={currentUser}
          onSave={handleSaveSessionLog}
          onClose={() => setLogSessionModalOpen(false)}
        />
      )}
      {logSkillSessionModalOpen && (
        <SkillSessionModal
          client={client}
          currentUser={currentUser}
          onSave={handleSaveSkillLog}
          onClose={() => setLogSkillSessionModalOpen(false)}
        />
      )}
      {logCaregiverSessionModalOpen && (
        <CaregiverTrainingLogModal
          client={client}
          currentUser={currentUser}
          onSave={handleSaveCaregiverSessionLog}
          onClose={() => setLogCaregiverSessionModalOpen(false)}
        />
      )}

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

      {/* Portal-based assign picker — always rendered at body level to escape overflow clipping */}
      {AssignPickerPortal}
    </div>
  );
}
