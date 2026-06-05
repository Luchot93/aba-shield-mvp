import React, { useState, useRef } from 'react';
import { Ico } from '../../../components/icons.jsx';
import { loadCdnScript } from '../../../utils/cdn.js';
import { normalizeDate } from '../../../utils/dates.js';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock.js';

// ─── Role normalization ───────────────────────────────────────────────────────
const ROLE_MAP = {
  // BCBA
  'bcba': 'bcba',
  'board certified behavior analyst': 'bcba',
  'board-certified behavior analyst': 'bcba',
  // BCaBA
  'bcaba': 'bcaba',
  'board certified assistant behavior analyst': 'bcaba',
  'board-certified assistant behavior analyst': 'bcaba',
  'assistant behavior analyst': 'bcaba',
  // RBT
  'rbt': 'rbt',
  'registered behavior technician': 'rbt',
  // Admin / other clinical roles
  'admin': 'admin',
  'administrator': 'admin',
  'care specialist': 'admin',
  'lmhc': 'admin',
  'licensed mental health counselor': 'admin',
};

const ROLE_LABELS = { bcba:'BCBA', bcaba:'BCaBA', rbt:'RBT', admin:'Admin' };

function normalizeRole(raw) {
  if (!raw) return null;
  return ROLE_MAP[String(raw).toLowerCase().trim()] ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE_FIELDS = ['cert_expiry', 'cert_effective_date', 'hire_date'];

// P3: Field length caps — prevent oversized data from propagating into app state
const MAX_LEN = {
  name:        100,
  email:       254,  // RFC 5321
  phone:        30,
  title:       120,
  cert_number:  60,
  npi:          10,
  caqh_id:      30,
  supervisor:  120,
};

function toInitials(name) {
  return (name || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Field definitions ────────────────────────────────────────────────────────
const REQUIRED = [
  { key: 'name',  label: 'Full name' },
  { key: 'email', label: 'Email'     },
  { key: 'role',  label: 'Role'      },
];

const OPTIONAL = [
  { key: 'phone',               label: 'Phone'               },
  { key: 'title',               label: 'Title'               },
  { key: 'cert_number',         label: 'Cert number'         },
  { key: 'cert_expiry',         label: 'Cert expiry'         },
  { key: 'cert_effective_date', label: 'Cert effective date' },
  { key: 'npi',                 label: 'NPI'                 },
  { key: 'caqh_id',             label: 'CAQH ID'             },
  { key: 'hire_date',           label: 'Hire date'           },
  { key: 'supervisor',          label: 'Supervisor'          },
];

// Virtual split-name helpers — shown when 'name' isn't mapped
const SPLIT_NAME = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName',  label: 'Last name'  },
];

const ALL_FIELDS = [...REQUIRED, ...OPTIONAL, ...SPLIT_NAME];

const STEPS = [
  ['drop',    '1. Upload'],
  ['map',     '2. Map Columns'],
  ['preview', '3. Preview & Invite'],
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BulkInvitePanel({ onClose, onImport, existingStaff }) {
  useBodyScrollLock();
  const [step,       setStep]      = useState('drop');
  const [rawRows,    setRawRows]   = useState([]);
  const [headers,    setHeaders]   = useState([]);
  const [mapping,    setMapping]   = useState({});
  const [validated,  setValidated] = useState([]);
  const [loading,    setLoading]   = useState(false);
  const [dragOver,   setDragOver]  = useState(false);
  const [sending,    setSending]   = useState(null); // null | { current, total }
  const [parseError, setParseError] = useState(null);
  const fileRef = useRef(null);

  // ── Step 1: parse file ────────────────────────────────────────────────────
  const parseFile = async file => {
    setLoading(true);
    setParseError(null);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let rows = [];

      if (ext === 'csv') {
        await loadCdnScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
        const text = await file.text();
        rows = window.Papa.parse(text, { header: true, skipEmptyLines: true }).data;
      } else if (ext === 'xlsx' || ext === 'xls') {
        await loadCdnScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const ab = await file.arrayBuffer();
        const wb = window.XLSX.read(ab, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Use header:1 (array-of-arrays) mode so we don't miss rows with gaps in the first column
        const raw2d = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
        if (raw2d.length > 1) {
          const hdrRow = raw2d[0].map(h => String(h));
          rows = raw2d.slice(1).map(r => {
            const obj = {};
            hdrRow.forEach((h, i) => { obj[h] = r[i] !== undefined ? String(r[i]) : ''; });
            return obj;
          });
        }
      } else {
        setParseError('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
        setLoading(false); return;
      }

      // Strip rows that are entirely empty (Excel often appends blank trailing rows)
      rows = rows.filter(row => Object.values(row).some(v => String(v).trim() !== ''));

      if (!rows.length) {
        setParseError('The file appears to be empty. Add at least one data row and try again.');
        setLoading(false); return;
      }

      const hdrs = Object.keys(rows[0]);

      // Auto-map: fuzzy match header against field key + label
      const autoMap = {};
      ALL_FIELDS.forEach(f => {
        const match = hdrs.find(h => {
          const hn = h.toLowerCase().replace(/[\s._-]/g, '');
          const fk = f.key.toLowerCase().replace(/[\s._-]/g, '');
          const fl = f.label.toLowerCase().replace(/[\s._-]/g, '');
          return hn === fk || hn.includes(fk) || fk.includes(hn) || hn === fl || hn.includes(fl) || fl.includes(hn);
        });
        if (match) autoMap[f.key] = match;
      });

      // If not a single required column was recognized, wrong file
      const recognizedRequired = REQUIRED.filter(f => autoMap[f.key]);
      if (recognizedRequired.length === 0) {
        setParseError(
          `None of the required columns were found in this file. ` +
          `Expected: ${REQUIRED.map(f => `"${f.label}"`).join(', ')}. ` +
          `Download the example template below to see the correct format.`
        );
        setLoading(false); return;
      }

      setHeaders(hdrs);
      setRawRows(rows);
      setMapping(autoMap);
      setStep('map');
    } catch (e) {
      console.error(e);
      setParseError('Failed to read the file. Make sure it is a valid CSV or Excel file and try again.');
    }
    setLoading(false);
  };

  // ── Step 2: build preview ────────────────────────────────────────────────
  const buildPreview = () => {
    const rows = rawRows.map((row, i) => {
      // P3: cap applies after trimming so we don't silently accept oversized data
      const get = key => {
        const raw = mapping[key] ? String(row[mapping[key]] ?? '').trim() : '';
        const max = MAX_LEN[key];
        return max ? raw.slice(0, max) : raw;
      };

      // Resolve name: direct or split
      let name = '';
      if (mapping['name']) {
        name = get('name');
      } else {
        const fn = get('firstName');
        const ln = get('lastName');
        name = [fn, ln].filter(Boolean).join(' ');
      }

      const emailRaw = get('email');
      const roleRaw  = get('role');
      const role     = normalizeRole(roleRaw);

      const r = {
        name,
        email:              emailRaw,
        role:               roleRaw,
        _normalizedRole:    role,
        phone:              get('phone'),
        title:              get('title'),
        cert_number:        get('cert_number'),
        cert_expiry:        normalizeDate(mapping['cert_expiry']         ? row[mapping['cert_expiry']]         : ''),
        cert_effective_date:normalizeDate(mapping['cert_effective_date'] ? row[mapping['cert_effective_date']] : ''),
        npi:                get('npi'),
        caqh_id:            get('caqh_id'),
        hire_date:          normalizeDate(mapping['hire_date']           ? row[mapping['hire_date']]           : ''),
        supervisor:         get('supervisor'),
      };

      const errors   = [];   // data errors — need fixing
      const warnings = [];   // soft warnings — still importable
      let   isDup    = false;

      if (!name)                         errors.push('Missing: Full name');
      if (!emailRaw)                     errors.push('Missing: Email');
      else if (!EMAIL_RE.test(emailRaw)) errors.push('Invalid email format');
      if (!roleRaw)                      errors.push('Missing: Role');
      else if (!role)                    errors.push(`Unknown role: "${roleRaw}"`);

      DATE_FIELDS.forEach(f => {
        if (r[f] && !/^\d{4}-\d{2}-\d{2}$/.test(r[f]))
          errors.push(`Invalid date (${f.replace(/_/g, ' ')})`);
      });

      // Email is the authoritative unique key for staff (no member ID equivalent)
      if (emailRaw && !errors.length) {
        isDup = existingStaff.some(s => s.email?.toLowerCase() === emailRaw.toLowerCase());
      }

      return { ...r, _idx: i, _errors: errors, _warnings: warnings, _isDup: isDup, _valid: !isDup && errors.length === 0 };
    });

    setValidated(rows);
    setStep('preview');
  };

  // ── Step 3: import (async — processes one invite at a time so the counter updates) ──
  const doImport = async () => {
    const ts   = Date.now();
    const good = validated.filter(r => r._valid);
    const total = good.length;

    setSending({ current: 0, total });

    const staffRecords  = [];
    const inviteRecords = [];

    for (let i = 0; i < good.length; i++) {
      const r = good[i];
      // Yield to the browser so the counter re-renders between each invite
      await new Promise(resolve => setTimeout(resolve, 35));
      setSending({ current: i + 1, total });

      staffRecords.push({
        id:                  `s_${ts}_${i}`,
        name:                r.name,
        initials:            toInitials(r.name),
        email:               r.email,
        phone:               r.phone || '',
        role:                r._normalizedRole,
        title:               r.title || '',
        cert_number:         r.cert_number || '',
        cert_expiry:         r.cert_expiry || '',
        cert_effective_date: r.cert_effective_date || '',
        npi:                 r.npi || '',
        caqh_id:             r.caqh_id || '',
        hire_date:           r.hire_date || '',
        supervisor:          r.supervisor || '',
        status:              'pending',
      });

      inviteRecords.push({
        id:         `inv_${ts}_${i}`,
        name:       r.name,
        email:      r.email,
        role:       r._normalizedRole,
        invited_at: new Date().toISOString(),
      });
    }

    // Brief pause so the "N of N" final state is visible before closing
    await new Promise(resolve => setTimeout(resolve, 400));
    setSending(null);
    onImport({ staffRecords, inviteRecords });
  };

  // ── Derived counts ───────────────────────────────────────────────────────
  const okCount    = validated.filter(r => r._valid).length;
  const warnCount  = validated.filter(r => r._valid && r._warnings?.length > 0).length;
  const dupCount   = validated.filter(r => r._isDup).length;
  const errorCount = validated.filter(r => !r._valid && !r._isDup).length;

  // Sort: errors first → new/ready → warnings → already-in-system last
  const sortedRows = [...validated].sort((a, b) => {
    const rank = r => (!r._valid && !r._isDup) ? 0 : (r._valid && !r._warnings?.length) ? 1 : r._warnings?.length ? 2 : 3;
    return rank(a) - rank(b);
  });

  const nameMapped = !!(mapping['name'] || (mapping['firstName'] && mapping['lastName']));
  const allMapped  = nameMapped && !!mapping['email'] && !!mapping['role'];

  // ── Example XLSX download ────────────────────────────────────────────────
  const downloadTemplate = async e => {
    e.stopPropagation();
    await loadCdnScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const sampleRows = [
      {
        'Full name': 'Dr. Jane Smith', 'Email': 'jsmith@abaclinic.com', 'Role': 'BCBA',
        'Phone': '(305) 555-0101', 'Title': 'Clinical Director',
        'Cert number': 'BCBA-123456', 'Cert expiry': '2027-03-31',
        'Cert effective date': '2025-04-01', 'NPI': '1234567890',
        'CAQH ID': 'CAQH-448821', 'Hire date': '2022-06-15', 'Supervisor': '',
      },
      {
        'Full name': 'Marcus Rivera', 'Email': 'mrivera@abaclinic.com', 'Role': 'RBT',
        'Phone': '(786) 555-0202', 'Title': 'Registered Behavior Technician',
        'Cert number': 'RBT-654321', 'Cert expiry': '2026-08-31',
        'Cert effective date': '2024-09-01', 'NPI': '',
        'CAQH ID': '', 'Hire date': '2023-02-01', 'Supervisor': 'Dr. Jane Smith',
      },
      {
        'Full name': 'Priya Nair', 'Email': 'pnair@abaclinic.com', 'Role': 'BCaBA',
        'Phone': '', 'Title': 'Assistant Behavior Analyst',
        'Cert number': 'BCaBA-789012', 'Cert expiry': '2026-11-30',
        'Cert effective date': '2024-12-01', 'NPI': '9876543210',
        'CAQH ID': '', 'Hire date': '2023-11-01', 'Supervisor': 'Dr. Jane Smith',
      },
    ];
    const ws = window.XLSX.utils.json_to_sheet(sampleRows);
    ws['!cols'] = [22, 26, 10, 16, 28, 14, 14, 20, 14, 14, 12, 22].map(w => ({ wch: w }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Staff');
    window.XLSX.writeFile(wb, 'ABAShield_Staff_Import_Template.xlsx');
  };

  // ── Mapping UI: which fields to show ────────────────────────────────────
  // Show split-name rows only when 'name' is not yet mapped
  const showSplitName = !mapping['name'];

  const mapFields = [
    ...REQUIRED.filter(f => f.key !== 'name'),      // email + role always
    { key: 'name', label: 'Full name', _isName: true }, // name row (may show split below)
    ...OPTIONAL,
  ];

  // ── Role badge color ─────────────────────────────────────────────────────
  const roleBadgeStyle = role => {
    if (role === 'bcba' || role === 'bcaba') return 'bg-teal-50 text-teal-700 border-teal-200';
    if (role === 'rbt')   return 'bg-blue-50 text-blue-700 border-blue-200';
    if (role === 'admin') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-stone-100 text-slate-500 border-stone-200';
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(15,23,42,0.45)' }} data-testid="bulk-invite-panel">
      <div className="flex-1" onClick={onClose}/>
      <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              Import Staff
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Batch-invite staff from a CSV or Excel export</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition-colors">
            <Ico.X/>
          </button>
        </div>

        {/* Step bar */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-stone-100 flex-shrink-0" style={{ background: '#FAFAF8' }}>
          {STEPS.map(([s, label], i) => (
            <React.Fragment key={s}>
              <span className={`text-xs font-medium ${step === s ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="text-slate-200 mx-1">›</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP 1: Drop ───────────────────────────────────────────── */}
          {step === 'drop' && (
            <div
              data-testid="bulk-invite-dropzone"
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${dragOver ? 'border-teal-400 bg-teal-50' : 'border-stone-300 hover:border-teal-300 hover:bg-teal-50/20'}`}>
              <input
                ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) parseFile(f); }}/>
              <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
              </div>
              {loading
                ? <p className="text-sm text-slate-500 animate-pulse">Parsing file…</p>
                : <>
                    <p className="text-sm font-semibold text-slate-700">
                      Drop your file here, or <span className="text-teal-600 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">Supports .csv and .xlsx — Office Puzzle exports work directly</p>
                    {parseError && (
                      <div className="mt-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl border text-left"
                        style={{ background:'rgba(239,68,68,0.05)', borderColor:'rgba(239,68,68,0.25)' }}>
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        </svg>
                        <p className="text-xs text-red-700 leading-relaxed">{parseError}</p>
                      </div>
                    )}
                    <button
                      onClick={downloadTemplate}
                      className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 border border-teal-200 bg-white rounded-lg hover:bg-teal-50 transition-colors"
                      data-testid="bulk-invite-download-template">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                      Download example file
                    </button>
                  </>
              }
            </div>
          )}

          {/* ── STEP 2: Map Columns ────────────────────────────────────── */}
          {step === 'map' && (
            <div data-testid="bulk-invite-mapping">
              <p className="text-sm text-slate-600 mb-4">
                Match your file's columns to the required fields.{' '}
                <span className="font-semibold text-slate-800">{rawRows.length} rows detected.</span>
              </p>
              {/* Unmapped required fields banner */}
              {REQUIRED.filter(f => !mapping[f.key]).length > 0 && (
                <div className="mb-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl border"
                  style={{ background:'rgba(239,68,68,0.05)', borderColor:'rgba(239,68,68,0.2)' }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1">
                      {REQUIRED.filter(f => !mapping[f.key]).length} required column{REQUIRED.filter(f => !mapping[f.key]).length !== 1 ? 's' : ''} not mapped
                    </p>
                    <p className="text-xs text-red-600">
                      {REQUIRED.filter(f => !mapping[f.key]).map(f => f.label).join(' · ')}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {/* Required fields */}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Required</p>
                {REQUIRED.map(f => {
                  // For 'name', show it with the split-name option below
                  if (f.key === 'name') {
                    return (
                      <div key="name-group">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium w-44 flex-shrink-0 text-slate-800">
                            Full name <span className="text-red-500 ml-0.5">*</span>
                          </span>
                          <select
                            value={mapping['name'] || ''}
                            onChange={e => setMapping(m => ({ ...m, name: e.target.value || undefined }))}
                            className="flex-1 text-xs px-2.5 py-1.5 border border-stone-200 rounded-lg outline-none focus:border-teal-400 bg-white text-slate-700">
                            <option value="">— not mapped —</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          {mapping['name']
                            ? <span className="text-teal-600 flex-shrink-0"><Ico.Check/></span>
                            : <span className="text-[10px] text-red-500 font-semibold w-14 flex-shrink-0">Required</span>
                          }
                        </div>
                        {/* Split name option */}
                        {showSplitName && (
                          <div className="ml-44 pl-3 mt-1.5 space-y-1.5 border-l-2 border-stone-100">
                            <p className="text-[10px] text-slate-400">Or map first + last name separately:</p>
                            {SPLIT_NAME.map(sf => (
                              <div key={sf.key} className="flex items-center gap-3">
                                <span className="text-xs text-slate-500 w-24 flex-shrink-0">{sf.label}</span>
                                <select
                                  value={mapping[sf.key] || ''}
                                  onChange={e => setMapping(m => ({ ...m, [sf.key]: e.target.value || undefined }))}
                                  className="flex-1 text-xs px-2.5 py-1.5 border border-stone-200 rounded-lg outline-none focus:border-teal-400 bg-white text-slate-700">
                                  <option value="">— not mapped —</option>
                                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                {mapping[sf.key]
                                  ? <span className="text-teal-600 flex-shrink-0"><Ico.Check/></span>
                                  : <span className="w-14 flex-shrink-0"/>
                                }
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-44 flex-shrink-0 text-slate-800">
                        {f.label} <span className="text-red-500 ml-0.5">*</span>
                      </span>
                      <select
                        value={mapping[f.key] || ''}
                        onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-stone-200 rounded-lg outline-none focus:border-teal-400 bg-white text-slate-700">
                        <option value="">— not mapped —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      {mapping[f.key]
                        ? <span className="text-teal-600 flex-shrink-0"><Ico.Check/></span>
                        : <span className="text-[10px] text-red-500 font-semibold w-14 flex-shrink-0">Required</span>
                      }
                    </div>
                  );
                })}

                {/* Optional fields */}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-4 mb-1 pt-3 border-t border-stone-100">
                  Optional
                </p>
                {OPTIONAL.map(f => (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-44 flex-shrink-0 text-slate-500">{f.label}</span>
                    <select
                      value={mapping[f.key] || ''}
                      onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}
                      className="flex-1 text-xs px-2.5 py-1.5 border border-stone-200 rounded-lg outline-none focus:border-teal-400 bg-white text-slate-700">
                      <option value="">— not mapped —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {mapping[f.key]
                      ? <span className="text-teal-600 flex-shrink-0"><Ico.Check/></span>
                      : <span className="w-14 flex-shrink-0"/>
                    }
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('drop')} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">← Back</button>
                <button
                  onClick={buildPreview}
                  disabled={!allMapped}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  style={{ background: '#0D9488' }}>
                  Preview →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview & Invite ───────────────────────────────── */}
          {step === 'preview' && (
            <div data-testid="bulk-invite-preview">

              {/* All already in system */}
              {okCount === 0 && errorCount === 0 && dupCount > 0 && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 border"
                  style={{ background:'rgba(20,184,166,0.05)', borderColor:'rgba(20,184,166,0.2)' }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-teal-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-teal-700">All staff already exist</p>
                    <p className="text-xs text-teal-600 mt-0.5">Every row in this file is already in the system. Nothing new to invite.</p>
                  </div>
                </div>
              )}

              {/* Hard data errors block import */}
              {okCount === 0 && errorCount > 0 && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 border"
                  style={{ background:'rgba(239,68,68,0.06)', borderColor:'rgba(239,68,68,0.25)' }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700">No new staff to invite</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {errorCount} row{errorCount !== 1 ? 's have' : ' has'} data errors that need fixing.
                      {dupCount > 0 && ` ${dupCount} already exist in the system and will be skipped.`}
                      {' '}Go back to edit the column mapping, or fix the source file and re-upload.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary banner */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border ${
                okCount === 0 && errorCount > 0 ? 'bg-red-50 border-red-200' :
                errorCount > 0 || warnCount > 0 ? 'bg-amber-50 border-amber-200' :
                                                   'bg-teal-50 border-teal-200'
              }`}>
                <span className="text-sm font-semibold text-slate-800">
                  {okCount > 0 && <span className="text-teal-700">{okCount} new staff member{okCount !== 1 ? 's' : ''} ready</span>}
                  {okCount > 0 && dupCount > 0 && <span className="text-slate-400"> · </span>}
                  {dupCount > 0 && <span className="text-slate-500">{dupCount} already in system</span>}
                  {(okCount > 0 || dupCount > 0) && warnCount > 0 && <span className="text-slate-400"> · </span>}
                  {warnCount > 0 && <span className="text-amber-600">{warnCount} possible duplicate{warnCount !== 1 ? 's' : ''}</span>}
                  {(okCount > 0 || dupCount > 0 || warnCount > 0) && errorCount > 0 && <span className="text-slate-400"> · </span>}
                  {errorCount > 0 && <span className="text-red-600">{errorCount} data error{errorCount !== 1 ? 's' : ''} — will be skipped</span>}
                </span>
                <span className="flex-1"/>
                <button onClick={() => setStep('map')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  ← Edit mapping
                </button>
              </div>

              {/* Preview table */}
              <div className="rounded-xl border border-stone-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-xs border-collapse" style={{ minWidth: '560px' }}>
                  <thead>
                    <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E7E5E0' }}>
                      {['#', 'Full name', 'Email', 'Role', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.slice(0, 50).map(row => (
                      <tr key={row._idx} style={{
                        borderBottom: '1px solid #F5F4F0',
                        background: row._isDup ? '#F8FAFC' : !row._valid ? '#FFF5F5' : row._warnings?.length ? '#FFFBEB' : '',
                      }}>
                        <td className="px-3 py-2 text-slate-400">{row._idx + 1}</td>
                        <td className={`px-3 py-2 font-medium max-w-[160px] truncate ${row._isDup ? 'text-slate-400' : 'text-slate-800'}`}>
                          {row.name || <em className="not-italic text-red-400">—</em>}
                        </td>
                        <td className={`px-3 py-2 max-w-[180px] truncate ${row._isDup ? 'text-slate-400' : 'text-slate-600'}`} style={{ fontFamily: 'DM Mono, monospace' }}>
                          {row.email || <em className="not-italic text-red-400">—</em>}
                        </td>
                        <td className="px-3 py-2">
                          {row._normalizedRole
                            ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${row._isDup ? 'bg-slate-50 text-slate-400 border-slate-200' : roleBadgeStyle(row._normalizedRole)}`}>
                                {ROLE_LABELS[row._normalizedRole]}
                              </span>
                            : row.role
                              ? <span className="text-[10px] text-red-500 italic">{row.role}</span>
                              : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-3 py-2">
                          {row._isDup && (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded text-slate-500 bg-slate-100 border border-slate-200">
                              Already in system
                            </span>
                          )}
                          {!row._isDup && row._valid && !row._warnings?.length && (
                            <span className="text-teal-600 font-semibold">✓ New</span>
                          )}
                          {!row._isDup && row._valid && row._warnings?.length > 0 && (
                            <div className="flex flex-col gap-0.5">
                              {row._warnings.map((w, i) => (
                                <span key={i} className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded text-amber-700 bg-amber-50 border border-amber-200">{w}</span>
                              ))}
                              <span className="text-[10px] text-amber-600 mt-0.5">Will be invited</span>
                            </div>
                          )}
                          {!row._isDup && !row._valid && (
                            <div className="flex flex-col gap-0.5">
                              {row._errors.map((e, i) => (
                                <span key={i} className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200">{e}</span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validated.length > 50 && (
                  <p className="px-4 py-2 text-xs text-slate-400 border-t border-stone-100">
                    Showing first 50 of {validated.length} rows · new staff appear first
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer (preview step only) */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-200 flex-shrink-0" style={{ background: '#FAFAF8' }}>
            {sending ? (
              /* ── Sending progress ── */
              <div className="flex items-center gap-4 w-full">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {/* Spinner */}
                  <svg className="w-4 h-4 text-teal-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">
                      Sending invitations… {sending.current} of {sending.total}
                    </p>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-150"
                        style={{ background: '#0D9488', width: `${(sending.current / sending.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {Math.round((sending.current / sending.total) * 100)}%
                </span>
              </div>
            ) : (
              /* ── Normal footer ── */
              <>
                <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                <button
                  onClick={doImport}
                  disabled={okCount === 0}
                  data-testid="bulk-invite-submit"
                  className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  style={{ background: '#0D9488' }}>
                  Invite {okCount} staff member{okCount !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
