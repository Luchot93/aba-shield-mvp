/**
 * assessmentStore.js
 *
 * All mutations to assessment_session live here. Every function takes
 * setClients (the React state setter from App.jsx) and operates immutably
 * on the clients array. Components import only what they need.
 */

import { makeReassessmentSession } from '../../constants/seedData.js';

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Recompute the three derived counters on assessment_session. */
function _recomputeCounts(session) {
  const sections = Object.values(session.sections);

  // Every section except demographics counts toward sectionsWithData
  const sectionsWithData = sections.filter(
    s => s.key !== 'demographics' && s.completionState !== 'empty'
  ).length;

  const sectionsApproved = sections.filter(
    s => s.key !== 'demographics' && (s.approvalState === 'approved' || s.approvalState === 'skipped')
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

/** Update a single client's assessment_session, merging patch at the top level. */
export function patchSession(setClients, clientId, patch) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    return {
      ...c,
      assessment_session: {
        ...c.assessment_session,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    };
  }));
}

/** Merge sectionPatch into a specific section and recompute derived counts. */
export function patchSection(setClients, clientId, sectionKey, sectionPatch) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;

    const session = c.assessment_session;
    const updatedSections = {
      ...session.sections,
      [sectionKey]: {
        ...session.sections[sectionKey],
        ...sectionPatch,
      },
    };

    const updatedSession = {
      ...session,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
    };

    const counts = _recomputeCounts(updatedSession);

    return {
      ...c,
      assessment_session: {
        ...updatedSession,
        ...counts,
      },
    };
  }));
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export function updateSectionNotes(setClients, clientId, sectionKey, notes) {
  patchSection(setClients, clientId, sectionKey, {
    notes,
    completionState: notes.trim() ? 'partial' : 'empty',
  });
}

// ─── Indicators ─────────────────────────────────────────────────────────────

export function updateIndicatorCount(setClients, clientId, sectionKey, indicatorId, delta) {
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const updatedIndicators = section.indicators.map(ind =>
      ind.id === indicatorId
        ? { ...ind, count: Math.max(0, ind.count + delta) }
        : ind
    );
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        [sectionKey]: { ...section, indicators: updatedIndicators },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

export function addCustomIndicator(setClients, clientId, sectionKey, label) {
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
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        [sectionKey]: { ...section, indicators: updatedIndicators },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

export function removeCustomIndicator(setClients, clientId, sectionKey, indicatorId) {
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const updatedIndicators = section.indicators.filter(ind => ind.id !== indicatorId);
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        [sectionKey]: { ...section, indicators: updatedIndicators },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

export function resetIndicator(setClients, clientId, sectionKey, indicatorId) {
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    const updatedIndicators = section.indicators.map(ind =>
      ind.id === indicatorId ? { ...ind, count: 0 } : ind
    );
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        [sectionKey]: { ...section, indicators: updatedIndicators },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
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

export function setDraftContent(setClients, clientId, sectionKey, content, draftState, aiOriginal) {
  patchSection(setClients, clientId, sectionKey, {
    draftContent: content,
    draftState,
    aiOriginalContent: aiOriginal ?? content,
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
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections[sectionKey];
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        [sectionKey]: {
          ...section,
          draftContent: section.aiOriginalContent,
          approvalState: 'pending',
          // Preserve edit history — wasEdited/editedAt intentionally kept
        },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

// ─── completionState helpers ──────────────────────────────────────────────────

function skillGoalCompletionState(goals) {
  if (!goals || goals.length === 0) return 'empty';
  const allComplete = goals.every(g =>
    g.targetSkill?.trim() && g.operationalDefinition?.trim() && g.masteryCriteriaPercent
  );
  return allComplete ? 'complete' : 'partial';
}

function behaviorTargetCompletionState(targets) {
  if (!targets || targets.length === 0) return 'empty';
  const allComplete = targets.every(t =>
    t.behaviorName?.trim() && t.operationalDefinition?.trim() &&
    t.hypothesizedFunction?.trim() && t.baselineFrequency
  );
  return allComplete ? 'complete' : 'partial';
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
      const session = c.assessment_session;
      const updatedSections = { ...session.sections, skill_acquisitions: updatedSection };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

export function updateSkillGoal(setClients, clientId, goalId, patch) {
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).map(g =>
      g.id === goalId ? { ...g, ...patch } : g
    );
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        skill_acquisitions: { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

export function removeSkillGoal(setClients, clientId, goalId) {
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).filter(g => g.id !== goalId);
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        skill_acquisitions: { ...section, skillGoals: updatedGoals },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

export function reorderSkillGoals(setClients, clientId, fromIndex, toIndex) {
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section = client.assessment_session.sections['skill_acquisitions'];
    const goals = [...(section.skillGoals || [])];
    const [moved] = goals.splice(fromIndex, 1);
    goals.splice(toIndex, 0, moved);
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = {
        ...session.sections,
        skill_acquisitions: { ...section, skillGoals: goals },
      };
      const updatedSession = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
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
  setClients(prev => {
    const client = prev.find(c => c.id === clientId);
    if (!client) return prev;
    const section   = client.assessment_session.sections['behavior_targets'];
    const newTarget = { id: crypto.randomUUID(), ...BEHAVIOR_TARGET_DEFAULTS };
    const updatedTargets = [...(section.behaviorTargets || []), newTarget];
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    return prev.map(c => {
      if (c.id !== clientId) return c;
      const session = c.assessment_session;
      const updatedSections = { ...session.sections, behavior_targets: updated };
      const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
      return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
    });
  });
}

export function updateBehaviorTarget(setClients, clientId, targetId, patch) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updatedTargets = (section.behaviorTargets || []).map(t =>
      t.id === targetId ? { ...t, ...patch } : t,
    );
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    const updatedSections = { ...session.sections, behavior_targets: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

export function removeBehaviorTarget(setClients, clientId, targetId) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updated = { ...section, behaviorTargets: (section.behaviorTargets || []).filter(t => t.id !== targetId) };
    const updatedSections = { ...session.sections, behavior_targets: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

// ─── Behavior Target STO Steps ───────────────────────────────────────────────

export function addBehaviorStoStep(setClients, clientId, targetId) {
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
    const updatedSections = { ...session.sections, behavior_targets: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

export function updateBehaviorStoStep(setClients, clientId, targetId, stepId, field, value) {
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
    const updatedSections = { ...session.sections, behavior_targets: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

export function removeBehaviorStoStep(setClients, clientId, targetId, stepId) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['behavior_targets'];
    const updatedTargets = (section.behaviorTargets || []).map(t => {
      if (t.id !== targetId) return t;
      return { ...t, stoSteps: (t.stoSteps ?? []).filter(s => s.id !== stepId) };
    });
    const updated = { ...section, behaviorTargets: updatedTargets, completionState: behaviorTargetCompletionState(updatedTargets) };
    const updatedSections = { ...session.sections, behavior_targets: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

// ─── Skill Goal STO Steps ─────────────────────────────────────────────────────

export function addSkillStoStep(setClients, clientId, goalId) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).map(g => {
      if (g.id !== goalId) return g;
      const newStep = { id: crypto.randomUUID(), targetPercent: '', skillDescription: '', durationWeeks: '' };
      return { ...g, stoSteps: [...(g.stoSteps ?? []), newStep] };
    });
    const updated = { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) };
    const updatedSections = { ...session.sections, skill_acquisitions: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

export function updateSkillStoStep(setClients, clientId, goalId, stepId, field, value) {
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
    const updatedSections = { ...session.sections, skill_acquisitions: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

export function removeSkillStoStep(setClients, clientId, goalId, stepId) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    const session = c.assessment_session;
    const section = session.sections['skill_acquisitions'];
    const updatedGoals = (section.skillGoals || []).map(g => {
      if (g.id !== goalId) return g;
      return { ...g, stoSteps: (g.stoSteps ?? []).filter(s => s.id !== stepId) };
    });
    const updated = { ...section, skillGoals: updatedGoals, completionState: skillGoalCompletionState(updatedGoals) };
    const updatedSections = { ...session.sections, skill_acquisitions: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

// ─── Client Profile ──────────────────────────────────────────────────────────

export function updateClientProfile(setClients, clientId, patch) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    return {
      ...c,
      assessment_session: {
        ...c.assessment_session,
        clientProfile: {
          ...c.assessment_session.clientProfile,
          ...patch,
        },
        updatedAt: new Date().toISOString(),
      },
    };
  }));
}

export function updateClientName(setClients, clientId, name) {
  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    return {
      ...c,
      assessment_session: {
        ...c.assessment_session,
        clientName: name,
        updatedAt: new Date().toISOString(),
      },
    };
  }));
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

// ─── Export readiness ────────────────────────────────────────────────────────

// Sections excluded from the export gate — demographics has no standalone approve path
const EXPORT_EXCLUDED = new Set(['demographics']);

export function canExport(client) {
  const session = client?.assessment_session;
  if (!session) return false;
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
  goalName:            '',
  operationalDefinition: '',
  baselinePercent:     null,
  baselineContext:     '',
  stoPercent:          null,
  stoWeeks:            null,
  sto:                 '',
  ltoPercent:          null,
  ltoSessions:         null,
  lto:                 '',
  isStandard:          false,
  standardKey:         null,
};

export function addCaregiverTrainingTarget(sessionId, clients, setClients) {
  setClients(prev => prev.map(c => {
    if (c.id !== sessionId) return c;
    const session  = c.assessment_session;
    const section  = session.sections['caregiver_training'];
    const newTarget = { id: crypto.randomUUID(), ...CAREGIVER_TRAINING_TARGET_DEFAULTS };
    const updated  = {
      ...section,
      caregiverTrainingTargets: [...(section.caregiverTrainingTargets ?? []), newTarget],
    };
    const updatedSections = { ...session.sections, caregiver_training: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

export function updateCaregiverTrainingTarget(sessionId, targetId, field, value, clients, setClients) {
  setClients(prev => prev.map(c => {
    if (c.id !== sessionId) return c;
    const session  = c.assessment_session;
    const section  = session.sections['caregiver_training'];
    const updatedTargets = (section.caregiverTrainingTargets ?? []).map(t =>
      t.id === targetId ? { ...t, [field]: value } : t,
    );
    const updated = { ...section, caregiverTrainingTargets: updatedTargets };
    const updatedSections = { ...session.sections, caregiver_training: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
}

export function removeCaregiverTrainingTarget(sessionId, targetId, clients, setClients) {
  setClients(prev => prev.map(c => {
    if (c.id !== sessionId) return c;
    const session  = c.assessment_session;
    const section  = session.sections['caregiver_training'];
    const updatedTargets = (section.caregiverTrainingTargets ?? []).filter(t => t.isStandard || t.id !== targetId);
    const updated = { ...section, caregiverTrainingTargets: updatedTargets };
    const updatedSections = { ...session.sections, caregiver_training: updated };
    const updatedSession  = { ...session, sections: updatedSections, updatedAt: new Date().toISOString() };
    return { ...c, assessment_session: { ...updatedSession, ..._recomputeCounts(updatedSession) } };
  }));
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

// ─── Reassessment ─────────────────────────────────────────────────────────────

export function createReassessmentSession(clientId, clients, setClients, bcbaId, bcbaName) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return null;

  const initialSession    = client.assessment_session;
  const sessionLogs       = client.service_session_logs ?? [];
  const authPeriodStart   = client.checklist?.submitted?.auth_start_date ?? null;
  const authPeriodEnd     = client.checklist?.submitted?.auth_end_date
    ?? client.auth_expiry_date
    ?? null;

  const newSession = makeReassessmentSession(
    client, initialSession, sessionLogs, authPeriodStart, authPeriodEnd,
  );

  setClients(prev => prev.map(c => {
    if (c.id !== clientId) return c;
    return {
      ...c,
      reassessment_sessions: [...(c.reassessment_sessions ?? []), newSession],
    };
  }));

  return newSession;
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
