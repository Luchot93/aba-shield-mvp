/**
 * planDraftExport.js
 *
 * Generates the caregiver-facing Treatment Plan Summary .docx — a short document
 * a BCBA hands to the parent/guardian for review and signature. This is NOT the
 * clinical assessment report (see ../../assessment/lib/generateAssessmentDoc.js):
 * no biopsychosocial narrative, no behavior hypotheses, no crisis plan, no graphs.
 * Just goals, hours/schedule, and a signature block.
 *
 * Built programmatically with the `docx` library (same approach as
 * generateAssessmentDoc.js) — there is no .docx template file for this document.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import {
  hasMedicalNecessityContent,
  hasSkillTargetsContent,
  hasBehaviorGoalsContent,
  hasCaregiverTrainingContent,
} from './planDraftContentChecks.js';

// ─── Typography constants (matches generateAssessmentDoc.js's clinic styling) ─

const FONT        = 'Arial';
const SZ          = 20;  // 10pt
const SZ_SM       = 18;  // 9pt
const SZ_LG       = 24;  // 12pt
const SZ_XL       = 28;  // 14pt
const TEAL        = '2D7D6F';
const TEAL_LIGHT  = 'E8F5F3';
const TEAL_BORDER = 'B2D8D3';
const SLATE       = '475569';

const TABLE_BORDERS = {
  top:     { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  bottom:  { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  left:    { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  right:   { style: BorderStyle.SINGLE, size: 4, color: TEAL_BORDER },
  insideH: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
  insideV: { style: BorderStyle.SINGLE, size: 2, color: TEAL_BORDER },
};

const fmtDate = (iso) => iso
  ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : '—';

const empty = (after = 120) => new Paragraph({ text: '', spacing: { after } });

const sectionHeading = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: SZ_LG, font: FONT, color: TEAL })],
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL } },
  });

const bodyPara = (text) =>
  text?.trim()
    ? new Paragraph({ children: [new TextRun({ text, size: SZ, font: FONT })], spacing: { after: 120 } })
    : null;

// ─── 1. Title block ───────────────────────────────────────────────────────────

function titleBlock(client) {
  return [
    new Paragraph({
      children: [new TextRun({ text: 'ABA SHIELD BEHAVIORAL SERVICES', bold: true, size: SZ_XL, font: FONT, color: TEAL })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'TREATMENT PLAN SUMMARY', bold: true, size: SZ_LG, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Prepared for ${client?.name ?? 'Client'}  ·  ${fmtDate(new Date().toISOString().slice(0, 10))}`,
        size: SZ_SM, font: FONT, color: SLATE, italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];
}

// ─── 2. Client info table ──────────────────────────────────────────────────────

function clientInfoTable(client, bcbaName) {
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

  const rows = [
    new TableRow({ children: [
      mkCell('Client Name',  client?.name ?? '—',          true),
      mkCell('Date of Birth', fmtDate(client?.dob),         true),
      mkCell('BCBA',          bcbaName ?? '—',               true),
    ]}),
    new TableRow({ children: [
      mkCell('Diagnosis',    client?.diagnosis ?? '—'),
      mkCell('ICD-10',       client?.icd10 ?? '—'),
      mkCell('Plan Period',  `${fmtDate(client?.plan_start_date)} – ${fmtDate(client?.plan_end_date)}`),
    ]}),
  ];

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows });
}

// ─── 3. Why services are needed (short, plain-language) ──────────────────────
// Uses only the first paragraph of the already-approved medical necessity
// narrative — never fabricates a shorter rewrite of clinical content.

function medicalNecessitySection(session) {
  const sec = session?.sections?.medical_necessity;
  if (!hasMedicalNecessityContent(sec)) {
    return [sectionHeading('Why Services Are Needed'), bodyPara('To be completed by the BCBA.')];
  }
  const firstParagraph = sec.draftContent
    .trim()
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .find(p => p && !/^#/.test(p));
  return [sectionHeading('Why Services Are Needed'), bodyPara(firstParagraph ?? 'To be completed by the BCBA.')];
}

// ─── 4. Skill acquisition goals ────────────────────────────────────────────────

function skillGoalsSection(session) {
  if (!hasSkillTargetsContent(session)) {
    return [sectionHeading('Skill-Building Goals'), bodyPara('No skill goals documented yet.')];
  }
  const goals = session.sections.skill_acquisitions.skillGoals ?? [];

  const headerRow = new TableRow({ children: ['Area', 'Skill We Are Building'].map(h =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: SZ_SM, font: FONT })] })],
      shading: { type: ShadingType.SOLID, color: TEAL_LIGHT },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    })
  )});

  const rows = goals.map(g => new TableRow({ children: [
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: g.domain || '—', size: SZ_SM, font: FONT })] })],
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: g.targetSkill || '—', size: SZ_SM, font: FONT })] })],
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    }),
  ]}));

  return [
    sectionHeading('Skill-Building Goals'),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows: [headerRow, ...rows] }),
    empty(160),
  ];
}

// ─── 5. Behavior reduction goals ───────────────────────────────────────────────

function behaviorGoalsSection(session) {
  if (!hasBehaviorGoalsContent(session)) {
    return [sectionHeading('Behavior Reduction Goals'), bodyPara('No behavior targets documented yet.')];
  }
  const behaviors = session.sections.behavior_targets.behaviorTargets ?? [];

  const headerRow = new TableRow({ children: ['Behavior', 'Current', 'Goal'].map(h =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: SZ_SM, font: FONT })] })],
      shading: { type: ShadingType.SOLID, color: TEAL_LIGHT },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    })
  )});

  const rows = behaviors.map(bt => {
    const unit = bt.frequencyUnit || 'day';
    const current = bt.baselineFrequency ? `${bt.baselineFrequency} per ${unit}` : '—';
    // Never fabricate a reduction target — only show one if the BCBA entered it.
    const goal = (bt.targetFrequency != null && bt.targetFrequency !== '')
      ? `${bt.targetFrequency} per ${unit}`
      : 'To be determined from baseline data';
    return new TableRow({ children: [bt.behaviorName || '—', current, goal].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, size: SZ_SM, font: FONT })] })],
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
      })
    )});
  });

  return [
    sectionHeading('Behavior Reduction Goals'),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows: [headerRow, ...rows] }),
    empty(160),
  ];
}

// ─── 6. Caregiver training ─────────────────────────────────────────────────────

function caregiverTrainingSection(session) {
  const sec = session?.sections?.caregiver_training;
  if (!hasCaregiverTrainingContent(sec)) {
    return [sectionHeading('Caregiver Training'), bodyPara('Caregiver training schedule to be determined.')];
  }
  const { trainingFormat, trainingFrequency, caregiverTrainingTargets } = sec;
  const targetNames = (caregiverTrainingTargets ?? []).map(t => t.goalName).filter(Boolean);

  const lines = [];
  if (trainingFormat?.length) lines.push(`Format: ${trainingFormat.join(', ')}`);
  if (trainingFrequency)      lines.push(`Frequency: ${trainingFrequency}`);
  if (targetNames.length)     lines.push(`Focus areas: ${targetNames.join(', ')}`);

  return [
    sectionHeading('Caregiver Training'),
    ...(lines.length ? lines.map(bodyPara) : [bodyPara('Caregiver training schedule to be determined.')]),
  ];
}

// ─── 7. Service hours & schedule ───────────────────────────────────────────────

function serviceScheduleSection(client) {
  const mkRow = (label, value) => new TableRow({ children: [
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: SZ_SM, font: FONT })] })],
      shading: { type: ShadingType.SOLID, color: TEAL_LIGHT },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      width: { size: 55, type: WidthType.PERCENTAGE },
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: SZ_SM, font: FONT })] })],
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    }),
  ]});

  const rows = [
    mkRow('Direct Therapy Hours (CPT 97153) / month',    client?.hours_97153 != null ? String(client.hours_97153) : null),
    mkRow('BCBA Supervision Hours (CPT 97155) / month',  client?.hours_97155 != null ? String(client.hours_97155) : null),
    mkRow('Caregiver Training Hours (CPT 97156) / month', client?.hours_97156 != null ? String(client.hours_97156) : null),
    mkRow('Sessions per Week',                            client?.sessions_per_week != null ? String(client.sessions_per_week) : null),
    mkRow('Session Duration',                             client?.session_duration_min != null ? `${client.session_duration_min} minutes` : null),
  ];

  return [
    sectionHeading('Service Hours & Schedule'),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows }),
    empty(160),
  ];
}

// ─── 8. Signature block ────────────────────────────────────────────────────────

function signatureSection() {
  const divider = () =>
    new Paragraph({
      children: [new TextRun({ text: '_'.repeat(42), size: SZ, font: FONT, color: '94A3B8' })],
      spacing: { after: 40 },
    });

  const dateLine = (label) =>
    new Paragraph({
      children: [
        new TextRun({ text: label, size: SZ_SM, font: FONT, color: SLATE }),
        new TextRun({ text: '                                                   ', size: SZ_SM, font: FONT }),
        new TextRun({ text: 'Date: ', bold: true, size: SZ_SM, font: FONT }),
        new TextRun({ text: '_'.repeat(18), size: SZ_SM, font: FONT, color: '94A3B8' }),
      ],
      spacing: { after: 200 },
    });

  return [
    sectionHeading('Review & Approval'),
    bodyPara('By signing below, the parent/guardian confirms they have reviewed this treatment plan and approve the goals and services described above.'),
    empty(80),

    new Paragraph({
      children: [new TextRun({ text: 'Parent / Guardian', bold: true, size: SZ, font: FONT, color: TEAL })],
      spacing: { before: 120, after: 80 },
    }),
    divider(),
    dateLine('Signature'),

    new Paragraph({
      children: [new TextRun({ text: 'Lead Behavior Analyst (BCBA)', bold: true, size: SZ, font: FONT, color: TEAL })],
      spacing: { before: 120, after: 80 },
    }),
    divider(),
    dateLine('Signature'),
  ];
}

// ─── generatePlanDraftDoc ──────────────────────────────────────────────────────

/**
 * @param {object} client   Full client record (name, dob, diagnosis, icd10,
 *                           hours_97153/97155/97156, plan dates, etc.)
 * @param {object} session  client.assessment_session
 * @param {string} bcbaName Display name of the assigned BCBA
 * @returns {Promise<Blob>}
 */
export async function generatePlanDraftDoc(client, session, bcbaName) {
  const children = [
    ...titleBlock(client),
    clientInfoTable(client, bcbaName),
    empty(200),
    ...medicalNecessitySection(session),
    ...skillGoalsSection(session),
    ...behaviorGoalsSection(session),
    ...caregiverTrainingSection(session),
    ...serviceScheduleSection(client),
    ...signatureSection(),
  ].filter(Boolean);

  const doc = new Document({
    creator:     'ABA Shield',
    title:       `Treatment Plan — ${client?.name ?? 'Client'}`,
    description: 'Caregiver-facing Treatment Plan Summary',
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
        page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}
