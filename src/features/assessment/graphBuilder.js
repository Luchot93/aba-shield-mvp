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

import Chart from 'chart.js/auto';
import {
  createOffscreenCanvas,
  renderMaladaptiveBehaviorChart,
  renderSTOTrajectoryChart,
  renderReplacementBehaviorChart,
  renderCaregiverTrainingChart,
  renderSkillSTOChart,
  renderCaregiverSTOChart,
} from './chartRenderer.js';
import { computeStoPercent } from './assessmentStore.js';

// ─── buildBehaviorTrendFromLogs ───────────────────────────────────────────────

/**
 * Extracts per-session frequency data for a single behavior from RBT session logs.
 * @param {object[]} sessionLogs  Array of service_session_log objects.
 * @param {string}   behaviorId   ID of the behavior target to extract.
 * @returns {{ entries, baseline, average, percentReduction, trend }}
 */
export function buildBehaviorTrendFromLogs(sessionLogs, behaviorId) {
  const matched = (sessionLogs ?? [])
    .filter(log => (log.behaviorEntries ?? []).some(be => be.behaviorId === behaviorId))
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));

  const entries = matched.map((log, i) => {
    const be = log.behaviorEntries.find(be => be.behaviorId === behaviorId);
    return {
      sessionNumber:    i + 1,
      sessionDate:      log.sessionDate,
      frequency:        be?.sessionFrequency ?? be?.frequency ?? 0,
      currentStoNumber: be?.currentStoNumber ?? null,
      stoStatus:        be?.stoStatus ?? null,
    };
  });

  if (entries.length === 0) {
    return { entries: [], baseline: null, average: null, percentReduction: null, trend: 'flat' };
  }

  // Use the assessment baseline from the first matched log entry (not the first session frequency)
  const firstBe   = matched[0]?.behaviorEntries?.find(be => be.behaviorId === behaviorId);
  const baseline  = firstBe?.baselineFrequency ?? entries[0].frequency;
  const average   = entries.reduce((sum, e) => sum + e.frequency, 0) / entries.length;
  const percentReduction = baseline > 0 ? ((baseline - average) / baseline) * 100 : 0;
  const threshold = baseline * 0.05;
  const trend     = average < baseline - threshold ? 'improving'
    : average > baseline + threshold ? 'worsening'
    : 'flat';

  return { entries, baseline, average, percentReduction, trend };
}

// ─── renderCaregiverTrainingTargetChart ───────────────────────────────────────

/**
 * Single chart for one caregiver training target.
 * Bar at baseline %, horizontal reference lines at STO and LTO.
 * @param {object} target  A caregiverTrainingTarget object.
 * @param {object} [options]
 * @returns {string} base64 PNG
 */
export function renderCaregiverTrainingTargetChart(target, options = {}) {
  const bp = parseFloat(target.baselinePercent) || 0;
  const ltoPercent = target.ltoPercent != null ? parseFloat(target.ltoPercent) : 90;

  // If BCBA-defined STO steps exist, delegate to the trajectory line chart
  const validStoSteps = (target.stoSteps ?? []).filter(
    s => s.targetPercent !== '' && s.targetPercent != null,
  );
  if (validStoSteps.length > 0) {
    return renderCaregiverSTOChart(target.goalName || 'Caregiver Goal', bp, validStoSteps, ltoPercent);
  }

  // Legacy: single STO reference line chart
  const stoPercent = target.stoPercent != null
    ? parseFloat(target.stoPercent)
    : (computeStoPercent(bp) ?? bp);

  // Y-axis ticks: [0, baseline, STO, LTO, 100] — deduplicated and sorted
  const tickSet = new Set([0, Math.round(bp), Math.round(stoPercent), Math.round(ltoPercent), 100]);
  const tickValues = [...tickSet].sort((a, b) => a - b);

  // Use 3 phantom x-positions so line datasets span horizontally across the chart
  const labels = ['', 'Observed Baseline', ''];

  const canvas = createOffscreenCanvas(520, 300);
  const ctx    = canvas.getContext('2d');
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 520, 300);
  ctx.restore();

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type:            'bar',
          label:           'Baseline %',
          data:            [null, bp, null],
          backgroundColor: 'rgba(148,163,184,0.7)',
          borderColor:     'rgba(148,163,184,1)',
          borderWidth:     1,
          borderRadius:    3,
          barPercentage:   0.5,
        },
        {
          type:        'line',
          label:       'STO target',
          data:        [stoPercent, stoPercent, stoPercent],
          borderColor: 'rgba(20,184,166,1)',
          borderWidth: 2,
          borderDash:  [6, 3],
          pointRadius: 0,
          fill:        false,
        },
        {
          type:        'line',
          label:       'LTO target',
          data:        [ltoPercent, ltoPercent, ltoPercent],
          borderColor: 'rgba(52,211,153,1)',
          borderWidth: 2,
          borderDash:  [4, 4],
          pointRadius: 0,
          fill:        false,
        },
      ],
    },
    options: {
      responsive: false,
      animation:  false,
      plugins: {
        title: {
          display: true,
          text:    target.goalName || 'Caregiver Training Goal',
          font:    { size: 14, weight: 'bold' },
          padding: { bottom: 12 },
        },
        legend: { display: true, position: 'bottom' },
      },
      scales: {
        y: {
          beginAtZero: true,
          max:         100,
          title: { display: true, text: '% Correct' },
          ticks: {
            callback: (val) => tickValues.includes(val) ? `${val}%` : '',
          },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });

  const base64 = canvas.toDataURL('image/png').split(',')[1];
  chart.destroy();
  return base64;
}

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
    // targetFrequency: BCBA-entered LTO target; 0 means elimination (common for maladaptive)
    const targetCount   = bt.targetFrequency !== '' && bt.targetFrequency != null
      ? parseFloat(bt.targetFrequency)
      : 0;
    const frequencyUnit = bt.frequencyUnit || 'day';

    // Step 1 — baseline vs mastery target bar chart
    const graphKey = `behavior_${normalize(name)}`;
    try {
      result[graphKey] = renderMaladaptiveBehaviorChart(
        name,
        baselineCount,
        targetCount,
        frequencyUnit,
      );
    } catch (err) {
      console.warn(`Chart failed: ${graphKey}`, err);
    }

    // Step 2 — STO reduction trajectory line chart
    // Skip if baseline is 0 — all STO targets would also be 0, producing a flat useless line
    if (baselineCount > 0) {
      const stoKey  = `sto_${normalize(name)}`;
      const stoSteps = (bt.stoSteps ?? []).filter(s => s.targetFrequency !== '' && s.targetFrequency != null);
      try {
        result[stoKey] = renderSTOTrajectoryChart(name, baselineCount, masteryDates, targetCount, stoSteps.length > 0 ? stoSteps : null);
      } catch (err) {
        console.warn(`Chart failed: ${stoKey}`, err);
      }
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

    // Per-skill STO trajectory charts
    for (const g of filteredGoals) {
      const name = (g.targetSkill || '').trim();
      if (!name) continue;
      const stoKey    = `skill_sto_${normalize(name)}`;
      const stoSteps  = (g.stoSteps ?? []).filter(s => s.targetPercent !== '' && s.targetPercent != null);
      const baseline  = parseFloat(g.baselinePercent) || 0;
      const mastery   = parseFloat(g.masteryCriteriaPercent) || 80;
      // Tier-1 fallback: no stoSteps but stoPercent entered → synthesize single step for chart
      const singleSto = stoSteps.length === 0 && g.stoPercent != null && g.stoPercent !== ''
        ? [{ targetPercent: String(g.stoPercent), skillDescription: g.stoSkillDescription || g.targetSkill, durationWeeks: g.stoWeeks || '12' }]
        : null;
      const stoStepsForChart = stoSteps.length > 0 ? stoSteps : singleSto;
      try {
        result[stoKey] = renderSkillSTOChart(name, baseline, stoStepsForChart, mastery);
      } catch (err) {
        console.warn(`Chart failed: ${stoKey}`, err);
      }
    }
  }

  // ── Step 4 — Caregiver training charts ──────────────────────────────────────
  //
  // If the BCBA has defined caregiver training targets (caregiverTrainingTargets),
  // generate one dynamic chart per target (baseline + STO/LTO reference lines).
  // Otherwise fall back to the legacy hardcoded Premack / Reinforcement charts.

  const ct = session?.sections?.caregiver_training;
  const ctTargets = session?.caregiver_training?.caregiverTrainingTargets
    ?? ct?.caregiverTrainingTargets;

  if (ctTargets && ctTargets.length > 0) {
    for (const t of ctTargets) {
      const key = `caregiver_target_${normalize(t.goalName || t.id || String(ctTargets.indexOf(t)))}`;
      try {
        result[key] = renderCaregiverTrainingTargetChart(t);
      } catch (err) {
        console.warn(`Chart failed: ${key}`, err);
      }
    }
  } else if (ct) {
    // Fallback: existing hardcoded Premack + Reinforcement logic
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
