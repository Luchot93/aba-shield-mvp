/**
 * Feature flags for aba-shield-mvp.
 * Alpha ships with all flags false.
 * To enable a Phase 2 feature, set its flag to true and fix any import errors.
 * Never delete code guarded by these flags — it ports from ABA_Shield_V0.
 */
export const FLAGS = {
  PIPELINE:     false,   // Trench 5 — 9-stage Kanban CRM
  SESSION_LOG:  false,   // Trench 6 — Behavior/Skill/CT session logging
  REASSESSMENT: false,   // Trench 7 — 6-month reassessment workflow
  STAFF:        false,   // Trench 8 — Staff directory and cert tracking
  METRICS:      false,   // Trench 9 — Metrics dashboard
};
