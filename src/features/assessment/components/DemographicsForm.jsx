import React from 'react';
import { updateClientProfile, updateClientName } from '../assessmentStore.js';

const SETTINGS_OPTIONS = [
  'Home', 'School', 'Clinic', 'Community', 'Telehealth',
];

const Field = ({ label, children, half }) => (
  <div className={half ? '' : 'col-span-2'}>
    <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, type = 'text', placeholder }) => (
  <input
    type={type}
    value={value ?? ''}
    onChange={onChange}
    placeholder={placeholder}
    className="w-full px-3 py-2 text-[13px] bg-stone-50 border border-stone-200 rounded-lg outline-none
      focus:border-teal-400 focus:ring-1 focus:ring-teal-100
      placeholder:text-slate-300 text-slate-700 transition-all"
    style={{ fontFamily: 'DM Sans, sans-serif' }}
  />
);

const Select = ({ value, onChange, children }) => (
  <select
    value={value ?? ''}
    onChange={onChange}
    className="w-full px-3 py-2 text-[13px] bg-stone-50 border border-stone-200 rounded-lg outline-none
      focus:border-teal-400 focus:ring-1 focus:ring-teal-100 text-slate-700"
    style={{ fontFamily: 'DM Sans, sans-serif' }}>
    {children}
  </select>
);

export default function DemographicsForm({ clientId, client, session, setClients }) {
  const profile = session?.clientProfile ?? {};
  const clientName = session?.clientName ?? client?.name ?? '';

  const set = (field) => (e) =>
    updateClientProfile(setClients, clientId, { [field]: e.target.value });

  const setName = (e) =>
    updateClientName(setClients, clientId, e.target.value);

  const toggleSetting = (setting) => {
    const current = profile.interventionSettings ?? [];
    const next = current.includes(setting)
      ? current.filter(s => s !== setting)
      : [...current, setting];
    updateClientProfile(setClients, clientId, { interventionSettings: next });
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <div className="grid grid-cols-2 gap-3">

        {/* Client Name */}
        <Field label="Client Full Name">
          <Input value={clientName} onChange={setName} placeholder="Full legal name" />
        </Field>

        {/* DOB */}
        <Field label="Date of Birth" half>
          <Input type="date" value={profile.dob} onChange={set('dob')} />
        </Field>

        {/* Gender */}
        <Field label="Gender" half>
          <Input value={profile.gender} onChange={set('gender')} placeholder="e.g. Male / Female / Non-binary" />
        </Field>

        {/* Diagnosis */}
        <Field label="Primary Diagnosis">
          <Input value={profile.diagnosis} onChange={set('diagnosis')} placeholder="e.g. ASD Level 2" />
        </Field>

        {/* ICD-10 */}
        <Field label="ICD-10 Code" half>
          <Input value={profile.icd10} onChange={set('icd10')} placeholder="e.g. F84.0" />
        </Field>

        {/* Phone */}
        <Field label="Phone" half>
          <Input type="tel" value={profile.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
        </Field>

        {/* Address */}
        <Field label="Address">
          <Input value={profile.address} onChange={set('address')} placeholder="Street, City, State ZIP" />
        </Field>

        {/* Insurer */}
        <Field label="Insurance Carrier" half>
          <Input value={profile.insurerName} onChange={set('insurerName')} placeholder="e.g. Aetna" />
        </Field>

        {/* Member ID */}
        <Field label="Member ID" half>
          <Input value={profile.memberId} onChange={set('memberId')} placeholder="e.g. AET-000000" />
        </Field>

        {/* Group Number */}
        <Field label="Group Number" half>
          <Input value={profile.groupNumber} onChange={set('groupNumber')} placeholder="e.g. G-00000" />
        </Field>

        {/* Medicaid ID */}
        <Field label="Medicaid ID" half>
          <Input value={profile.medicaidId} onChange={set('medicaidId')} placeholder="If applicable" />
        </Field>

        {/* Referring Provider */}
        <Field label="Referring Provider">
          <Input value={profile.referringProvider} onChange={set('referringProvider')} placeholder="Dr. Name / Practice" />
        </Field>

        {/* Referral Date */}
        <Field label="Referral Date" half>
          <Input type="date" value={profile.referralDate} onChange={set('referralDate')} />
        </Field>

        {/* Assessment Date */}
        <Field label="Assessment Date" half>
          <Input type="date" value={profile.assessmentDate} onChange={set('assessmentDate')} />
        </Field>

        {/* Assessment Type */}
        <Field label="Assessment Type" half>
          <Select value={profile.assessmentType} onChange={set('assessmentType')}>
            <option value="Initial">Initial</option>
            <option value="Re-evaluation">Re-evaluation</option>
            <option value="Reauthorization">Reauthorization</option>
          </Select>
        </Field>

        {/* Preferred Language */}
        <Field label="Preferred Language" half>
          <Input value={profile.preferredLanguage} onChange={set('preferredLanguage')} placeholder="e.g. English" />
        </Field>

        {/* Parent/Guardian Names */}
        <Field label="Parent / Guardian Name(s)">
          <Input value={profile.parentGuardianNames} onChange={set('parentGuardianNames')} placeholder="Full names" />
        </Field>

        {/* Relationship */}
        <Field label="Relationship to Client">
          <Input value={profile.relationship} onChange={set('relationship')} placeholder="e.g. Mother / Father / Guardian" />
        </Field>

        {/* Reason for Referral */}
        <Field label="Reason for Referral">
          <textarea
            value={profile.reasonForReferral ?? ''}
            onChange={set('reasonForReferral')}
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
              const selected = (profile.interventionSettings ?? []).includes(s);
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
