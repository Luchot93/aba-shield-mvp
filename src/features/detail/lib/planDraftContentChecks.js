// Shared "does this Plan Draft section have real content yet?" predicates.
//
// These mirror the exact gating conditions already used by PlanDraftInlinePanel.jsx
// (empty-state messages) and PlanDraftPreview.jsx's CaregiverSummary, so the
// checklist (itemComplete, src/utils/checklist.js) and the review UI never disagree
// about whether a section is "real" vs. still a seeded placeholder.
//
// No chart.js / canvas dependency here on purpose — sessionHasGraphableContent
// mirrors graphBuilder.js's input-gating only (not the rendering), so importing
// this module (transitively, from itemComplete) never pulls chart.js into bundles
// that don't otherwise need it.

export function hasMedicalNecessityContent(section) {
  return !!section?.draftContent?.trim();
}

export function hasSkillTargetsContent(session) {
  return (session?.sections?.skill_acquisitions?.skillGoals ?? []).length > 0;
}

export function hasBehaviorGoalsContent(session) {
  return (session?.sections?.behavior_targets?.behaviorTargets ?? []).length > 0;
}

export function hasTeachingStrategies(goals) {
  return (goals ?? []).some(g => (g.teachingStrategies?.length ?? 0) > 0 || g.teachingStrategiesOther?.trim());
}

export function hasHypothesizedFunctions(behaviors) {
  return (behaviors ?? []).some(bt => bt.hypothesizedFunction?.trim());
}

export function hasInterventionStrategiesContent(session) {
  const goals     = session?.sections?.skill_acquisitions?.skillGoals ?? [];
  const behaviors = session?.sections?.behavior_targets?.behaviorTargets ?? [];
  return hasTeachingStrategies(goals) || hasHypothesizedFunctions(behaviors);
}

// Caregiver training always has 2 auto-seeded standard targets (Premack Principle,
// Reinforcement Delivery) with a goalName/operationalDefinition but no baseline/STO/LTO
// until a BCBA fills them in. A plain "targets.length > 0" check (what the panel's
// empty-state used) is always true and never reflects real BCBA input — so this checks
// the actual data fields CaregiverSummary renders, not just array presence.
export function hasCaregiverTrainingContent(section) {
  if (!section) return false;
  const { caregiverTrainingTargets, trainingFormat, trainingFrequency, trainingBarriers, caregiverStrengths, draftContent } = section;
  const targets = caregiverTrainingTargets ?? [];

  const hasRealTargetData = targets.some(t =>
    t.baselinePercent != null ||
    t.ltoPercent != null ||
    t.lto?.trim() ||
    t.sto?.trim() ||
    (t.stoSteps ?? []).some(s => s.targetPercent !== '' && s.targetPercent != null)
  );

  return (
    hasRealTargetData ||
    (trainingFormat?.length ?? 0) > 0 ||
    !!trainingFrequency ||
    !!trainingBarriers?.trim?.() ||
    !!caregiverStrengths?.trim?.() ||
    !!draftContent?.trim()
  );
}

// Mirrors buildGraphsFromSession's (graphBuilder.js) non-caregiver gating only:
// Step 1/2 (behaviorTargets with a non-empty behaviorName) and Step 3 (skillGoals
// with a non-empty targetSkill), plus the reassessment "included in plan" paths.
// Deliberately excludes Step 4 (caregiver charts) — those render unconditionally
// for the 2 seeded placeholder targets via a `parseFloat(...) || 0` fallback, so
// including them here would make this always true, same bug as the old
// 'smart_auto' => !!client.smart_assessment_session_id check. Caregiver completeness
// is already covered independently by hasCaregiverTrainingContent/the caregiver_training item.
export function sessionHasGraphableContent(session) {
  const behaviorTargets = session?.sections?.behavior_targets?.behaviorTargets ?? [];
  if (behaviorTargets.some(bt => (bt.behaviorName || '').trim())) return true;

  const skillGoals = session?.sections?.skill_acquisitions?.skillGoals ?? [];
  if (skillGoals.some(g => (g.targetSkill || '').trim())) return true;

  if (session?.sessionType === 'reassessment') {
    const newBehaviors = session.newBehaviorSummary ?? [];
    if (newBehaviors.some(item => item.includedInPlan === true && (item.behaviorName || '').trim())) return true;

    const newSkills = session.newSkillSummary ?? [];
    if (newSkills.some(item => item.includedInPlan === true && (item.skillName ?? item.bcbaGoalName ?? '').trim())) return true;
  }

  return false;
}
