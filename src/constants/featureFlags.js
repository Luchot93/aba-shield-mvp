// Feature flags for Phase 2 / Trench 1 rollout.
// All flags default to false — flip to true to enable a module for a specific trench release.
// Do not import this file until the target trench is ready to wire up.

export const FLAGS = {
  // Trench 1 — Pipeline CRM: Kanban board, stage checklists, client card actions
  PIPELINE: false,

  // Trench 2 — Session Logging: behavior, skill, and caregiver training log modals
  SESSION_LOG: false,

  // Trench 3 — Reassessment Workflow: reassessment interview, review page, cycle panel
  REASSESSMENT: false,

  // Trench 4 — Staff Directory: staff cards, credential tracking, invite flow
  STAFF: false,

  // Trench 5 — Metrics Dashboard: KPI row, operational alerts, pipeline charts
  METRICS: false,
};
