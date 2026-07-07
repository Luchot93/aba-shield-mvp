/**
 * draftHash.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Change-detection fingerprints for AI-drafted sections.
 *
 * The per-section prompt built by buildSectionPrompts(session) is a pure,
 * deterministic function of the structured form data + notes + transcript that
 * feed each section's AI draft. Hashing that prompt string gives us a compact
 * fingerprint we can store at generation time and re-compare on re-entry to know
 * EXACTLY which sections' inputs changed since the draft was generated — so we
 * only ever re-run (and pay for) the sections that actually changed.
 *
 * No React, no side effects. Safe to call any time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildSectionPrompts } from './buildSectionPrompts.js';

/**
 * FNV-1a 32-bit string hash → stable hex string. No crypto dependency.
 * Deterministic across reloads/sessions, which is all we need for equality checks.
 */
export function hashString(str) {
  const s = typeof str === 'string' ? str : String(str ?? '');
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts, kept in unsigned range with >>> 0
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Hash every section's prompt in one pass.
 * @returns {Record<string, string>} { [sectionKey]: hash }
 */
export function sectionPromptHashes(session) {
  const prompts = buildSectionPrompts(session);
  const out = {};
  for (const key of Object.keys(prompts)) {
    out[key] = hashString(prompts[key] ?? '');
  }
  return out;
}

/**
 * Hash for a single section's current prompt.
 */
export function sectionPromptHash(session, sectionKey) {
  const prompts = buildSectionPrompts(session);
  return hashString(prompts[sectionKey] ?? '');
}
