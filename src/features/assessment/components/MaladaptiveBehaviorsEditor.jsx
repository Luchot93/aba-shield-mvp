import React, { useState } from 'react';
import { updateBehaviorTarget, addBehaviorTarget, removeBehaviorTarget } from '../assessmentStore.js';

// ─── Shared computed helpers (mirror MaladaptiveBehaviorsReviewView) ──────────

function computeBtSTO(bt) {
  const base = parseFloat(bt.baselineFrequency) || 0;
  const unit = bt.frequencyUnit || 'day';
  const name = bt.behaviorName  || 'behavior';
  if (!base) return `Reduce ${name} frequency by 50% within 12 weeks`;
  return `Reduce to ${Math.ceil(base * 0.5)} per ${unit} within 12 weeks`;
}

function computeBtLTO(bt) {
  const target = bt.targetFrequency;
  const unit   = bt.frequencyUnit || 'day';
  const name   = bt.behaviorName  || 'behavior';
  if (!target || target === '0' || target === '') {
    return `Eliminate ${name} (0 per ${unit}) for 3 consecutive months`;
  }
  return `Reduce to ${target} per ${unit}, sustained for 3 consecutive months`;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

const FieldLabel = ({ children }) => (
  <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
    {children}
  </label>
);

const Field = ({ label, children }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    {children}
  </div>
);

const EditInput = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 text-[13px] text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors"
    style={{ fontFamily: 'DM Sans, sans-serif' }}
  />
);

const EditTextarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full px-3 py-2 text-[13px] leading-relaxed text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 resize-y transition-colors"
    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
  />
);

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="text-slate-400 flex-shrink-0 font-medium">{label}:</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

// ─── Chips selector ───────────────────────────────────────────────────────────

const FUNCTIONS = ['Escape', 'Attention', 'Access', 'Automatic'];
const UNITS     = ['day', 'session', 'week'];

function ChipSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? '' : opt)}
            className="px-3 py-1 text-[12px] font-semibold rounded-full border transition-all"
            style={active
              ? { background: 'rgba(20,184,166,0.12)', borderColor: '#14B8A6', color: '#0D7A6E' }
              : { background: '#F8F7F6', borderColor: '#E7E5E4', color: '#64748B' }
            }>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── BehaviorEditorCard ───────────────────────────────────────────────────────

function BehaviorEditorCard({ clientId, target, index, setClients }) {
  const [open, setOpen] = useState(true);

  const set = (field) => (val) =>
    updateBehaviorTarget(setClients, clientId, target.id, { [field]: val });

  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden mb-3">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: '#F59E0B' }}>
            {index + 1}
          </span>
          <span className="flex-1 text-[13px] font-semibold text-slate-700 truncate">
            {target.behaviorName || <span className="font-normal text-slate-400">Untitled behavior</span>}
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        {/* Delete button */}
        <button
          onClick={() => removeBehaviorTarget(setClients, clientId, target.id)}
          title="Remove behavior"
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>

      {open && (
        <div className="px-4 pb-5 pt-2 border-t border-stone-100 space-y-4">

          {/* Behavior name */}
          <Field label="Behavior Name">
            <EditInput
              value={target.behaviorName}
              onChange={set('behaviorName')}
              placeholder="e.g. Physical Aggression, Elopement, Self-Injurious Behavior…"
            />
          </Field>

          {/* Operational definition */}
          <Field label="Operational Definition">
            <EditTextarea
              value={target.operationalDefinition}
              onChange={set('operationalDefinition')}
              placeholder="Observable, measurable description of the behavior…"
              rows={3}
            />
          </Field>

          {/* Antecedents */}
          <Field label="Antecedents">
            <EditTextarea
              value={target.antecedents}
              onChange={set('antecedents')}
              placeholder="Common triggers or setting events that precede this behavior…"
              rows={2}
            />
          </Field>

          {/* Hypothesized function */}
          <Field label="Hypothesized Function">
            <ChipSelect
              options={FUNCTIONS}
              value={target.hypothesizedFunction ?? ''}
              onChange={set('hypothesizedFunction')}
            />
          </Field>

          {/* Baseline + unit */}
          <Field label="Baseline Rate">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={target.baselineFrequency ?? ''}
                onChange={e => set('baselineFrequency')(e.target.value)}
                placeholder="e.g. 5"
                className="w-24 px-3 py-2 text-[13px] text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
              <span className="self-center text-[13px] text-slate-500">per</span>
              <ChipSelect
                options={UNITS}
                value={target.frequencyUnit ?? 'day'}
                onChange={set('frequencyUnit')}
              />
            </div>
          </Field>

          {/* Target frequency */}
          <Field label="Target Rate (for LTO)">
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={0}
                value={target.targetFrequency ?? ''}
                onChange={e => set('targetFrequency')(e.target.value)}
                placeholder="0 = eliminate"
                className="w-32 px-3 py-2 text-[13px] text-slate-800 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-colors"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
              <span className="text-[12px] text-slate-400">per {target.frequencyUnit || 'day'}</span>
            </div>
          </Field>

          {/* Computed STO / LTO preview */}
          <div className="rounded-lg px-3 py-2.5 space-y-1.5"
            style={{ background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.18)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#0D9488" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="text-[11px] font-semibold" style={{ color: '#0D7A6E' }}>
                Computed objectives — shown in Review table &amp; document
              </span>
            </div>
            <InfoRow label="STO" value={computeBtSTO(target)} />
            <InfoRow label="LTO" value={computeBtLTO(target)} />
          </div>

        </div>
      )}
    </div>
  );
}

// ─── MaladaptiveBehaviorsEditor ───────────────────────────────────────────────

export default function MaladaptiveBehaviorsEditor({ session, clientId, setClients, onClose }) {
  const behaviorTargets = session?.sections?.behavior_targets?.behaviorTargets ?? [];

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-100">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {behaviorTargets.length} maladaptive behavior{behaviorTargets.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-slate-400">Changes save automatically</p>
          <button
            onClick={() => addBehaviorTarget(setClients, clientId)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-stone-200 text-slate-500 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add
          </button>
        </div>
      </div>

      {behaviorTargets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
          <p className="text-sm">No maladaptive behaviors documented yet.</p>
          <button
            onClick={() => addBehaviorTarget(setClients, clientId)}
            className="mt-1 px-4 py-2 text-[12px] font-semibold rounded-xl border-2 border-dashed border-stone-200 text-slate-400 hover:border-teal-300 hover:text-teal-600 transition-all">
            + Add first behavior
          </button>
        </div>
      ) : (
        behaviorTargets.map((target, i) => (
          <BehaviorEditorCard
            key={target.id ?? i}
            clientId={clientId}
            target={target}
            index={i}
            setClients={setClients}
          />
        ))
      )}

      {/* Footer */}
      <div className="flex justify-end mt-3 pt-3 border-t border-stone-100">
        <button
          onClick={onClose}
          className="px-5 py-2 text-[13px] font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: '#0D9488' }}>
          Save &amp; Close
        </button>
      </div>
    </div>
  );
}
