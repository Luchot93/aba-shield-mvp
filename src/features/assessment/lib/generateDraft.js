/**
 * generateDraft.js
 *
 * Feature-flag dispatch layer for AI draft generation.
 *
 * VITE_DEMO_MODE=true  (default) → never called; AssessmentChecklistPage uses hardcoded drafts
 * VITE_DEMO_MODE=false           → called by AssessmentChecklistPage; hits /api/generate
 *                                  for every section that has structured data
 *
 * Usage:
 *   import { generateDraft } from './lib/generateDraft.js';
 *   const drafts = await generateDraft(session, { clientName, onProgress });
 *   // drafts → { [sectionKey]: string }
 *
 * onProgress(sectionKey, sectionTitle, index, total)
 *   Called once before each section fetch so the UI can update its loading state.
 *
 * Throws on network/API errors so the caller can surface them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Production checklist (VITE_DEMO_MODE=false path):
 *   1. Set VITE_DEMO_MODE=false in .env.local
 *   2. Set ANTHROPIC_API_KEY=sk-ant-... in .env.local
 *   3. Restart the dev server (or redeploy)
 *   That is all. No backend changes needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildSectionPrompts } from './buildSectionPrompts.js';
import { SECTION_ORDER, SECTION_TITLES } from '../sectionConfig.js';

/**
 * Generate clinical draft content for every section that has usable data.
 *
 * @param {object} session     - The full assessment session object (client.assessment)
 * @param {object} options
 * @param {string} options.clientName  - Client display name for the Claude prompt
 * @param {function} [options.onProgress] - (sectionKey, sectionTitle, index, total) => void
 * @returns {Promise<Record<string, string>>} Map of sectionKey → draft content string
 */
export async function generateDraft(session, { clientName = 'the client', onProgress, only } = {}) {
  // Build all section prompts from the structured form data.
  // buildSectionPrompts returns { [sectionKey]: string } — empty string if no data.
  const prompts = buildSectionPrompts(session);

  // Optional scoped regeneration: when `only` is provided, restrict to that set
  // so we re-run (and pay for) just the sections whose inputs changed.
  const onlySet = Array.isArray(only) && only.length > 0 ? new Set(only) : null;

  // Only draft sections that have actual prompt content (and, if scoped, are in `only`).
  const sectionsToGenerate = SECTION_ORDER.filter(key => {
    if (onlySet && !onlySet.has(key)) return false;
    const p = prompts[key];
    return typeof p === 'string' && p.trim().length > 0;
  });

  const results = {};
  const total   = sectionsToGenerate.length;

  for (let i = 0; i < sectionsToGenerate.length; i++) {
    const sectionKey   = sectionsToGenerate[i];
    const sectionTitle = SECTION_TITLES[sectionKey] ?? sectionKey;

    // Notify caller so the UI can show per-section progress.
    if (typeof onProgress === 'function') {
      onProgress(sectionKey, sectionTitle, i, total);
    }

    const res = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sectionKey,
        sectionPrompt: prompts[sectionKey],
        clientName,
        sectionTitle,
      }),
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        errMsg = body.error ?? errMsg;
      } catch {
        // ignore parse error, keep errMsg as status
      }
      throw new Error(`Draft generation failed for "${sectionTitle}": ${errMsg}`);
    }

    const data = await res.json();
    results[sectionKey] = data.content ?? '';
  }

  return results;
}
