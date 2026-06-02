/**
 * graphBuilder.js
 *
 * Bridges an assessment_session object and the chartRenderer functions.
 * Reads all structured data, calls the renderers, and returns a flat map:
 *   { [graphKey: string]: base64PNGString }
 *
 * NOTE — field name discrepancies corrected from spec:
 *
 *   behavior data:  session.sections.behavior_targets.INDICATORS is antecedent-only tags.
 *                   Actual behavior data lives in .behaviorTargets[].
 *                   Fields used: bt.behaviorName, bt.baselineFrequency.
 *
 *   caregiver data: spec used ct.premackPercent / ct.reinforcementPercent.
 *                   Actual fields: ct.caregiverBaselines.premack_baseline
 *                                  ct.caregiverBaselines.reinforcement_baseline
 */

import {
  renderMaladaptiveBehaviorChart,
  renderSTOTrajectoryChart,
  renderReplacementBehaviorChart,
  renderCaregiverTrainingChart,
} from './chartRenderer.js';

// ─── Key normalizer ───────────────────────────────────────────────────────────

const normalize = (label) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ─── buildGraphsFromSession ───────────────────────────────────────────────────

/**
 * @param {object} session  Full assessment_session (makeAssessmentSession shape).
 * @returns {Promise<Record<string, string>>}  Map of graphKey → base64 PNG string.
 */
export async function buildGraphsFromSession(session) {
  const result = {};

  // ── Step 1 & 2 — Maladaptive behavior charts + STO trajectories ─────────────
  //
  // Data source: session.sections.behavior_targets.behaviorTargets[]
  //   bt.behaviorName      — behavior label
  //   bt.baselineFrequency — frequency count at assessment (string or number)
  //
  // (session.sections.behavior_targets.indicators contains only antecedent
  //  context tags, all prefixed "Antecedent:"; not used for charts.)

  const behaviorTargets =
    session?.sections?.behavior_targets?.behaviorTargets ?? [];

  // Mastery date helper — today + N months
  const today = new Date();
  const masteryDates = Array.from({ length: 9 }, (_, i) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + i + 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

  for (const bt of behaviorTargets) {
    const name = (bt.behaviorName || '').trim();
    if (!name) continue;

    const baselineCount = parseFloat(bt.baselineFrequency) || 0;
    const observationData = [baselineCount]; // single baseline point at assessment time

    // Step 1 — baseline frequency bar chart
    const graphKey = `behavior_${normalize(name)}`;
    try {
      result[graphKey] = renderMaladaptiveBehaviorChart(
        name,
        baselineCount,
        observationData,
      );
    } catch (err) {
      console.warn(`Chart failed: ${graphKey}`, err);
    }

    // Step 2 — STO reduction trajectory line chart
    const stoKey = `sto_${normalize(name)}`;
    try {
      result[stoKey] = renderSTOTrajectoryChart(name, baselineCount, masteryDates);
    } catch (err) {
      console.warn(`Chart failed: ${stoKey}`, err);
    }
  }

  // ── Step 3 — Replacement behavior baseline vs mastery chart ─────────────────
  //
  // Data source: session.sections.skill_acquisitions.skillGoals[]
  //   g.targetSkill            — skill name
  //   g.baselinePercent        — observed baseline %
  //   g.masteryCriteriaPercent — target mastery %

  const skillGoals =
    session?.sections?.skill_acquisitions?.skillGoals ?? [];

  const filteredGoals = skillGoals.filter(
    g => g.targetSkill && g.targetSkill.trim(),
  );

  if (filteredGoals.length > 0) {
    const skillTargets = filteredGoals.map(g => ({
      targetSkill:            g.targetSkill,
      baselinePercent:        g.baselinePercent        ?? '0',
      masteryCriteriaPercent: g.masteryCriteriaPercent ?? '80',
    }));

    try {
      result['replacement_behaviors'] = renderReplacementBehaviorChart(skillTargets);
    } catch (err) {
      console.warn('Chart failed: replacement_behaviors', err);
    }
  }

  // ── Step 4 — Caregiver training skill baseline charts ────────────────────────
  //
  // Data source: session.sections.caregiver_training.caregiverBaselines
  //   .premack_baseline      — % correct Premack (first/then) observed at assessment
  //   .reinforcement_baseline — % correct reinforcement delivery observed
  //
  // NOTE: spec referenced ct.premackPercent / ct.reinforcementPercent — those
  // fields do not exist. Actual paths confirmed from seedData.js and
  // CaregiverTrainingForm.jsx.

  const ct = session?.sections?.caregiver_training;
  if (ct) {
    const bl = ct.caregiverBaselines ?? {};

    const premack = bl.premack_baseline;
    if (premack !== '' && premack != null && parseFloat(premack) >= 0) {
      try {
        result['caregiver_premack'] = renderCaregiverTrainingChart(
          'Premack Principle',
          premack,
          [20, 40, 60, 80, 100],
        );
      } catch (err) {
        console.warn('Chart failed: caregiver_premack', err);
      }
    }

    const reinforcement = bl.reinforcement_baseline;
    if (reinforcement !== '' && reinforcement != null && parseFloat(reinforcement) >= 0) {
      try {
        result['caregiver_reinforcement'] = renderCaregiverTrainingChart(
          'Reinforcement Delivery',
          reinforcement,
          [20, 40, 60, 80, 100],
        );
      } catch (err) {
        console.warn('Chart failed: caregiver_reinforcement', err);
      }
    }
  }

  return result;
}
