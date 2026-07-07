/**
 * runGeneration.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared, UI-agnostic generation runner used by both the checklist page
 * (first-time regenerate entry) and the review page (per-changed-section
 * regenerate). Keeps ONE place that knows how to:
 *   1. produce section drafts (demo → local builder; real → /api/generate), and
 *   2. persist them with a fresh input fingerprint + reset approval to pending
 *      so a regenerated section must be re-approved before export.
 *
 * `regenerateSections` always runs SCOPED (an explicit `only` list) — it is the
 * cost-control path: re-run and pay for just the sections whose inputs changed.
 * First-time full generation stays in AssessmentChecklistPage.handleGenerate
 * (it owns the loading animation + hardcoded demo seed drafts).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { generateDraft } from './generateDraft.js';
import { buildLocalDraft } from './buildLocalDraft.js';
import { sectionPromptHashes } from './draftHash.js';
import { setDraftContent, setApprovalState } from '../assessmentStore.js';

const isDemoMode = () => import.meta.env.VITE_DEMO_MODE !== 'false';

/**
 * Regenerate a specific set of sections and persist the results.
 *
 * @param {object}   args
 * @param {object}   args.session      Full assessment session.
 * @param {string}   args.clientId
 * @param {string}   args.clientName
 * @param {function} args.setClients   React state setter from App.jsx.
 * @param {string[]} args.only         Section keys to regenerate (required).
 * @param {function} [args.onProgress] (sectionKey, sectionTitle, index, total) => void
 * @returns {Promise<string[]>} the keys that were actually (re)written.
 */
export async function regenerateSections({ session, clientId, clientName = 'the client', setClients, only, onProgress }) {
  if (!Array.isArray(only) || only.length === 0) return [];

  // Fresh fingerprints for the CURRENT session data — stored so the section is
  // no longer flagged "changed" until the inputs change again.
  const hashes = sectionPromptHashes(session);

  // Produce the new content for the requested sections.
  let drafts;
  if (isDemoMode()) {
    // Demo regeneration rebuilds from the current session data (reflects edits),
    // then keeps only the requested keys.
    const all = buildLocalDraft(session);
    drafts = {};
    only.forEach((key, i) => {
      if (all[key] != null) {
        if (typeof onProgress === 'function') onProgress(key, key, i, only.length);
        drafts[key] = all[key];
      }
    });
  } else {
    drafts = await generateDraft(session, { clientName, onProgress, only });
  }

  // Persist: new draft + new fingerprint, and reset approval so the BCBA must
  // re-approve just these sections before the document can be exported again.
  const written = [];
  for (const [key, content] of Object.entries(drafts)) {
    setDraftContent(setClients, clientId, key, content, 'pending', content, hashes[key]);
    setApprovalState(setClients, clientId, key, 'pending');
    written.push(key);
  }
  return written;
}
