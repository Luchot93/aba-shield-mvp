/**
 * docxExport.js
 *
 * Generates the clinic's Initial Assessment .docx by filling chart images
 * into the INITIAL_ASSESSMENT_TEMPLATE.docx using Docxtemplater + ImageModule.
 *
 * Template tag format: {%tag_name} — one image per tag.
 *
 * Graph keys produced by buildGraphsFromSession:
 *   behavior_{name}        → template tag: behavior_{name}_graph
 *   sto_{name}             → template tag: sto_{name}_graph
 *   replacement_behaviors  → template tag: replacement_behaviors_graph
 *   caregiver_premack      → template tag: caregiver_premack_graph
 *   caregiver_reinforcement→ template tag: caregiver_reinforcement_graph
 */

import Docxtemplater from 'docxtemplater';
import ImageModule    from 'docxtemplater-image-module-free';
import JSZip          from 'jszip';

import { buildGraphsFromSession } from '../graphBuilder.js';

// ─── Base64 → Uint8Array (browser-safe, no Buffer needed) ────────────────────

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── generateTemplateDoc ──────────────────────────────────────────────────────

/**
 * Fetch the assessment Word template, render all chart images into it,
 * and return the result as a Blob ready for browser download.
 *
 * @param {object} session  Full assessment_session (makeAssessmentSession shape)
 * @returns {Promise<Blob>}
 */
export async function generateTemplateDoc(session) {

  // ── 1. Fetch template ───────────────────────────────────────────────────────
  const templateUrl = `${import.meta.env.BASE_URL}INITIAL_ASSESSMENT_TEMPLATE.docx`;
  const response    = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch assessment template (${response.status}). Make sure INITIAL_ASSESSMENT_TEMPLATE.docx is in the public/ directory.`);
  }
  const arrayBuffer = await response.arrayBuffer();

  // ── 2. Build all chart images from session data ─────────────────────────────
  const graphs = await buildGraphsFromSession(session);

  // ── 3. Map graphBuilder keys → template tag names ──────────────────────────
  //
  // graphBuilder produces:  "behavior_tantrum", "sto_tantrum", "replacement_behaviors", …
  // Template tags expect:   "behavior_tantrum_graph", "sto_tantrum_graph", …
  //
  // Rule: append "_graph" to every key.
  const templateData = {};
  for (const [key, base64] of Object.entries(graphs)) {
    if (base64) templateData[`${key}_graph`] = base64;
  }

  // ── 4. Configure ImageModule ────────────────────────────────────────────────
  const imageModule = new ImageModule({
    centered:  false,
    fileType:  'docx',

    getImage(tagValue) {
      // tagValue is the base64 PNG string set in templateData above.
      // Return null (skip / leave blank) if no chart was generated for this tag.
      if (!tagValue) return null;
      return base64ToUint8Array(tagValue);
    },

    getSize(img, tagValue, tagName) {   // eslint-disable-line no-unused-vars
      // Sizes in EMU are handled by the template's inline image settings.
      // Return pixel dimensions; the module converts to EMU automatically.
      if (!tagValue) return [1, 1]; // invisible 1×1 placeholder for missing charts
      if (tagName.startsWith('sto_') || tagName.startsWith('behavior_')) {
        return [560, 280]; // wider for frequency / trajectory charts
      }
      if (tagName === 'replacement_behaviors_graph') {
        return [600, 300];
      }
      return [460, 260]; // caregiver charts
    },
  });

  // ── 5. Load template with JSZip ─────────────────────────────────────────────
  const zip = await JSZip.loadAsync(arrayBuffer);

  // ── 6. Instantiate Docxtemplater ────────────────────────────────────────────
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
    modules:       [imageModule],
    // Gracefully skip tags that have no data (behavior not in this client's session)
    nullGetter() { return null; },
  });

  // ── 7. Render ───────────────────────────────────────────────────────────────
  doc.render(templateData);

  // ── 8. Export as Blob ───────────────────────────────────────────────────────
  const outputBuffer = await doc.getZip().generateAsync({
    type:             'arraybuffer',
    compression:      'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return new Blob(
    [outputBuffer],
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  );
}
