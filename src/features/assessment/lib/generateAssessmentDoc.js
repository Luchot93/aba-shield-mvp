/**
 * generateAssessmentDoc.js
 *
 * Generates a clinic-formatted .docx Word document from a completed ABA assessment
 * session, matching the structure of the clinic's Initial Assessment Template.
 *
 * Document order:
 *   1.  Title block
 *   2.  Client information table         ← session.clientProfile (structured)
 *   3.  Demographics & Referral Info      ← demographics.draftContent (AI narrative)
 *   4.  Presenting Concerns              ← presenting_concerns.draftContent
 *   5.  Self-Help Skills                 ← self_help.draftContent
 *   6.  Daily Living Skills              ← daily_living.draftContent
 *   7.  Safety Concerns                  ← safety.draftContent
 *   8.  Communication                    ← communication.draftContent
 *   9.  Self-Stimulatory Behavior        ← self_stim.draftContent
 *   10. Medical Necessity                ← medical_necessity.draftContent
 *   11. Medical Condition & Medications  ← structured medications[], diagnoses[], priorABA[]
 *   12. Strengths                        ← derived from skillGoals[] (what the client can do)
 *   13. Areas Requiring Intervention     ← behaviorTargets[] names + skillGoal baselines
 *   14. Maladaptive Behaviors            ← behaviorTargets[] (structured: opDef, function, LTO)
 *   15. Reinforcement                    ← skill_acquisitions notes + teaching strategies
 *   16. Hypothesis-Based Interventions   ← behavior_targets.draftContent (AI functional analysis)
 *   17. Intervention Techniques          ← standard clinic template list
 *   18. Skills / Replacement Behaviors   ← skillGoals[] (structured: opDef, strategies, STO)
 *   19. Crisis Plan                      ← structured contacts, warning signs, thresholds
 *
 * Skipped (manual BCBA completion):
 *   - Standardized assessment scores (QABF, BASC-3, Vineland-3)
 *   - Data graphs and visualizations
 *   - Signature blocks
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';

import { buildGraphsFromSession } from '../graphBuilder.js';

// ─── Typography constants ─────────────────────────────────────────────────────

const FONT         = 'Arial';
const SZ           = 20;   // 10pt (docx uses half-points)
const SZ_SM        = 18;   // 9pt
const SZ_LG        = 24;   // 12pt
const SZ_XL        = 28;   // 14pt
const TEAL         = '2D7D6F';
const TEAL_LIGHT   = 'E8F5F3';
const TEAL_BORDER  = 'B2D8D3';
const SLATE        = '475569';

// ─── Chart helpers ────────────────────────────────────────────────────────────

/** Same normalizer as graphBuilder.js — must stay in sync. */
const normalize = (label) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Base64 PNG → Uint8Array (browser-safe, no Buffer needed). */
function b64toU8(b64) {
  const bin   = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Returns a centred Paragraph containing the chart image, or null if no data.
 * widthPx / heightPx control the rendered size in the Word document.
 */
function chartImage(base64, widthPx = 500, heightPx = 250) {
  if (!base64) return null;
  return new Paragraph({
    children: [
      new ImageRun({
        type: 'png',
        data: b64toU8(base64),
        transformation: { width: widthPx, height: heightPx },
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 100 },
  });
}

// ─── Skill goal computation helpers ──────────────────────────────────────────
// Mirror the logic in SkillAcquisitionsReviewView.jsx so doc and Review are in sync.

function computeSkillBaseline(g) {
  if (!g.baselinePercent && g.baselinePercent !== 0) return '—';
  const opps   = g.baselineOpportunities || '?';
  const prompt = g.baselinePromptingLevel || g.promptingLevel?.[0] || null;
  const promptPart = prompt ? ` with ${prompt} prompting` : '';
  return `Client demonstrates ${g.baselinePercent}% correct${promptPart} across ${opps} opportunities.`;
}

function computeSkillSTO(g) {
  // Tier 0 — BCBA-defined multi-step milestones
  if ((g.stoSteps ?? []).length > 0) {
    return g.stoSteps.map((s, i) =>
      `STO ${i + 1}: Client will demonstrate ${s.skillDescription || g.targetSkill || 'the target skill'} with ${s.targetPercent || '?'}% accuracy across ${g.masteryCriteriaSessions || '3'} consecutive sessions within ${s.durationWeeks || '?'} weeks.`
    ).join('\n');
  }
  // Tier 1 — structured single-step fields (only when the BCBA entered a real STO %)
  if (g.stoPercent) {
    const desc     = g.stoSkillDescription || (g.targetSkill || 'the target skill');
    const weeks    = g.stoWeeks           || '12';
    const sessions = g.masteryCriteriaSessions || '3';
    return (
      `Client will demonstrate ${desc} with ${g.stoPercent}% accuracy across ` +
      `${sessions} consecutive sessions within ${weeks} weeks.`
    );
  }
  // Tier 2 — legacy free-text
  if (g.sto) return g.sto;
  // No STO defined — never fabricate one. Export is gated on a real STO
  // (see sectionsMissingSTO/canExport), so this marker should be unreachable in a real export.
  return '—';
}

function computeSkillMastery(g) {
  const pct      = g.masteryCriteriaPercent         || '80';
  const sessions = g.masteryCriteriaSessions        || '3';
  const settings = g.masteryCriteriaSettings        || '2';
  const prompt   = g.masteryCriteriaPromptingLevel  || g.masteryCriteriaPrompting || 'independent';
  return (
    `Client will demonstrate ${g.targetSkill || 'the target skill'} with ` +
    `${pct}% accuracy across ${sessions} consecutive sessions across ` +
    `${settings} opportunities/trials with ${prompt} level of prompting.`
  );
}

// ─── Behavior target computation helpers ─────────────────────────────────────
// Mirror the logic in MaladaptiveBehaviorsReviewView.jsx.

function computeBtBaseline(bt) {
  if (!bt.baselineFrequency) return '—';
  return `${bt.baselineFrequency} per ${bt.frequencyUnit || 'day'}`;
}

function computeBtSTO(bt) {
  // Only render BCBA-defined STO steps. Never fabricate a "reduce by 50%" target.
  const unit  = bt.frequencyUnit || 'day';
  const steps = (bt.stoSteps ?? []).filter(
    s => s.targetFrequency !== '' && s.targetFrequency != null,
  );
  if (steps.length > 0) {
    return steps.map((s, i) =>
      `STO ${i + 1}: Reduce to ${s.targetFrequency} per ${unit} within ${s.durationWeeks || '?'} weeks.`,
    ).join('\n');
  }
  // No STO defined — never fabricate one. Export is gated on a real STO.
  return '—';
}

function computeBtLTO(bt) {
  const target = bt.targetFrequency;
  const unit   = bt.frequencyUnit || 'day';
  const name   = bt.behaviorName  || 'behavior';
  if (!target || target === '0' || target === '') {
    return `Eliminate ${name} (0 per ${unit}) for 3 consecutive months`;
  }
  return `Reduce to ${target} per ${unit}, sustained for 3 consecutive months`;
}

// ─── Caregiver training target STO helper ────────────────────────────────────

function computeCaregiverSTO(t) {
  // Tier 0 — BCBA-defined multi-step milestones
  const validSteps = (t.stoSteps ?? []).filter(
    s => s.targetPercent !== '' && s.targetPercent != null,
  );
  if (validSteps.length > 0) {
    return validSteps.map((s, i) =>
      `STO ${i + 1}: Caregiver will demonstrate ${t.goalName || 'the target skill'} with ${s.targetPercent}% accuracy within ${s.durationWeeks || '?'} consecutive weeks.`,
    ).join('\n');
  }
  // Tier 1 — legacy stoPercent field (BCBA-entered)
  if (t.stoPercent != null) {
    return t.stoWeeks != null
      ? `${t.stoPercent}% over ${t.stoWeeks} weeks`
      : `${t.stoPercent}%`;
  }
  // No STO defined — never fabricate one (previously (baseline+lto)/2). Export is gated on a real STO.
  return '—';
}

// ─── Inline bold parser ───────────────────────────────────────────────────────
// Converts **text** markers in a string into bold TextRuns.

function parseBoldRuns(text, baseOpts = {}) {
  if (!text) return [new TextRun({ text: '', ...baseOpts })];
  const parts = text.split(/\*\*([^*]+)\*\*/);
  const runs = [];
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    runs.push(new TextRun({ text: parts[i], bold: i % 2 === 1, ...baseOpts }));
  }
  return runs.length ? runs : [new TextRun({ text, ...baseOpts })];
}

// ─── Markdown → docx Paragraphs ───────────────────────────────────────────────
// Converts AI draft markdown to Word paragraphs with structure preserved.
// - ##  headings → skipped (section header already added by caller)
// - ### headings → sub-section label (bold, underlined)
// - **bold** inline → bold TextRun
// - - list items → bullet paragraph
// - | table rows | → skipped (tables not renderable inline)
// - blank lines / --- → paragraph break

// ─── Markdown table → docx Table ─────────────────────────────────────────────
// Converts a block of collected `| col | col |` lines into a styled Word table.

function mdTableToDocx(tableLines) {
  // Split each row into cells, trimming whitespace and pipe delimiters
  const parseRow = (line) =>
    line.split('|')
      .map(c => c.trim())
      .filter((c, i, arr) => i > 0 && i < arr.length - 1); // drop empty outer fragments

  const rows = tableLines
    .filter(l => !/^\|[-| :]+\|$/.test(l)) // drop separator rows (|---|---|)
    .map(parseRow)
    .filter(r => r.length > 0);

  if (!rows.length) return null;

  const colCount = Math.max(...rows.map(r => r.length));
  const colPct   = Math.floor(100 / colCount);

  const borders = {
    top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
    insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
  };

  const docxRows = rows.map((cells, rowIdx) =>
    new TableRow({
      children: cells.map(cell =>
        new TableCell({
          children: [new Paragraph({
            children: parseBoldRuns(cell, { size: SZ_SM, font: FONT, bold: rowIdx === 0 }),
            spacing: { after: 0 },
          })],
          shading: rowIdx === 0
            ? { type: ShadingType.SOLID, color: TEAL_LIGHT }
            : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          width: { size: colPct, type: WidthType.PERCENTAGE },
        })
      ),
    })
  );

  return new Table({
    width:   { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows:    docxRows,
    margins: { top: 0, bottom: 0 },
  });
}

// ─── Markdown → docx Paragraphs ───────────────────────────────────────────────
// Converts AI draft markdown to Word paragraphs with structure preserved.
// - ##  headings → goal/sub-section heading (bold teal)
// - ### headings → sub-section label (bold, underlined)
// - **bold** inline → bold TextRun
// - - list items → bullet paragraph
// - | table rows | → proper docx Table (header row tinted teal)
// - blank lines / --- → paragraph break

function markdownToParagraphs(text) {
  if (!text?.trim()) return [];

  const out   = [];
  const lines = text.split('\n');
  let buf      = [];
  let tableBuf = []; // collects consecutive | lines

  const flush = () => {
    if (!buf.length) return;
    const combined = buf.join(' ').trim();
    if (combined) {
      out.push(new Paragraph({
        children: parseBoldRuns(combined, { size: SZ, font: FONT }),
        spacing: { after: 120 },
      }));
    }
    buf = [];
  };

  const flushTable = () => {
    if (!tableBuf.length) return;
    const tbl = mdTableToDocx(tableBuf);
    if (tbl) out.push(tbl, empty(100));
    tableBuf = [];
  };

  for (const line of lines) {
    const t = line.trim();

    // Collect table rows (including separator rows — mdTableToDocx filters them)
    if (t.startsWith('|')) {
      flush();
      tableBuf.push(t);
      continue;
    }

    // Non-table line → flush any pending table first
    flushTable();

    // Blank lines and dividers → flush text buffer
    if (!t || t === '---') { flush(); continue; }

    // ## Goal-level heading → bold teal label (used in skill_acquisitions goals)
    if (t.startsWith('## ')) {
      flush();
      const heading = t.replace(/^##\s+/, '');
      out.push(new Paragraph({
        children: parseBoldRuns(heading, { bold: true, size: SZ, font: FONT, color: TEAL }),
        spacing: { before: 200, after: 60 },
      }));
      continue;
    }

    // # top-level heading → skip (section title already added by caller)
    if (t.startsWith('# ')) { flush(); continue; }

    // ### Sub-section heading → bold underlined label
    if (t.startsWith('### ')) {
      flush();
      out.push(new Paragraph({
        children: [new TextRun({
          text: t.replace(/^###\s+/, ''),
          bold: true,
          underline: { type: UnderlineType.SINGLE },
          size: SZ,
          font: FONT,
        })],
        spacing: { before: 160, after: 60 },
      }));
      continue;
    }

    // List items → bullet paragraph
    if (t.startsWith('- ') || t.startsWith('* ')) {
      flush();
      out.push(new Paragraph({
        children: parseBoldRuns(t.replace(/^[-*]\s+/, ''), { size: SZ, font: FONT }),
        bullet: { level: 0 },
        spacing: { after: 60 },
      }));
      continue;
    }

    // Numbered lists (1. text)
    if (/^\d+\.\s/.test(t)) {
      flush();
      out.push(new Paragraph({
        children: parseBoldRuns(t.replace(/^\d+\.\s+/, ''), { size: SZ, font: FONT }),
        bullet: { level: 0 },
        spacing: { after: 60 },
      }));
      continue;
    }

    buf.push(t);
  }

  // Flush any remaining content
  flushTable();
  flush();
  return out;
}

// ─── Primitive helpers ────────────────────────────────────────────────────────

const empty = (after = 120) =>
  new Paragraph({ text: '', spacing: { after } });

const sectionHeading = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: SZ_LG, font: FONT, color: TEAL })],
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL } },
  });

const subHeading = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: SZ, font: FONT })],
    spacing: { before: 160, after: 60 },
  });

const bodyPara = (text, opts = {}) =>
  text?.trim()
    ? new Paragraph({
        children: parseBoldRuns(text, { size: SZ, font: FONT }),
        spacing: { after: 120 },
        ...opts,
      })
    : null;

const labelVal = (label, value) =>
  new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: SZ, font: FONT }),
      new TextRun({ text: value || '—', size: SZ, font: FONT }),
    ],
    spacing: { after: 80 },
  });

const bullet = (text, level = 0) =>
  text?.trim()
    ? new Paragraph({
        children: parseBoldRuns(text, { size: SZ, font: FONT }),
        bullet: { level },
        spacing: { after: 60 },
      })
    : null;

// ─── 1. Title block ───────────────────────────────────────────────────────────

function titleBlock(session) {
  const p = session.clientProfile ?? {};
  const dateStr = p.assessmentDate
    ? new Date(`${p.assessmentDate}T12:00:00`).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return [
    new Paragraph({
      children: [new TextRun({ text: 'ABA SHIELD BEHAVIORAL SERVICES', bold: true, size: SZ_XL, font: FONT, color: TEAL })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'INITIAL COMPREHENSIVE ABA ASSESSMENT', bold: true, size: SZ_LG, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `${p.assessmentType ?? 'Initial'} Assessment  ·  ${dateStr}`,
        size: SZ_SM, font: FONT, color: SLATE, italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];
}

// ─── 2. Client information table ──────────────────────────────────────────────

function clientInfoTable(session, clientName) {
  const p = session.clientProfile ?? {};

  const mkCell = (label, value, shade = false) =>
    new TableCell({
      children: [new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: SZ_SM, font: FONT }),
          new TextRun({ text: value || '—', size: SZ_SM, font: FONT }),
        ],
        spacing: { after: 0 },
      })],
      shading: shade ? { type: ShadingType.SOLID, color: TEAL_LIGHT } : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    });

  // Calculate age
  let age = '—';
  if (p.dob) {
    const dob = new Date(p.dob);
    const now = new Date();
    let yrs = now.getFullYear() - dob.getFullYear();
    let mos = now.getMonth() - dob.getMonth();
    if (mos < 0) { yrs--; mos += 12; }
    age = `${yrs} years${mos > 0 ? `, ${mos} months` : ''}`;
  }

  const fmtDate = (iso) => iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  const borders = {
    top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
    insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
  };

  const rows = [
    new TableRow({ children: [
      mkCell('Client Name',      clientName,              true),
      mkCell('Date of Birth',    fmtDate(p.dob),          true),
      mkCell('Age',              age,                     true),
    ]}),
    new TableRow({ children: [
      mkCell('Assessment Date',  fmtDate(p.assessmentDate)),
      mkCell('Assessment Type',  `${p.assessmentType ?? 'Initial'} Comprehensive`),
      mkCell('BCBA',             session.bcbaName ?? ''),
    ]}),
    new TableRow({ children: [
      mkCell('Primary Diagnosis', p.diagnosis ?? '',      true),
      mkCell('ICD-10',            p.icd10 ?? '',          true),
      mkCell('Referring Provider', p.referringProvider ?? '', true),
    ]}),
    new TableRow({ children: [
      mkCell('Insurance',        p.insurerName ?? ''),
      mkCell('Member ID',        p.memberId ?? ''),
      mkCell('Group #',          p.groupNumber ?? ''),
    ]}),
  ];

  // Guardian / Medicaid row
  if (p.medicaidId) {
    rows.push(new TableRow({ children: [
      mkCell('Medicaid ID',      p.medicaidId,            true),
      mkCell('Parent / Guardian', p.parentGuardianNames ?? '—', true),
      mkCell('Relationship',     p.relationship ?? '—',   true),
    ]}));
  } else if (p.parentGuardianNames) {
    rows.push(new TableRow({ children: [
      mkCell('Parent / Guardian', p.parentGuardianNames),
      mkCell('Relationship',     p.relationship ?? '—'),
      mkCell('Preferred Language', p.preferredLanguage ?? 'English'),
    ]}));
  }

  // Contact / referral row — only when at least one field is filled
  const hasContact = p.phone || p.address || p.referralDate;
  if (hasContact) {
    rows.push(new TableRow({ children: [
      mkCell('Phone',         p.phone       ?? '—'),
      mkCell('Address',       p.address     ?? '—'),
      mkCell('Referral Date', p.referralDate ? fmtDate(p.referralDate) : '—'),
    ]}));
  }

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows });
}

// ─── 3. Background & Referral Information ────────────────────────────────────
// Source: demographics.draftContent (AI-generated narrative covering school,
// family structure, prior ABA history, referral context).
// Falls back to demographics.notes if no draft yet.

function backgroundSection(session) {
  const sec  = session.sections?.demographics;
  const text = sec?.draftContent?.trim() || sec?.notes?.trim() || '';

  const children = [sectionHeading('Demographics & Referral Information')];

  if (text) {
    children.push(...markdownToParagraphs(text));
  } else {
    children.push(bodyPara('[Complete the Demographics & Referral section in the assessment interview to populate this section.]'));
  }

  children.push(empty(80));
  return children;
}

// ─── 4–10. Narrative sections (AI drafts) ────────────────────────────────────
// Each section renders its draftContent (AI-written clinical prose).
// Falls back to raw notes if no draft has been generated yet.

const NARRATIVE_SECTIONS = [
  { key: 'presenting_concerns', label: 'Presenting Concerns'        },
  { key: 'self_help',           label: 'Self-Help Skills'           },
  { key: 'daily_living',        label: 'Daily Living Skills'        },
  { key: 'safety',              label: 'Safety Concerns'            },
  { key: 'communication',       label: 'Communication'              },
  { key: 'self_stim',           label: 'Self-Stimulatory Behavior'  },
  { key: 'medical_necessity',   label: 'Medical Necessity'          },
];

function narrativeSections(session) {
  const children = [];

  for (const cfg of NARRATIVE_SECTIONS) {
    const sec  = session.sections?.[cfg.key];
    const text = sec?.draftContent?.trim() || sec?.notes?.trim() || '';

    children.push(sectionHeading(cfg.label));

    if (text) {
      children.push(...markdownToParagraphs(text));
    } else {
      children.push(bodyPara('[Section not yet completed — generate the AI draft or add notes in the interview.]'));
    }

    children.push(empty(80));
  }

  return children;
}

// ─── 11. Medical Condition & Medications ─────────────────────────────────────
// Source: structured data from medical_necessity section form fields.
// Keeps only clinical facts here (diagnoses list, medication list, prior ABA,
// recommended hours) — the prose narrative is already in section 10 above.

function medicalConditionSection(session) {
  const sec  = session.sections?.medical_necessity;
  const meds = sec?.medications          ?? [];
  const diag = sec?.coOccurringDiagnoses ?? [];
  const aba  = sec?.priorABAHistory      ?? [];

  const children = [sectionHeading('Medical Condition and Medications')];

  // Co-occurring diagnoses
  if (diag.length) {
    children.push(subHeading('Co-Occurring Diagnoses'));
    for (const dx of diag) {
      children.push(bullet(
        `${dx.diagnosis}${dx.icd10 ? ` (${dx.icd10})` : ''} — confirmed by ${dx.provider ?? '—'}, ${dx.date ?? '—'}`
      ));
    }
    children.push(empty(80));
  }

  // Current medications
  children.push(subHeading('Current Medications'));
  if (meds.length) {
    for (const med of meds) {
      children.push(bullet(
        `${med.name} ${med.dose}, ${med.frequency}` +
        (med.prescriber ? ` — prescribed by ${med.prescriber}` : '') +
        (med.purpose ? ` for ${med.purpose}` : '')
      ));
    }
  } else {
    children.push(bodyPara('No current medications reported.'));
  }
  children.push(empty(80));

  // Prior ABA services
  if (aba.length) {
    children.push(subHeading('Prior ABA Services'));
    for (const a of aba) {
      children.push(bullet(
        `${a.provider} (${a.startDate ?? '—'} – ${a.endDate ?? 'present'}, ` +
        `${a.hoursPerWeek ?? '—'} hrs/week, ${a.setting ?? '—'})` +
        (a.reasonDiscontinued ? `. Discontinued: ${a.reasonDiscontinued}` : '')
      ));
    }
    children.push(empty(80));
  }

  // Recommended hours
  if (sec?.recommendedHoursPerWeek) {
    children.push(labelVal(
      'Recommended Service Intensity',
      `${sec.recommendedHoursPerWeek} hours/week — ${sec.recommendedSetting ?? 'as clinically indicated'}`
    ));
  }

  children.push(empty(80));
  return children;
}

// ─── 12. Strengths ───────────────────────────────────────────────────────────
// Source: skill_acquisitions.skillGoals[] — what the client CAN do at baseline,
// the skills they are being taught (positive framing), and identified reinforcers.

function strengthsSection(session) {
  const skillSec = session.sections?.skill_acquisitions;
  const goals    = skillSec?.skillGoals ?? [];

  const children = [sectionHeading('Strengths')];

  if (goals.length) {
    children.push(bodyPara(
      `${session.clientName ?? 'The client'} demonstrates a range of existing skills and learning readiness behaviors ` +
      `that support the initiation of ABA programming. The following skill areas have been identified as ` +
      `active targets for development, with the client demonstrating emerging abilities in each domain:`
    ));
    children.push(empty(60));

    for (const g of goals) {
      const baseline = parseInt(g.baselinePercent ?? '0');
      // Frame positively: "X% of opportunities independently" or "emerging"
      const baselineText = baseline > 0
        ? `currently demonstrates ${g.baselinePercent}% accuracy independently`
        : 'skill is emerging with support';
      children.push(bullet(
        `**${g.domain} — ${g.targetSkill}:** Client ${baselineText}. ` +
        (g.baselinePromptingDesc ? g.baselinePromptingDesc : '')
      ));
    }

    // Add any notes about reinforcers from skill_acquisitions notes
    const notes = skillSec?.notes ?? '';
    const reinforcerSentence = notes
      .split(/[.\n]/)
      .find(s => /reinforc|prefer|reward|motivat|favorite/i.test(s));
    if (reinforcerSentence) {
      children.push(empty(80));
      children.push(bodyPara(reinforcerSentence.trim() + '.'));
    }
  } else {
    children.push(bodyPara('[Document client strengths, identified reinforcers, and positive skill observations from the interview.]'));
  }

  children.push(empty(80));
  return children;
}

// ─── 13. Areas Requiring Intervention ────────────────────────────────────────
// Source: behaviorTargets[] names + skillGoals[] deficit baselines.

function areasRequiringIntervention(session) {
  const btSec    = session.sections?.behavior_targets;
  const skillSec = session.sections?.skill_acquisitions;
  const targets  = btSec?.behaviorTargets ?? [];
  const goals    = skillSec?.skillGoals   ?? [];

  const children = [sectionHeading('Areas Requiring Intervention')];

  if (targets.length) {
    children.push(subHeading('Behavior Reduction Targets'));
    for (const bt of targets) {
      children.push(bullet(
        `**${bt.behaviorName}** — Function: ${bt.hypothesizedFunction ?? 'under assessment'}. ` +
        `Baseline: ${bt.baselineFrequency ?? '—'} per ${bt.frequencyUnit ?? 'day'}.`
      ));
    }
    children.push(empty(80));
  }

  if (goals.length) {
    children.push(subHeading('Skill Acquisition Targets'));
    for (const g of goals) {
      children.push(bullet(
        `**${g.domain} — ${g.targetSkill}:** Baseline ${g.baselinePercent ?? '—'}% independent. ` +
        `Mastery criterion: ${g.masteryCriteriaPercent ?? '—'}% across ${g.masteryCriteriaSessions ?? '—'} sessions.`
      ));
    }
  }

  if (!targets.length && !goals.length) {
    children.push(bodyPara('[Document behavioral excesses and skill deficits identified in the interview.]'));
  }

  children.push(empty(80));
  return children;
}

// ─── 14. Maladaptive Behaviors ────────────────────────────────────────────────
// Built from behavior_targets.behaviorTargets[] structured data, matching the
// MaladaptiveBehaviorsReviewView exactly (same columns, same computed STO/LTO).

function maladaptiveBehaviorsSection(session, graphs = {}) {
  const children = [sectionHeading('Maladaptive Behaviors')];
  const targets  = session.sections?.behavior_targets?.behaviorTargets ?? [];

  if (!targets.length) {
    children.push(bodyPara('[No maladaptive behaviors documented. Complete the Maladaptive Behaviors section in the interview.]'));
    return children;
  }

  const borders = {
    top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
    insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
  };

  for (let i = 0; i < targets.length; i++) {
    const bt = targets[i];

    // Behavior heading
    children.push(new Paragraph({
      children: [new TextRun({
        text: `Behavior ${i + 1}: ${bt.behaviorName || 'Untitled Behavior'}`,
        bold: true, size: SZ, font: FONT, color: TEAL,
      })],
      spacing: { before: 200, after: 80 },
    }));

    // Operational definition
    if (bt.operationalDefinition?.trim()) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Operational Definition: ', bold: true, size: SZ, font: FONT }),
          new TextRun({ text: bt.operationalDefinition, size: SZ, font: FONT }),
        ],
        spacing: { after: 80 },
      }));
    }

    // Antecedents
    if (bt.antecedents?.trim()) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Antecedents: ', bold: true, size: SZ, font: FONT }),
          new TextRun({ text: bt.antecedents, size: SZ, font: FONT }),
        ],
        spacing: { after: 100 },
      }));
    }

    // 5-column data table (matching MaladaptiveBehaviorsReviewView exactly)
    const colWidths = [18, 16, 14, 26, 26]; // sum = 100
    const headers   = [
      'Target Behavior',
      'Hypothesized Function',
      'Baseline Rate',
      'Short-Term Objective (STO)',
      'Long-Term Objective (LTO)',
    ];
    const values = [
      bt.behaviorName        || '—',
      bt.hypothesizedFunction || '—',
      computeBtBaseline(bt),
      (bt.stoSteps ?? []).length > 0
        ? bt.stoSteps.map((s, si) =>
            `STO ${si + 1}: Reduce to ${s.targetFrequency || '?'} per ${bt.frequencyUnit || 'day'} for ${s.durationWeeks || '?'} consecutive weeks.`
          ).join('\n')
        : computeBtSTO(bt),
      computeBtLTO(bt),
    ];

    children.push(new Table({
      width:   { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({
          children: headers.map((h, ci) =>
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: h, bold: true, size: SZ_SM, font: FONT, color: TEAL })],
                spacing: { after: 0 },
              })],
              shading: { type: ShadingType.SOLID, color: TEAL_LIGHT },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
            })
          ),
        }),
        new TableRow({
          children: values.map((v, ci) =>
            new TableCell({
              children: [new Paragraph({
                children: parseBoldRuns(v, { size: SZ_SM, font: FONT }),
                spacing: { after: 0 },
              })],
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
            })
          ),
        }),
      ],
    }));

    // Additional clinical details (topography, intensity, measurement — below the table)
    const details = [
      bt.topography?.length ? labelVal('Topography', bt.topography.join(', ')) : null,
      bt.intensityRating    ? labelVal('Intensity',   bt.intensityRating)       : null,
      bt.measurementSystem  ? labelVal('Measurement System', bt.measurementSystem) : null,
      bt.notes              ? labelVal('Clinical Notes', bt.notes)               : null,
    ].filter(Boolean);

    if (details.length) {
      children.push(empty(60));
      children.push(...details);
    }

    // ── Baseline frequency chart + STO trajectory chart ───────────────────────
    const key = normalize(bt.behaviorName || '');
    if (key) {
      const baselineChart = chartImage(graphs[`behavior_${key}`], 500, 250);
      const stoChart      = chartImage(graphs[`sto_${key}`],      500, 250);
      if (baselineChart || stoChart) {
        children.push(empty(80));
        if (baselineChart) children.push(baselineChart);
        if (stoChart)      children.push(stoChart);
      }
    }

    children.push(empty(160));
  }

  return children;
}

// ─── 15. Reinforcement / Preference Assessment ────────────────────────────────
// Source: skill_acquisitions.notes (contains reinforcer identification from
// the family interview) + teaching strategies from skillGoals[].

function reinforcementSection(session) {
  const children = [sectionHeading('Reinforcement — Stimulus Preference Assessment')];
  const skillSec = session.sections?.skill_acquisitions;
  const goals    = skillSec?.skillGoals ?? [];
  const notes    = skillSec?.notes      ?? '';

  children.push(bodyPara(
    'Results based on caregiver interview and structured preference assessment identified the following ' +
    'preferred items and activities for use as reinforcers in ABA programming:'
  ));
  children.push(empty(60));

  // Extract reinforcer-related lines from notes
  if (notes) {
    const reinforcerLines = notes
      .split(/[.\n]/)
      .filter(s => /reinforc|prefer|reward|motivat|favorite|snack|edible|social|tangib|activit/i.test(s) && s.trim().length > 15)
      .map(s => s.trim())
      .filter(Boolean);

    if (reinforcerLines.length) {
      for (const line of reinforcerLines.slice(0, 5)) {
        children.push(bullet(line));
      }
    }
  }

  // Teaching strategies used across skill programs → derive reinforcement approach
  if (goals.length) {
    const strategies = [...new Set(goals.flatMap(g => g.teachingStrategies ?? []))];
    if (strategies.length) {
      children.push(empty(80));
      children.push(subHeading('Teaching & Reinforcement Methods'));
      for (const s of strategies) children.push(bullet(s));
    }
  }

  children.push(empty(160));
  return children;
}

// ─── 16. Hypothesis-Based Interventions ──────────────────────────────────────
// Source: behavior_targets.draftContent — the AI-generated functional hypothesis
// and preliminary intervention narrative for each target behavior.
// Falls back to generating from structured data if no draft exists.

function hypothesisSection(session) {
  const children = [sectionHeading('Hypothesis-Based Interventions')];
  const btSec    = session.sections?.behavior_targets;
  const draft    = btSec?.draftContent?.trim();
  const targets  = btSec?.behaviorTargets ?? [];

  children.push(bodyPara(
    'The following hypothesis-based interventions will be initiated to address the identified behavioral ' +
    'patterns. Strategies have been selected based on the hypothesized functions of the client\'s behavior ' +
    'and represent the least intrusive, most clinically effective options available within the environments ' +
    'in which the client participates.'
  ));
  children.push(empty(80));

  if (draft) {
    // Use the AI-generated functional hypothesis narrative from the behavior targets section
    children.push(...markdownToParagraphs(draft));
  } else if (targets.length) {
    // Fall back: build from structured data
    const functionSet = [...new Set(targets.map(bt => bt.hypothesizedFunction).filter(Boolean))];
    if (functionSet.length) {
      children.push(subHeading('Identified Behavioral Functions'));
      for (const fn of functionSet) {
        const related = targets.filter(bt => bt.hypothesizedFunction === fn).map(bt => bt.behaviorName).join(', ');
        children.push(bullet(`**${fn}** — ${related}`));
      }
      children.push(empty(80));
    }

    children.push(subHeading('Behavior-Specific Intervention Approach'));
    for (const bt of targets) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: bt.behaviorName, bold: true, size: SZ, font: FONT })],
          spacing: { before: 120, after: 40 },
        }),
        bodyPara(
          `Hypothesized function: ${bt.hypothesizedFunction ?? 'under assessment'}. ` +
          `Intervention approach: FCT to establish a functional replacement behavior; ` +
          `differential reinforcement of alternative behavior (DRA); antecedent modifications ` +
          `to reduce triggering conditions; extinction of the target behavior contingent on the ` +
          `replacement behavior being reliably in the client's repertoire.`
        ),
      );
    }
  } else {
    children.push(bodyPara('[Complete the Behavior Targets section to generate the hypothesis-based intervention plan.]'));
  }

  children.push(empty(80));
  return children;
}

// ─── 17. Standard Intervention Techniques ────────────────────────────────────
// Fixed list from the clinic's template — these apply to all clients.

const CLINIC_INTERVENTIONS = [
  {
    name: 'Differential Reinforcement of Alternative Behavior (DRA)',
    desc: 'When the client presents the target behavior, reinforce an alternative behavior that serves the same function. Immediately and consistently reinforce the alternative to build a stronger response.',
  },
  {
    name: 'Differential Reinforcement of Incompatible Behaviors (DRI)',
    desc: 'Engage the client in an activity that is physically incompatible with the target behavior (e.g., sitting vs. standing, holding an object vs. throwing). Praise and reinforce the incompatible behavior.',
  },
  {
    name: 'Differential Reinforcement of Other Behavior (DRO)',
    desc: 'Deliver reinforcement during any interval in which the target behavior did not occur. Gradually increase the interval length as the behavior decreases.',
  },
  {
    name: 'Functional Communication Training (FCT)',
    desc: 'Teach the client to use an appropriate communicative response — verbal, gestural, or AAC-based — to access the reinforcer that previously maintained the target behavior. Honor the mand immediately and consistently to build the replacement response.',
  },
  {
    name: 'Stop–Redirect–Reinforce (SRR)',
    desc: 'When the target behavior occurs, calmly signal the client to stop, redirect to an appropriate alternative behavior, and immediately reinforce engagement in that alternative.',
  },
  {
    name: 'Premack Principle (First-Then)',
    desc: 'Use a highly preferred behavior as a contingent reinforcer for completing a less preferred task. Use visual First-Then supports to communicate the contingency clearly before the task begins.',
  },
  {
    name: 'Planned Ignoring (Extinction)',
    desc: 'Withhold social attention contingent on the target behavior. Maintain visual supervision at all times. Immediately and robustly reinforce the appropriate alternative behavior.',
  },
  {
    name: 'Antecedent Modification / Environment Manipulation',
    desc: 'Proactively modify the environment before the target behavior occurs — including altering task demands, using visual schedules and timers, providing advance transition warnings, and reducing identified setting event conditions.',
  },
  {
    name: 'Non-Contingent Reinforcement (NCR)',
    desc: 'Deliver reinforcement on a fixed time schedule, independent of behavior, to satiate the motivating operation for the target behavior before it occurs. Gradually thin the schedule as behavior stabilizes.',
  },
  {
    name: 'Task Analysis / Chaining',
    desc: 'Develop a step-by-step guide to teach full completion of a multi-step skill. Apply forward chaining, backward chaining, or all-task chaining based on the client\'s current skill level and the task requirements.',
  },
  {
    name: 'Discrete Trial Training (DTT)',
    desc: 'Use structured instructional trials with a clear antecedent, targeted response, and immediate consequence. Apply in massed-practice format for new skill acquisition with errorless teaching and systematic prompt fading.',
  },
  {
    name: 'Natural Environment Teaching (NET)',
    desc: 'Teach skills within naturally occurring routines and activities using incidental teaching, environmental arrangement, and follow-the-child\'s lead to capture and create functional learning opportunities.',
  },
  {
    name: 'Errorless Teaching',
    desc: 'Prompt the correct response immediately to ensure accuracy and minimize frustration. Systematically fade prompts using a least-to-most or most-to-least hierarchy to promote independent responding.',
  },
  {
    name: 'Parent / Caregiver Training',
    desc: 'Provide structured training for caregivers in behavior management strategies, implementation of skill programs, data collection procedures, and consistent application of the behavior support plan across home, school, and community settings.',
  },
];

function interventionsSection() {
  const children = [sectionHeading('Intervention Techniques')];

  children.push(bodyPara(
    'The following evidence-based intervention techniques will be utilized as clinically indicated across sessions ' +
    'and environments. Selection and emphasis will be guided by the individualized treatment plan and ongoing data review.'
  ));
  children.push(empty(80));

  for (const inv of CLINIC_INTERVENTIONS) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `• ${inv.name}`, bold: true, size: SZ, font: FONT })],
        spacing: { before: 120, after: 40 },
      }),
      bodyPara(inv.desc),
    );
  }

  children.push(empty(80));
  return children;
}

// ─── 18. Skill Acquisitions ───────────────────────────────────────────────────
// Built entirely from skillGoals[] structured data — the same source and the
// same computed helpers as SkillAcquisitionsReviewView.jsx.
// This guarantees that the Word doc table always matches what the BCBA saw and
// approved in the Review page, even if the AI draftContent was edited separately.

function skillAcquisitionsSection(session, graphs = {}) {
  const children = [sectionHeading('Skill Acquisitions')];
  const sec   = session.sections?.skill_acquisitions;
  const goals = sec?.skillGoals ?? [];

  if (!goals.length) {
    children.push(bodyPara('[No skill acquisition goals documented. Complete the Skill Acquisitions section in the interview.]'));
    return children;
  }

  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];

    // Goal heading — "Goal 1: Functional Help-Seeking (Verbal Request)"
    children.push(new Paragraph({
      children: [new TextRun({
        text: `Goal ${i + 1}: ${g.targetSkill || 'Untitled Goal'}`,
        bold: true, size: SZ, font: FONT, color: TEAL,
      })],
      spacing: { before: 200, after: 80 },
    }));

    // Operational definition
    if (g.operationalDefinition?.trim()) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Operational Definition: ', bold: true, size: SZ, font: FONT }),
          new TextRun({ text: g.operationalDefinition, size: SZ, font: FONT }),
        ],
        spacing: { after: 80 },
      }));
    }

    // Teaching strategies (include free-text "Other" if filled)
    const strategiesArr = Array.isArray(g.teachingStrategies) ? g.teachingStrategies : [];
    const strategiesParts = [...strategiesArr];
    if (g.teachingStrategiesOther?.trim()) strategiesParts.push(g.teachingStrategiesOther.trim());
    const strategies = strategiesParts.join(', ');
    if (strategies) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Teaching Strategies: ', bold: true, size: SZ, font: FONT }),
          new TextRun({ text: strategies, size: SZ, font: FONT }),
        ],
        spacing: { after: 100 },
      }));
    }

    // 5-column data table (matching SkillAcquisitionsReviewView exactly)
    const colWidths = [20, 25, 20, 35]; // percentages, must sum to 100
    const headers   = [
      'Target Behavior',
      '6-Month Target (STO)',
      'Baseline Data',
      'Mastery Criteria (LTO)',
    ];
    const values = [
      g.targetSkill || '—',
      computeSkillSTO(g),
      computeSkillBaseline(g),
      computeSkillMastery(g),
    ];

    const borders = {
      top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
      bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
      left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
      right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
      insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
      insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
    };

    children.push(new Table({
      width:   { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        // Header row
        new TableRow({
          children: headers.map((h, ci) =>
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: h, bold: true, size: SZ_SM, font: FONT, color: TEAL })],
                spacing: { after: 0 },
              })],
              shading: { type: ShadingType.SOLID, color: TEAL_LIGHT },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
            })
          ),
        }),
        // Data row
        new TableRow({
          children: values.map((v, ci) =>
            new TableCell({
              children: [new Paragraph({
                children: parseBoldRuns(v, { size: SZ_SM, font: FONT }),
                spacing: { after: 0 },
              })],
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
            })
          ),
        }),
      ],
    }));

    // Generalization notes
    if (g.generalizationNotes?.trim()) {
      children.push(empty(80));
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Generalization & Maintenance: ', bold: true, size: SZ, font: FONT }),
          new TextRun({ text: g.generalizationNotes, size: SZ, font: FONT }),
        ],
        spacing: { after: 100 },
      }));
    }

    children.push(empty(160));
  }

  // ── Replacement behavior comparison chart (all goals side-by-side) ──────────
  const rbChart = chartImage(graphs['replacement_behaviors'], 560, 280);
  if (rbChart) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Baseline vs. Mastery — All Skill Targets', bold: true, size: SZ, font: FONT, color: TEAL })],
        spacing: { before: 160, after: 60 },
      }),
      rbChart,
    );
  }

  // ── Per-skill STO trajectory charts ──────────────────────────────────────────
  const normalize = (label) =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  for (const g of goals) {
    const name = (g.targetSkill || '').trim();
    if (!name) continue;
    const stoKey   = `skill_sto_${normalize(name)}`;
    const stoChart = chartImage(graphs[stoKey], 560, 280);
    if (stoChart) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${name} — STO Trajectory`, bold: true, size: SZ, font: FONT, color: TEAL })],
          spacing: { before: 160, after: 60 },
        }),
        stoChart,
      );
    }
  }

  return children;
}

// ─── 19. Crisis Plan ─────────────────────────────────────────────────────────
// ─── §19 Caregiver Training Program ──────────────────────────────────────────
// Source: caregiver_training section — structured baselines, format chips,
// frequency, barriers, strengths, plus the AI-generated training narrative.
// Insurance reviewers use this section to verify hours requested for caregiver
// training are clinically justified.

function caregiverTrainingSection(session, graphs = {}) {
  const children = [sectionHeading('Caregiver Training Program')];
  const sec = session.sections?.caregiver_training;

  if (!sec) {
    children.push(bodyPara('[Caregiver training not yet documented. Complete the Caregiver Training section in the interview.]'));
    return children;
  }

  const ctTargets = sec.caregiverTrainingTargets ?? [];

  // ── Caregiver training targets table ──────────────────────────────────────
  if (ctTargets.length > 0) {
    children.push(subHeading('Caregiver Training Targets'));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
        },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({ shading: { type: ShadingType.SOLID, color: TEAL_LIGHT }, children: [new Paragraph({ children: [new TextRun({ text: 'Goal', bold: true, size: SZ_SM, font: FONT, color: TEAL })] })] }),
              new TableCell({ shading: { type: ShadingType.SOLID, color: TEAL_LIGHT }, children: [new Paragraph({ children: [new TextRun({ text: 'Baseline %', bold: true, size: SZ_SM, font: FONT, color: TEAL })] })] }),
              new TableCell({ shading: { type: ShadingType.SOLID, color: TEAL_LIGHT }, children: [new Paragraph({ children: [new TextRun({ text: 'STO', bold: true, size: SZ_SM, font: FONT, color: TEAL })] })] }),
              new TableCell({ shading: { type: ShadingType.SOLID, color: TEAL_LIGHT }, children: [new Paragraph({ children: [new TextRun({ text: 'LTO', bold: true, size: SZ_SM, font: FONT, color: TEAL })] })] }),
            ],
          }),
          ...ctTargets.map(t => {
            const bp  = t.baselinePercent != null ? `${t.baselinePercent}%${t.baselineContext?.trim() ? ` (${t.baselineContext.trim()})` : ''}` : '—';
            const sto = computeCaregiverSTO(t);
            const lto = t.lto?.trim() || (t.ltoPercent != null && t.ltoSessions != null ? `${t.ltoPercent}% across ${t.ltoSessions} sessions` : t.ltoPercent != null ? `${t.ltoPercent}%` : '—');
            // STO cell: split multi-step string into separate paragraphs
            const stoLines = sto.split('\n').filter(Boolean);
            return new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t.goalName || '—', size: SZ_SM, font: FONT })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: bp, size: SZ_SM, font: FONT })] })] }),
              new TableCell({ children: stoLines.map(line => new Paragraph({ children: [new TextRun({ text: line, size: SZ_SM, font: FONT })] })) }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lto, size: SZ_SM, font: FONT })] })] }),
            ]});
          }),
        ],
      })
    );
    children.push(empty(100));

    // Embed per-target charts
    for (const t of ctTargets) {
      const key = `caregiver_target_${normalize(t.goalName || '')}`;
      const img = chartImage(graphs[key], 460, 230);
      if (img) children.push(img);
    }
    children.push(empty(80));
  }

  // ── Training program details ───────────────────────────────────────────────
  const formats = sec.trainingFormat ?? [];
  const freq    = sec.trainingFrequency ?? '';
  if (formats.length || freq) {
    children.push(subHeading('Training Program'));
    if (formats.length) children.push(labelVal('Format', formats.join(', ')));
    if (freq)           children.push(labelVal('Frequency', freq));
    children.push(empty(80));
  }

  if (sec.trainingBarriers?.trim()) {
    children.push(labelVal('Barriers to Participation', sec.trainingBarriers));
    children.push(empty(80));
  }

  if (sec.caregiverStrengths?.trim()) {
    children.push(labelVal('Caregiver Strengths', sec.caregiverStrengths));
    children.push(empty(80));
  }

  // ── AI narrative (BCBA-approved training plan) ────────────────────────────
  const draft = sec.draftContent?.trim();
  if (draft) {
    children.push(subHeading('Training Plan & Objectives'));
    children.push(...markdownToParagraphs(draft));
  } else if (sec.notes?.trim()) {
    children.push(subHeading('Clinical Notes'));
    children.push(bodyPara(sec.notes));
  } else {
    children.push(bodyPara('[Generate the Caregiver Training section draft to include a full training plan narrative.]'));
  }

  return children;
}

// Primary source: crisis_plan.draftContent — the AI narrative the BCBA sees
// and approves in the Review page (warning signs, de-escalation, thresholds).
// Appended below the draft: emergency contacts table and call thresholds from
// structured fields, since these are precise reference data that must always
// appear verbatim regardless of what the BCBA edited in the narrative.

function crisisPlanSection(session) {
  const children = [sectionHeading('Crisis Plan')];
  const sec      = session.sections?.crisis_plan;

  if (!sec) {
    children.push(bodyPara('[Crisis plan not yet completed. Complete the Crisis Plan section in the interview.]'));
    return children;
  }

  const draft = sec.draftContent?.trim();

  // ── AI draft (what the BCBA approved) ──────────────────────────────────────
  if (draft) {
    children.push(...markdownToParagraphs(draft));
    children.push(empty(120));
  }

  // ── Emergency contacts — always rendered from structured data ───────────────
  // Phone numbers and relationships must be exact; not left to AI paraphrase.
  const contacts = sec.emergencyContacts ?? [];
  if (contacts.length) {
    children.push(subHeading('Emergency Contacts'));
    for (const c of contacts) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${c.role ?? 'Contact'}: `, bold: true, size: SZ, font: FONT }),
          new TextRun({ text: `${c.name} (${c.relationship}) — ${c.phone}`, size: SZ, font: FONT }),
        ],
        spacing: { after: 80 },
      }));
    }
    children.push(empty(80));
  }

  // ── Structured reference data — always rendered regardless of AI draft ────────
  // These are precise clinical values the AI may paraphrase; showing them verbatim
  // ensures insurance reviewers and RBTs have the exact data on file.

  const signs = [
    ...(sec.warningSignsSelected ?? []),
    ...(sec.warningSignsCustom?.trim() ? [sec.warningSignsCustom.trim()] : []),
  ];
  if (signs.length) {
    children.push(subHeading('Early Warning Signs'));
    for (const s of signs) children.push(bullet(s));
    children.push(empty(80));
  }

  const deWorks = [
    ...(sec.deEscalationWorks ?? []),
    ...(sec.deEscalationWorksOther?.trim() ? [sec.deEscalationWorksOther.trim()] : []),
  ];
  if (deWorks.length) {
    children.push(subHeading('De-Escalation Strategies — Effective'));
    for (const s of deWorks) children.push(bullet(s));
    children.push(empty(80));
  }

  const deWorsens = [
    ...(sec.deEscalationWorsens ?? []),
    ...(sec.deEscalationWorsensOther?.trim() ? [sec.deEscalationWorsensOther.trim()] : []),
  ];
  if (deWorsens.length) {
    children.push(subHeading('Strategies That Worsen Escalation — Avoid'));
    for (const s of deWorsens) children.push(bullet(s));
    children.push(empty(80));
  }

  if (sec.deEscalationNotes?.trim()) {
    children.push(labelVal('De-escalation Notes', sec.deEscalationNotes));
  }

  if (sec.baselineReturnMin || sec.baselineReturnMax) {
    const range = sec.baselineReturnMax
      ? `${sec.baselineReturnMin || '?'}–${sec.baselineReturnMax} minutes`
      : `${sec.baselineReturnMin} minutes`;
    children.push(labelVal('Expected Return to Baseline', range));
  }

  // BCBA / 911 / session suspension thresholds
  if (sec.bcbaCallMinutes) {
    children.push(labelVal(
      'BCBA Call Threshold',
      `Contact supervising BCBA within ${sec.bcbaCallMinutes} minutes if ${sec.bcbaCallIncidents ?? '2'}+ incidents occur within a ${sec.bcbaCallWindow ?? '30'}-minute session window.`
    ));
  }
  if (sec.call911Threshold && sec.call911Notes?.trim()) {
    children.push(labelVal('911 Call Threshold', sec.call911Notes));
  }
  if (sec.sessionSuspendThreshold && sec.sessionSuspendNotes?.trim()) {
    children.push(labelVal('Session Suspension Threshold', sec.sessionSuspendNotes));
  }

  if (sec.medicalNotes?.trim()) {
    children.push(labelVal('Medical Considerations', sec.medicalNotes));
  }

  const contraindications = sec.medicalContraindications ?? [];
  if (contraindications.length) {
    children.push(labelVal('Medical Contraindications', contraindications.join(', ')));
  }

  // ── Compliance acknowledgments — legally significant ───────────────────────
  const ackLines = [
    sec.caregiverSignedCrisisPlan  && 'Caregiver has signed the crisis plan',
    sec.rbtTrainedOnPlan           && 'RBT has been trained on this crisis plan',
    sec.crisisPlanInBsp            && 'Crisis plan is included in the BSP',
  ].filter(Boolean);

  if (ackLines.length) {
    children.push(empty(80));
    children.push(subHeading('Compliance Acknowledgments'));
    for (const line of ackLines) children.push(bullet(line));
  }

  children.push(empty(80));
  return children;
}

// ─── Manual completion reminder ───────────────────────────────────────────────

function manualCompletionNote() {
  return [
    empty(160),
    new Paragraph({
      children: [new TextRun({
        text: '— Sections Requiring Manual Completion by Supervising BCBA —',
        bold: true, size: SZ_SM, font: FONT, color: '94A3B8', italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    bullet('Standardized assessment scores — see placeholder sections below (QABF, BASC-3, Vineland-3). Paste graphs into each section and delete the prompt text before submitting.'),
    bullet('Data graphs and visual analysis — auto-generated charts are included in this document. Please review them thoroughly for accuracy before submission.'),
    bullet('Insurance-specific prior authorization attachments'),
    bullet('Any assessment results not yet available at time of this report'),
    empty(240),
  ];
}

// ─── Standardized assessment score placeholders ────────────────────────────────

function standardizedAssessmentPlaceholders() {
  return [
    ...placeholderSection(
      'QABF — Questions About Behavioral Function',
      'QABF (Questions About Behavioral Function)',
      'Include total scores for each subscale (Attention, Escape, Non-Social/Automatic, Physical, Tangible), the profile graph, and a brief interpretive note linking the highest-scoring function to the treatment targets documented in this report.',
    ),
    ...placeholderSection(
      'BASC-3 — Behavior Assessment System for Children',
      'BASC-3 (Behavior Assessment System for Children, 3rd Edition)',
      'Include the composite scores and clinical subscale T-scores from the applicable rating form (Parent, Teacher, or Self-Report). Note any scores in the At-Risk or Clinically Significant range and their relevance to the presenting concerns.',
    ),
    ...placeholderSection(
      'Vineland-3 — Adaptive Behavior Scales',
      'Vineland-3 (Vineland Adaptive Behavior Scales, 3rd Edition)',
      'Include the Adaptive Behavior Composite (ABC) score, domain standard scores (Communication, Daily Living Skills, Socialization, Motor Skills), and the adaptive level classification. Note any subdomain v-scale scores that directly inform treatment goals.',
    ),
  ];
}

function placeholderSection(heading, fullName, instructions) {
  return [
    sectionHeading(heading),
    new Paragraph({
      children: [new TextRun({
        text: '[ BCBA ACTION REQUIRED — DELETE THIS PROMPT BEFORE SUBMITTING ]',
        bold: true, size: SZ_SM, font: FONT, color: 'DC2626',
      })],
      spacing: { after: 80 },
      shading: { type: ShadingType.SOLID, color: 'FEF2F2' },
    }),
    bodyPara(`${fullName} — Paste the score summary, profile graph, or report excerpt from this assessment into this section. Include the administration date, respondent name, and the clinician who administered the tool. Delete this prompt once the content has been added.`),
    bodyPara(instructions),
    empty(400),
  ];
}

// ─── Signature block ──────────────────────────────────────────────────────────

function signatureSection() {
  const divider = () =>
    new Paragraph({
      children: [new TextRun({ text: '_'.repeat(42), size: SZ, font: FONT, color: '94A3B8' })],
      spacing: { after: 40 },
    });

  const sigLabel = (text) =>
    new Paragraph({
      children: [new TextRun({ text, size: SZ_SM, font: FONT, color: SLATE })],
      spacing: { after: 160 },
    });

  const printLabel = (text) =>
    new Paragraph({
      children: [
        new TextRun({ text: 'Print Name: ', bold: true, size: SZ_SM, font: FONT }),
        new TextRun({ text: '_'.repeat(32), size: SZ_SM, font: FONT, color: '94A3B8' }),
        new TextRun({ text: `     ${text}`, bold: true, size: SZ_SM, font: FONT }),
      ],
      spacing: { after: 120 },
    });

  return [
    sectionHeading('Signatures & Authorization'),

    bodyPara(
      'By signing below, the parent/guardian acknowledges receipt of this report and consents to the implementation of the treatment plan. The supervising BCBA certifies that this assessment was conducted in accordance with the BACB Ethics Code and the applicable state licensure standards.'
    ),
    empty(80),

    // Parent / Guardian
    new Paragraph({
      children: [new TextRun({ text: 'Parent / Guardian', bold: true, size: SZ, font: FONT, color: TEAL })],
      spacing: { before: 120, after: 80 },
    }),
    printLabel('(please print)'),
    divider(),
    new Paragraph({
      children: [
        new TextRun({ text: 'Signature', size: SZ_SM, font: FONT, color: SLATE }),
        new TextRun({ text: '                                                   ', size: SZ_SM, font: FONT }),
        new TextRun({ text: 'Date: ', bold: true, size: SZ_SM, font: FONT }),
        new TextRun({ text: '_'.repeat(18), size: SZ_SM, font: FONT, color: '94A3B8' }),
      ],
      spacing: { after: 200 },
    }),

    // Lead BCBA
    new Paragraph({
      children: [new TextRun({ text: 'Lead Behavior Analyst (BCBA)', bold: true, size: SZ, font: FONT, color: TEAL })],
      spacing: { before: 120, after: 80 },
    }),
    printLabel('(BCBA credential number)'),
    divider(),
    new Paragraph({
      children: [
        new TextRun({ text: 'Behavior Analyst Signature', size: SZ_SM, font: FONT, color: SLATE }),
        new TextRun({ text: '                                    ', size: SZ_SM, font: FONT }),
        new TextRun({ text: 'Date: ', bold: true, size: SZ_SM, font: FONT }),
        new TextRun({ text: '_'.repeat(18), size: SZ_SM, font: FONT, color: '94A3B8' }),
      ],
      spacing: { after: 200 },
    }),

    // Clinical Director
    new Paragraph({
      children: [new TextRun({ text: 'Clinical Director', bold: true, size: SZ, font: FONT, color: TEAL })],
      spacing: { before: 120, after: 80 },
    }),
    printLabel('(credential / title)'),
    divider(),
    new Paragraph({
      children: [
        new TextRun({ text: 'Clinical Director Signature', size: SZ_SM, font: FONT, color: SLATE }),
        new TextRun({ text: '                                   ', size: SZ_SM, font: FONT }),
        new TextRun({ text: 'Date: ', bold: true, size: SZ_SM, font: FONT }),
        new TextRun({ text: '_'.repeat(18), size: SZ_SM, font: FONT, color: '94A3B8' }),
      ],
      spacing: { after: 160 },
    }),

    empty(240),
  ];
}

// ─── Reassessment document helpers ───────────────────────────────────────────
//
// All functions below are used exclusively by generateReassessmentDoc().
// They are NOT called by generateInitialAssessmentDoc() / generateAssessmentDoc().

/** Shared date formatter used across reassessment sections */
const fmtDocDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Shared table border style for reassessment progress tables */
const PROGRESS_BORDERS = {
  top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
  insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
};

/** Shared cell builder for progress tables */
const progressCell = (text, opts = {}) => new TableCell({
  children: [new Paragraph({
    children: parseBoldRuns(text ?? '—', { size: SZ_SM, font: FONT, bold: opts.header ?? false }),
    spacing: { after: 0 },
  })],
  shading:  opts.header ? { type: ShadingType.SOLID, color: TEAL_LIGHT } : undefined,
  margins:  { top: 60, bottom: 60, left: 100, right: 100 },
  width:    opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
});

// ── R1. Reassessment title block ──────────────────────────────────────────────

function reassessmentTitleBlock(session) {
  const p        = session.clientProfile ?? {};
  const fmt      = (iso) => iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const assessDate = fmt(p.assessmentDate);
  const authStart  = session.authPeriodStart ? fmt(session.authPeriodStart) : null;
  const authEnd    = session.authPeriodEnd   ? fmt(session.authPeriodEnd)   : null;

  return [
    new Paragraph({
      children: [new TextRun({ text: 'ABA SHIELD BEHAVIORAL SERVICES', bold: true, size: SZ_XL, font: FONT, color: TEAL })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'RE-ASSESSMENT REPORT', bold: true, size: SZ_LG, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'Progress Report & New Authorization Cycle Treatment Plan',
        size: SZ, font: FONT, italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: authStart && authEnd
          ? `Authorization Period: ${authStart} — ${authEnd}  ·  Assessment Date: ${assessDate}`
          : `Assessment Date: ${assessDate}`,
        size: SZ_SM, font: FONT, color: SLATE, italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];
}

// ── R2. Executive Summary (progressNarrativeText) ─────────────────────────────

function executiveSummarySection(session) {
  const heading = session.authPeriodStart || session.authPeriodEnd
    ? `Clinical Overview — Authorization Period ${fmtDocDate(session.authPeriodStart)} — ${fmtDocDate(session.authPeriodEnd)}`
    : 'Clinical Overview';

  const text     = session.progressNarrativeText?.trim();
  const children = [sectionHeading(heading)];

  if (text) {
    children.push(...markdownToParagraphs(text));
  } else {
    children.push(new Paragraph({
      children: [new TextRun({
        text: '[ BCBA ACTION REQUIRED — Complete the narrative in the Reassessment Review page before generating this document ]',
        bold: true, size: SZ_SM, font: FONT, color: 'DC2626',
      })],
      spacing: { after: 80 },
      shading: { type: ShadingType.SOLID, color: 'FEF2F2' },
    }));
    children.push(bodyPara(
      'Complete the "Progress Narrative" field in the Narrative & Document panel of the Reassessment Review page. ' +
      'Include: summary of progress this authorization period, clinical reasoning for continued services, ' +
      'key changes from initial assessment, and recommendation for new authorization.'
    ));
  }

  children.push(empty(80));
  return children;
}

// ── R3. Clinical background sections (prefilled from initial, BCBA-reviewed) ──

const REASSESSMENT_BACKGROUND_SECTIONS = [
  { key: 'demographics',        label: 'Demographics & Referral Information' },
  { key: 'presenting_concerns', label: 'Presenting Concerns'                 },
  { key: 'self_help',           label: 'Self-Help Skills'                    },
  { key: 'daily_living',        label: 'Daily Living Skills'                 },
  { key: 'safety',              label: 'Safety Concerns'                     },
  { key: 'communication',       label: 'Communication'                       },
  { key: 'self_stim',           label: 'Self-Stimulatory Behavior'           },
];

function reassessmentClinicalBackgroundSections(session) {
  const children = [];

  for (const cfg of REASSESSMENT_BACKGROUND_SECTIONS) {
    const sec        = session.sections?.[cfg.key];
    const isApproved = sec?.approvalState === 'approved' || sec?.approvalState === 'edited';
    const isPrefilled = sec?.prefillSource === 'initial_assessment';
    const text       = sec?.draftContent?.trim() || sec?.notes?.trim() || '';

    children.push(sectionHeading(cfg.label));

    // Provenance note
    if (isApproved && sec?.draftContent?.trim()) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'Reviewed & updated at reassessment',
          size: SZ_SM, font: FONT, color: '059669', italics: true,
        })],
        spacing: { after: 80 },
      }));
    } else if (isPrefilled && text) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'Carried forward from initial assessment — review and update as clinically indicated',
          size: SZ_SM, font: FONT, color: '6366F1', italics: true,
        })],
        spacing: { after: 80 },
      }));
    }

    if (text) {
      children.push(...markdownToParagraphs(text));
    } else {
      children.push(bodyPara('[Section not yet completed — update in the reassessment interview or add clinical notes.]'));
    }

    children.push(empty(80));
  }

  return children;
}

// ── R4. Continued Medical Necessity (re-evaluated — NOT prefilled) ─────────────

function reassessmentMedicalSection(session) {
  const sec  = session.sections?.medical_necessity;
  const text = sec?.draftContent?.trim() || sec?.notes?.trim() || '';
  const meds = sec?.medications          ?? [];
  const diag = sec?.coOccurringDiagnoses ?? [];
  const aba  = sec?.priorABAHistory      ?? [];

  const children = [sectionHeading('Continued Medical Necessity')];

  children.push(new Paragraph({
    children: [new TextRun({
      text: 'This section documents continued medical necessity for ABA services as evaluated at reassessment. A new clinical justification is required for the upcoming authorization period.',
      size: SZ_SM, font: FONT, color: SLATE, italics: true,
    })],
    spacing: { after: 120 },
  }));

  if (text) {
    children.push(...markdownToParagraphs(text));
  } else {
    children.push(new Paragraph({
      children: [new TextRun({
        text: '[ BCBA ACTION REQUIRED — Complete the Medical Necessity section in the reassessment interview ]',
        bold: true, size: SZ_SM, font: FONT, color: 'DC2626',
      })],
      spacing: { after: 80 },
      shading: { type: ShadingType.SOLID, color: 'FEF2F2' },
    }));
  }
  children.push(empty(80));

  // Structured medical data
  if (diag.length) {
    children.push(subHeading('Co-Occurring Diagnoses'));
    for (const dx of diag) {
      children.push(bullet(
        `${dx.diagnosis}${dx.icd10 ? ` (${dx.icd10})` : ''} — confirmed by ${dx.provider ?? '—'}, ${dx.date ?? '—'}`
      ));
    }
    children.push(empty(80));
  }

  children.push(subHeading('Current Medications'));
  if (meds.length) {
    for (const med of meds) {
      children.push(bullet(
        `${med.name} ${med.dose}, ${med.frequency}` +
        (med.prescriber ? ` — prescribed by ${med.prescriber}` : '') +
        (med.purpose ? ` for ${med.purpose}` : '')
      ));
    }
  } else {
    children.push(bodyPara('No current medications reported.'));
  }
  children.push(empty(80));

  if (aba.length) {
    children.push(subHeading('Prior ABA Services'));
    for (const a of aba) {
      children.push(bullet(
        `${a.provider} (${a.startDate ?? '—'} – ${a.endDate ?? 'present'}, ` +
        `${a.hoursPerWeek ?? '—'} hrs/week, ${a.setting ?? '—'})` +
        (a.reasonDiscontinued ? `. Discontinued: ${a.reasonDiscontinued}` : '')
      ));
    }
    children.push(empty(80));
  }

  if (sec?.recommendedHoursPerWeek) {
    children.push(labelVal(
      'Recommended Service Intensity',
      `${sec.recommendedHoursPerWeek} hours/week — ${sec.recommendedSetting ?? 'as clinically indicated'}`
    ));
  }

  children.push(empty(80));
  return children;
}

// ── R5. Strengths (initial baseline + gains this period) ──────────────────────

function reassessmentStrengthsSection(session) {
  const skillGoals = session.sections?.skill_acquisitions?.skillGoals ?? [];
  const notes      = session.sections?.skill_acquisitions?.notes ?? '';
  const origSkills = session.originalSkillSummary   ?? [];
  const origBehav  = session.originalBehaviorSummary ?? [];
  const ctSummary  = session.caregiverTrainingSummary ?? [];

  const children = [sectionHeading('Strengths')];

  // Part A: Initial assessment baseline
  children.push(subHeading('Identified Strengths — Initial Assessment Baseline'));
  if (skillGoals.length) {
    children.push(bodyPara(
      `${session.clientName ?? 'The client'} demonstrated the following strengths at initial assessment, ` +
      `which continue to inform and support ABA programming:`
    ));
    for (const g of skillGoals) {
      const baseline = parseInt(g.baselinePercent ?? '0');
      const baselineText = baseline > 0
        ? `demonstrated ${g.baselinePercent}% accuracy independently at baseline`
        : 'skill was emerging with support at initial assessment';
      children.push(bullet(
        `**${g.domain} — ${g.targetSkill}:** Client ${baselineText}.` +
        (g.generalizationNotes ? ` ${g.generalizationNotes}` : '')
      ));
    }
    const reinforcerSentence = notes.split(/[.\n]/).find(s => /reinforc|prefer|reward|motivat|favorite/i.test(s));
    if (reinforcerSentence) {
      children.push(empty(80));
      children.push(bodyPara(reinforcerSentence.trim() + '.'));
    }
  } else {
    children.push(bodyPara('[Document client strengths and identified reinforcers from initial assessment.]'));
  }
  children.push(empty(80));

  // Part B: Gains this authorization period
  const masteredSkills   = origSkills.filter(s => (s.sessionDerivedStatus ?? s.status) === 'mastered');
  const masteredBehav    = origBehav.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) === 'met');
  const reducedBehav     = origBehav.filter(b =>
    (b.percentReduction ?? 0) >= 50 && (b.sessionDerivedStoStatus ?? b.stoStatus) !== 'met'
  );
  const metCT            = ctSummary.filter(c => (c.sessionDerivedStoStatus ?? c.stoStatus) === 'met');
  const hasGains         = masteredSkills.length || masteredBehav.length || reducedBehav.length || metCT.length;

  children.push(subHeading('Gains This Authorization Period'));

  if (hasGains) {
    if (masteredBehav.length) {
      children.push(bodyPara('**Behaviors Reduced to Mastery Criteria:**'));
      for (const b of masteredBehav) {
        children.push(bullet(
          `**${b.behaviorName}** — reduced from ${b.baselineFrequency ?? '—'}×/day baseline ` +
          `to average ${b.averageFrequency != null ? Number(b.averageFrequency).toFixed(1) : '—'}×/day ` +
          `(${b.percentReduction != null ? Math.round(b.percentReduction) : '—'}% reduction). Target achieved. ✓`
        ));
      }
      children.push(empty(60));
    }
    if (reducedBehav.length) {
      children.push(bodyPara('**Significant Behavioral Reductions (≥50%):**'));
      for (const b of reducedBehav) {
        children.push(bullet(
          `**${b.behaviorName}** — reduced from ${b.baselineFrequency ?? '—'}×/day to average ` +
          `${b.averageFrequency != null ? Number(b.averageFrequency).toFixed(1) : '—'}×/day ` +
          `(${b.percentReduction != null ? Math.round(b.percentReduction) : '—'}% reduction).`
        ));
      }
      children.push(empty(60));
    }
    if (masteredSkills.length) {
      children.push(bodyPara('**Skills Achieving Mastery:**'));
      for (const s of masteredSkills) {
        children.push(bullet(
          `**${s.skillName}** (${s.domain ?? ''}) — progressed from ${s.baselinePercent ?? '—'}% baseline ` +
          `to average accuracy of ${s.averageAccuracy != null ? Number(s.averageAccuracy).toFixed(1) : '—'}% ` +
          `across ${s.sessionsLogged ?? '—'} sessions. Mastery criteria achieved. ✓`
        ));
      }
      children.push(empty(60));
    }
    if (metCT.length) {
      children.push(bodyPara('**Caregiver Training Goals Achieved:**'));
      for (const c of metCT) {
        children.push(bullet(
          `**${c.goalName}** — progressed from ${c.baselinePercent ?? '—'}% baseline ` +
          `to average ${c.averageSessionPercent != null ? Number(c.averageSessionPercent).toFixed(1) : '—'}% ` +
          `implementation accuracy. Goal achieved. ✓`
        ));
      }
      children.push(empty(60));
    }
  } else {
    children.push(bodyPara(
      'No formal mastery criteria have been achieved during this authorization period. ' +
      'Continued services are recommended to meet established treatment targets as documented in the progress sections below.'
    ));
  }

  children.push(empty(80));
  return children;
}

// ── R6. Areas requiring continued & new intervention ─────────────────────────

function reassessmentAreasSection(session) {
  const origBehav  = session.originalBehaviorSummary ?? [];
  const origSkills = session.originalSkillSummary    ?? [];
  const newBehav   = session.newBehaviorSummary      ?? [];
  const newSkills  = session.newSkillSummary         ?? [];

  const activeBehav  = origBehav.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) !== 'met');
  const activeSkills = origSkills.filter(s => (s.sessionDerivedStatus ?? s.status) !== 'mastered');

  const children = [sectionHeading('Areas Requiring Continued & New Intervention')];

  if (activeBehav.length) {
    children.push(subHeading('Active Behavior Reduction Targets'));
    for (const b of activeBehav) {
      children.push(bullet(
        `**${b.behaviorName}** — Function: ${b.function ?? 'under review'}. ` +
        `Baseline: ${b.baselineFrequency ?? '—'}×/day. ` +
        `Current avg: ${b.averageFrequency != null ? Number(b.averageFrequency).toFixed(1) : '—'}×/day. ` +
        `STO Status: ${b.sessionDerivedStoStatus === 'in_progress' ? 'In progress' : b.sessionDerivedStoStatus === 'not_yet_started' ? 'Not started' : b.sessionDerivedStoStatus ?? '—'}.`
      ));
    }
    children.push(empty(80));
  }

  if (activeSkills.length) {
    children.push(subHeading('Active Skill Acquisition Targets'));
    for (const s of activeSkills) {
      children.push(bullet(
        `**${s.skillName}** (${s.domain ?? ''}) — ` +
        `Baseline: ${s.baselinePercent ?? '—'}%. ` +
        `Current avg accuracy: ${s.averageAccuracy != null ? Number(s.averageAccuracy).toFixed(1) : '—'}%. ` +
        `Status: ${s.sessionDerivedStatus === 'in_progress' ? 'In progress' : s.sessionDerivedStatus === 'mastered' ? 'Mastered ✓' : 'New'}.`
      ));
    }
    children.push(empty(80));
  }

  if (newBehav.length) {
    children.push(subHeading('Newly Identified Behaviors'));
    children.push(bodyPara(
      'The following behaviors were identified during this authorization period and reviewed by the supervising BCBA. ' +
      'Disposition for the new authorization cycle is noted for each.'
    ));
    for (const b of newBehav) {
      const disp = b.includedInPlan === true
        ? 'IN PLAN — formal plan target in new cycle'
        : b.monitorOnly === true
          ? 'MONITOR ONLY — observed but not a plan target'
          : 'EXCLUDED from new plan';
      children.push(bullet(
        `**${b.behaviorName}** — Function: ${b.function ?? '—'}. Severity: ${b.severity ?? '—'}. ` +
        `First observed: ${fmtDocDate(b.firstSeenDate)}. ` +
        `Avg frequency: ${b.averageFrequency != null ? Number(b.averageFrequency).toFixed(1) : '—'}×/day. ` +
        (b.rbtDefinitionDraft ? `RBT description: ${b.rbtDefinitionDraft} ` : '') +
        `[${disp}]`
      ));
    }
    children.push(empty(80));
  }

  if (newSkills.length) {
    children.push(subHeading('Newly Identified Skill Areas'));
    children.push(bodyPara(
      'The following skill areas were identified during this authorization period.'
    ));
    for (const s of newSkills) {
      const disp = s.includedInPlan === true
        ? 'IN PLAN — included in new treatment plan'
        : s.monitorOnly === true
          ? 'MONITOR ONLY'
          : 'EXCLUDED from new plan';
      children.push(bullet(
        `**${s.skillName ?? s.bcbaGoalName ?? '(unnamed)'}** (${s.bcbaDomain ?? '—'}) — ` +
        `Baseline: ${s.baselinePercent != null ? `${s.baselinePercent}%` : '—'}. ` +
        (s.rbtNotes ? `Notes: ${s.rbtNotes}. ` : '') +
        `[${disp}]`
      ));
    }
    children.push(empty(80));
  }

  if (!activeBehav.length && !activeSkills.length && !newBehav.length && !newSkills.length) {
    children.push(bodyPara('[Document active treatment targets and newly identified areas requiring intervention.]'));
  }

  children.push(empty(80));
  return children;
}

// ── R7. Maladaptive behavior progress section ─────────────────────────────────

function behaviorProgressSection(session, graphs = {}) {
  const origBehaviors = session.originalBehaviorSummary ?? [];
  const behaviorDefs  = session.sections?.behavior_targets?.behaviorTargets ?? [];

  const children = [sectionHeading('Maladaptive Behavior Progress — This Authorization Period')];

  if (!origBehaviors.length) {
    children.push(bodyPara('[No behavior progress data available for this authorization period.]'));
    return children;
  }

  const active   = origBehaviors.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) !== 'met');
  const mastered = origBehaviors.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) === 'met');

  if (active.length) {
    children.push(subHeading('Active Behavior Targets'));

    for (const b of active) {
      const def      = behaviorDefs.find(bt => bt.id === b.behaviorId);
      const key      = normalize(b.behaviorName);
      const trendStr = b.trend === 'improving' ? '↓ Reducing (improving)'
        : b.trend === 'worsening' ? '↑ Increasing (concern)'
        : '→ Stable';
      const pctStr   = b.percentReduction != null
        ? `${Math.round(b.percentReduction)}% reduction`
        : '—';
      const stoStr   = b.sessionDerivedStoStatus === 'met'          ? 'Met ✓'
        : b.sessionDerivedStoStatus === 'in_progress'   ? 'In progress'
        : b.sessionDerivedStoStatus === 'not_yet_started' ? 'Not started'
        : '—';

      children.push(new Paragraph({
        children: [new TextRun({ text: b.behaviorName, bold: true, size: SZ, font: FONT, color: TEAL })],
        spacing: { before: 180, after: 60 },
      }));

      if (def?.operationalDefinition?.trim()) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: 'Operational Definition: ', bold: true, size: SZ_SM, font: FONT }),
            new TextRun({ text: def.operationalDefinition, size: SZ_SM, font: FONT }),
          ],
          spacing: { after: 80 },
        }));
      }

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: PROGRESS_BORDERS,
        rows: [
          new TableRow({ children: [
            progressCell('Baseline',       { header: true, width: 16 }),
            progressCell('Avg This Period',{ header: true, width: 18 }),
            progressCell('% Change',       { header: true, width: 15 }),
            progressCell('Trend',          { header: true, width: 22 }),
            progressCell('Sessions',       { header: true, width: 11 }),
            progressCell('STO Status',     { header: true, width: 18 }),
          ]}),
          new TableRow({ children: [
            progressCell(`${b.baselineFrequency ?? '—'}×/day`,                                   { width: 16 }),
            progressCell(`${b.averageFrequency != null ? Number(b.averageFrequency).toFixed(1) : '—'}×/day`, { width: 18 }),
            progressCell(pctStr,                                                                  { width: 15 }),
            progressCell(trendStr,                                                                { width: 22 }),
            progressCell(String(b.sessionsLogged ?? '—'),                                        { width: 11 }),
            progressCell(stoStr,                                                                  { width: 18 }),
          ]}),
        ],
      }));
      children.push(empty(80));

      // Actual session progress chart (chartImage returns a Paragraph — push directly)
      const progressChart = graphs[`progress_behavior_${key}`];
      if (progressChart) children.push(chartImage(progressChart, 520, 280));

      // STO trajectory (planned path) chart
      const stoChart = graphs[`sto_${key}`];
      if (stoChart) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Planned STO Reduction Trajectory:', bold: true, size: SZ_SM, font: FONT, color: SLATE })],
          spacing: { after: 40 },
        }));
        children.push(chartImage(stoChart, 520, 240));
      }
    }
  }

  if (mastered.length) {
    children.push(subHeading('Behaviors Achieving Mastery — Transferred to Maintenance Monitoring'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: PROGRESS_BORDERS,
      rows: [
        new TableRow({ children: [
          progressCell('Behavior',         { header: true, width: 28 }),
          progressCell('Original Baseline',{ header: true, width: 17 }),
          progressCell('Final Average',    { header: true, width: 17 }),
          progressCell('% Reduction',      { header: true, width: 17 }),
          progressCell('Sessions',         { header: true, width: 11 }),
          progressCell('Status',           { header: true, width: 10 }),
        ]}),
        ...mastered.map(b => new TableRow({ children: [
          progressCell(b.behaviorName,                                                                          { width: 28 }),
          progressCell(`${b.baselineFrequency ?? '—'}×/day`,                                                   { width: 17 }),
          progressCell(`${b.averageFrequency != null ? Number(b.averageFrequency).toFixed(1) : '—'}×/day`,     { width: 17 }),
          progressCell(b.percentReduction != null ? `${Math.round(b.percentReduction)}%` : '—',               { width: 17 }),
          progressCell(String(b.sessionsLogged ?? '—'),                                                        { width: 11 }),
          progressCell('Met ✓',                                                                                { width: 10 }),
        ]})),
      ],
    }));
    children.push(bodyPara(
      'Targets marked Met ✓ have achieved mastery criteria. They are transferred to maintenance monitoring in the new authorization cycle.'
    ));
    children.push(empty(80));
  }

  children.push(empty(80));
  return children;
}

// ── R8. Skill acquisition progress section ────────────────────────────────────

function skillProgressSection(session, graphs = {}) {
  const origSkills = session.originalSkillSummary ?? [];

  const children = [sectionHeading('Skill Acquisition Progress — This Authorization Period')];

  if (!origSkills.length) {
    children.push(bodyPara('[No skill progress data available for this authorization period.]'));
    return children;
  }

  const active   = origSkills.filter(s => (s.sessionDerivedStatus ?? s.status) !== 'mastered');
  const mastered = origSkills.filter(s => (s.sessionDerivedStatus ?? s.status) === 'mastered');

  if (active.length) {
    children.push(subHeading('Active Skill Targets'));

    for (const s of active) {
      const key       = normalize(s.skillName);
      const trendStr  = s.trend === 'improving' ? '↑ Improving'
        : s.trend === 'worsening' ? '↓ Declining'
        : '→ Stable';
      const pctChange = s.baselinePercent != null && s.averageAccuracy != null
        ? `+${(Number(s.averageAccuracy) - Number(s.baselinePercent)).toFixed(1)}%`
        : '—';
      const status    = s.sessionDerivedStatus === 'mastered' ? 'Mastered ✓'
        : s.sessionDerivedStatus === 'in_progress' ? 'In progress'
        : 'New';

      children.push(new Paragraph({
        children: [new TextRun({
          text: `${s.skillName}${s.domain ? ` (${s.domain})` : ''}`,
          bold: true, size: SZ, font: FONT, color: TEAL,
        })],
        spacing: { before: 180, after: 80 },
      }));

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: PROGRESS_BORDERS,
        rows: [
          new TableRow({ children: [
            progressCell('Baseline %',    { header: true, width: 16 }),
            progressCell('Avg Accuracy',  { header: true, width: 18 }),
            progressCell('% Improvement', { header: true, width: 16 }),
            progressCell('Trend',         { header: true, width: 18 }),
            progressCell('Sessions',      { header: true, width: 12 }),
            progressCell('Status',        { header: true, width: 20 }),
          ]}),
          new TableRow({ children: [
            progressCell(`${s.baselinePercent ?? '—'}%`,                                                          { width: 16 }),
            progressCell(`${s.averageAccuracy != null ? Number(s.averageAccuracy).toFixed(1) : '—'}%`,           { width: 18 }),
            progressCell(pctChange,                                                                               { width: 16 }),
            progressCell(trendStr,                                                                                { width: 18 }),
            progressCell(String(s.sessionsLogged ?? '—'),                                                        { width: 12 }),
            progressCell(status,                                                                                  { width: 20 }),
          ]}),
        ],
      }));
      children.push(empty(80));

      // Actual progress chart (chartImage returns a Paragraph — push directly)
      const progressChart = graphs[`progress_skill_${key}`];
      if (progressChart) children.push(chartImage(progressChart, 520, 280));

      // STO trajectory chart
      const stoChart = graphs[`skill_sto_${key}`];
      if (stoChart) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Planned STO Trajectory:', bold: true, size: SZ_SM, font: FONT, color: SLATE })],
          spacing: { after: 40 },
        }));
        children.push(chartImage(stoChart, 520, 240));
      }
    }
  }

  if (mastered.length) {
    children.push(subHeading('Skills Achieving Mastery ✓'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: PROGRESS_BORDERS,
      rows: [
        new TableRow({ children: [
          progressCell('Skill',       { header: true, width: 30 }),
          progressCell('Domain',      { header: true, width: 20 }),
          progressCell('Baseline %',  { header: true, width: 15 }),
          progressCell('Final Avg %', { header: true, width: 15 }),
          progressCell('Sessions',    { header: true, width: 10 }),
          progressCell('Status',      { header: true, width: 10 }),
        ]}),
        ...mastered.map(s => new TableRow({ children: [
          progressCell(s.skillName,                                                                               { width: 30 }),
          progressCell(s.domain ?? '—',                                                                          { width: 20 }),
          progressCell(`${s.baselinePercent ?? '—'}%`,                                                           { width: 15 }),
          progressCell(`${s.averageAccuracy != null ? Number(s.averageAccuracy).toFixed(1) : '—'}%`,            { width: 15 }),
          progressCell(String(s.sessionsLogged ?? '—'),                                                          { width: 10 }),
          progressCell('Mastered ✓',                                                                             { width: 10 }),
        ]})),
      ],
    }));
    children.push(bodyPara('Mastery criteria achieved. Transferred to maintenance monitoring in the new authorization cycle.'));
    children.push(empty(80));
  }

  children.push(empty(80));
  return children;
}

// ── R9. Caregiver training progress section ───────────────────────────────────

function caregiverProgressSection(session, graphs = {}) {
  const ctSummary = session.caregiverTrainingSummary ?? [];

  const children = [sectionHeading('Caregiver Training Progress — This Authorization Period')];

  if (!ctSummary.length) {
    children.push(bodyPara('[No caregiver training progress data available for this authorization period.]'));
    return children;
  }

  const active = ctSummary.filter(c => (c.sessionDerivedStoStatus ?? c.stoStatus) !== 'met');
  const met    = ctSummary.filter(c => (c.sessionDerivedStoStatus ?? c.stoStatus) === 'met');

  if (active.length) {
    children.push(subHeading('Active Caregiver Training Goals'));

    for (const c of active) {
      const key       = normalize(c.goalName);
      const trendStr  = c.trend === 'improving' ? '↑ Improving'
        : c.trend === 'worsening' ? '↓ Declining'
        : '→ Stable';
      const pctChange = c.baselinePercent != null && c.averageSessionPercent != null
        ? `+${(Number(c.averageSessionPercent) - Number(c.baselinePercent)).toFixed(1)}%`
        : '—';
      const status    = c.sessionDerivedStoStatus === 'met'              ? 'Met ✓'
        : c.sessionDerivedStoStatus === 'in_progress'      ? 'In progress'
        : c.sessionDerivedStoStatus === 'not_yet_started'  ? 'Not started'
        : '—';

      children.push(new Paragraph({
        children: [new TextRun({ text: c.goalName, bold: true, size: SZ, font: FONT, color: TEAL })],
        spacing: { before: 180, after: 80 },
      }));

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: PROGRESS_BORDERS,
        rows: [
          new TableRow({ children: [
            progressCell('Baseline %',    { header: true, width: 16 }),
            progressCell('Avg Session %', { header: true, width: 18 }),
            progressCell('% Change',      { header: true, width: 16 }),
            progressCell('Trend',         { header: true, width: 18 }),
            progressCell('Sessions',      { header: true, width: 12 }),
            progressCell('STO Status',    { header: true, width: 20 }),
          ]}),
          new TableRow({ children: [
            progressCell(`${c.baselinePercent ?? '—'}%`,                                                                    { width: 16 }),
            progressCell(`${c.averageSessionPercent != null ? Number(c.averageSessionPercent).toFixed(1) : '—'}%`,         { width: 18 }),
            progressCell(pctChange,                                                                                         { width: 16 }),
            progressCell(trendStr,                                                                                          { width: 18 }),
            progressCell(String(c.sessionsLogged ?? '—'),                                                                   { width: 12 }),
            progressCell(status,                                                                                            { width: 20 }),
          ]}),
        ],
      }));
      children.push(empty(80));

      // Actual progress chart (chartImage returns a Paragraph — push directly)
      const progressChart = graphs[`progress_ct_${key}`];
      if (progressChart) children.push(chartImage(progressChart, 520, 280));
    }
  }

  if (met.length) {
    children.push(subHeading('Caregiver Training Goals Achieved ✓'));
    for (const c of met) {
      children.push(bullet(
        `**${c.goalName}** — progressed from ${c.baselinePercent ?? '—'}% baseline ` +
        `to average ${c.averageSessionPercent != null ? Number(c.averageSessionPercent).toFixed(1) : '—'}% ` +
        `implementation accuracy across ${c.sessionsLogged ?? '—'} sessions. Goal achieved. ✓`
      ));
    }
    children.push(empty(80));
  }

  children.push(empty(80));
  return children;
}

// ─── Reassessment — New Authorization Cycle Plan Summary ─────────────────────
//
// Reads from the reassessment-specific data arrays on session:
//   originalBehaviorSummary[], newBehaviorSummary[]
//   originalSkillSummary[],    newSkillSummary[]
//   caregiverTrainingSummary[], newCaregiverSummary[]
//
// Organises every item into four disposition buckets:
//   IN PLAN  (active originals + new items w/ includedInPlan === true)
//   MASTERED (original items that reached mastery — maintenance monitoring)
//   MONITOR  (new items w/ monitorOnly === true — observed but not plan targets)
//   EXCLUDED (new items explicitly excluded from the new plan)
//
// Charts come from the graphs map built by buildGraphsFromSession (Step 5 keys
// use the `reauth_*` prefix for new-item charts).

function reassessmentPlanSection(session, graphs = {}) {
  if (session?.sessionType !== 'reassessment') return [];

  const children = [
    sectionHeading('New Authorization Cycle — Plan Summary'),
  ];

  // Auth period banner
  const fmt = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  if (session.authPeriodStart || session.authPeriodEnd) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Authorization Period: ', bold: true, size: SZ_SM, font: FONT, color: TEAL }),
        new TextRun({ text: `${fmt(session.authPeriodStart)} — ${fmt(session.authPeriodEnd)}`, size: SZ_SM, font: FONT }),
      ],
      spacing: { after: 160 },
    }));
  }

  // Shared table borders
  const borders = {
    top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
    insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
    insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
  };

  const cell = (text, opts = {}) => new TableCell({
    children: [new Paragraph({
      children: parseBoldRuns(text ?? '—', { size: SZ_SM, font: FONT, bold: opts.header ?? false }),
      spacing: { after: 0 },
    })],
    shading: opts.header ? { type: ShadingType.SOLID, color: TEAL_LIGHT } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: opts.vAlign ?? 'top',
  });

  const headerRow = (labels, widths) => new TableRow({
    children: labels.map((h, i) => cell(h, { header: true, width: widths[i] })),
    tableHeader: true,
  });

  const dataRow = (values, widths) => new TableRow({
    children: values.map((v, i) => cell(v ?? '—', { width: widths[i] })),
  });

  const dispositionLabel = (text, color = TEAL) => new Paragraph({
    children: [new TextRun({ text, bold: true, size: SZ, font: FONT, color })],
    spacing: { before: 240, after: 80 },
  });

  const milestoneCell = (text, opts = {}) => new TableCell({
    children: [new Paragraph({
      children: parseBoldRuns(text ?? '—', { size: SZ_SM, font: FONT, bold: opts.bold ?? false }),
      spacing: { after: 0 },
    })],
    shading: opts.bgColor
      ? { type: ShadingType.SOLID, color: opts.bgColor }
      : opts.header
        ? { type: ShadingType.SOLID, color: TEAL_LIGHT }
        : undefined,
    margins:  { top: 60, bottom: 60, left: 100, right: 100 },
    width:    opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: 'top',
  });

  const milestoneTable = (steps, ltoRow) => {
    const colW = [28, 24, 24, 24];
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({
          children: ['Milestone', 'Target', 'Timeline', 'Status'].map((h, i) =>
            milestoneCell(h, { header: true, width: colW[i] })
          ),
          tableHeader: true,
        }),
        ...steps.map(s => new TableRow({
          children: [
            milestoneCell(s.label,    { width: colW[0], bgColor: s.isCurrent ? 'F0FDF4' : undefined }),
            milestoneCell(s.target,   { width: colW[1] }),
            milestoneCell(s.timeline, { width: colW[2] }),
            milestoneCell(s.status,   { width: colW[3] }),
          ],
        })),
        ...(ltoRow ? [new TableRow({
          children: [
            milestoneCell('LTO — Mastery Criteria', { width: colW[0], bgColor: 'EFF6FF' }),
            milestoneCell(ltoRow.target,             { width: colW[1] }),
            milestoneCell(ltoRow.timeline,           { width: colW[2] }),
            milestoneCell('—',                       { width: colW[3] }),
          ],
        })] : []),
      ],
    });
  };

  // ─── BEHAVIOR REDUCTION TARGETS ─────────────────────────────────────────────

  children.push(subHeading('Behavior Reduction Targets'));

  const origBehaviors  = session.originalBehaviorSummary ?? [];
  const newBehaviors   = session.newBehaviorSummary ?? [];
  const btDefs         = session?.sections?.behavior_targets?.behaviorTargets ?? [];
  const findBtDef      = id => btDefs.find(d => d.id === id) ?? {};

  // Partition
  const activeBehaviors   = origBehaviors.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) !== 'met');
  const masteredBehaviors = origBehaviors.filter(b => (b.sessionDerivedStoStatus ?? b.stoStatus) === 'met');
  const inPlanBehaviors   = newBehaviors.filter(b => b.includedInPlan === true);
  const monitorBehaviors  = newBehaviors.filter(b => b.monitorOnly === true);
  const excludedBehaviors = newBehaviors.filter(b => b.includedInPlan !== true && b.monitorOnly !== true);

  const hasBehaviors = activeBehaviors.length || masteredBehaviors.length || inPlanBehaviors.length || monitorBehaviors.length || excludedBehaviors.length;

  if (!hasBehaviors) {
    children.push(bodyPara('[No behavior data recorded for this reassessment period.]'));
  } else {

    // ── A. Continuing / In Plan ───────────────────────────────────────────────
    if (activeBehaviors.length > 0 || inPlanBehaviors.length > 0) {
      children.push(dispositionLabel('A. Continuing / Included in New Treatment Plan'));
      const colW = [22, 14, 14, 25, 25];

      // Original active behaviors — per-behavior two-table layout
      if (activeBehaviors.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Behaviors continuing from the previous plan (updated baselines reflect this authorization period average):', italics: true, size: SZ_SM, font: FONT })],
          spacing: { after: 80 },
        }));

        for (const b of activeBehaviors) {
          const def     = findBtDef(b.behaviorId);
          const unit    = def.frequencyUnit || 'day';
          const totalStos    = (def.stoSteps ?? []).length;
          const currentIdx   = Math.max(0, (b.currentStoNumber ?? 1) - 1);
          const remainingSteps = totalStos > 0 ? def.stoSteps.slice(currentIdx) : [];

          // Behavior name heading
          children.push(new Paragraph({
            children: [new TextRun({ text: b.behaviorName, bold: true, size: SZ, font: FONT, color: TEAL })],
            spacing: { before: 160, after: 40 },
          }));
          if (def.operationalDefinition?.trim()) {
            children.push(new Paragraph({
              children: [
                new TextRun({ text: 'Operational Definition: ', bold: true, size: SZ_SM, font: FONT }),
                new TextRun({ text: def.operationalDefinition, size: SZ_SM, font: FONT }),
              ],
              spacing: { after: 80 },
            }));
          }

          // Table 1: Progress This Period
          const pctStr  = b.percentReduction != null ? `${Math.round(b.percentReduction)}% reduction` : '—';
          const stoLabel = totalStos > 0
            ? `STO ${b.currentStoNumber ?? 1} of ${totalStos}`
            : (b.sessionDerivedStoStatus === 'in_progress' ? 'In progress' : '—');
          children.push(new Paragraph({
            children: [new TextRun({ text: 'Progress This Period', bold: true, size: SZ_SM, font: FONT })],
            spacing: { before: 80, after: 40 },
          }));
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE }, borders,
            rows: [
              new TableRow({ children: [
                cell('Baseline',        { header: true, width: 18 }),
                cell('Avg This Period', { header: true, width: 18 }),
                cell('% Change',        { header: true, width: 16 }),
                cell('Sessions',        { header: true, width: 14 }),
                cell('Function',        { header: true, width: 16 }),
                cell('Current STO',     { header: true, width: 18 }),
              ]}),
              new TableRow({ children: [
                cell(`${b.baselineFrequency ?? '—'}×/${unit}`,                                                                          { width: 18 }),
                cell(`${b.averageFrequency != null ? Number(b.averageFrequency).toFixed(1) : '—'}×/${unit}`,                           { width: 18 }),
                cell(pctStr,                                                                                                             { width: 16 }),
                cell(String(b.sessionsLogged ?? '—'),                                                                                   { width: 14 }),
                cell(def.hypothesizedFunction ?? b.function ?? '—',                                                                     { width: 16 }),
                cell(stoLabel,                                                                                                           { width: 18 }),
              ]}),
            ],
          }));
          children.push(empty(80));

          // Table 2: Remaining Treatment Milestones
          children.push(new Paragraph({
            children: [new TextRun({ text: 'Remaining Treatment Milestones', bold: true, size: SZ_SM, font: FONT })],
            spacing: { before: 80, after: 40 },
          }));
          if (remainingSteps.length > 0) {
            const milestoneSteps = remainingSteps.map((s, i) => ({
              label:     i === 0
                ? `STO ${currentIdx + i + 1} — Current`
                : `STO ${currentIdx + i + 1}`,
              target:    `≤${s.targetFrequency ?? '?'}×/${unit}`,
              timeline:  s.durationWeeks ? `${s.durationWeeks} weeks` : '—',
              status:    i === 0 ? 'In Progress' : 'Upcoming',
              isCurrent: i === 0,
            }));
            const ltoTarget = computeBtLTO(def);
            children.push(milestoneTable(milestoneSteps, { target: ltoTarget, timeline: '3 consecutive months' }));
          } else {
            const fallbackSTO = computeBtSTO(def);
            const fallbackLTO = computeBtLTO(def);
            children.push(new Table({
              width: { size: 100, type: WidthType.PERCENTAGE }, borders,
              rows: [
                new TableRow({ children: [
                  cell('Short-Term Objective', { header: true, width: 50 }),
                  cell('Long-Term Objective',  { header: true, width: 50 }),
                ]}),
                new TableRow({ children: [
                  cell(fallbackSTO, { width: 50 }),
                  cell(fallbackLTO, { width: 50 }),
                ]}),
              ],
            }));
          }
          children.push(empty(80));

          // Charts
          const key = normalize(b.behaviorName || '');
          const progressChart = chartImage(graphs[`progress_behavior_${key}`], 480, 220);
          const stoChart      = chartImage(graphs[`sto_${key}`],               480, 220);
          if (progressChart) children.push(progressChart);
          if (stoChart)      children.push(stoChart);
          children.push(empty(120));
        }
      }

      // New behaviors being added to the plan
      if (inPlanBehaviors.length > 0) {
        children.push(empty(120));
        children.push(new Paragraph({
          children: [new TextRun({ text: 'New behaviors identified during reassessment — added to new treatment plan:', italics: true, size: SZ_SM, font: FONT })],
          spacing: { after: 80 },
        }));
        const colW2 = [22, 12, 12, 12, 22, 20];
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders,
          rows: [
            headerRow(['Behavior', 'Function', 'Severity', 'Baseline', 'Short-Term Objectives', 'Long-Term Objective'], colW2),
            ...inPlanBehaviors.map(b => {
              const stoText = (b.stoStructure ?? []).length > 0
                ? b.stoStructure.map((s, i) => `STO ${i + 1}: ≤${s.targetFrequency ?? '?'}/${b.frequencyUnit || 'day'} for ${s.durationWeeks || '?'} wks.`).join('\n')
                : '—';
              const ltoText = b.masteryCriteriaFrequency != null
                ? `≤${b.masteryCriteriaFrequency}/${b.frequencyUnit || 'day'}${b.masteryCriteriaWeeks ? ` for ${b.masteryCriteriaWeeks} weeks` : ''}`
                : (b.bcbaLtoText ?? '—');
              const base = b.baselineFrequency != null ? `${b.baselineFrequency}/${b.frequencyUnit || 'day'}` : '—';
              return dataRow([b.behaviorName, b.function ?? '—', b.severity ?? '—', base, stoText, ltoText], colW2);
            }),
          ],
        }));
        // Definition notes + charts for new in-plan behaviors
        for (const b of inPlanBehaviors) {
          if (b.bcbaDefinitionFinal?.trim()) {
            children.push(empty(60));
            children.push(labelVal(`${b.behaviorName} — Definition`, b.bcbaDefinitionFinal));
          }
          const key = normalize(b.behaviorName || '');
          const baseChart = chartImage(graphs[`reauth_behavior_${key}`], 480, 220);
          const stoChart  = chartImage(graphs[`reauth_sto_${key}`],      480, 220);
          if (baseChart || stoChart) {
            children.push(empty(60));
            if (baseChart) children.push(baseChart);
            if (stoChart)  children.push(stoChart);
          }
        }
      }
    }

    // ── B. Mastered — Maintenance Monitoring ─────────────────────────────────
    if (masteredBehaviors.length > 0) {
      children.push(dispositionLabel('B. Mastered — Maintenance Monitoring', '059669'));
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'The following behaviors reached mastery criteria during this authorization period. Formal reduction targets are discontinued; monitoring will continue in the new cycle to confirm maintenance and detect any regression.',
          italics: true, size: SZ_SM, font: FONT,
        })],
        spacing: { after: 100 },
      }));
      const colW = [20, 13, 13, 12, 12, 16, 14];
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders,
        rows: [
          headerRow(['Behavior', 'Baseline', 'Final Avg', '% Reduction', 'Sessions', 'Mastery Date', 'Status'], colW),
          ...masteredBehaviors.map(b => {
            const pct      = b.percentReduction != null ? `${Math.abs(b.percentReduction).toFixed(1)}% reduction` : '—';
            const base     = b.baselineFrequency != null ? `${b.baselineFrequency}/day` : '—';
            const avg      = b.averageFrequency  != null ? `${b.averageFrequency}/day`  : '—';
            const mastDate = b.masteryDate ? fmtDocDate(b.masteryDate) : 'This auth period';
            return dataRow([b.behaviorName, base, avg, pct, String(b.sessionsLogged ?? '—'), mastDate, 'Mastered ✓'], colW);
          }),
        ],
      }));
      for (const b of masteredBehaviors) {
        const key = normalize(b.behaviorName || '');
        const baseChart = chartImage(graphs[`behavior_${key}`], 480, 220);
        const stoChart  = chartImage(graphs[`sto_${key}`],      480, 220);
        if (baseChart || stoChart) {
          children.push(empty(80));
          children.push(new Paragraph({
            children: [new TextRun({ text: `${b.behaviorName} — Progress to Mastery`, bold: true, size: SZ_SM, font: FONT, color: '059669' })],
            spacing: { after: 40 },
          }));
          if (baseChart) children.push(baseChart);
          if (stoChart)  children.push(stoChart);
        }
      }
    }

    // ── C. Monitor Only ───────────────────────────────────────────────────────
    if (monitorBehaviors.length > 0) {
      children.push(dispositionLabel('C. Monitor Only — Not Formal Plan Targets', '0369A1'));
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'The following emerging behaviors will be observed and tracked during the new authorization cycle but are not designated as formal behavior reduction targets.',
          italics: true, size: SZ_SM, font: FONT,
        })],
        spacing: { after: 100 },
      }));
      const colW = [30, 20, 20, 30];
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders,
        rows: [
          headerRow(['Behavior', 'Function', 'Severity', 'Notes'], colW),
          ...monitorBehaviors.map(b => dataRow([b.behaviorName, b.function ?? '—', b.severity ?? '—', b.bcbaDefinitionFinal ?? '—'], colW)),
        ],
      }));
    }

    // ── D. Excluded ───────────────────────────────────────────────────────────
    if (excludedBehaviors.length > 0) {
      children.push(dispositionLabel('D. Excluded from New Plan', '64748B'));
      children.push(new Paragraph({
        children: [new TextRun({ text: 'The following behaviors were identified during reassessment but excluded from the new authorization cycle:', size: SZ_SM, font: FONT, italics: true })],
        spacing: { after: 60 },
      }));
      for (const b of excludedBehaviors) {
        children.push(bullet(`${b.behaviorName}${b.function ? ` — Function: ${b.function}` : ''}`));
      }
    }
  }

  children.push(empty(200));

  // ─── SKILL ACQUISITION TARGETS ──────────────────────────────────────────────

  children.push(subHeading('Skill Acquisition Targets'));

  const origSkills  = session.originalSkillSummary ?? [];
  const newSkills   = session.newSkillSummary ?? [];
  const skillDefs   = session?.sections?.skill_acquisitions?.skillGoals ?? [];
  const findSkillDef = id => skillDefs.find(d => d.id === id) ?? {};

  const activeSkills   = origSkills.filter(s => (s.sessionDerivedStatus ?? s.status) !== 'mastered');
  const masteredSkills = origSkills.filter(s => (s.sessionDerivedStatus ?? s.status) === 'mastered');
  const inPlanSkills   = newSkills.filter(s => s.includedInPlan === true);
  const monitorSkills  = newSkills.filter(s => s.monitorOnly === true);
  const excludedSkills = newSkills.filter(s => s.includedInPlan !== true && s.monitorOnly !== true);

  const hasSkills = activeSkills.length || masteredSkills.length || inPlanSkills.length || monitorSkills.length || excludedSkills.length;

  if (!hasSkills) {
    children.push(bodyPara('[No skill goal data recorded for this reassessment period.]'));
  } else {

    // ── A. Continuing / In Plan ───────────────────────────────────────────────
    if (activeSkills.length > 0 || inPlanSkills.length > 0) {
      children.push(dispositionLabel('A. Continuing / Included in New Treatment Plan'));
      if (activeSkills.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Skills continuing from the previous plan:', italics: true, size: SZ_SM, font: FONT })],
          spacing: { after: 80 },
        }));

        for (const s of activeSkills) {
          const def       = findSkillDef(s.skillId);
          const totalStos = (def.stoSteps ?? []).length;
          const currentIdx = Math.max(0, (s.currentStoNumber ?? 1) - 1);
          const remainingSteps = totalStos > 0 ? def.stoSteps.slice(currentIdx) : [];
          const pctImprovement = s.baselinePercent != null && s.averageAccuracy != null
            ? `+${(Number(s.averageAccuracy) - Number(s.baselinePercent)).toFixed(1)}%`
            : '—';
          const stoLabel = totalStos > 0
            ? `STO ${s.currentStoNumber ?? 1} of ${totalStos}`
            : (s.sessionDerivedStatus === 'in_progress' ? 'In progress' : '—');

          // Skill name heading
          children.push(new Paragraph({
            children: [new TextRun({
              text: `${s.skillName}${s.domain ? ` — ${s.domain}` : ''}`,
              bold: true, size: SZ, font: FONT, color: TEAL,
            })],
            spacing: { before: 160, after: 80 },
          }));

          // Table 1: Progress This Period
          children.push(new Paragraph({
            children: [new TextRun({ text: 'Progress This Period', bold: true, size: SZ_SM, font: FONT })],
            spacing: { before: 40, after: 40 },
          }));
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE }, borders,
            rows: [
              new TableRow({ children: [
                cell('Baseline %',    { header: true, width: 18 }),
                cell('Avg Accuracy',  { header: true, width: 18 }),
                cell('% Improvement', { header: true, width: 16 }),
                cell('Sessions',      { header: true, width: 14 }),
                cell('Current STO',   { header: true, width: 34 }),
              ]}),
              new TableRow({ children: [
                cell(`${s.baselinePercent ?? '—'}%`,                                                                { width: 18 }),
                cell(`${s.averageAccuracy != null ? Number(s.averageAccuracy).toFixed(1) : '—'}%`,                 { width: 18 }),
                cell(pctImprovement,                                                                                { width: 16 }),
                cell(String(s.sessionsLogged ?? '—'),                                                               { width: 14 }),
                cell(stoLabel,                                                                                       { width: 34 }),
              ]}),
            ],
          }));
          children.push(empty(80));

          // Table 2: Remaining Treatment Milestones
          children.push(new Paragraph({
            children: [new TextRun({ text: 'Remaining Treatment Milestones', bold: true, size: SZ_SM, font: FONT })],
            spacing: { before: 80, after: 40 },
          }));
          if (remainingSteps.length > 0) {
            const milestoneSteps = remainingSteps.map((st, i) => ({
              label:     i === 0 ? `STO ${currentIdx + i + 1} — Current` : `STO ${currentIdx + i + 1}`,
              target:    `${st.targetPercent ?? '?'}% accuracy`,
              timeline:  st.durationWeeks ? `${st.durationWeeks} weeks` : '—',
              status:    i === 0 ? 'In Progress' : 'Upcoming',
              isCurrent: i === 0,
            }));
            const masteryTarget   = def.masteryCriteriaPercent ? `${def.masteryCriteriaPercent}%` : '—';
            const masteryCriteria = def.masteryCriteriaPercent
              ? `${def.masteryCriteriaPercent}% across ${def.masteryCriteriaSessions ?? '3'} consecutive sessions`
              : '—';
            children.push(milestoneTable(milestoneSteps, { target: masteryTarget, timeline: masteryCriteria }));
          } else {
            const fallbackSTO = computeSkillSTO(def);
            const mastery     = def.masteryCriteriaPercent
              ? `${def.masteryCriteriaPercent}% across ${def.masteryCriteriaSessions ?? '3'} sessions`
              : computeSkillMastery(def);
            children.push(new Table({
              width: { size: 100, type: WidthType.PERCENTAGE }, borders,
              rows: [
                new TableRow({ children: [
                  cell('Short-Term Objective', { header: true, width: 50 }),
                  cell('Mastery Criteria',     { header: true, width: 50 }),
                ]}),
                new TableRow({ children: [
                  cell(fallbackSTO, { width: 50 }),
                  cell(mastery,     { width: 50 }),
                ]}),
              ],
            }));
          }
          children.push(empty(80));

          // Charts
          const key = normalize(s.skillName || '');
          const progressChart = chartImage(graphs[`progress_skill_${key}`], 480, 220);
          const stoChart      = chartImage(graphs[`skill_sto_${key}`],      480, 220);
          if (progressChart) children.push(progressChart);
          if (stoChart)      children.push(stoChart);
          children.push(empty(120));
        }
      }

      if (inPlanSkills.length > 0) {
        children.push(empty(120));
        children.push(new Paragraph({
          children: [new TextRun({ text: 'New skills identified during reassessment — added to new treatment plan:', italics: true, size: SZ_SM, font: FONT })],
          spacing: { after: 80 },
        }));
        const colW2 = [28, 14, 14, 22, 22];
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders,
          rows: [
            headerRow(['Skill Goal', 'Baseline', 'Mastery Target', 'Short-Term Objectives', 'Long-Term Objective'], colW2),
            ...inPlanSkills.map(s => {
              const name = s.skillName ?? s.bcbaGoalName ?? '—';
              const stoText = (s.stoSteps ?? []).length > 0
                ? s.stoSteps.map((st, i) => `STO ${i + 1}: ${st.targetPercent ?? '?'}% in ${st.durationWeeks || '?'} wks.`).join('\n')
                : '—';
              const ltoText = s.masteryCriteriaPercent != null ? `${s.masteryCriteriaPercent}%` : (s.bcbaLtoText ?? '—');
              return dataRow([name, `${s.baselinePercent ?? '—'}%`, `${s.masteryCriteriaPercent ?? '—'}%`, stoText, ltoText], colW2);
            }),
          ],
        }));
        for (const s of inPlanSkills) {
          const name = s.skillName ?? s.bcbaGoalName ?? '';
          const chart = chartImage(graphs[`reauth_skill_sto_${normalize(name)}`], 480, 220);
          if (chart) { children.push(empty(60)); children.push(chart); }
        }
      }
    }

    // ── B. Mastered — Maintenance Monitoring ─────────────────────────────────
    if (masteredSkills.length > 0) {
      children.push(dispositionLabel('B. Mastered — Maintenance Monitoring', '059669'));
      children.push(new Paragraph({
        children: [new TextRun({ text: 'The following skills reached mastery criteria this period. Goals are discontinued as active targets; accuracy will continue to be monitored to confirm maintenance.', italics: true, size: SZ_SM, font: FONT })],
        spacing: { after: 100 },
      }));
      const colW = [22, 12, 12, 12, 10, 18, 14];
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders,
        rows: [
          headerRow(['Skill Goal', 'Domain', 'Baseline', 'Final Avg %', 'Sessions', 'Mastery Date', 'Status'], colW),
          ...masteredSkills.map(s => {
            const mastDate = s.masteryDate ? fmtDocDate(s.masteryDate) : 'This auth period';
            return dataRow([s.skillName, s.domain ?? '—', `${s.baselinePercent ?? '—'}%`, `${s.averageAccuracy != null ? Number(s.averageAccuracy).toFixed(1) : '—'}%`, String(s.sessionsLogged ?? '—'), mastDate, 'Mastered ✓'], colW);
          }),
        ],
      }));
      for (const s of masteredSkills) {
        const key = normalize(s.skillName || '');
        const chart = chartImage(graphs[`skill_sto_${key}`], 480, 220);
        if (chart) { children.push(empty(60)); children.push(chart); }
      }
    }

    // ── C. Monitor Only ───────────────────────────────────────────────────────
    if (monitorSkills.length > 0) {
      children.push(dispositionLabel('C. Monitor Only — Not Formal Plan Targets', '0369A1'));
      const colW = [40, 16, 44];
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders,
        rows: [
          headerRow(['Skill Goal', 'Baseline', 'Notes'], colW),
          ...monitorSkills.map(s => {
            const name = s.skillName ?? s.bcbaGoalName ?? '—';
            return dataRow([name, `${s.baselinePercent ?? '—'}%`, s.bcbaLtoText ?? '—'], colW);
          }),
        ],
      }));
    }

    // ── D. Excluded ───────────────────────────────────────────────────────────
    if (excludedSkills.length > 0) {
      children.push(dispositionLabel('D. Excluded from New Plan', '64748B'));
      for (const s of excludedSkills) {
        children.push(bullet(s.skillName ?? s.bcbaGoalName ?? '—'));
      }
    }
  }

  children.push(empty(200));

  // ─── CAREGIVER TRAINING GOALS ────────────────────────────────────────────────

  children.push(subHeading('Caregiver Training Goals'));

  const ctSummary    = session.caregiverTrainingSummary ?? [];
  const newCT        = session.newCaregiverSummary ?? [];
  const inPlanCT     = newCT.filter(c => c.includedInPlan === true);
  const monitorCT    = newCT.filter(c => c.monitorOnly === true);
  const excludedCT   = newCT.filter(c => c.includedInPlan !== true && c.monitorOnly !== true);

  const hasCT = ctSummary.length || inPlanCT.length || monitorCT.length || excludedCT.length;

  if (!hasCT) {
    children.push(bodyPara('[No caregiver training data recorded for this reassessment period.]'));
  } else {

    // ── A. Continuing + New In-Plan ───────────────────────────────────────────
    if (ctSummary.length > 0 || inPlanCT.length > 0) {
      children.push(dispositionLabel('A. Active / Included in New Treatment Plan'));

      if (ctSummary.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Caregiver training goals continuing from the previous plan:', italics: true, size: SZ_SM, font: FONT })],
          spacing: { after: 80 },
        }));

        for (const ct of ctSummary) {
          const stoSteps   = ct.stoSteps ?? [];
          const currentIdx = Math.max(0, (ct.currentStoNumber ?? 1) - 1);
          const remaining  = stoSteps.length > 0 ? stoSteps.slice(currentIdx) : [];
          const pctChange  = ct.baselinePercent != null && ct.averageSessionPercent != null
            ? `+${(Number(ct.averageSessionPercent) - Number(ct.baselinePercent)).toFixed(1)}%`
            : '—';
          const trendStr   = ct.trend === 'improving' ? '↑ Improving' : ct.trend === 'worsening' ? '↓ Declining' : '→ Stable';
          const stoLabel   = stoSteps.length > 0
            ? `STO ${ct.currentStoNumber ?? 1} of ${stoSteps.length}`
            : (ct.stoStatus === 'in_progress' ? 'In progress' : '—');

          // Goal name heading
          children.push(new Paragraph({
            children: [new TextRun({ text: ct.goalName, bold: true, size: SZ, font: FONT, color: TEAL })],
            spacing: { before: 160, after: 40 },
          }));

          // Table 1: Progress This Period
          children.push(new Paragraph({
            children: [new TextRun({ text: 'Progress This Period', bold: true, size: SZ_SM, font: FONT })],
            spacing: { before: 40, after: 40 },
          }));
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE }, borders,
            rows: [
              new TableRow({ children: [
                cell('Baseline %',    { header: true, width: 18 }),
                cell('Avg Session %', { header: true, width: 18 }),
                cell('% Change',      { header: true, width: 16 }),
                cell('Trend',         { header: true, width: 16 }),
                cell('Sessions',      { header: true, width: 14 }),
                cell('Current STO',   { header: true, width: 18 }),
              ]}),
              new TableRow({ children: [
                cell(`${ct.baselinePercent ?? '—'}%`,                                                                              { width: 18 }),
                cell(`${ct.averageSessionPercent != null ? Number(ct.averageSessionPercent).toFixed(1) : '—'}%`,                  { width: 18 }),
                cell(pctChange,                                                                                                     { width: 16 }),
                cell(trendStr,                                                                                                      { width: 16 }),
                cell(String(ct.sessionsLogged ?? '—'),                                                                             { width: 14 }),
                cell(stoLabel,                                                                                                      { width: 18 }),
              ]}),
            ],
          }));
          children.push(empty(80));

          // Table 2: Remaining milestones
          children.push(new Paragraph({
            children: [new TextRun({ text: 'Remaining Treatment Milestones', bold: true, size: SZ_SM, font: FONT })],
            spacing: { before: 80, after: 40 },
          }));
          if (remaining.length > 0) {
            const milestoneSteps = remaining.map((st, i) => ({
              label:     i === 0 ? `STO ${currentIdx + i + 1} — Current` : `STO ${currentIdx + i + 1}`,
              target:    `${st.targetPercent ?? '?'}% accuracy`,
              timeline:  st.durationWeeks ? `${st.durationWeeks} weeks` : '—',
              status:    i === 0 ? 'In Progress' : 'Upcoming',
              isCurrent: i === 0,
            }));
            const ltoTarget = ct.ltoData
              ? `${ct.ltoData.percent}%`
              : ct.lto ?? '—';
            const ltoTimeline = ct.ltoData?.sessions
              ? `${ct.ltoData.sessions} consecutive sessions`
              : '—';
            children.push(milestoneTable(milestoneSteps, { target: ltoTarget, timeline: ltoTimeline }));
          } else {
            // Fallback to pre-computed strings
            children.push(new Table({
              width: { size: 100, type: WidthType.PERCENTAGE }, borders,
              rows: [
                new TableRow({ children: [
                  cell('Short-Term Objective', { header: true, width: 50 }),
                  cell('Long-Term Objective',  { header: true, width: 50 }),
                ]}),
                new TableRow({ children: [
                  cell(ct.sto ?? '—', { width: 50 }),
                  cell(ct.lto ?? '—', { width: 50 }),
                ]}),
              ],
            }));
          }
          children.push(empty(80));

          // Chart
          const key = normalize(ct.goalName || '');
          const chart = chartImage(graphs[`progress_ct_${key}`] ?? graphs[`caregiver_target_${key}`] ?? null, 480, 220);
          if (chart) children.push(chart);
          children.push(empty(120));
        }
      }

      if (inPlanCT.length > 0) {
        children.push(empty(120));
        children.push(new Paragraph({
          children: [new TextRun({ text: 'New caregiver training goals identified during reassessment:', italics: true, size: SZ_SM, font: FONT })],
          spacing: { after: 80 },
        }));
        const colW2 = [30, 14, 16, 20, 20];
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders,
          rows: [
            headerRow(['Training Goal', 'Baseline %', 'Mastery Target', 'Short-Term Objective', 'Long-Term Objective'], colW2),
            ...inPlanCT.map(ct => {
              const stoText = (ct.stoStructure ?? []).length > 0
                ? ct.stoStructure.map((s, i) => `STO ${i + 1}: ${s.targetPercent ?? '?'}%`).join('; ')
                : '—';
              const ltoText = ct.masteryCriteriaPercent != null ? `${ct.masteryCriteriaPercent}%` : (ct.bcbaLtoText ?? '—');
              return dataRow([ct.goalName, `${ct.baselinePercent ?? '—'}%`, `${ct.masteryCriteriaPercent ?? '—'}%`, stoText, ltoText], colW2);
            }),
          ],
        }));
        for (const ct of inPlanCT) {
          const key = normalize(ct.goalName || '');
          const chart = chartImage(graphs[`reauth_ct_${key}`], 480, 220);
          if (chart) { children.push(empty(60)); children.push(chart); }
        }
      }
    }

    // ── B. Monitor Only ───────────────────────────────────────────────────────
    if (monitorCT.length > 0) {
      children.push(dispositionLabel('B. Monitor Only — Not Formal Goals', '0369A1'));
      const colW = [40, 16, 44];
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders,
        rows: [
          headerRow(['Training Goal', 'Baseline %', 'Notes'], colW),
          ...monitorCT.map(ct => dataRow([ct.goalName, `${ct.baselinePercent ?? '—'}%`, ct.bcbaLtoText ?? '—'], colW)),
        ],
      }));
    }

    // ── C. Excluded ───────────────────────────────────────────────────────────
    if (excludedCT.length > 0) {
      children.push(dispositionLabel('C. Excluded from New Plan', '64748B'));
      for (const ct of excludedCT) {
        children.push(bullet(ct.goalName ?? '—'));
      }
    }
  }

  children.push(empty(200));
  return children;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * generateAssessmentDoc(session, clientName)
 *
 * @param {object} session     — client.assessment_session
 * @param {string} clientName  — client's display name
 * @returns {Promise<Blob>}    — .docx file blob ready for download
 */
export async function generateAssessmentDoc(session, clientName = 'Client') {

  // Build all chart images from session data.
  // Failures are silently ignored — charts are enhancement, not blocker.
  let graphs = {};
  try {
    graphs = await buildGraphsFromSession(session);
  } catch (err) {
    console.warn('Chart generation failed — exporting without charts:', err.message);
  }

  const children = [
    // 1. Title
    ...titleBlock(session),

    // 2. Client info table
    clientInfoTable(session, clientName),
    empty(200),

    // Manual completion reminder (at top so BCBA sees it first)
    ...manualCompletionNote(),

    // 3. Background & Referral (demographics draft)
    ...backgroundSection(session),

    // 4–10. Clinical narrative sections (AI drafts)
    ...narrativeSections(session),

    // 11. Medical Condition & Medications (structured data)
    ...medicalConditionSection(session),

    // 12. Strengths (from skillGoals)
    ...strengthsSection(session),

    // 13. Areas Requiring Intervention (behavior targets + skill deficit summary)
    ...areasRequiringIntervention(session),

    // 14. Maladaptive Behaviors — each behavior includes baseline + STO charts
    ...maladaptiveBehaviorsSection(session, graphs),

    // 15. Reinforcement (preference assessment from notes)
    ...reinforcementSection(session),

    // 16. Hypothesis-Based Interventions (behavior_targets AI draft)
    ...hypothesisSection(session),

    // 17. Standard Intervention Techniques (clinic template list)
    ...interventionsSection(),

    // 18. Skills / Replacement Behaviors — includes replacement behavior comparison chart
    ...skillAcquisitionsSection(session, graphs),

    // 19. Caregiver Training Program — includes caregiver skill progression charts
    ...caregiverTrainingSection(session, graphs),

    // 20. Crisis Plan (structured fields)
    ...crisisPlanSection(session),

    // 21. Reassessment — New Cycle Plan Summary (reassessment sessions only)
    // Organises all behaviors/skills/caregiver training by disposition:
    // In Plan (active + new includedInPlan) | Mastered–Maintenance | Monitor Only | Excluded
    ...reassessmentPlanSection(session, graphs),

    // 22–24. Standardized assessment score placeholders (QABF, BASC-3, Vineland-3)
    ...standardizedAssessmentPlaceholders(),

    // 24. Signature block
    ...signatureSection(),
  ].filter(Boolean);

  const doc = new Document({
    creator:     'ABA Shield',
    title:       `ABA Assessment — ${clientName}`,
    description: 'Initial Comprehensive ABA Assessment Report',
    styles: {
      default: {
        document: {
          run:       { font: FONT, size: SZ },
          paragraph: { spacing: { after: 120 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          // 0.75" left/right margins, 0.5" top/bottom
          margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
        },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

// ─── Alias for backwards compat (initial assessment unchanged) ────────────────
export const generateInitialAssessmentDoc = generateAssessmentDoc;

// ─── Reassessment document — purpose-built ────────────────────────────────────
/**
 * generateReassessmentDoc
 *
 * Generates the re-authorization / re-assessment DOCX report.
 * Distinct from generateAssessmentDoc: this is a progress report + new cycle
 * treatment plan, NOT a fresh diagnostic evaluation.
 *
 * Document structure (24 sections):
 *   PART 1  IDENTIFICATION         — Title block, Client info
 *   PART 2  EXECUTIVE SUMMARY      — BCBA narrative (progressNarrativeText)
 *   PART 3  CLINICAL BACKGROUND    — Updated narrative w/ provenance notes
 *   PART 4  MEDICAL NECESSITY      — Continued necessity re-evaluation
 *   PART 5  CURRENT CLINICAL PIC   — Strengths + Areas requiring intervention
 *   PART 6  AUTHORIZATION PERIOD   — Behavior / Skill / CT progress + charts
 *   PART 7  INTERVENTION APPROACH  — Hypothesis + Techniques (clinic list)
 *   PART 8  NEW CYCLE PLAN         — Reassessment plan (4 buckets × 3 domains)
 *   PART 9  SUPPORTING DOCS        — Crisis plan, placeholders, signature
 *
 * @param {object} session     - reassessment session object
 * @param {string} clientName  - display name for doc title
 * @param {Array}  sessionLogs - service session log entries (for progress charts)
 * @param {Array}  ctLogs      - caregiver training log entries (for progress charts)
 */
export async function generateReassessmentDoc(
  session,
  clientName  = 'Client',
  sessionLogs = [],
  ctLogs      = [],
) {
  // Build all graphs — progress charts (Step 6) need the log arrays
  let graphs = {};
  try {
    graphs = await buildGraphsFromSession(session, { sessionLogs, ctLogs });
  } catch (err) {
    console.warn('Reassessment chart generation failed — exporting without charts:', err.message);
  }

  const children = [
    // ── PART 1: IDENTIFICATION ──────────────────────────────────────────────
    // Section 1: Title block (re-assessment specific heading)
    ...reassessmentTitleBlock(session),

    // Section 2: Client information table (reused)
    clientInfoTable(session, clientName),
    empty(200),

    // ── PART 2: EXECUTIVE SUMMARY ───────────────────────────────────────────
    // Section 3: Clinical progress summary (BCBA narrative)
    ...executiveSummarySection(session),

    // ── PART 3: CLINICAL BACKGROUND ─────────────────────────────────────────
    // Sections 4–10: Prefilled narrative sections with provenance notes
    ...reassessmentClinicalBackgroundSections(session),

    // ── PART 4: MEDICAL NECESSITY ────────────────────────────────────────────
    // Section 11a: Continued medical necessity statement
    ...reassessmentMedicalSection(session),

    // Section 11b: Medical conditions, diagnoses & medications (structured)
    ...medicalConditionSection(session),

    // ── PART 5: CURRENT CLINICAL PICTURE ────────────────────────────────────
    // Section 12: Strengths — initial baseline + gains this auth period
    ...reassessmentStrengthsSection(session),

    // Section 13: Areas requiring continued & new intervention
    ...reassessmentAreasSection(session),

    // ── PART 6: AUTHORIZATION PERIOD PROGRESS ───────────────────────────────
    // Section 14: Maladaptive behavior progress (tables + charts)
    ...behaviorProgressSection(session, graphs),

    // Section 15: Skill acquisition progress (tables + charts)
    ...skillProgressSection(session, graphs),

    // Section 16: Caregiver training progress (tables + charts)
    ...caregiverProgressSection(session, graphs),

    // ── PART 7: INTERVENTION APPROACH ───────────────────────────────────────
    // Section 17: Hypothesis-based interventions (updated narrative)
    ...hypothesisSection(session),

    // Section 18: Intervention techniques (hardcoded clinic list, unchanged)
    ...interventionsSection(),

    // ── PART 8: NEW AUTHORIZATION CYCLE PLAN ────────────────────────────────
    // Sections 19–21: Behavior / Skill / Caregiver — 4 buckets each
    ...reassessmentPlanSection(session, graphs),

    // ── PART 9: SUPPORTING DOCUMENTATION ────────────────────────────────────
    // Section 22: Crisis plan (reviewed/updated at reassessment)
    ...crisisPlanSection(session),

    // Section 23: Standardized assessment score placeholders
    ...standardizedAssessmentPlaceholders(),

    // Section 24: Signature block
    ...signatureSection(),
  ].filter(Boolean);

  const doc = new Document({
    creator:     'ABA Shield',
    title:       `ABA Re-Assessment — ${clientName}`,
    description: 'Progress Report & New Authorization Cycle Treatment Plan',
    styles: {
      default: {
        document: {
          run:       { font: FONT, size: SZ },
          paragraph: { spacing: { after: 120 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
        },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}
