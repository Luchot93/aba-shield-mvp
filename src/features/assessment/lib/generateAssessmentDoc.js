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
  const opps = g.baselineOpportunities || '?';
  return `${g.baselinePercent}% across ${opps} opportunities`;
}

function computeSkillCurrentLevel(g) {
  if (g.currentLevel) return g.currentLevel;
  if (!g.baselinePercent && g.baselinePercent !== 0) return 'NEW';
  const prompt = g.baselinePromptingLevel || g.promptingLevel?.[0] || 'prompting';
  return `${g.baselinePercent}% correct with ${prompt} prompting`;
}

function computeSkillSTO(g) {
  // Prefer BCBA-entered structured STO fields, then legacy free-text, then auto-formula
  if (g.stoPercent || g.stoSkillDescription || g.stoWeeks) {
    const pct      = g.stoPercent         || Math.round(Number(g.masteryCriteriaPercent || 80) * 0.5);
    const desc     = g.stoSkillDescription || (g.targetSkill || 'the target skill');
    const weeks    = g.stoWeeks           || '12';
    const sessions = g.masteryCriteriaSessions || '3';
    return (
      `Client will demonstrate ${desc} with ${pct}% accuracy across ` +
      `${sessions} consecutive sessions within ${weeks} weeks.`
    );
  }
  if (g.sto) return g.sto;
  const pct      = g.masteryCriteriaPercent  || '80';
  const sessions = g.masteryCriteriaSessions || '3';
  return (
    `Client will demonstrate ${g.targetSkill || 'the target skill'} with ` +
    `${Math.round(Number(pct) * 0.5) || 40}% accuracy across ${sessions} ` +
    `consecutive sessions with decreasing prompt support.`
  );
}

function computeSkillMastery(g) {
  const pct      = g.masteryCriteriaPercent         || '80';
  const sessions = g.masteryCriteriaSessions        || '3';
  const settings = g.masteryCriteriaSettings        || '2';
  const prompt   = g.masteryCriteriaPromptingLevel  || g.masteryCriteriaPrompting || 'independent';
  return (
    `Client will demonstrate ${g.targetSkill || 'the target skill'} with ` +
    `${pct}% accuracy across ${sessions} consecutive sessions across ` +
    `${settings} people/settings with ${prompt} level of prompting.`
  );
}

// ─── Behavior target computation helpers ─────────────────────────────────────
// Mirror the logic in MaladaptiveBehaviorsReviewView.jsx.

function computeBtBaseline(bt) {
  if (!bt.baselineFrequency) return '—';
  return `${bt.baselineFrequency} per ${bt.frequencyUnit || 'day'}`;
}

function computeBtSTO(bt) {
  const base = parseFloat(bt.baselineFrequency) || 0;
  const unit = bt.frequencyUnit || 'day';
  const name = bt.behaviorName  || 'behavior';
  if (!base) return `Reduce ${name} frequency by 50% within 12 weeks`;
  const half = Math.ceil(base * 0.5);
  return `Reduce to ${half} per ${unit} within 12 weeks`;
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
      computeBtSTO(bt),
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
    const colWidths = [18, 22, 15, 20, 25]; // percentages, must sum to 100
    const headers   = [
      'Target Behavior',
      '6-Month Target (STO)',
      'Baseline Data',
      'Current Level',
      'Mastery Criteria (LTO)',
    ];
    const values = [
      g.targetSkill || '—',
      computeSkillSTO(g),
      computeSkillBaseline(g),
      computeSkillCurrentLevel(g),
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

  const bl = sec.caregiverBaselines ?? {};

  // ── Observed baseline table ────────────────────────────────────────────────
  const hasPremack      = bl.premack_baseline !== '' && bl.premack_baseline != null;
  const hasReinforcement = bl.reinforcement_baseline !== '' && bl.reinforcement_baseline != null;

  if (hasPremack || hasReinforcement) {
    children.push(subHeading('Observed Caregiver Skill Baseline'));
    children.push(
      new Table({

        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top:           { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          bottom:        { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          left:          { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          right:         { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
          insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
          insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
        },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                shading: { fill: TEAL_LIGHT },
                children: [new Paragraph({ children: [new TextRun({ text: 'Strategy', bold: true, size: SZ_SM, font: FONT, color: TEAL })] })],
              }),
              new TableCell({
                shading: { fill: TEAL_LIGHT },
                children: [new Paragraph({ children: [new TextRun({ text: 'Observed Baseline', bold: true, size: SZ_SM, font: FONT, color: TEAL })] })],
              }),
            ],
          }),
          ...(hasPremack ? [new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Premack Principle (first/then)', size: SZ_SM, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bl.premack_baseline}%`, size: SZ_SM, font: FONT })] })] }),
          ]})] : []),
          ...(hasReinforcement ? [new TableRow({ children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Reinforcement Delivery', size: SZ_SM, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bl.reinforcement_baseline}%`, size: SZ_SM, font: FONT })] })] }),
          ]})] : []),
        ],
      })
    );
    children.push(empty(100));

    // Embed caregiver skill progression charts immediately below the table
    const premackChart = hasPremack
      ? chartImage(graphs['caregiver_premack'], 460, 230)
      : null;
    const reinforcementChart = hasReinforcement
      ? chartImage(graphs['caregiver_reinforcement'], 460, 230)
      : null;
    if (premackChart)       children.push(premackChart);
    if (reinforcementChart) children.push(reinforcementChart);
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

    // 21–23. Standardized assessment score placeholders (QABF, BASC-3, Vineland-3)
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
