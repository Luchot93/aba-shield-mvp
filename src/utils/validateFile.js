const MAGIC_NUMBER_SNIFFERS = {
  'application/pdf': bytes => bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46, // %PDF
  'image/png':  bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47,
  'image/jpeg': bytes => bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF,
  // .docx is a zip archive — the PK signature rules out non-zip disguises (e.g. a
  // renamed .exe) but doesn't confirm the zip actually contains Word XML.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    bytes => bytes[0] === 0x50 && bytes[1] === 0x4B,
  // .xlsx is also a zip archive (same caveat as .docx above).
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    bytes => bytes[0] === 0x50 && bytes[1] === 0x4B,
  // Legacy .xls is an OLE2 compound file — distinct signature from the zip-based formats.
  'application/vnd.ms-excel':
    bytes => bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0,
};

const TYPE_LABELS = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
};

// Matches the `client-documents` Storage bucket's server-side allowlist/limit (Prompt A2).
export const DOCUMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
];
export const DOCUMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

// CSV import guards — client-side parser protection only, not a Storage-backed boundary.
export const CSV_ALLOWED_MIME_TYPES = ['text/csv'];
export const CSV_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// XLSX/XLS import guards — same client-side-only boundary as CSV above (ImportPanel, BulkInvitePanel).
export const SPREADSHEET_ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
export const SPREADSHEET_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function formatSize(bytes) {
  return bytes % (1024 * 1024) === 0 ? `${bytes / (1024 * 1024)}MB` : `${Math.round(bytes / 1024)}KB`;
}

function friendlyTypeList(mimeTypes) {
  return mimeTypes.map(t => TYPE_LABELS[t] ?? t).join(', ');
}

/**
 * Checks a File against an allowed MIME-type list and a max size. For the types
 * with a known byte signature (PDF, PNG, JPEG, DOCX, XLSX, XLS) it also sniffs
 * the first bytes so a renamed/disguised file can't just spoof `file.type`. Plain
 * text types like CSV have no reliable signature, so only MIME + size apply.
 */
export async function validateFile(file, { allowedMimeTypes = [], maxSizeBytes } = {}) {
  if (!file) return { valid: false, error: 'No file selected.' };

  if (maxSizeBytes && file.size > maxSizeBytes) {
    return { valid: false, error: `File is too large — max size is ${formatSize(maxSizeBytes)}.` };
  }

  if (allowedMimeTypes.length && !allowedMimeTypes.includes(file.type)) {
    return { valid: false, error: `File type not allowed. Accepted: ${friendlyTypeList(allowedMimeTypes)}.` };
  }

  const sniff = MAGIC_NUMBER_SNIFFERS[file.type];
  if (sniff) {
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (!sniff(header)) {
      return { valid: false, error: "This file's content doesn't match its type and may be corrupted or mislabeled." };
    }
  }

  return { valid: true };
}
