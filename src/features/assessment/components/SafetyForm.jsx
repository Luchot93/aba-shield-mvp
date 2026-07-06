import React from 'react';
import { patchSection } from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_LEVELS = [
  { label: 'Low',      color: '#16A34A' },
  { label: 'Moderate', color: '#D97706' },
  { label: 'High',     color: '#DC2626' },
  { label: 'Critical', color: '#7C3AED' },
];

const SIB_TYPES = [
  'Head banging', 'Self-biting', 'Skin picking', 'Eye poking / pressing',
  'Face slapping', 'Hair pulling', 'Scratching own skin', 'Arm biting', 'Other',
];

const AGGRESSION_TYPES = [
  'Open-hand hitting', 'Closed-fist hitting', 'Biting', 'Kicking',
  'Object throwing', 'Scratching / clawing', 'Pinching', 'Spitting', 'Other',
];

const AGGRESSION_TARGETS = [
  'Parent / Caregiver', 'Sibling', 'Peers', 'School staff', 'Community members',
];

const ENV_SAFETY = [
  'Pool / water body secured or no access',
  'Firearms secured or not present',
  'Medications stored out of reach',
  'Door alarms or locks in place',
  'Window guards / locks in place',
  'Sharp objects secured',
  'Padding / protective equipment installed',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SL = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

function ChipGroup({ options, value, onChange, multi = false }) {
  const isActive = (opt) => multi ? (value ?? []).includes(opt) : value === opt;
  const toggle   = (opt) => {
    if (multi) {
      const arr = value ?? [];
      onChange(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
    } else {
      onChange(isActive(opt) ? '' : opt);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const lbl = typeof opt === 'string' ? opt : opt.label;
        return (
          <button key={lbl} type="button" onClick={() => toggle(lbl)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
              isActive(lbl)
                ? 'text-white border-transparent'
                : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
            }`}
            style={isActive(lbl) ? { background: '#0D9488' } : {}}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 accent-teal-600"/>
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

function SubPanel({ children }) {
  return (
    <div className="pl-4 border-l-2 border-teal-100 space-y-3 mt-2">
      {children}
    </div>
  );
}

// ─── SafetyForm ───────────────────────────────────────────────────────────────

export default function SafetyForm({ clientId, session, setClients }) {
  const sec = session?.sections?.['safety'] ?? {};

  const patch = (fields) =>
    patchSection(setClients, clientId, 'safety', fields);

  return (
    <div className="space-y-6 pt-1 pb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Overall Risk Level ────────────────────────────────────────────── */}
      <div>
        <SL>Overall Risk Level</SL>
        <div className="flex gap-2 flex-wrap">
          {RISK_LEVELS.map(({ label, color }) => {
            const active = sec.riskLevel === label;
            return (
              <button key={label} type="button"
                onClick={() => patch({ riskLevel: active ? '' : label })}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-all ${
                  active ? 'text-white' : 'text-slate-500 border-stone-200 bg-white hover:border-slate-300'
                }`}
                style={active ? { background: color, borderColor: color } : {}}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Self-Injurious Behavior ───────────────────────────────────────── */}
      <div>
        <SL>Self-Injurious Behavior (SIB)</SL>
        <Toggle
          checked={sec.sibPresent}
          onChange={v => patch({ sibPresent: v })}
          label="SIB is present"
        />
        {sec.sibPresent && (
          <SubPanel>
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">Topography (select all that apply)</p>
              <ChipGroup options={SIB_TYPES} value={sec.sibTopography ?? []} onChange={v => patch({ sibTopography: v })} multi/>
            </div>
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
              <span>Occurs approximately</span>
              <InlineNum value={sec.sibFrequency} onChange={v => patch({ sibFrequency: v })} placeholder="4" width="3rem"/>
              <span>times per day.</span>
            </p>
            <Toggle
              checked={sec.sibInjuryHistory}
              onChange={v => patch({ sibInjuryHistory: v })}
              label="Injury history (visible marks, medical treatment required)"
            />
            {sec.sibInjuryHistory && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 mb-1">Injury notes</p>
                <textarea
                  value={sec.sibInjuryNotes ?? ''}
                  onChange={e => patch({ sibInjuryNotes: e.target.value })}
                  placeholder="Describe injuries, frequency of medical attention, current protective measures…"
                  rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
              </div>
            )}
          </SubPanel>
        )}
      </div>

      {/* ── Aggression toward Others ──────────────────────────────────────── */}
      <div>
        <SL>Aggression toward Others</SL>
        <Toggle
          checked={sec.aggressionPresent}
          onChange={v => patch({ aggressionPresent: v })}
          label="Aggression toward others is present"
        />
        {sec.aggressionPresent && (
          <SubPanel>
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">Topography</p>
              <ChipGroup options={AGGRESSION_TYPES} value={sec.aggressionTopography ?? []} onChange={v => patch({ aggressionTopography: v })} multi/>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">Primary targets</p>
              <ChipGroup options={AGGRESSION_TARGETS} value={sec.aggressionTargets ?? []} onChange={v => patch({ aggressionTargets: v })} multi/>
            </div>
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
              <span>Occurs approximately</span>
              <InlineNum value={sec.aggressionFrequency} onChange={v => patch({ aggressionFrequency: v })} placeholder="3" width="3rem"/>
              <span>times per day.</span>
            </p>
            <Toggle
              checked={sec.aggressionInjuryHistory}
              onChange={v => patch({ aggressionInjuryHistory: v })}
              label="Injury to others documented (bruising, marks, medical attention)"
            />
            {sec.aggressionInjuryHistory && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 mb-1">Injury notes</p>
                <textarea
                  value={sec.aggressionInjuryNotes ?? ''}
                  onChange={e => patch({ aggressionInjuryNotes: e.target.value })}
                  placeholder="Describe incidents, victims, injury severity…"
                  rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
              </div>
            )}
          </SubPanel>
        )}
      </div>

      {/* ── Elopement ─────────────────────────────────────────────────────── */}
      <div>
        <SL>Elopement / Running Away</SL>
        <Toggle
          checked={sec.elopementPresent}
          onChange={v => patch({ elopementPresent: v })}
          label="Elopement history or current risk"
        />
        {sec.elopementPresent && (
          <SubPanel>
            <textarea
              value={sec.elopementNotes ?? ''}
              onChange={e => patch({ elopementNotes: e.target.value })}
              placeholder="Context, frequency, distance, supervision gaps…"
              rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </SubPanel>
        )}
      </div>

      {/* ── Property Destruction ──────────────────────────────────────────── */}
      <div>
        <SL>Property Destruction</SL>
        <Toggle
          checked={sec.propertyDestructionPresent}
          onChange={v => patch({ propertyDestructionPresent: v })}
          label="Property destruction is present"
        />
        {sec.propertyDestructionPresent && (
          <SubPanel>
            <textarea
              value={sec.propertyDestructionNotes ?? ''}
              onChange={e => patch({ propertyDestructionNotes: e.target.value })}
              placeholder="Describe objects targeted, frequency, severity…"
              rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </SubPanel>
        )}
      </div>

      {/* ── Environmental Safety ──────────────────────────────────────────── */}
      <div>
        <SL>Environmental Safety</SL>
        <div className="space-y-1.5">
          {ENV_SAFETY.map(item => (
            <Toggle
              key={item}
              checked={(sec.envSafety ?? []).includes(item)}
              onChange={checked => {
                const current = sec.envSafety ?? [];
                patch({ envSafety: checked ? [...current, item] : current.filter(x => x !== item) });
              }}
              label={item}
            />
          ))}
        </div>
      </div>

      {/* ── Law Enforcement / Prior Incidents ────────────────────────────── */}
      <div>
        <SL>Prior Incidents</SL>
        <div className="space-y-2">
          <Toggle
            checked={sec.lawEnforcementInvolvement}
            onChange={v => patch({ lawEnforcementInvolvement: v })}
            label="Law enforcement involvement history"
          />
          <Toggle
            checked={sec.hospitalizationHistory}
            onChange={v => patch({ hospitalizationHistory: v })}
            label="Psychiatric hospitalization or crisis stabilization history"
          />
        </div>
        {(sec.lawEnforcementInvolvement || sec.hospitalizationHistory) && (
          <SubPanel>
            <textarea
              value={sec.priorIncidentNotes ?? ''}
              onChange={e => patch({ priorIncidentNotes: e.target.value })}
              placeholder="Describe incidents, dates, outcomes…"
              rows={2} className="demo-input resize-y" style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </SubPanel>
        )}
      </div>

    </div>
  );
}
