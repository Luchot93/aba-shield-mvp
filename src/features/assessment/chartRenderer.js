/**
 * chartRenderer.js
 *
 * Renders ABA baseline charts to base64 PNG strings using Chart.js.
 * Runs entirely in the browser on off-screen canvas elements.
 * Pure JS module — no React, no DOM side effects.
 */

import Chart from 'chart.js/auto';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Create an off-screen canvas of the given dimensions.
 * Never appended to the DOM.
 */
export function createOffscreenCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  return canvas;
}

// ─── Internal: draw white background ─────────────────────────────────────────

function fillBackground(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// ─── renderMaladaptiveBehaviorChart ──────────────────────────────────────────

/**
 * Two-bar chart: "Current Baseline" vs "Mastery Target (LTO)".
 * Immediately shows the clinical gap — where we are vs. where we need to be.
 *
 * @param {string} behaviorName   – e.g. "Physical Aggression"
 * @param {number} baselineCount  – observed frequency at assessment
 * @param {number} targetCount    – LTO target frequency (0 = elimination)
 * @param {string} frequencyUnit  – e.g. "day" | "session" | "week"
 * @returns {string} base64 PNG (no data URI prefix)
 */
export function renderMaladaptiveBehaviorChart(behaviorName, baselineCount, targetCount, frequencyUnit = 'day') {
  const canvas = createOffscreenCanvas(520, 300);
  const ctx    = canvas.getContext('2d');
  fillBackground(ctx, 520, 300);

  const targetLabel = targetCount === 0
    ? 'Mastery Target (Elimination)'
    : `Mastery Target (≤${targetCount}/${frequencyUnit})`;

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Current Baseline', targetLabel],
      datasets: [
        {
          label: behaviorName,
          data:  [baselineCount, targetCount],
          backgroundColor: [
            'rgba(245,158,11,0.75)',   // amber — current problem level
            'rgba(20,184,166,0.70)',   // teal  — goal / solution
          ],
          borderColor: [
            'rgba(245,158,11,1)',
            'rgba(20,184,166,1)',
          ],
          borderWidth:  1,
          borderRadius: 5,
          barPercentage: 0.55,
        },
      ],
    },
    options: {
      responsive: false,
      animation:  false,
      plugins: {
        title: {
          display: true,
          text:    `${behaviorName} — Baseline vs. Mastery Target`,
          font:    { size: 14, weight: 'bold' },
          padding: { bottom: 12 },
        },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} per ${frequencyUnit}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: `Frequency per ${frequencyUnit}` },
          ticks: { stepSize: 1 },
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

// ─── renderSTOTrajectoryChart ─────────────────────────────────────────────────

/**
 * Line chart showing the 9-step reduction trajectory (STO 1–9) from baseline
 * down toward the long-term target.
 *
 * @param {string}   behaviorName  – e.g. "Elopement"
 * @param {number}   baselineCount – baseline frequency per session
 * @param {string[]} masteryDates  – 9 date strings, one per STO milestone
 * @returns {string} base64 PNG
 */
export function renderSTOTrajectoryChart(behaviorName, baselineCount, masteryDates) {
  const reductions  = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
  const stoTargets  = reductions.map(r => Math.round(baselineCount * r));
  const labels      = [
    'Baseline',
    ...masteryDates.map((d, i) => `STO ${i + 1} ${d}`),
  ];

  const canvas = createOffscreenCanvas(600, 300);
  const ctx    = canvas.getContext('2d');
  fillBackground(ctx, 600, 300);

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label:              'Target Frequency',
          data:               [baselineCount, ...stoTargets],
          borderColor:        'rgba(20,184,166,1)',
          backgroundColor:    'rgba(20,184,166,0.1)',
          borderWidth:        2,
          pointBackgroundColor: 'rgba(20,184,166,1)',
          pointRadius:        5,
          fill:               true,
          tension:            0.3,
        },
      ],
    },
    options: {
      responsive: false,
      animation:  false,
      plugins: {
        title: {
          display: true,
          text:    `${behaviorName} — Reduction Trajectory (STO Targets)`,
          font:    { size: 14, weight: 'bold' },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Target Frequency' },
        },
        x: {
          title: { display: true, text: 'Short-Term Objective' },
          ticks: { maxRotation: 45 },
        },
      },
    },
  });

  const base64 = canvas.toDataURL('image/png').split(',')[1];
  chart.destroy();
  return base64;
}

// ─── renderReplacementBehaviorChart ──────────────────────────────────────────

/**
 * Grouped bar chart: baseline % vs mastery target % for each skill goal.
 *
 * @param {{ targetSkill:string, baselinePercent:number, masteryCriteriaPercent:number }[]} skillTargets
 * @returns {string} base64 PNG
 */
export function renderReplacementBehaviorChart(skillTargets) {
  const targets = (skillTargets || [])
    .filter(s => s.targetSkill && s.targetSkill.trim())
    .map(s => ({
      ...s,
      label: s.targetSkill.length > 30
        ? s.targetSkill.slice(0, 30) + '…'
        : s.targetSkill,
    }));

  const canvas = createOffscreenCanvas(700, 350);
  const ctx    = canvas.getContext('2d');
  fillBackground(ctx, 700, 350);

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: targets.map(s => s.label),
      datasets: [
        {
          label:           'Baseline %',
          data:            targets.map(s => parseFloat(s.baselinePercent) || 0),
          backgroundColor: 'rgba(148,163,184,0.7)',
          borderColor:     'rgba(148,163,184,1)',
          borderWidth:     1,
          borderRadius:    3,
        },
        {
          label:           'Mastery Target %',
          data:            targets.map(s => parseFloat(s.masteryCriteriaPercent) || 80),
          backgroundColor: 'rgba(52,211,153,0.5)',
          borderColor:     'rgba(52,211,153,1)',
          borderWidth:     1,
          borderRadius:    3,
        },
      ],
    },
    options: {
      responsive: false,
      animation:  false,
      plugins: {
        title: {
          display: true,
          text:    'Replacement Behaviors — Baseline vs Mastery Target',
          font:    { size: 14, weight: 'bold' },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max:         100,
          title: { display: true, text: '% of Opportunities' },
        },
        x: {
          ticks: { maxRotation: 45, font: { size: 10 } },
        },
      },
    },
  });

  const base64 = canvas.toDataURL('image/png').split(',')[1];
  chart.destroy();
  return base64;
}

// ─── renderCaregiverTrainingChart ─────────────────────────────────────────────

/**
 * Bar chart showing caregiver baseline vs STO progression toward mastery.
 *
 * @param {string}   interventionName – e.g. "Premack Principle (first/then)"
 * @param {number}   baselinePercent  – observed baseline %
 * @param {number[]} stoTargets       – e.g. [20, 40, 60, 80, 100]
 * @returns {string} base64 PNG
 */
export function renderCaregiverTrainingChart(interventionName, baselinePercent, stoTargets) {
  const labels = ['Baseline', 'STO 1', 'STO 2', 'STO 3', 'STO 4', 'LTO'];
  const data   = [parseFloat(baselinePercent) || 0, ...stoTargets];

  const canvas = createOffscreenCanvas(500, 280);
  const ctx    = canvas.getContext('2d');
  fillBackground(ctx, 500, 280);

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           `${interventionName} — % Correct`,
          data,
          backgroundColor: [
            'rgba(148,163,184,0.7)',
            ...stoTargets.map(() => 'rgba(20,184,166,0.6)'),
          ],
          borderColor: [
            'rgba(148,163,184,1)',
            ...stoTargets.map(() => 'rgba(20,184,166,1)'),
          ],
          borderWidth:  1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: false,
      animation:  false,
      plugins: {
        title: {
          display: true,
          text:    `Caregiver Training — ${interventionName}`,
          font:    { size: 14, weight: 'bold' },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max:         100,
          title: { display: true, text: '% of Opportunities' },
        },
      },
    },
  });

  const base64 = canvas.toDataURL('image/png').split(',')[1];
  chart.destroy();
  return base64;
}
