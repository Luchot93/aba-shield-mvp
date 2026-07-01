import React, { useState, useRef } from 'react';
import { Ico } from '../../../components/icons.jsx';
import { loadCdnScript } from '../../../utils/cdn.js';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock.js';
import { normalizeDate } from '../../../utils/dates.js';
import { FLAGS } from '../../../constants/featureFlags.js';

const IMPORT_REQUIRED = [
  { key:'name',             label:'Client name'      },
  { key:'dob',              label:'Date of birth'    },
  { key:'insurer_name',     label:'Insurer name'     },
  { key:'member_id',        label:'Member ID'        },
  { key:'referral_date',    label:'Referral date'    },
];
const IMPORT_OPTIONAL = [
  { key:'phone',                    label:'Phone'                    },
  { key:'address',                  label:'Address'                  },
  { key:'group_number',             label:'Group number'             },
  { key:'health_plan_name',         label:'Health plan name'         },
  { key:'referring_provider',       label:'Referring provider'       },
  { key:'referring_provider_npi',   label:'Referring provider NPI'   },
  { key:'referring_provider_phone', label:'Referring provider phone' },
  { key:'gender',                   label:'Gender'                   },
  { key:'icd10',                    label:'ICD-10 code'              },
  { key:'diagnosis',                label:'Diagnosis'                },
  { key:'parent_name',              label:'Parent / guardian name'   },
  { key:'parent_relationship',      label:'Relationship'             },
  { key:'parent_email',             label:'Parent email'             },
  { key:'preferred_language',       label:'Preferred language'       },
];
const IMPORT_ALL = [...IMPORT_REQUIRED, ...IMPORT_OPTIONAL];

export default function ImportPanel({ onClose, onImport, existingClients }) {
  useBodyScrollLock();
  const [step,       setStep]      = useState('drop');
  const [rawRows,    setRawRows]   = useState([]);
  const [headers,    setHeaders]   = useState([]);
  const [mapping,    setMapping]   = useState({});
  const [validated,  setValidated] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [dragOver,      setDragOver]      = useState(false);
  const [parseError,    setParseError]    = useState(null);
  const [addToPipeline, setAddToPipeline] = useState(false);
  const fileRef = useRef(null);

  const parseFile = async file => {
    setLoading(true);
    setParseError(null);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let rows = [];
      if (ext === 'csv') {
        await loadCdnScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
        const text = await file.text();
        const result = window.Papa.parse(text, { header:true, skipEmptyLines:true });
        rows = result.data;
      } else if (ext === 'xlsx' || ext === 'xls') {
        await loadCdnScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const ab = await file.arrayBuffer();
        const wb = window.XLSX.read(ab, { type:'array', cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Use header:1 (array-of-arrays) mode so we don't miss rows with gaps in the first column
        const raw2d = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false, blankrows:false });
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
      const norm = s => s.toLowerCase().replace(/[\s_-]/g,'');
      const autoMap = {};
      const usedHeaders = new Set();

      // Pass 1: exact matches only, so e.g. "Referring provider NPI" claims its own
      // column before the looser pass 2 lets "Referring provider" swallow it via substring match.
      IMPORT_ALL.forEach(f => {
        const fk = norm(f.key), fl = norm(f.label);
        const match = hdrs.find(h => !usedHeaders.has(h) && (norm(h) === fk || norm(h) === fl));
        if (match) { autoMap[f.key] = match; usedHeaders.add(match); }
      });

      // Pass 2: fuzzy substring matches for anything still unmapped, restricted to
      // headers pass 1 didn't already claim, so no header is assigned to two fields.
      IMPORT_ALL.forEach(f => {
        if (autoMap[f.key]) return;
        const fk = norm(f.key), fl = norm(f.label);
        const match = hdrs.find(h => {
          if (usedHeaders.has(h)) return false;
          const hn = norm(h);
          return hn.includes(fk) || fk.includes(hn) || hn.includes(fl) || fl.includes(hn);
        });
        if (match) { autoMap[f.key] = match; usedHeaders.add(match); }
      });

      // If not a single required column was recognized, this is probably the wrong file
      const recognizedRequired = IMPORT_REQUIRED.filter(f => autoMap[f.key]);
      if (recognizedRequired.length === 0) {
        setParseError(
          `None of the required columns were found in this file. ` +
          `Expected: ${IMPORT_REQUIRED.map(f => `"${f.label}"`).join(', ')}. ` +
          `Download the example template below to see the correct format.`
        );
        setLoading(false); return;
      }

      setHeaders(hdrs);
      setRawRows(rows);
      setMapping(autoMap);
      setStep('map');
    } catch(e) {
      console.error(e);
      setParseError('Failed to read the file. Make sure it is a valid CSV or Excel file and try again.');
    }
    setLoading(false);
  };

  const buildPreview = () => {
    const rows = rawRows.map((row, i) => {
      const r = {};
      IMPORT_ALL.forEach(f => {
        const raw = mapping[f.key] ? row[mapping[f.key]] : '';
        if (f.key === 'dob' || f.key === 'referral_date') {
          r[f.key] = normalizeDate(raw);
        } else {
          r[f.key] = raw !== undefined && raw !== null ? String(raw).trim() : '';
        }
      });
      const errs  = [];   // data errors — need fixing
      const warns = [];   // soft warnings — still importable
      let   isDup = false;

      IMPORT_REQUIRED.forEach(f => { if (!r[f.key]) errs.push(`Missing: ${f.label}`); });
      if (r.dob && !/^\d{4}-\d{2}-\d{2}$/.test(r.dob))
        errs.push('Invalid date format (DOB)');
      if (r.referral_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.referral_date))
        errs.push('Invalid date format (Referral)');

      // Duplicate detection: Member ID is the authoritative unique key.
      // Fall back to name+DOB as a soft warning when Member ID is absent on either side.
      const memberId = r.member_id?.trim().toLowerCase();
      if (memberId && existingClients.some(c => c.member_id?.trim().toLowerCase() === memberId)) {
        isDup = true;   // already in system — skip silently, not a data error
      } else if (!memberId) {
        const nameDobDup = existingClients.some(
          c => c.name?.toLowerCase() === r.name?.toLowerCase() && c.dob === r.dob
        );
        if (nameDobDup) warns.push('Possible duplicate (name + DOB match)');
      }

      return { ...r, _idx:i, _errors:errs, _warnings:warns, _isDup:isDup, _valid:!isDup && errs.length === 0 };
    });
    setValidated(rows);
    setStep('preview');
  };

  const doImport = () => {
    const valid = validated.filter(r => r._valid);
    const now   = new Date().toISOString();
    onImport(valid.map(r => ({
      name:r.name, dob:r.dob, phone:r.phone||'', address:r.address||'',
      insurer_name:r.insurer_name, member_id:r.member_id,
      group_number:r.group_number||'', health_plan_name:r.health_plan_name||'',
      referring_provider:r.referring_provider||'',
      referring_provider_npi:r.referring_provider_npi||'',
      referring_provider_phone:r.referring_provider_phone||'',
      referral_date:r.referral_date,
      gender:r.gender||'', icd10:r.icd10||'', diagnosis:r.diagnosis||'',
      parent_name:r.parent_name||'', parent_relationship:r.parent_relationship||'',
      parent_email:r.parent_email||'', preferred_language:r.preferred_language||'English',
      source:'imported',
      pipeline_entry: addToPipeline,
      stage:           addToPipeline ? 'intake' : null,
      stage_entered_at:addToPipeline
        ? (r.referral_date ? new Date(r.referral_date).toISOString() : now)
        : null,
    })));
  };

  const readyCount = validated.filter(r => r._valid).length;
  const warnCount  = validated.filter(r => r._valid && r._warnings?.length > 0).length;
  const dupCount   = validated.filter(r => r._isDup).length;
  const errorCount = validated.filter(r => !r._valid && !r._isDup).length;

  // Sort: errors first → new/ready → warnings → already-in-system last
  // Preserves original _idx so row numbers stay meaningful
  const sortedRows = [...validated].sort((a, b) => {
    const rank = r => !r._valid && !r._isDup ? 0 : r._valid && !r._warnings?.length ? 1 : r._warnings?.length ? 2 : 3;
    return rank(a) - rank(b);
  });
  const allMapped  = IMPORT_REQUIRED.every(f => mapping[f.key]);

  const STEPS = [['drop','1. Upload'],['map','2. Map Columns'],['preview','3. Preview & Validate']];

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background:'rgba(15,23,42,0.45)' }} data-testid="import-panel">
      <div className="flex-1" onClick={onClose}/>
      <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>Import Clients</h2>
            <p className="text-xs text-slate-500 mt-0.5">Batch-add clients to Intake from CSV or Excel</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition-colors"><Ico.X/></button>
        </div>
        {/* Step bar */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-stone-100 flex-shrink-0" style={{ background:'#FAFAF8' }}>
          {STEPS.map(([s, label], i) => (
            <React.Fragment key={s}>
              <span className={`text-xs font-medium ${step===s ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>{label}</span>
              {i < STEPS.length-1 && <span className="text-slate-200 mx-1">›</span>}
            </React.Fragment>
          ))}
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 1: Dropzone */}
          {step === 'drop' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f) parseFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${dragOver ? 'border-teal-400 bg-teal-50' : 'border-stone-300 hover:border-teal-300 hover:bg-teal-50/20'}`}
              data-testid="import-dropzone">
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f=e.target.files[0]; if(f) parseFile(f); }}/>
              <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
              </div>
              {loading
                ? <p className="text-sm text-slate-500 animate-pulse">Parsing file…</p>
                : <>
                    <p className="text-sm font-semibold text-slate-700">Drop your file here, or <span className="text-teal-600 underline">browse</span></p>
                    <p className="text-xs text-slate-400 mt-1.5">Supports .csv and .xlsx files</p>
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
                      onClick={e => {
                        e.stopPropagation();
                        loadCdnScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(() => {
                          const sampleRows = [
                            {
                              'Client name':'John Smith',
                              'Date of birth':'2018-04-22',
                              'Insurer name':'Aetna',
                              'Member ID':'AET-123456',
                              'Referral date':'2026-05-01',
                              'Phone':'(305) 555-0101',
                              'Address':'123 Main St, Miami, FL 33101',
                              'Group number':'G-11100',
                              'Health plan name':'Aetna Better Health of Florida',
                              'Referring provider':'Dr. Jane Doe',
                              'Referring provider NPI':'1234567890',
                              'Referring provider phone':'(305) 555-9000',
                              'Gender':'Male',
                              'ICD-10 code':'F84.0',
                              'Diagnosis':'ASD Level 2',
                              'Parent / guardian name':'Robert Smith',
                              'Relationship':'Father',
                              'Parent email':'r.smith@email.com',
                              'Preferred language':'English',
                            },
                            {
                              'Client name':'Maria Lopez',
                              'Date of birth':'2019-09-10',
                              'Insurer name':'Florida Blue',
                              'Member ID':'FLB-654321',
                              'Referral date':'2026-05-03',
                              'Phone':'(786) 555-0202',
                              'Address':'456 Oak Ave, Hialeah, FL 33010',
                              'Group number':'G-22200',
                              'Health plan name':'Florida Blue HMO',
                              'Referring provider':'Dr. Carlos Ruiz',
                              'Referring provider NPI':'0987654321',
                              'Referring provider phone':'(786) 555-8000',
                              'Gender':'Female',
                              'ICD-10 code':'F84.1',
                              'Diagnosis':'ASD Level 3',
                              'Parent / guardian name':'Ana Lopez',
                              'Relationship':'Mother',
                              'Parent email':'ana.lopez@email.com',
                              'Preferred language':'Spanish',
                            },
                            {
                              'Client name':'Ethan Brown',
                              'Date of birth':'2017-12-05',
                              'Insurer name':'UnitedHealth',
                              'Member ID':'UHC-789012',
                              'Referral date':'2026-05-07',
                              'Phone':'(954) 555-0303',
                              'Address':'789 Pine Rd, Doral, FL 33178',
                              'Group number':'G-33300',
                              'Health plan name':'',
                              'Referring provider':'Dr. Amy Chen',
                              'Referring provider NPI':'',
                              'Referring provider phone':'',
                              'Gender':'Male',
                              'ICD-10 code':'F84.0',
                              'Diagnosis':'ASD Level 1',
                              'Parent / guardian name':'Lisa Brown',
                              'Relationship':'Mother',
                              'Parent email':'',
                              'Preferred language':'English',
                            },
                          ];
                          const ws = window.XLSX.utils.json_to_sheet(sampleRows);
                          ws['!cols'] = [20,16,18,16,14,14,32,13,28,22,20,22,10,12,18,24,14,24,18].map(w => ({ wch:w }));
                          const wb = window.XLSX.utils.book_new();
                          window.XLSX.utils.book_append_sheet(wb, ws, 'Clients');
                          window.XLSX.writeFile(wb, 'ABAShield_Client_Import_Template.xlsx');
                        });
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 border border-teal-200 bg-white rounded-lg hover:bg-teal-50 transition-colors"
                      data-testid="download-template-btn">
                      <span className="flex items-center" style={{ lineHeight:0 }}><Ico.Download/></span>
                      <span>Download example file</span>
                    </button>
                  </>
              }
            </div>
          )}

          {/* STEP 2: Column mapping */}
          {step === 'map' && (
            <div data-testid="import-mapping">
              <p className="text-sm text-slate-600 mb-4">
                Match your file's columns to the required fields.{' '}
                <span className="font-semibold text-slate-800">{rawRows.length} rows detected.</span>
              </p>
              {/* Required columns not yet mapped */}
              {IMPORT_REQUIRED.filter(f => !mapping[f.key]).length > 0 && (
                <div className="mb-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl border"
                  style={{ background:'rgba(239,68,68,0.05)', borderColor:'rgba(239,68,68,0.2)' }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1">
                      {IMPORT_REQUIRED.filter(f => !mapping[f.key]).length} required column{IMPORT_REQUIRED.filter(f => !mapping[f.key]).length !== 1 ? 's' : ''} not mapped
                    </p>
                    <p className="text-xs text-red-600">
                      {IMPORT_REQUIRED.filter(f => !mapping[f.key]).map(f => f.label).join(' · ')}
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2.5">
                {IMPORT_ALL.map(f => {
                  const req = IMPORT_REQUIRED.find(r => r.key === f.key);
                  return (
                    <div key={f.key} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-44 flex-shrink-0 ${req ? 'text-slate-800' : 'text-slate-500'}`}>
                        {f.label}{req && <span className="text-red-500 ml-0.5">*</span>}
                      </span>
                      <select value={mapping[f.key]||''} onChange={e => setMapping(m=>({...m,[f.key]:e.target.value||undefined}))}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-stone-200 rounded-lg outline-none focus:border-teal-400 bg-white text-slate-700">
                        <option value="">— not mapped —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      {mapping[f.key]
                        ? <span className="text-teal-600 flex-shrink-0"><Ico.Check/></span>
                        : req
                          ? <span className="text-[10px] text-red-500 font-semibold w-14 flex-shrink-0">Required</span>
                          : <span className="w-14 flex-shrink-0"/>
                      }
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep('drop')} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">← Back</button>
                <button onClick={buildPreview} disabled={!allMapped}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  style={{ background:'#0D9488' }}>
                  Preview →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Validate */}
          {step === 'preview' && (
            <div data-testid="import-preview">
              {/* Destination selector */}
              {readyCount > 0 && (
                <div className="mb-5 rounded-2xl border border-stone-200 overflow-hidden">
                  <p className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Where should new clients be added?
                  </p>
                  <div className="flex divide-x divide-stone-200 border-t border-stone-200">
                    <button
                      onClick={() => setAddToPipeline(false)}
                      className={`flex-1 flex items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                        !addToPipeline ? 'bg-teal-50' : 'bg-white hover:bg-stone-50'
                      }`}>
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        !addToPipeline ? 'border-teal-500 bg-teal-500' : 'border-stone-300'
                      }`}>
                        {!addToPipeline && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${!addToPipeline ? 'text-teal-700' : 'text-slate-700'}`}>
                          Client directory only
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          Clients are saved to the system but not added to the intake pipeline
                        </p>
                      </div>
                    </button>
                    {FLAGS.PIPELINE && (
                      <button
                        onClick={() => setAddToPipeline(true)}
                        className={`flex-1 flex items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                          addToPipeline ? 'bg-teal-50' : 'bg-white hover:bg-stone-50'
                        }`}>
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          addToPipeline ? 'border-teal-500 bg-teal-500' : 'border-stone-300'
                        }`}>
                          {addToPipeline && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${addToPipeline ? 'text-teal-700' : 'text-slate-700'}`}>
                            Add to intake pipeline
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            Clients are saved and immediately appear in the Intake stage of the pipeline
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* No new clients to import */}
              {readyCount === 0 && errorCount === 0 && dupCount > 0 && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 border"
                  style={{ background:'rgba(20,184,166,0.05)', borderColor:'rgba(20,184,166,0.2)' }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-teal-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-teal-700">All clients already exist</p>
                    <p className="text-xs text-teal-600 mt-0.5">Every row in this file is already in the system. Nothing new to import.</p>
                  </div>
                </div>
              )}
              {/* Hard data errors block import */}
              {readyCount === 0 && errorCount > 0 && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 border"
                  style={{ background:'rgba(239,68,68,0.06)', borderColor:'rgba(239,68,68,0.25)' }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700">No new clients to import</p>
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
                readyCount === 0 && errorCount > 0 ? 'bg-red-50 border-red-200' :
                errorCount > 0 || warnCount > 0    ? 'bg-amber-50 border-amber-200' :
                                                      'bg-teal-50 border-teal-200'
              }`}>
                <span className="text-sm font-semibold text-slate-800" data-testid="import-summary">
                  {readyCount > 0 && <span className="text-teal-700">{readyCount} new client{readyCount !== 1 ? 's' : ''} ready</span>}
                  {readyCount > 0 && dupCount > 0 && <span className="text-slate-400"> · </span>}
                  {dupCount > 0 && <span className="text-slate-500">{dupCount} already in system</span>}
                  {(readyCount > 0 || dupCount > 0) && warnCount > 0 && <span className="text-slate-400"> · </span>}
                  {warnCount > 0 && <span className="text-amber-600">{warnCount} possible duplicate{warnCount !== 1 ? 's' : ''}</span>}
                  {(readyCount > 0 || dupCount > 0 || warnCount > 0) && errorCount > 0 && <span className="text-slate-400"> · </span>}
                  {errorCount > 0 && <span className="text-red-600">{errorCount} data error{errorCount !== 1 ? 's' : ''} — will be skipped</span>}
                </span>
                <span className="flex-1"/>
                <button onClick={() => setStep('map')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">← Edit mapping</button>
              </div>
              <div className="rounded-xl border border-stone-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-xs border-collapse" style={{ minWidth:'600px' }}>
                  <thead>
                    <tr style={{ background:'#FAFAF8', borderBottom:'1px solid #E7E5E0' }}>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                      {IMPORT_REQUIRED.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{f.label}</th>
                      ))}
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.slice(0,50).map(row => (
                      <tr key={row._idx} style={{
                        borderBottom:'1px solid #F5F4F0',
                        background: row._isDup ? '#F8FAFC' : !row._valid ? '#FFF5F5' : row._warnings?.length ? '#FFFBEB' : ''
                      }}>
                        <td className="px-3 py-2 text-slate-400">{row._idx+1}</td>
                        {IMPORT_REQUIRED.map(f => (
                          <td key={f.key} className={`px-3 py-2 max-w-[130px] truncate ${
                            row._isDup ? 'text-slate-400' : !row[f.key] ? 'text-red-500' : 'text-slate-700'
                          }`}>
                            {row[f.key] || <em className="not-italic text-red-400">—</em>}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {row._isDup
                            ? <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded text-slate-500 bg-slate-100 border border-slate-200">Already in system</span>
                            : row._valid && !row._warnings?.length
                              ? <span className="text-teal-600 font-semibold">✓ New</span>
                              : <div className="flex flex-col gap-0.5">
                                  {row._errors.map((e,i) => (
                                    <span key={`e${i}`} className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded text-red-700 bg-red-50 border border-red-200">{e}</span>
                                  ))}
                                  {row._warnings?.map((w,i) => (
                                    <span key={`w${i}`} className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded text-amber-700 bg-amber-50 border border-amber-200">{w}</span>
                                  ))}
                                  {row._valid && row._warnings?.length > 0 && (
                                    <span className="text-[10px] text-amber-600 mt-0.5">Will be imported</span>
                                  )}
                                </div>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validated.length > 50 && (
                  <p className="px-4 py-2 text-xs text-slate-400 border-t border-stone-100">
                    Showing first 50 of {validated.length} rows · new clients appear first
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer (preview step only) */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-200 flex-shrink-0" style={{ background:'#FAFAF8' }}>
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
            <button onClick={doImport} disabled={readyCount === 0} data-testid="import-submit"
              className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{ background:'#0D9488' }}>
              {FLAGS.PIPELINE && addToPipeline
                ? `Import ${readyCount} client${readyCount !== 1 ? 's' : ''} to pipeline`
                : `Import ${readyCount} client${readyCount !== 1 ? 's' : ''} to directory`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
