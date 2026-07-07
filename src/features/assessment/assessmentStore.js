/**
 * assessmentStore.js
 *
 * All mutations to assessment_session live here. Every function takes
 * setClients (the React state setter from App.jsx) and operates immutably
 * on the clients array. Components import only what they need.
 */

import { updateAssessmentSession } from '../../lib/db.js';
import { sectionPromptHashes } from './lib/draftHash.js';
import { SECTION_TITLES } from './sectionConfig.js';

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Recompute the three derived counters on assessment_session. */
function _recomputeCounts(session) {
  const sections = Object.values(session.sections);

  // Demographics counts toward capture progress — BCBA verifies/edits pre-filled data
  const sectionsWithData = sections.filter(
    s => s.completionState !== 'empty'
  ).length;

  const sectionsApproved = sections.filter(
    s => s.approvalState === 'approved' || s.approvalState === 'skipped'
  ).length;

  // Never demote a completed session
  if (session.status === 'complete') {
    return { sectionsWithData, sectionsApproved, status: 'complete' };
  }

  // Any section with a generated draft → in_review
  const hasDraft = sections.some(s => !!s.draftContent);

  let status;
  if (hasDraft) {
    status = 'in_review';
  } else if (sectionsWithData > 0) {
    status = 'in_progress';
  } else {
    status = 'not_started';
  }

  return { sectionsWithData, sectionsApproved, status };
}

/** Fire-and-forget persistence to Supabase, broadcasting save-lifecycle events. */
function _persist(sessionId, patch) {
  if (!sessionId) return;
  window.dispatchEvent(new CustomEvent('aba:save-start'));
  updateAssessmentSession(sessionId, patch)
    .then(() => {
      window.dispatchEvent(new CustomEvent('aba:save-success'));
    })
    .catch(err => {
      console.error('[assessmentStore] Supabase save failed:', err);
      window.dispatchEvent(new CustomEvent('aba:save-error'));
    });
}

/**
 * Merge an updated section object into a session, recomputing derived counts.
 * Mirrors what patchSection does internally — used by mutators that need to
 * transform a section's array data (indicators, skill goals, behavior targets,
 * caregiver training targets) before merging, rather than a flat sectionPatch.
 * Returns { finalSession, persistPatch } for the caller to apply via setClients
 * and _persist respectively.
 */
function _buildSectionUpdate(session, sectionKey, updatedSectionData) {
  const updatedSections = { ...session.sections, [sectionKey]: updatedSectionData };
  const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
  const counts = _recomputeCounts(updatedSession);
  const finalSession = { ...updatedSession, ...counts };
  const persistPatch = {
    sections: finalSession.sections,
    status: finalSession.status,
    sectionsWithData: finalSession.sectionsWithData,
    sectionsApproved: finalSession.sectionsApproved,
  };
  return { finalSession, persistPatch };
}

/** Update a single client's assessment_session, merging patch at the top level. */
export function patchSession(setClients, clientId, patch) {
  let sessionId;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    sessionId = c.assessment_session?.id;
    const updatedSession = {
      ...c.assessment_session,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    // Keep reassessment_sessions in sync so ReassessmentCyclePanel always
    // sees the latest BCBA edits (patchSession is the write path for the
    // interview; reassessment_sessions is the read path for the detail view).
    const updatedReassessmentSessions = (c.reassessment_sessions ?? []).map(s =>
      s.id === updatedSession.id ? updatedSession : s,
    );
    return {
      ...c,
      assessment_session: updatedSession,
      reassessment_sessions: updatedReassessmentSessions,
    };
  }));

  _persist(sessionId, patch);
}

/** Merge sectionPatch into a specific section and recompute derived counts. */
export function patchSection(setClients, clientId, sectionKey, sectionPatch) {
  let sessionId;
  let persistPatch;

  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;

    const session = c.assessment_session;
    const mergedSection = { ...session.sections[sectionKey], ...sectionPatch };
    const computedState = computeSectionCompletionState(sectionKey, mergedSection);
    const updatedSections = {
      ...session.sections,
      [sectionKey]: computedState !== undefined
        ? { ...mergedSection, completionState: computedState }
        : mergedSection,
    };

    const updatedSession = {
      ...session,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
    };

    const counts = _recomputeCounts(updatedSession);
    const finalSession = { ...updatedSession, ...counts };

    sessionId = finalSession.id;
    persistPatch = {
      sections: finalSession.sections,
      status: finalSession.status,
      sectionsWithData: finalSession.sectionsWithData,
      sectionsApproved: finalSession.sectionsApproved,
    };

    const updatedReassessmentSessions = (c.reassessment_sessions ?? []).map(s =>
      s.id === finalSession.id ? finalSession : s,
    );

    return {
      ...c,
      assessment_session: finalSession,
      reassessment_sessions: updatedReassessmentSessions,
    };
  }));

  _persist(sessionId, persistPatch);
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export function updateSectionNotes(setClients, clientId, sectionKey, notes) {
  patchSection(setClients, clientId, sectionKey, { notes });
}

// ─── Indicators ─────────────────────────────────────────────────────────────

export function updateIndicatorCount(setClients, clientId, sectionKey, indicatorId, delta) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const updatedIndicators = section.indicators.map(ind =>
      ind.id === indicatorId
        ? { ...ind, count: Math.max(0, ind.count + delta) }
        : ind
    );
    const updated = { ...section, indicators: updatedIndicators };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, sectionKey, updated);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

export function addCustomIndicator(setClients, clientId, sectionKey, label) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const newIndicator = {
      id: `custom_${Date.now()}`,
      label,
      count: 0,
      isCustom: true,
      unit: 'count',
    };
    const updatedIndicators = [...section.indicators, newIndicator];
    const updated = { ...section, indicators: updatedIndicators };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, sectionKey, updated);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

export function removeCustomIndicator(setClients, clientId, sectionKey, indicatorId) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const updatedIndicators = section.indicators.filter(ind => ind.id !== indicatorId);
    const updated = { ...section, indicators: updatedIndicators };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, sectionKey, updated);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

export function resetIndicator(setClients, clientId, sectionKey, indicatorId) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const updatedIndicators = section.indicators.map(ind =>
      ind.id === indicatorId ? { ...ind, count: 0 } : ind
    );
    const updated = { ...section, indicators: updatedIndicators };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, sectionKey, updated);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

// ─── Recording ──────────────────────────────────────────────────────────────

export function setRecordingState(setClients, clientId, sectionKey, state) {
  patchSection(setClients, clientId, sectionKey, { recordingState: state });
}

export function setRecordingDuration(setClients, clientId, sectionKey, seconds) {
  patchSection(setClients, clientId, sectionKey, { recordingDurationSeconds: seconds });
}

export function setTranscript(setClients, clientId, sectionKey, transcript) {
  patchSection(setClients, clientId, sectionKey, {
    transcript,
    recordingState: 'transcript_ready',
  });
}

export function flagTranscript(setClients, clientId, sectionKey, flagged) {
  patchSection(setClients, clientId, sectionKey, { transcriptFlagged: flagged });
}

// ─── Consent ────────────────────────────────────────────────────────────────

export function grantConsent(setClients, clientId) {
  patchSession(setClients, clientId, {
    consentGranted: true,
    consentGrantedAt: new Date().toISOString(),
  });
}

// ─── Draft / Approval ────────────────────────────────────────────────────────

export function setDraftContent(setClients, clientId, sectionKey, content, draftState, aiOriginal, promptHash) {
  patchSection(setClients, clientId, sectionKey, {
    draftContent: content,
    draftState,
    aiOriginalContent: aiOriginal ?? content,
    // Fingerprint of the inputs this draft was generated from, so we can later
    // detect when the form data changed and only that section needs a re-run.
    // undefined → don't touch the stored hash (callers that don't generate).
    ...(promptHash !== undefined ? { generatedPromptHash: promptHash } : {}),
  });
}

export function setApprovalState(setClients, clientId, sectionKey, state) {
  patchSection(setClients, clientId, sectionKey, { approvalState: state });
}

export function markSectionEdited(setClients, clientId, sectionKey) {
  patchSection(setClients, clientId, sectionKey, {
    approvalState: 'edited',
    editedAt: new Date().toISOString(),
    wasEdited: true,
  });
}

export function revertToAiOriginal(setClients, clientId, sectionKey) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const updated = {
      ...section,
      draftContent: section.aiOriginalContent,
      approvalState: 'pending',
      // Preserve edit history — wasEdited/editedAt intentionally kept
    };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, sectionKey, updated);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

// ─── completionState helpers ──────────────────────────────────────────────────

// ─── STO presence helpers ─────────────────────────────────────────────────────
// An entry "has an STO" only when the BCBA has entered real data — the app never
// fabricates one (CLAUDE.md rule 6, HIPAA-facing accuracy). The recognized STO
// field set differs per goal section.

/** Skill goal: multi-step OR any structured/free-text STO field. */
export function skillGoalHasSTO(g) {
  if (!g) return false;
  return (g.stoSteps ?? []).length > 0 ||
    hasValue(g.stoPercent) || hasValue(g.stoSkillDescription) ||
    hasValue(g.stoWeeks) || hasValue(g.sto);
}

/** Behavior target: STO is expressed only via stoSteps[{targetFrequency,…}]. */
export function behaviorTargetHasSTO(t) {
  if (!t) return false;
  return (t.stoSteps ?? []).some(s => s.targetFrequency !== '' && s.targetFrequency != null);
}

/** Caregiver target: multi-step OR legacy stoPercent/stoWeeks/free-text. */
export function caregiverTargetHasSTO(t) {
  if (!t) return false;
  return (t.stoSteps ?? []).some(s => s.targetPercent !== '' && s.targetPercent != null) ||
    hasValue(t.stoPercent) || hasValue(t.stoWeeks) || hasValue(t.sto);
}

function skillGoalCompletionState(goals) {
  if (!goals || goals.length === 0) return 'empty';
  const allComplete = goals.every(g =>
    g.targetSkill?.trim() && g.operationalDefinition?.trim() && g.masteryCriteriaPercent &&
    skillGoalHasSTO(g)
  );
  return allComplete ? 'complete' : 'partial';
}

function behaviorTargetCompletionState(targets) {
  if (!targets || targets.length === 0) return 'empty';
  const allComplete = targets.every(t =>
    t.behaviorName?.trim() && t.operationalDefinition?.trim() &&
    t.hypothesizedFunction?.trim() && t.baselineFrequency &&
    behaviorTargetHasSTO(t)
  );
  return allComplete ? 'complete' : 'partial';
}

function caregiverTargetsComplete(targets) {
  if (!targets || targets.length === 0) return false;
  return targets.every(t =>
    t.goalName?.trim() && t.operationalDefinition?.trim() &&
    hasValue(t.baselinePercent) && hasValue(t.ltoPercent) && hasValue(t.ltoSessions) &&
    caregiverTargetHasSTO(t)
  );
}

/** True for a non-empty string, non-empty array, or any other non-null/undefined value. */
function hasValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Derive empty/partial/complete from a flags object. A flag of null/undefined
 * means "not applicable" (e.g. a detail field whose gating toggle is off) and
 * is excluded from the count, so turning a gate off never blocks completion.
 */
function deriveCompletionState(flags) {
  const applicable = Object.values(flags).filter(v => v !== null && v !== undefined);
  if (applicable.length === 0) return 'empty';
  const filled = applicable.filter(Boolean).length;
  if (filled === 0) return 'empty';
  if (filled === applicable.length) return 'complete';
  return 'partial';
}

function communicationCompletionFlags(s) {
  const modes    = s.primaryCommunicationModes ?? [];
  const hasVerbal = modes.includes('Verbal');
  const hasAAC    = modes.includes('AAC Device');
  const hasPECS   = modes.includes('PECS');
  return {
    primaryCommunicationModes: hasValue(modes),
    mluWords:                  hasVerbal ? hasValue(s.mluWords) : null,
    intelligibilityFamiliar:   hasVerbal ? hasValue(s.intelligibilityFamiliar) : null,
    intelligibilityUnfamiliar: hasVerbal ? hasValue(s.intelligibilityUnfamiliar) : null,
    aacSystem:                 hasAAC ? hasValue(s.aacSystem) : null,
    aacPhase:                  hasAAC ? hasValue(s.aacPhase) : null,
    pecsPhase:                 hasPECS ? hasValue(s.pecsPhase) : null,
    functionalRepertoire:      hasValue(s.functionalRepertoire),
    receptiveSingleStep:       hasValue(s.receptiveSingleStep),
    receptiveTwoStep:          hasValue(s.receptiveTwoStep),
    eyeContact:                hasValue(s.eyeContact),
    initiatesCommunication:    hasValue(s.initiatesCommunication),
    turnTaking:                hasValue(s.turnTaking),
    slpFrequencyPerWeek:       s.slpServices ? hasValue(s.slpFrequencyPerWeek) : null,
    slpFocus:                  s.slpServices ? hasValue(s.slpFocus) : null,
    notes:                     hasValue(s.notes),
  };
}

// envSafety and medical contraindication checklists are informational — an
// empty checklist is a valid clinical answer ("none apply"), not missing data.
function safetyCompletionFlags(s) {
  return {
    riskLevel:                hasValue(s.riskLevel),
    sibTopography:            s.sibPresent ? hasValue(s.sibTopography) : null,
    sibFrequency:             s.sibPresent ? hasValue(s.sibFrequency) : null,
    sibInjuryNotes:           (s.sibPresent && s.sibInjuryHistory) ? hasValue(s.sibInjuryNotes) : null,
    aggressionTopography:     s.aggressionPresent ? hasValue(s.aggressionTopography) : null,
    aggressionTargets:        s.aggressionPresent ? hasValue(s.aggressionTargets) : null,
    aggressionFrequency:      s.aggressionPresent ? hasValue(s.aggressionFrequency) : null,
    aggressionInjuryNotes:    (s.aggressionPresent && s.aggressionInjuryHistory) ? hasValue(s.aggressionInjuryNotes) : null,
    elopementNotes:           s.elopementPresent ? hasValue(s.elopementNotes) : null,
    propertyDestructionNotes: s.propertyDestructionPresent ? hasValue(s.propertyDestructionNotes) : null,
    priorIncidentNotes:       (s.lawEnforcementInvolvement || s.hospitalizationHistory) ? hasValue(s.priorIncidentNotes) : null,
    notes:                    hasValue(s.notes),
  };
}

function medicalNecessityCompletionFlags(s) {
  return {
    priorABAHistory:         s.hasPriorABA ? hasValue(s.priorABAHistory) : null,
    recommendedHoursPerWeek: hasValue(s.recommendedHoursPerWeek),
    recommendedSetting:      hasValue(s.recommendedSetting),
    notes:                   hasValue(s.notes),
  };
}

function caregiverTrainingCompletionFlags(s) {
  return {
    trainingFormat:           hasValue(s.trainingFormat),
    trainingFrequency:        hasValue(s.trainingFrequency),
    trainingBarriers:         hasValue(s.trainingBarriers),
    caregiverStrengths:       hasValue(s.caregiverStrengths),
    caregiverTrainingTargets: caregiverTargetsComplete(s.caregiverTrainingTargets),
    notes:                    hasValue(s.notes),
  };
}

function crisisPlanCompletionFlags(s) {
  return {
    emergencyContacts:   (s.emergencyContacts ?? []).some(c => c.name?.trim()),
    warningSigns:        hasValue(s.warningSignsSelected) || hasValue(s.warningSignsCustom),
    deEscalationWorks:   hasValue(s.deEscalationWorks),
    deEscalationWorsens: hasValue(s.deEscalationWorsens),
    deEscalationNotes:   hasValue(s.deEscalationNotes),
    bcbaCallMinutes:     hasValue(s.bcbaCallMinutes),
    bcbaCallIncidents:   hasValue(s.bcbaCallIncidents),
    bcbaCallWindow:      hasValue(s.bcbaCallWindow),
    call911Notes:        s.call911Threshold ? hasValue(s.call911Notes) : null,
    sessionSuspendNotes: s.sessionSuspendThreshold ? hasValue(s.sessionSuspendNotes) : null,
    baselineReturnMin:   hasValue(s.baselineReturnMin),
    baselineReturnMax:   hasValue(s.baselineReturnMax),
    remorseNotes:        s.remorsePresentPostCrisis ? hasValue(s.remorseNotes) : null,
    notes:               hasValue(s.notes),
  };
}

const NOTES_ONLY_SECTIONS = new Set(['presenting_concerns', 'self_help', 'daily_living', 'self_stim']);

/**
 * Central dispatcher for section completionState, called from patchSection
 * and the caregiver-training-target CRUD helpers below. Returns undefined for
 * sections whose completionState is owned elsewhere (demographics is set at
 * intake auto-population; skill_acquisitions/behavior_targets own their state
 * via skillGoalCompletionState/behaviorTargetCompletionState) — callers must
 * leave those sections' completionState untouched.
 */
function computeSectionCompletionState(sectionKey, section) {
  const s = section ?? {};
  if (NOTES_ONLY_SECTIONS.has(sectionKey)) {
    return deriveCompletionState({ notes: hasValue(s.notes) });
  }
  switch (sectionKey) {
    case 'communication':      return deriveCompletionState(communicationCompletionFlags(s));
    case 'safety':             return deriveCompletionState(safetyCompletionFlags(s));
    case 'medical_necessity':  return deriveCompletionState(medicalNecessityCompletionFlags(s));
    case 'caregiver_training': return deriveCompletionState(caregiverTrainingCompletionFlags(s));
    case 'crisis_plan':        return deriveCompletionState(crisisPlanCompletionFlags(s));
    default:                   return undefined;
  }
}

// ─── Skill Goals ─────────────────────────────────────────────────────────────

const SKILL_GOAL_DEFAULTS = {
  targetSkill: '',
  operationalDefinition: '',
  definitionIsAiGenerated: false,
  definitionIsLoading: false,
  teachingStrategies: [],
  teachingStrategiesOther: '',
  promptingLevel: null,
  promptingLevelCombination: '',
  baselinePercent: '',
  baselineOpportunities: '',
  baselinePromptingDesc: '',
  baselinePromptingLevel: '',      // inline sentence selector
  masteryCriteriaPercent: '',
  masteryCriteriaSessions: '',
  masteryCriteriaSettings: '',
  masteryCriteriaPrompting: '',
  masteryCriteriaPromptingLevel: '', // inline sentence selector
  sto: '',                           // short-term objective (6-month target)
  currentLevel: '',                  // current performance level (overridable)
  generalizationNotes: '',
  // ── Change #6 fields ──────────────────────────────────────────────────────
  domain: '',                        // Communication | Social | Adaptive / Self-Help | Academic | Motor | Play
  stoPercent: '',                    // STO accuracy target (%) — legacy single-step fallback
  stoSkillDescription: '',           // free-text description of the STO skill/step — legacy fallback
  stoWeeks: '',                      // weeks from program start to hit the STO — legacy fallback
  stoSteps: [],                      // [{ id, targetPercent, skillDescription, durationWeeks }] — BCBA-defined STO milestones
};

export function addSkillGoal(setClients, clientId) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections['skill_acquisitions'];
    const newGoal = { id: crypto.randomUUID(), ...SKILL_GOAL_DEFAULTS };
    const updatedGoals = [...(section.skillGoals || []), newGoal];
    const updatedSection = {
      ...section,
      skillGoals: updatedGoals,
      completionState: skillGoalCompletionState(updatedGoals),
    };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, 'skill_acquisitions', updatedSection);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

export function updateSkillGoal(setClients, clientId, goalId, patch) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).map(g =>
      g.id === goalId ? { ...g, ...patch } : g
    );
    const updatedSection = { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, 'skill_acquisitions', updatedSection);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

export function removeSkillGoal(setClients, clientId, goalId) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).filter(g => g.id !== goalId);
    const updatedSection = { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, 'skill_acquisitions', updatedSection);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

export function reorderSkillGoals(setClients, clientId, fromIndex, toIndex) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections['skill_acquisitions'];
    const goals = [...(section.skillGoals || [])];
    const [moved] = goals.splice(fromIndex, 1);
    goals.splice(toIndex, 0, moved);
    const updatedSection = { ...section, skillGoals: goals };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, 'skill_acquisitions', updatedSection);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

// ─── Behavior Targets ────────────────────────────────────────────────────────

const BEHAVIOR_TARGET_DEFAULTS = {
  behaviorName:          '',
  operationalDefinition: '',
  topography:            [],          // checklist
  frequencyPerDay:       '',
  frequencyUnit:         'day',       // 'day' | 'session' | 'week'
  durationSeconds:       '',
  durationUnit:          'seconds',   // 'seconds' | 'minutes'
  intensityRating:       '',          // 'Mild' | 'Moderate' | 'Severe'
  antecedents:           '',
  primaryTargets:        [],          // ['Self','Parent','Sibling','Peers','Staff']
  hypothesizedFunction:  '',          // 'Escape' | 'Attention' | 'Access' | 'Automatic'
  baselineFrequency:     '',
  targetFrequency:       '',
  stoSteps:              [],          // [{ id, targetFrequency, durationWeeks, note }] — BCBA-defined STO milestones
  measurementSystem:     '',          // 'Event Recording' | 'Duration Recording' | 'Interval Recording' | 'ABC'
  priorFBACompleted:     false,
  priorBIPCompleted:     false,
  notes:                 '',
};

export function addBehaviorTarget(setClients, clientId) {
  let sessionId, persistPatch;
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section   = client.assessment_session.sections['behavior_targets'];
    const newTarget = { id: crypto.randomUUID(), ...BEHAVIOR_TARGET_DEFAULTS };
    const updatedTargets = [...(section.behaviorTargets || []), newTarget];
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const { finalSession, persistPatch: pp } = _buildSectionUpdate(c.assessment_session, 'behavior_targets', updated);
      sessionId = finalSession.id;
      persistPatch = pp;
      return { ...c, assessment_session: finalSession };
    });
  });
  _persist(sessionId, persistPatch);
}

export function updateBehaviorTarget(setClients, clientId, targetId, patch) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updatedTargets = (section.behaviorTargets || []).map(t => {
      if (t.id !== targetId) return t;
      // Baseline is a snapshot: capture the first real frequency value entered
      // and never overwrite it afterward, so it stays fixed as a comparison
      // point for the reduction goal even if frequency is edited later.
      const baselineFrequency = (t.baselineFrequency === '' || t.baselineFrequency == null) && patch.frequencyPerDay !== undefined && patch.frequencyPerDay !== ''
        ? patch.frequencyPerDay
        : t.baselineFrequency;
      return { ...t, ...patch, baselineFrequency };
    });
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'behavior_targets', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function removeBehaviorTarget(setClients, clientId, targetId) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updatedTargets = (section.behaviorTargets || []).filter(t => t.id !== targetId);
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'behavior_targets', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

// ─── Behavior Target STO Steps ───────────────────────────────────────────────

export function addBehaviorStoStep(setClients, clientId, targetId) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updatedTargets = (section.behaviorTargets || []).map(t => {
      if (t.id !== targetId) return t;
      const newStep = { id: crypto.randomUUID(), targetFrequency: '', durationWeeks: '', note: '' };
      return { ...t, stoSteps: [...(t.stoSteps ?? []), newStep] };
    });
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'behavior_targets', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function updateBehaviorStoStep(setClients, clientId, targetId, stepId, field, value) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updatedTargets = (section.behaviorTargets || []).map(t => {
      if (t.id !== targetId) return t;
      const updatedSteps = (t.stoSteps ?? []).map(s => s.id === stepId ? { ...s, [field]: value } : s);
      return { ...t, stoSteps: updatedSteps };
    });
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'behavior_targets', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function removeBehaviorStoStep(setClients, clientId, targetId, stepId) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updatedTargets = (section.behaviorTargets || []).map(t => {
      if (t.id !== targetId) return t;
      return { ...t, stoSteps: (t.stoSteps ?? []).filter(s => s.id !== stepId) };
    });
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'behavior_targets', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

// ─── Skill Goal STO Steps ─────────────────────────────────────────────────────

export function addSkillStoStep(setClients, clientId, goalId) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).map(g => {
      if (g.id !== goalId) return g;
      const newStep = { id: crypto.randomUUID(), targetPercent: '', targetSessions: '', skillDescription: '', durationWeeks: '' };
      return { ...g, stoSteps: [...(g.stoSteps ?? []), newStep] };
    });
    const updated = { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'skill_acquisitions', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function updateSkillStoStep(setClients, clientId, goalId, stepId, field, value) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).map(g => {
      if (g.id !== goalId) return g;
      const updatedSteps = (g.stoSteps ?? []).map(s => s.id === stepId ? { ...s, [field]: value } : s);
      return { ...g, stoSteps: updatedSteps };
    });
    const updated = { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'skill_acquisitions', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function removeSkillStoStep(setClients, clientId, goalId, stepId) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).map(g => {
      if (g.id !== goalId) return g;
      return { ...g, stoSteps: (g.stoSteps ?? []).filter(s => s.id !== stepId) };
    });
    const updated = { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'skill_acquisitions', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

// ─── Client Profile ──────────────────────────────────────────────────────────

export function updateClientProfile(setClients, clientId, patch) {
  let sessionId;
  let mergedProfile;

  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    sessionId = c.assessment_session?.id;
    mergedProfile = {
      ...c.assessment_session.clientProfile,
      ...patch,
    };
    return {
      ...c,
      assessment_session: {
        ...c.assessment_session,
        clientProfile: mergedProfile,
        updatedAt: new Date().toISOString(),
      },
    };
  }));

  _persist(sessionId, { clientProfile: mergedProfile });
}

export function updateClientName(setClients, clientId, name) {
  let sessionId;

  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    sessionId = c.assessment_session?.id;
    return {
      ...c,
      assessment_session: {
        ...c.assessment_session,
        clientName: name,
        updatedAt: new Date().toISOString(),
      },
    };
  }));

  _persist(sessionId, { clientName: name });
}

// ─── Session Completion ──────────────────────────────────────────────────────

export function completeSession(setClients, clientId, result) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;

    const session = c.assessment_session;
    const completedSession = {
      ...session,
      status: 'complete',
      result,
      updatedAt: new Date().toISOString(),
    };

    // Update checklist fields derived from the result
    const planDraftChecklist = {
      ...c.checklist?.plan_draft,
      medical_necessity: !!(result?.sections?.medical_necessity?.content),
      skill_targets: !!(
        result?.sections?.skill_acquisitions?.skillGoals?.length ||
        result?.sections?.skill_acquisitions?.content
      ),
      behavior_goals: !!(result?.sections?.behavior_targets?.content),
    };

    return {
      ...c,
      smart_assessment_session_id: session.id,
      checklist: {
        ...c.checklist,
        assessment: {
          ...c.checklist?.assessment,
          smart_assessment_submitted: true,
        },
        plan_draft: planDraftChecklist,
      },
      assessment_session: completedSession,
    };
  }));
}

// ─── Cloud document backup ───────────────────────────────────────────────────

/**
 * Append a Storage-backed document record to the session and persist it.
 *
 * Called from a Storage-upload `.then()` callback (outside React's
 * synchronous event-batching), so `sessionId` and the resulting `documents`
 * array must be supplied by the caller rather than captured from inside the
 * `setClients` updater below — that updater isn't guaranteed to run before
 * this function returns when invoked from a plain Promise callback.
 */
export function addSessionDocument(setClients, clientId, sessionId, updatedDocuments) {
  setClients(prev => prev.map(c => (
    c.id !== clientId ? c : {
      ...c,
      assessment_session: {
        ...c.assessment_session,
        documents: updatedDocuments,
        updatedAt: new Date().toISOString(),
      },
    }
  )));

  _persist(sessionId, { documents: updatedDocuments });
}

// ─── Export readiness ────────────────────────────────────────────────────────

// Sections excluded from the export gate — demographics has no standalone approve path
const EXPORT_EXCLUDED = new Set(['demographics']);

/**
 * Every goal-section entry that exists but lacks a BCBA-defined STO. Iterates
 * ONLY existing entries: a section with an empty entries array contributes
 * nothing, so a client with (e.g.) only behaviors + caregiver is never blocked
 * for skills. Returns [{ sectionLabel, entryName }] for the UI to name offenders.
 */
export function sectionsMissingSTO(session) {
  const sections = session?.sections;
  if (!sections) return [];
  const out = [];

  (sections.skill_acquisitions?.skillGoals ?? []).forEach(g => {
    if (!skillGoalHasSTO(g)) {
      out.push({ sectionLabel: 'Skill Acquisitions', entryName: g.targetSkill?.trim() || 'Unnamed goal' });
    }
  });

  (sections.behavior_targets?.behaviorTargets ?? []).forEach(t => {
    if (!behaviorTargetHasSTO(t)) {
      out.push({ sectionLabel: 'Maladaptive Behaviors', entryName: t.behaviorName?.trim() || 'Unnamed behavior' });
    }
  });

  (sections.caregiver_training?.caregiverTrainingTargets ?? []).forEach(t => {
    if (!caregiverTargetHasSTO(t)) {
      out.push({ sectionLabel: 'Caregiver Training', entryName: t.goalName?.trim() || 'Unnamed goal' });
    }
  });

  return out;
}

/**
 * Sections whose form inputs changed since their AI draft was generated.
 *
 * Compares the current per-section prompt fingerprint against the
 * `generatedPromptHash` stored when the draft was last (re)generated. Only a
 * section that (a) already has draft content and (b) has a stored fingerprint
 * that no longer matches qualifies — so legacy drafts (no stored hash) and
 * never-generated sections never nag. Returns [{ key, title }] for the UI.
 */
export function sectionsWithChanges(session) {
  if (!session?.sections) return [];
  const currentHashes = sectionPromptHashes(session);
  const out = [];
  for (const [key, section] of Object.entries(session.sections)) {
    if (EXPORT_EXCLUDED.has(key)) continue;
    const hasDraft = !!(section?.draftContent?.trim());
    const storedHash = section?.generatedPromptHash;
    if (!hasDraft || storedHash == null) continue;
    if (currentHashes[key] !== storedHash) {
      out.push({ key, title: SECTION_TITLES[key] ?? key });
    }
  }
  return out;
}

/**
 * One-time migration for drafts generated before change-detection existed.
 *
 * Any section that already has draft content but no stored input fingerprint
 * gets one stamped from its CURRENT inputs — establishing the existing draft as
 * the baseline so future edits flag correctly. Costs zero tokens (no AI call),
 * and is idempotent: once every draft-bearing section has a hash, it no-ops.
 *
 * Absorbs any edits made before the backfill into the baseline (they won't
 * flag); only edits made AFTER stamping will surface as "changes available".
 *
 * @returns {number} how many sections were stamped (0 if nothing to do).
 */
export function backfillPromptHashes(setClients, clientId) {
  let sessionId, persistPatch, stamped = 0;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const s = c.assessment_session;
    if (!s?.sections) return c;

    const currentHashes = sectionPromptHashes(s);
    const updatedSections = { ...s.sections };
    let changed = false;
    for (const [key, sec] of Object.entries(s.sections)) {
      const hasDraft = !!(sec?.draftContent?.trim());
      if (hasDraft && sec?.generatedPromptHash == null) {
        updatedSections[key] = { ...sec, generatedPromptHash: currentHashes[key] ?? null };
        changed = true;
        stamped++;
      }
    }
    if (!changed) return c;

    const updatedSession = { ...s, sections: updatedSections, updatedAt: new Date().toISOString() };
    sessionId = updatedSession.id;
    persistPatch = { sections: updatedSession.sections };

    const updatedReassessmentSessions = (c.reassessment_sessions ?? []).map(rs =>
      rs.id === updatedSession.id ? updatedSession : rs,
    );
    return { ...c, assessment_session: updatedSession, reassessment_sessions: updatedReassessmentSessions };
  }));

  if (sessionId) _persist(sessionId, persistPatch);
  return stamped;
}

export function canExport(client) {
  const session = client?.assessment_session;
  if (!session) return false;
  // Hard gate: never export while any existing goal entry lacks a real STO.
  if (sectionsMissingSTO(session).length > 0) return false;
  return Object.entries(session.sections)
    .filter(([key]) => !EXPORT_EXCLUDED.has(key))
    .every(([, s]) => s.approvalState === 'approved' || s.approvalState === 'skipped');
}

// ─── STO helper ──────────────────────────────────────────────────────────────

export function computeStoPercent(baselinePercent) {
  const b = Number(baselinePercent);
  if (isNaN(b)) return null;
  let sto;
  if (b < 50) {
    sto = b + 30;
  } else {
    sto = Math.round((b + (100 - b) * 0.5) / 5) * 5;
  }
  return Math.min(sto, 100);
}

// ─── Caregiver Training Targets ───────────────────────────────────────────────

const CAREGIVER_TRAINING_TARGET_DEFAULTS = {
  goalName:              '',
  operationalDefinition: '',
  baselinePercent:       null,
  baselineContext:       '',
  stoSteps:              [],
  ltoPercent:            null,
  ltoSessions:           null,
  lto:                   '',
  isStandard:            false,
  standardKey:           null,
};

export function addCaregiverTrainingTarget(clientId, clients, setClients) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session  = c.assessment_session;
    const section  = session.sections['caregiver_training'];
    const newTarget = { id: crypto.randomUUID(), ...CAREGIVER_TRAINING_TARGET_DEFAULTS };
    const updatedTargets = [...(section.caregiverTrainingTargets ?? []), newTarget];
    const updated  = {
      ...section,
      caregiverTrainingTargets: updatedTargets,
      completionState: computeSectionCompletionState('caregiver_training', { ...section, caregiverTrainingTargets: updatedTargets }),
    };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'caregiver_training', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function updateCaregiverTrainingTarget(clientId, targetId, field, value, clients, setClients) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session  = c.assessment_session;
    const section  = session.sections['caregiver_training'];
    const updatedTargets = (section.caregiverTrainingTargets ?? []).map(t =>
      t.id === targetId ? { ...t, [field]: value } : t,
    );
    const updated = {
      ...section,
      caregiverTrainingTargets: updatedTargets,
      completionState: computeSectionCompletionState('caregiver_training', { ...section, caregiverTrainingTargets: updatedTargets }),
    };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'caregiver_training', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function removeCaregiverTrainingTarget(clientId, targetId, clients, setClients) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session  = c.assessment_session;
    const section  = session.sections['caregiver_training'];
    const updatedTargets = (section.caregiverTrainingTargets ?? []).filter(t => t.isStandard || t.id !== targetId);
    const updated = {
      ...section,
      caregiverTrainingTargets: updatedTargets,
      completionState: computeSectionCompletionState('caregiver_training', { ...section, caregiverTrainingTargets: updatedTargets }),
    };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'caregiver_training', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

// ─── Caregiver Training STO Steps ────────────────────────────────────────────

export function addCaregiverStoStep(setClients, clientId, targetId) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['caregiver_training'];
    const updatedTargets = (section.caregiverTrainingTargets ?? []).map(t => {
      if (t.id !== targetId) return t;
      const newStep = { id: crypto.randomUUID(), targetPercent: '', durationWeeks: '', note: '' };
      return { ...t, stoSteps: [...(t.stoSteps ?? []), newStep] };
    });
    const updated = {
      ...section,
      caregiverTrainingTargets: updatedTargets,
      completionState: computeSectionCompletionState('caregiver_training', { ...section, caregiverTrainingTargets: updatedTargets }),
    };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'caregiver_training', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function updateCaregiverStoStep(setClients, clientId, targetId, stepId, field, value) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['caregiver_training'];
    const updatedTargets = (section.caregiverTrainingTargets ?? []).map(t => {
      if (t.id !== targetId) return t;
      const updatedSteps = (t.stoSteps ?? []).map(s => s.id === stepId ? { ...s, [field]: value } : s);
      return { ...t, stoSteps: updatedSteps };
    });
    const updated = {
      ...section,
      caregiverTrainingTargets: updatedTargets,
      completionState: computeSectionCompletionState('caregiver_training', { ...section, caregiverTrainingTargets: updatedTargets }),
    };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'caregiver_training', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

export function removeCaregiverStoStep(setClients, clientId, targetId, stepId) {
  let sessionId, persistPatch;
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['caregiver_training'];
    const updatedTargets = (section.caregiverTrainingTargets ?? []).map(t => {
      if (t.id !== targetId) return t;
      return { ...t, stoSteps: (t.stoSteps ?? []).filter(s => s.id !== stepId) };
    });
    const updated = {
      ...section,
      caregiverTrainingTargets: updatedTargets,
      completionState: computeSectionCompletionState('caregiver_training', { ...section, caregiverTrainingTargets: updatedTargets }),
    };
    const { finalSession, persistPatch: pp } = _buildSectionUpdate(session, 'caregiver_training', updated);
    sessionId = finalSession.id;
    persistPatch = pp;
    return { ...c, assessment_session: finalSession };
  }));
  _persist(sessionId, persistPatch);
}

// ─── Caregiver Training Session Logs ─────────────────────────────────────────

export function addCaregiverTrainingSessionLog(clientId, newLog, clients, setClients) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    return {
      ...c,
      caregiver_training_session_logs: [
        ...(c.caregiver_training_session_logs ?? []),
        newLog,
      ],
    };
  }));
}

// ─── Session listing ──────────────────────────────────────────────────────────

export function getClientSessions(client) {
  const sessions = [];
  if (client?.assessment_session) {
    sessions.push({
      ...client.assessment_session,
      sessionType: 'initial',
      clientId: client.id,
    });
  }
  for (const s of (client?.reassessment_sessions ?? [])) {
    sessions.push({
      ...s,
      sessionType: 'reassessment',
      clientId: client.id,
    });
  }
  return sessions;
}
