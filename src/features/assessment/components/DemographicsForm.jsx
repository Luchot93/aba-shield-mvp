import React, { useEffect, useState } from 'react';
import { useAutoSave } from '../../../hooks/useAutoSave.js';
import { updateClientProfile, updateClientName } from '../assessmentStore.js';

const SETTINGS_OPTIONS = [
  'Home', 'School', 'Clinic', 'Community', 'Telehealth',
];

// Fields that originate from the intake record — used to show yellow "needs manual entry" border
// when the client record didn't have the value at intake time.
const INTAKE_FIELD_KEYS = new Set([
  'dob','phone','address','insurerName','memberId',
  'groupNumber','referringProvider','referralDate','gender','icd10','diagnosis',
]);

// Returns true if this field should display the "missing from intake" indicator
function isMissingFromIntake(profile, profileKey) {
  return (
    INTAKE_FIELD_KEYS.has(profileKey) &&
    (profile._intakeMissingFields ?? []).includes(profileKey) &&
    !profile[profileKey]   // clear indicator once user fills it in
  );
}

const MissingBadge = () => (
  <span
    title="Not captured at intake — please complete"
    className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
    style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>
    <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
    Needs entry
  </span>
);

const Field = ({ label, children, half, missing }) => (
  <div className={half ? '' : 'col-span-2'}>
    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mb-1">
      {label}
      {missing && <MissingBadge />}
    </label>
    {children}
  </div>
);

const inputCls = (missing) =>
  `w-full px-3 py-2 text-[13px] bg-stone-50 rounded-lg outline-none transition-all
   placeholder:text-slate-300 text-slate-700
   ${missing
     ? 'border-2 border-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-100'
     : 'border border-stone-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-100'}`;

const Input = ({ value, onChange, type = 'text', placeholder, missing }) => (
  <input
    type={type}
    value={value ?? ''}
    onChange={onChange}
    placeholder={placeholder}
    className={inputCls(missing)}
    style={{ fontFamily: 'DM Sans, sans-serif' }}
  />
);

const Select = ({ value, onChange, children, missing }) => (
  <select
    value={value ?? ''}
    onChange={onChange}
    className={inputCls(missing)}
    style={{ fontFamily: 'DM Sans, sans-serif' }}>
    {children}
  </select>
);

export default function DemographicsForm({ clientId, client, session, setClients }) {
  const profile = session?.clientProfile ?? {};
  const clientName = session?.clientName ?? client?.name ?? '';

  // Local draft state, debounced before hitting Supabase — mirrors the
  // useAutoSave pattern already used by FreeTextNotes/ProseEditor/InlineEditor.
  // Without this, every keystroke fired its own PATCH request; concurrent
  // requests could complete out of order and silently clobber each other,
  // which is why typed text (e.g. Reason for Referral) could vanish on reload.
  const [draft, setDraft] = useState(profile);
  const [nameDraft, setNameDraft] = useState(clientName);

  // Re-hydrate local drafts only when switching to a different assessment
  // session — never on every keystroke (session.id is stable across edits).
  useEffect(() => {
    setDraft(profile);
    setNameDraft(clientName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useAutoSave(draft, (v) => updateClientProfile(setClients, clientId, v), 800);
  useAutoSave(nameDraft, (v) => updateClientName(setClients, clientId, v), 800);

  const set = (field) => (e) => {
    const { value } = e.target;
    setDraft(d => ({ ...d, [field]: value }));
  };

  const setName = (e) => setNameDraft(e.target.value);

  const toggleSetting = (setting) => {
    setDraft(d => {
      const current = d.interventionSettings ?? [];
      const next = current.includes(setting)
        ? current.filter(s => s !== setting)
        : [...current, setting];
      return { ...d, interventionSettings: next };
    });
  };

  const missing = (key) => isMissingFromIntake(draft, key);

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Autofill notice — only shown when session was seeded from a client record */}
      {(draft._intakeMissingFields?.length > 0) && (
        <div className="mb-4 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border"
          style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color:'#B45309' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div>
            <p className="text-[12px] font-semibold" style={{ color:'#92400E' }}>
              Some fields were not captured at intake
            </p>
            <p className="text-[11px] mt-0.5" style={{ color:'#B45309' }}>
              Fields marked <span className="font-semibold">Needs entry</span> were not in the client record. Please complete them before generating the assessment document.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">

        {/* Client Name */}
        <Field label="Client Full Name">
          <Input value={nameDraft} onChange={setName} placeholder="Full legal name" />
        </Field>

        {/* DOB */}
        <Field label="Date of Birth" half missing={missing('dob')}>
          <Input type="date" value={draft.dob} onChange={set('dob')} missing={missing('dob')} />
        </Field>

        {/* Gender */}
        <Field label="Gender" half missing={missing('gender')}>
          <Input value={draft.gender} onChange={set('gender')} placeholder="e.g. Male / Female / Non-binary" missing={missing('gender')} />
        </Field>

        {/* Diagnosis */}
        <Field label="Primary Diagnosis" missing={missing('diagnosis')}>
          <Input value={draft.diagnosis} onChange={set('diagnosis')} placeholder="e.g. ASD Level 2" missing={missing('diagnosis')} />
        </Field>

        {/* ICD-10 */}
        <Field label="ICD-10 Code" half missing={missing('icd10')}>
          <Input value={draft.icd10} onChange={set('icd10')} placeholder="e.g. F84.0" missing={missing('icd10')} />
        </Field>

        {/* Phone */}
        <Field label="Phone" half missing={missing('phone')}>
          <Input type="tel" value={draft.phone} onChange={set('phone')} placeholder="(555) 000-0000" missing={missing('phone')} />
        </Field>

        {/* Address */}
        <Field label="Address" missing={missing('address')}>
          <Input value={draft.address} onChange={set('address')} placeholder="Street, City, State ZIP" missing={missing('address')} />
        </Field>

        {/* Insurer */}
        <Field label="Insurance Carrier" half missing={missing('insurerName')}>
          <Input value={draft.insurerName} onChange={set('insurerName')} placeholder="e.g. Aetna" missing={missing('insurerName')} />
        </Field>

        {/* Member ID */}
        <Field label="Member ID" half missing={missing('memberId')}>
          <Input value={draft.memberId} onChange={set('memberId')} placeholder="e.g. AET-000000" missing={missing('memberId')} />
        </Field>

        {/* Group Number */}
        <Field label="Group Number" half missing={missing('groupNumber')}>
          <Input value={draft.groupNumber} onChange={set('groupNumber')} placeholder="e.g. G-00000" missing={missing('groupNumber')} />
        </Field>

        {/* Medicaid ID */}
        <Field label="Medicaid ID" half>
          <Input value={draft.medicaidId} onChange={set('medicaidId')} placeholder="If applicable" />
        </Field>

        {/* Referring Provider */}
        <Field label="Referring Provider" missing={missing('referringProvider')}>
          <Input value={draft.referringProvider} onChange={set('referringProvider')} placeholder="Dr. Name / Practice" missing={missing('referringProvider')} />
        </Field>

        {/* Referral Date */}
        <Field label="Referral Date" half missing={missing('referralDate')}>
          <Input type="date" value={draft.referralDate} onChange={set('referralDate')} missing={missing('referralDate')} />
        </Field>

        {/* Assessment Date */}
        <Field label="Assessment Date" half>
          <Input type="date" value={draft.assessmentDate} onChange={set('assessmentDate')} />
        </Field>

        {/* Assessment Type */}
        <Field label="Assessment Type" half>
          <Select value={draft.assessmentType} onChange={set('assessmentType')}>
            <option value="Initial">Initial</option>
            <option value="Re-evaluation">Re-evaluation</option>
            <option value="Reauthorization">Reauthorization</option>
          </Select>
        </Field>

        {/* Preferred Language */}
        <Field label="Preferred Language" half>
          <Input value={draft.preferredLanguage} onChange={set('preferredLanguage')} placeholder="e.g. English" />
        </Field>

        {/* Parent/Guardian Names */}
        <Field label="Parent / Guardian Name(s)">
          <Input value={draft.parentGuardianNames} onChange={set('parentGuardianNames')} placeholder="Full names" />
        </Field>

        {/* Relationship */}
        <Field label="Relationship to Client">
          <Input value={draft.relationship} onChange={set('relationship')} placeholder="e.g. Mother / Father / Guardian" />
        </Field>

        {/* Reason for Referral */}
        <Field label="Reason for Referral">
          <textarea
            value={draft.reasonForReferral ?? ''}
            onChange={set('reasonForReferral')}
            data-testid="assessment-field-reason"
            placeholder="Brief summary of referral reason…"
            rows={3}
            className="w-full px-3 py-2 text-[13px] bg-stone-50 border border-stone-200 rounded-lg outline-none
              focus:border-teal-400 focus:ring-1 focus:ring-teal-100
              placeholder:text-slate-300 text-slate-700 resize-none leading-relaxed"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </Field>

        {/* Intervention Settings */}
        <Field label="Intervention Settings (select all that apply)">
          <div className="flex flex-wrap gap-2 mt-1">
            {SETTINGS_OPTIONS.map(s => {
              const selected = (draft.interventionSettings ?? []).includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleSetting(s)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                    selected
                      ? 'text-white border-teal-600'
                      : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300 hover:text-teal-700'
                  }`}
                  style={selected ? { background: '#0D9488' } : {}}>
                  {s}
                </button>
              );
            })}
          </div>
        </Field>

      </div>
    </div>
  );
}
