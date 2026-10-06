/**
 * denialCycleExport.js
 *
 * Generates the "Denial Cycle N — Reason & Appeal Record" .docx — a permanent
 * record of one denial/appeal cycle (denial date & code, reason, peer-to-peer
 * status, supporting docs filed, appeal deadline/outcome, and where the client
 * was routed next). Generated automatically when leaving the Denied stage, so
 * the cycle's data survives even if the client is denied again later and the
 * same real columns (denial_date, denial_code, etc.) get overwritten.
 *
 * Built programmatically with the `docx` library (same approach as
 * planDraftExport.js) — there is no .docx template file for this document.
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

function titleBlock(client, cycleNumber) {
  return [
    new Paragraph({
      children: [new TextRun({ text: 'ABA SHIELD BEHAVIORAL SERVICES', bold: true, size: SZ_XL, font: FONT, color: TEAL })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `DENIAL CYCLE ${cycleNumber} — REASON & APPEAL RECORD`, bold: true, size: SZ_LG, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `${client?.name ?? 'Client'}  ·  Generated ${fmtDate(new Date().toISOString().slice(0, 10))}`,
        size: SZ_SM, font: FONT, color: SLATE, italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];
}

function clientInfoTable(client) {
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
      mkCell('Client Name',  client?.name ?? '—',  true),
      mkCell('Date of Birth', fmtDate(client?.dob), true),
      mkCell('Insurer',       client?.insurer_name ?? '—', true),
    ]}),
  ];

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows });
}

function denialDetailsTable(client) {
  const mkRow = (label, value) => new TableRow({ children: [
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: SZ_SM, font: FONT })] })],
      shading: { type: ShadingType.SOLID, color: TEAL_LIGHT },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      width: { size: 45, type: WidthType.PERCENTAGE },
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: SZ_SM, font: FONT })] })],
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    }),
  ]});

  const rows = [
    mkRow('Denial Received Date', fmtDate(client?.denial_date)),
    mkRow('Denial Code',          client?.denial_code),
    mkRow('Denial Reason',        client?.denial_reason),
    mkRow('Appeal Deadline',      fmtDate(client?.appeal_deadline)),
  ];

  return [
    sectionHeading('Denial Details'),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows }),
    empty(160),
  ];
}

function appealProgressSection(client, outcome) {
  const denied = client?.checklist?.denied ?? {};
  const p2pStatus = denied.peer_to_peer_scheduled_na
    ? 'N/A for this case'
    : denied.peer_to_peer_completed
      ? 'Completed'
      : denied.peer_to_peer_scheduled
        ? 'Scheduled'
        : 'Not scheduled';

  const supportingDocs = (client?.documents ?? [])
    .filter(d => d.type === 'appeal_docs')
    .map(d => d.label);

  const lines = [
    `Peer-to-peer status: ${p2pStatus}`,
    `Supporting documentation filed: ${supportingDocs.length ? supportingDocs.join(', ') : 'None on file'}`,
    `Appeal outcome: ${outcome ?? 'Pending'}`,
  ];

  return [
    sectionHeading('Appeal Progress'),
    ...lines.map(bodyPara),
  ];
}

function resolutionSection(destinationLabel) {
  return [
    sectionHeading('Resolution'),
    bodyPara(`Client routed to: ${destinationLabel}`),
  ];
}

/**
 * @param {object} client           Full client record (name, dob, denial_date,
 *                                   denial_code, denial_reason, appeal_deadline,
 *                                   checklist.denied.*, documents, etc.)
 * @param {object} opts
 * @param {number} opts.cycleNumber     client.denial_count at generation time
 * @param {string} opts.outcome         'Approved' | 'Upheld' | 'Pending'
 * @param {string} opts.destinationLabel Human-readable stage the client was routed to
 * @returns {Promise<Blob>}
 */
export async function generateDenialCycleRecord(client, { cycleNumber, outcome, destinationLabel }) {
  const children = [
    ...titleBlock(client, cycleNumber),
    clientInfoTable(client),
    empty(200),
    ...denialDetailsTable(client),
    ...appealProgressSection(client, outcome),
    ...resolutionSection(destinationLabel),
  ].filter(Boolean);

  const doc = new Document({
    creator:     'ABA Shield',
    title:       `Denial Cycle ${cycleNumber} — ${client?.name ?? 'Client'}`,
    description: 'Denial Cycle — Reason & Appeal Record',
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
