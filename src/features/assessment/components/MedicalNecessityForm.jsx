import React from 'react';
import { patchSection } from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SETTINGS = ['Center-based', 'Home-based', 'School-based', 'Community-based', 'Telehealth'];

const ABA_SETTINGS = ['Center-based', 'Home-based', 'School-based', 'Hybrid'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SL = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

function InlineNum({ value, onChange, placeholder, width = '3.5rem' }) {
  return (
    <input
      type="number" value={value ?? ''} min={0} max={9999}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="inline-block text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-1"
      style={{ width, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}
    />
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 mb-1">{label}</p>
      {children}
    </div>
  );
}

function DemoInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="demo-input" style={{ fontFamily: 'DM Sans, sans-serif' }}
    />
  );
}

function AddBtn({ onClick, label }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 transition-all">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
      </svg>
      {label}
    </button>
  );
}

function RemoveBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
      title="Remove">×</button>
  );
}

// ─── MedicalNecessityForm ─────────────────────────────────────────────────────

export default function MedicalNecessityForm({ clientId, session, setClients }) {
  const sec = session?.sections?.['medical_necessity'] ?? {};

  const patch = (fields) =>
    patchSection(setClients, clientId, 'medical_necessity', fields);

  // ── Co-occurring diagnoses ──
  const diagnoses = sec.coOccurringDiagnoses ?? [];

  const addDx = () => patch({
    coOccurringDiagnoses: [
      ...diagnoses,
      { id: `dx_${Date.now()}`, diagnosis: '', icd10: '', provider: '', date: '' },
    ],
  });

  const updateDx = (id, field, val) => patch({
    coOccurringDiagnoses: diagnoses.map(d => d.id === id ? { ...d, [field]: val } : d),
  });

  const removeDx = (id) => patch({
    coOccurringDiagnoses: diagnoses.filter(d => d.id !== id),
  });

  // ── Medications ──
  const medications = sec.medications ?? [];

  const addMed = () => patch({
    medications: [
      ...medications,
      { id: `med_${Date.now()}`, name: '', dose: '', frequency: '', prescriber: '', purpose: '' },
    ],
  });

  const updateMed = (id, field, val) => patch({
    medications: medications.map(m => m.id === id ? { ...m, [field]: val } : m),
  });

  const removeMed = (id) => patch({
    medications: medications.filter(m => m.id !== id),
  });

  // ── Prior ABA history ──
  const priorABA = sec.priorABAHistory ?? [];

  const addABA = () => patch({
    priorABAHistory: [
      ...priorABA,
      { id: `aba_${Date.now()}`, provider: '', startDate: '', endDate: '', hoursPerWeek: '', setting: '', reasonDiscontinued: '' },
    ],
  });

  const updateABA = (id, field, val) => patch({
    priorABAHistory: priorABA.map(a => a.id === id ? { ...a, [field]: val } : a),
  });

  const removeABA = (id) => patch({
    priorABAHistory: priorABA.filter(a => a.id !== id),
  });

  return (
    <div className="space-y-6 pt-1 pb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Co-occurring Diagnoses ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SL>Co-occurring Diagnoses</SL>
          <AddBtn onClick={addDx} label="Add diagnosis"/>
        </div>

        {diagnoses.length === 0 ? (
          <button onClick={addDx}
            className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-stone-200 rounded-xl text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/40 transition-all text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add co-occurring diagnosis
          </button>
        ) : (
          <div className="space-y-3">
            {diagnoses.map(dx => (
              <div key={dx.id} className="border border-stone-200 rounded-xl p-3.5 bg-white space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Field label="Diagnosis">
                      <DemoInput value={dx.diagnosis} onChange={v => updateDx(dx.id, 'diagnosis', v)}
                        placeholder="e.g. ADHD Combined, Generalized Anxiety Disorder"/>
                    </Field>
                  </div>
                  <RemoveBtn onClick={() => removeDx(dx.id)}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="ICD-10 Code">
                    <DemoInput value={dx.icd10} onChange={v => updateDx(dx.id, 'icd10', v)} placeholder="e.g. F90.2"/>
                  </Field>
                  <Field label="Diagnosing Provider">
                    <DemoInput value={dx.provider} onChange={v => updateDx(dx.id, 'provider', v)} placeholder="e.g. Dr. Vargas, Psy.D."/>
                  </Field>
                </div>
                <Field label="Date of Diagnosis">
                  <DemoInput value={dx.date} onChange={v => updateDx(dx.id, 'date', v)} placeholder="e.g. Jan 2024"/>
                </Field>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Current Medications ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SL>Current Medications</SL>
          <AddBtn onClick={addMed} label="Add medication"/>
        </div>

        {medications.length === 0 ? (
          <button onClick={addMed}
            className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-stone-200 rounded-xl text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/40 transition-all text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add medication
          </button>
        ) : (
          <div className="space-y-3">
            {medications.map(med => (
              <div key={med.id} className="border border-stone-200 rounded-xl p-3.5 bg-white space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Field label="Medication Name">
                      <DemoInput value={med.name} onChange={v => updateMed(med.id, 'name', v)}
                        placeholder="e.g. Guanfacine ER, Sertraline, Risperidone"/>
                    </Field>
                  </div>
                  <RemoveBtn onClick={() => removeMed(med.id)}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Dose">
                    <DemoInput value={med.dose} onChange={v => updateMed(med.id, 'dose', v)} placeholder="e.g. 1mg"/>
                  </Field>
                  <Field label="Frequency">
                    <DemoInput value={med.frequency} onChange={v => updateMed(med.id, 'frequency', v)} placeholder="e.g. QD, BID, PRN"/>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Prescribing Physician">
                    <DemoInput value={med.prescriber} onChange={v => updateMed(med.id, 'prescriber', v)} placeholder="e.g. Dr. Costa"/>
                  </Field>
                  <Field label="Purpose / Target">
                    <DemoInput value={med.purpose} onChange={v => updateMed(med.id, 'purpose', v)} placeholder="e.g. Attention regulation, anxiety"/>
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Prior ABA History ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SL>Prior ABA History</SL>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!sec.hasPriorABA}
              onChange={e => patch({ hasPriorABA: e.target.checked })}
              className="w-3.5 h-3.5 accent-teal-600"/>
            <span className="text-[12px] text-slate-600 font-medium">Client has prior ABA history</span>
          </label>
        </div>

        {sec.hasPriorABA && (
          <div className="space-y-3">
            {priorABA.map(a => (
              <div key={a.id} className="border border-stone-200 rounded-xl p-3.5 bg-white space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Field label="Provider / Agency">
                      <DemoInput value={a.provider} onChange={v => updateABA(a.id, 'provider', v)}
                        placeholder="e.g. Sunshine Behavioral Health"/>
                    </Field>
                  </div>
                  <RemoveBtn onClick={() => removeABA(a.id)}/>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Start Date">
                    <DemoInput value={a.startDate} onChange={v => updateABA(a.id, 'startDate', v)} placeholder="e.g. Oct 2022"/>
                  </Field>
                  <Field label="End Date">
                    <DemoInput value={a.endDate} onChange={v => updateABA(a.id, 'endDate', v)} placeholder="e.g. Jun 2023"/>
                  </Field>
                  <Field label="Hrs / Week">
                    <DemoInput value={a.hoursPerWeek} onChange={v => updateABA(a.id, 'hoursPerWeek', v)} placeholder="e.g. 15"/>
                  </Field>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Setting</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ABA_SETTINGS.map(s => (
                      <button key={s} type="button" onClick={() => updateABA(a.id, 'setting', s)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                          a.setting === s
                            ? 'text-white border-transparent'
                            : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
                        }`}
                        style={a.setting === s ? { background: '#0D9488' } : {}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Reason Discontinued">
                  <DemoInput value={a.reasonDiscontinued} onChange={v => updateABA(a.id, 'reasonDiscontinued', v)}
                    placeholder="e.g. Family relocation, insurance change, goals met"/>
                </Field>
              </div>
            ))}
            <AddBtn onClick={addABA} label="Add prior ABA provider"/>
          </div>
        )}
      </div>

      {/* ── Recommended Intensity ─────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-3.5 space-y-3"
        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <SL>Recommended Intensity</SL>
        <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
          <span>Recommend</span>
          <InlineNum value={sec.recommendedHoursPerWeek} onChange={v => patch({ recommendedHoursPerWeek: v })}
            placeholder="20" width="3.5rem"/>
          <span>hours per week of ABA services.</span>
        </p>
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Intervention Setting</p>
          <div className="flex flex-wrap gap-1.5">
            {SETTINGS.map(s => (
              <button key={s} type="button"
                onClick={() => patch({ recommendedSetting: sec.recommendedSetting === s ? '' : s })}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                  sec.recommendedSetting === s
                    ? 'text-white border-transparent'
                    : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
                }`}
                style={sec.recommendedSetting === s ? { background: '#0D9488' } : {}}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
