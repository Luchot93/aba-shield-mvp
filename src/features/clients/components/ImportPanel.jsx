import React, { useState, useRef } from 'react';
import { Ico } from '../../../components/icons.jsx';
import { loadCdnScript } from '../../../utils/cdn.js';
import { normalizeDate } from '../../../utils/dates.js';
import { mkChecklist } from '../../../constants/checklist.js';

const IMPORT_REQUIRED = [
  { key:'name',             label:'Client name'      },
  { key:'dob',              label:'Date of birth'    },
  { key:'insurer_name',     label:'Insurer name'     },
  { key:'member_id',        label:'Member ID'        },
  { key:'referral_date',    label:'Referral date'    },
];
const IMPORT_OPTIONAL = [
  { key:'phone',              label:'Phone'              },
  { key:'address',            label:'Address'            },
  { key:'group_number',       label:'Group number'       },
  { key:'referring_provider', label:'Referring provider' },
];
const IMPORT_ALL = [...IMPORT_REQUIRED, ...IMPORT_OPTIONAL];

export default function ImportPanel({ onClose, onImport, existingClients }) {
  const [step,      setStep]      = useState('drop');
  const [rawRows,   setRawRows]   = useState([]);
  const [headers,   setHeaders]   = useState([]);
  const [mapping,   setMapping]   = useState({});
  const [validated, setValidated] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const fileRef = useRef(null);

  const parseFile = async file => {
    setLoading(true);
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
        rows = window.XLSX.utils.sheet_to_json(ws, { defval:'', raw:false });
      } else {
        alert('Please upload a .csv or .xlsx file'); setLoading(false); return;
      }
      if (!rows.length) { alert('File appears to be empty.'); setLoading(false); return; }
      const hdrs = Object.keys(rows[0]);
      setHeaders(hdrs);
      setRawRows(rows);
      const autoMap = {};
      IMPORT_ALL.forEach(f => {
        const match = hdrs.find(h => {
          const hn = h.toLowerCase().replace(/[\s_-]/g,'');
          const fk = f.key.toLowerCase().replace(/[\s_-]/g,'');
          const fl = f.label.toLowerCase().replace(/[\s_-]/g,'');
          return hn === fk || hn.includes(fk) || fk.includes(hn) || hn.includes(fl) || fl.includes(hn);
        });
        if (match) autoMap[f.key] = match;
      });
      setMapping(autoMap);
      setStep('map');
    } catch(e) {
      console.error(e);
      alert('Failed to parse file. Please check the format.');
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
      const errs = [];
      IMPORT_REQUIRED.forEach(f => { if (!r[f.key]) errs.push(`Missing: ${f.label}`); });
      if (r.dob && !/^\d{4}-\d{2}-\d{2}$/.test(r.dob))
        errs.push('Invalid date format (DOB)');
      if (r.referral_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.referral_date))
        errs.push('Invalid date format (Referral)');
      const dup = existingClients.some(c => c.name.toLowerCase() === r.name.toLowerCase() && c.dob === r.dob);
      if (dup) errs.push('Duplicate (name + DOB)');
      return { ...r, _idx:i, _errors:errs, _valid:errs.length === 0 };
    });
    setValidated(rows);
    setStep('preview');
  };

  const doImport = () => {
    const valid = validated.filter(r => r._valid);
    onImport(valid.map((r, i) => ({
      id:`imp_${Date.now()}_${i}`,
      name:r.name, dob:r.dob, phone:r.phone||'', address:r.address||'',
      insurer_name:r.insurer_name, member_id:r.member_id,
      group_number:r.group_number||'', referring_provider:r.referring_provider||'',
      referral_date:r.referral_date, stage:'intake', source:'imported',
      pipeline_entry: false,
      denial_reason:null, bcba_id:null, rbt_id:null,
      auth_expiry_date:null, reauth_active:false,
      smart_assessment_session_id:null,
      checklist:mkChecklist(), documents:[], activity_log:[],
    })));
  };

  const readyCount = validated.filter(r => r._valid).length;
  const errorCount = validated.filter(r => !r._valid).length;
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
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        loadCdnScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(() => {
                          const sampleRows = [
                            { 'Client name':'John Smith', 'Date of birth':'2018-04-22', 'Insurer name':'Aetna', 'Member ID':'AET-123456', 'Referral date':'2026-05-01', 'Phone':'(305) 555-0101', 'Address':'123 Main St, Miami, FL 33101', 'Group number':'G-11100', 'Referring provider':'Dr. Jane Doe' },
                            { 'Client name':'Maria Lopez', 'Date of birth':'2019-09-10', 'Insurer name':'Florida Blue', 'Member ID':'FLB-654321', 'Referral date':'2026-05-03', 'Phone':'(786) 555-0202', 'Address':'456 Oak Ave, Hialeah, FL 33010', 'Group number':'G-22200', 'Referring provider':'Dr. Carlos Ruiz' },
                            { 'Client name':'Ethan Brown', 'Date of birth':'2017-12-05', 'Insurer name':'UnitedHealth', 'Member ID':'UHC-789012', 'Referral date':'2026-05-07', 'Phone':'(954) 555-0303', 'Address':'789 Pine Rd, Doral, FL 33178', 'Group number':'G-33300', 'Referring provider':'Dr. Amy Chen' },
                          ];
                          const ws = window.XLSX.utils.json_to_sheet(sampleRows);
                          ws['!cols'] = [22,18,18,16,16,16,36,14,22].map(w => ({ wch:w }));
                          const wb = window.XLSX.utils.book_new();
                          window.XLSX.utils.book_append_sheet(wb, ws, 'Clients');
                          window.XLSX.writeFile(wb, 'ABAShield_Import_Template.xlsx');
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
              <p className="text-sm text-slate-600 mb-5">
                Match your file's columns to the required fields.{' '}
                <span className="font-semibold text-slate-800">{rawRows.length} rows detected.</span>
              </p>
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
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border ${errorCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200'}`}>
                <span className="text-sm font-semibold text-slate-800" data-testid="import-summary">
                  {readyCount} ready · {errorCount} error{errorCount !== 1 ? 's' : ''}
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
                    {validated.slice(0,50).map(row => (
                      <tr key={row._idx} style={{ borderBottom:'1px solid #F5F4F0', background: row._valid ? '' : '#FFF5F5' }}>
                        <td className="px-3 py-2 text-slate-400">{row._idx+1}</td>
                        {IMPORT_REQUIRED.map(f => (
                          <td key={f.key} className={`px-3 py-2 max-w-[130px] truncate ${!row[f.key] ? 'text-red-500' : 'text-slate-700'}`}>
                            {row[f.key] || <em className="not-italic text-red-400">—</em>}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {row._valid
                            ? <span className="text-teal-600 font-semibold">✓ Ready</span>
                            : <div className="flex flex-col gap-0.5">
                                {row._errors.map((e,i) => (
                                  <span key={i} className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${e.startsWith('Duplicate') ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>
                                    {e}
                                  </span>
                                ))}
                              </div>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validated.length > 50 && (
                  <p className="px-4 py-2 text-xs text-slate-400 border-t border-stone-100">
                    Showing first 50 of {validated.length} rows
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
              Import {readyCount} client{readyCount !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
