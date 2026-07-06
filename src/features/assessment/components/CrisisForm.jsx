import React from 'react';
import { patchSection } from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTACT_ROLES = ['Primary', 'Backup', 'Medical', 'School'];

const WARNING_SIGNS = [
  'Increased pacing',
  'Elevated vocal volume',
  'Rising echolalia frequency',
  'Bilateral hand flapping (intensified)',
  'Skin color change (flushing)',
  'Fist clenching',
  'Refusal of eye contact / body turned away',
  'Repetitive "no" or vocal protest',
  'Rocking speed increase',
  'Crying onset',
  'Item clutching / guarding',
  'Self-directed vocalizations',
];

const WHAT_WORKS = [
  'Remove all demands',
  'Offer preferred item / activity',
  'Move to quiet low-stimulation space',
  'Dim lights',
  'Provide movement break',
  'Deep pressure / firm hug',
  'Play preferred music',
  'Offer chew / fidget tool',
  'Single simple statement only',
  'Wait quietly — no talking',
  'Offer tablet / screen access',
  'Offer preferred snack',
];

const WHAT_WORSENS = [
  'Physical blocking or restraint',
  'Multiple verbal prompts in sequence',
  'Raised voice / urgent tone',
  'Extended verbal explanations',
  'Eye contact demand',
  'Sibling / peer proximity during episode',
  'Removing preferred items',
  'Physical redirection without warning',
  'Touching without warning',
  'Crowding personal space',
];

const CONTRAINDICATIONS = [
  'No physical blocking',
  'No physical restraint of any kind',
  'Seizure protocol active — do not restrain',
  'Epi-pen on site — know location',
  'Cardiac condition — avoid intense physical exertion',
  'Fragile X — avoid direct eye contact during escalation',
  'Pica risk — clear environment before crisis',
  'No dietary items as de-escalation tool (allergy)',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SL = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

function ChipGroup({ options, value, onChange, multi = false }) {
  const isActive = (opt) => multi ? (value ?? []).includes(opt) : value === opt;
  const toggle = (opt) => {
    if (multi) {
      const arr = value ?? [];
      onChange(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
    } else {
      onChange(isActive(opt) ? '' : opt);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
            isActive(opt)
              ? 'text-white border-transparent'
              : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
          }`}
          style={isActive(opt) ? { background: '#0D9488' } : {}}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 accent-teal-600" />
      <span className="text-[12px] font-medium text-slate-600">{label}</span>
    </label>
  );
}

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

function InlineText({ value, onChange, placeholder, width = '9rem' }) {
  return (
    <input
      type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="inline-block text-[13px] font-medium text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-1 px-0.5"
      style={{ width, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}
    />
  );
}

function AddBtn({ onClick, label }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 transition-all">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
    <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="demo-input" style={{ fontFamily: 'DM Sans, sans-serif' }} />
  );
}

// ─── CrisisForm ───────────────────────────────────────────────────────────────

export default function CrisisForm({ clientId, session, setClients }) {
  const sec = session?.sections?.['crisis_plan'] ?? {};

  const patch = (fields) =>
    patchSection(setClients, clientId, 'crisis_plan', fields);

  // ── Emergency contacts ──
  const contacts = sec.emergencyContacts ?? [];

  const addContact = () => patch({
    emergencyContacts: [
      ...contacts,
      { id: `ec_${Date.now()}`, name: '', relationship: '', phone: '', role: '' },
    ],
  });

  const updateContact = (id, field, val) => patch({
    emergencyContacts: contacts.map(c => c.id === id ? { ...c, [field]: val } : c),
  });

  const removeContact = (id) => patch({
    emergencyContacts: contacts.filter(c => c.id !== id),
  });

  return (
    <div className="space-y-6 pt-1 pb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Emergency Contacts ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SL>Emergency Contacts</SL>
          <AddBtn onClick={addContact} label="Add contact" />
        </div>

        {contacts.length === 0 ? (
          <button onClick={addContact}
            className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-stone-200 rounded-xl text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/40 transition-all text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add emergency contact
          </button>
        ) : (
          <div className="space-y-3">
            {contacts.map(c => (
              <div key={c.id} className="border border-stone-200 rounded-xl p-3.5 bg-white space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Field label="Full Name">
                      <DemoInput value={c.name} onChange={v => updateContact(c.id, 'name', v)}
                        placeholder="e.g. Linda Thompson" />
                    </Field>
                  </div>
                  <RemoveBtn onClick={() => removeContact(c.id)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Relationship">
                    <DemoInput value={c.relationship} onChange={v => updateContact(c.id, 'relationship', v)}
                      placeholder="e.g. Mother, Pediatrician" />
                  </Field>
                  <Field label="Phone">
                    <DemoInput value={c.phone} onChange={v => updateContact(c.id, 'phone', v)}
                      placeholder="e.g. (305) 555-0100" />
                  </Field>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Role</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTACT_ROLES.map(role => (
                      <button key={role} type="button"
                        onClick={() => updateContact(c.id, 'role', c.role === role ? '' : role)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                          c.role === role
                            ? 'text-white border-transparent'
                            : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
                        }`}
                        style={c.role === role ? { background: '#0D9488' } : {}}>
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Escalation Warning Signs ───────────────────────────────────────── */}
      <div>
        <SL>Escalation Warning Signs</SL>
        <p className="text-[11px] text-slate-400 mb-2">Select all observed for this client</p>
        <ChipGroup
          options={WARNING_SIGNS}
          value={sec.warningSignsSelected ?? []}
          onChange={v => patch({ warningSignsSelected: v })}
          multi
        />
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-slate-400 mb-1">Additional / client-specific warning signs</p>
          <textarea
            value={sec.warningSignsCustom ?? ''}
            onChange={e => patch({ warningSignsCustom: e.target.value })}
            placeholder="Describe any unique early indicators not listed above…"
            rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>
      </div>

      {/* ── De-escalation Strategies ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <SL>De-escalation Strategies</SL>
          <p className="text-[11px] font-semibold text-emerald-600 mb-1.5">✓ What works</p>
          <ChipGroup
            options={WHAT_WORKS}
            value={sec.deEscalationWorks ?? []}
            onChange={v => patch({ deEscalationWorks: v })}
            multi
          />
          <div className="mt-2">
            <input
              type="text"
              value={sec.deEscalationWorksOther ?? ''}
              onChange={e => patch({ deEscalationWorksOther: e.target.value })}
              placeholder="Other — describe additional strategies that work…"
              className="demo-input"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-red-500 mb-1.5">✕ What worsens behavior</p>
          <ChipGroup
            options={WHAT_WORSENS}
            value={sec.deEscalationWorsens ?? []}
            onChange={v => patch({ deEscalationWorsens: v })}
            multi
          />
          <div className="mt-2">
            <input
              type="text"
              value={sec.deEscalationWorsensOther ?? ''}
              onChange={e => patch({ deEscalationWorsensOther: e.target.value })}
              placeholder="Other — describe additional triggers or things to avoid…"
              className="demo-input"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-1">Clinical notes on de-escalation</p>
          <textarea
            value={sec.deEscalationNotes ?? ''}
            onChange={e => patch({ deEscalationNotes: e.target.value })}
            placeholder="Document sequence, timing, nuance — e.g. deep pressure works only if offered by primary caregiver, not dad…"
            rows={5} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>
      </div>

      {/* ── RBT Response Protocol ──────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-3.5 space-y-3"
        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <SL>RBT Response Protocol</SL>

        <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
          <span>Contact supervising BCBA when behavior exceeds</span>
          <InlineNum value={sec.bcbaCallMinutes} onChange={v => patch({ bcbaCallMinutes: v })} placeholder="5" width="3rem" />
          <span>consecutive minutes</span>
        </p>

        <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
          <span>or reaches</span>
          <InlineNum value={sec.bcbaCallIncidents} onChange={v => patch({ bcbaCallIncidents: v })} placeholder="3" width="3rem" />
          <span>incidents within</span>
          <InlineNum value={sec.bcbaCallWindow} onChange={v => patch({ bcbaCallWindow: v })} placeholder="30" width="3rem" />
          <span>minutes.</span>
        </p>

        <div className="space-y-2 pt-1">
          <Toggle
            checked={sec.call911Threshold}
            onChange={v => patch({ call911Threshold: v })}
            label="Call 911 immediately if a specific threshold is met"
          />
          {sec.call911Threshold && (
            <div className="pl-4 border-l-2 border-red-100">
              <p className="text-[10px] font-semibold text-slate-400 mb-1">911 threshold description</p>
              <textarea
                value={sec.call911Notes ?? ''}
                onChange={e => patch({ call911Notes: e.target.value })}
                placeholder="e.g. Any SIB resulting in visible bleeding, loss of consciousness, or injury requiring medical attention. Any aggression resulting in injury to another person."
                rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
          )}
          <Toggle
            checked={sec.sessionSuspendThreshold}
            onChange={v => patch({ sessionSuspendThreshold: v })}
            label="Suspend session and remove RBT from environment if behavior escalates"
          />
          {sec.sessionSuspendThreshold && (
            <div className="pl-4 border-l-2 border-amber-100">
              <textarea
                value={sec.sessionSuspendNotes ?? ''}
                onChange={e => patch({ sessionSuspendNotes: e.target.value })}
                placeholder="Describe specific conditions warranting session suspension…"
                rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Return to Baseline ─────────────────────────────────────────────── */}
      <div>
        <SL>Return to Baseline</SL>
        <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
          <span>Client typically returns to baseline within</span>
          <InlineNum value={sec.baselineReturnMin} onChange={v => patch({ baselineReturnMin: v })} placeholder="20" width="3rem" />
          <span>–</span>
          <InlineNum value={sec.baselineReturnMax} onChange={v => patch({ baselineReturnMax: v })} placeholder="40" width="3rem" />
          <span>minutes after de-escalation.</span>
        </p>
        <div className="mt-3 space-y-2">
          <Toggle
            checked={sec.postCrisisDebrief}
            onChange={v => patch({ postCrisisDebrief: v })}
            label="Post-crisis debrief with caregiver required after each incident"
          />
          <Toggle
            checked={sec.remorsePresentPostCrisis}
            onChange={v => patch({ remorsePresentPostCrisis: v })}
            label="Client shows remorse / seeks affection post-episode (document in notes)"
          />
        </div>
        {sec.remorsePresentPostCrisis && (
          <div className="pl-4 border-l-2 border-teal-100 mt-2">
            <textarea
              value={sec.remorseNotes ?? ''}
              onChange={e => patch({ remorseNotes: e.target.value })}
              placeholder="Describe post-episode behavior pattern…"
              rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
        )}
      </div>

      {/* ── Medical Considerations ─────────────────────────────────────────── */}
      <div>
        <SL>Medical Considerations &amp; Contraindications</SL>
        <ChipGroup
          options={CONTRAINDICATIONS}
          value={sec.medicalContraindications ?? []}
          onChange={v => patch({ medicalContraindications: v })}
          multi
        />
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-slate-400 mb-1">Additional medical notes</p>
          <textarea
            value={sec.medicalNotes ?? ''}
            onChange={e => patch({ medicalNotes: e.target.value })}
            placeholder="Medications that may affect behavior, known allergies, physician instructions for crisis scenarios…"
            rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>
      </div>

      {/* ── Acknowledgment ─────────────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-3 space-y-2"
        style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.2)' }}>
        <SL>Plan Acknowledgment</SL>
        <div className="space-y-2">
          <Toggle
            checked={sec.caregiverSignedCrisisPlan}
            onChange={v => patch({ caregiverSignedCrisisPlan: v })}
            label="Caregiver has reviewed and signed crisis plan acknowledgment"
          />
          <Toggle
            checked={sec.rbtTrainedOnPlan}
            onChange={v => patch({ rbtTrainedOnPlan: v })}
            label="RBT trained on this crisis plan prior to service start"
          />
          <Toggle
            checked={sec.crisisPlanInBsp}
            onChange={v => patch({ crisisPlanInBsp: v })}
            label="Crisis plan to be included verbatim in the Behavior Support Plan"
          />
        </div>
      </div>

    </div>
  );
}
