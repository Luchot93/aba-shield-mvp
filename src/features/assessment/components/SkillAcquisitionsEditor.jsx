import React, { useState } from 'react';
import { updateSkillGoal } from '../assessmentStore.js';

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

// ─── Computed read-only preview ───────────────────────────────────────────────

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="text-slate-400 flex-shrink-0 font-medium">{label}:</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

// ─── GoalEditorCard ───────────────────────────────────────────────────────────

function GoalEditorCard({ clientId, goal, index, setClients }) {
  const [open, setOpen] = useState(true);

  const set = (field) => (val) =>
    updateSkillGoal(setClients, clientId, goal.id, { [field]: val });

  const strategies = Array.isArray(goal.teachingStrategies)
    ? goal.teachingStrategies.join(', ')
    : (goal.teachingStrategies || '');

  // Computed interview values for preview
  const baselinePreview = goal.baselinePercent != null && goal.baselinePercent !== ''
    ? `${goal.baselinePercent}% across ${goal.baselineOpportunities || '?'} opportunities`
    : null;

  const masteryPreview = goal.masteryCriteriaPercent
    ? `${goal.masteryCriteriaPercent}% accuracy across ${goal.masteryCriteriaSessions || '3'} consecutive sessions`
    : null;

  const promptPreview = goal.masteryCriteriaPromptingLevel || goal.masteryCriteriaPrompting || null;

  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden mb-3">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: '#14B8A6' }}>
          {index + 1}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-slate-700 truncate">
          {goal.targetSkill || <span className="font-normal text-slate-400">Untitled goal</span>}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </div>

      {open && (
        <div className="px-4 pb-5 pt-2 border-t border-stone-100 space-y-4">

          {/* Operational Definition */}
          <Field label="Operational Definition">
            <EditTextarea
              value={goal.operationalDefinition}
              onChange={set('operationalDefinition')}
              placeholder="Observable, measurable description of the target behavior…"
              rows={3}
            />
          </Field>

          {/* Teaching Strategies */}
          <Field label="Teaching Strategies">
            <EditInput
              value={strategies}
              onChange={(val) => updateSkillGoal(setClients, clientId, goal.id, { teachingStrategies: val.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="e.g. DTT, Natural Environment Teaching, Task Analysis…"
            />
          </Field>

          {/* Short-Term Objective */}
          <Field label="6-Month Target (STO)">
            <EditTextarea
              value={goal.sto}
              onChange={set('sto')}
              placeholder={`Client will demonstrate ${goal.targetSkill || 'the target skill'} with improving accuracy across consecutive sessions with decreasing prompt support.`}
              rows={2}
            />
          </Field>

          {/* Current Level */}
          <Field label="Current Level">
            <EditInput
              value={goal.currentLevel}
              onChange={set('currentLevel')}
              placeholder={
                goal.baselinePercent != null && goal.baselinePercent !== ''
                  ? `${goal.baselinePercent}% correct with ${goal.baselinePromptingLevel || 'prompting'}`
                  : 'Describe current performance level…'
              }
            />
          </Field>

          {/* Baseline & Mastery — read-only from interview */}
          <div className="rounded-lg px-3 py-2.5 space-y-1.5"
            style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#3B82F6" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="text-[11px] font-semibold" style={{ color: '#1D4ED8' }}>
                Baseline &amp; mastery criteria — from interview
              </span>
            </div>
            <InfoRow label="Baseline"  value={baselinePreview} />
            <InfoRow label="Mastery"   value={masteryPreview} />
            <InfoRow label="At mastery" value={promptPreview} />
            {!baselinePreview && !masteryPreview && (
              <p className="text-[11px] text-slate-400">No data captured in interview yet.</p>
            )}
          </div>

          {/* Generalization */}
          <Field label="Generalization &amp; Maintenance">
            <EditTextarea
              value={goal.generalizationNotes}
              onChange={set('generalizationNotes')}
              placeholder="Describe planned generalization across people, settings, and materials…"
              rows={2}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ─── SkillAcquisitionsEditor ──────────────────────────────────────────────────

export default function SkillAcquisitionsEditor({ session, clientId, setClients, onClose }) {
  const skillGoals = session?.sections?.skill_acquisitions?.skillGoals ?? [];

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-100">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {skillGoals.length} skill goal{skillGoals.length !== 1 ? 's' : ''}
        </p>
        <p className="text-[10px] text-slate-400">Changes save automatically</p>
      </div>

      {skillGoals.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          No skill goals found. Add goals in the Interview tab first.
        </p>
      ) : (
        skillGoals.map((goal, i) => (
          <GoalEditorCard
            key={goal.id ?? i}
            clientId={clientId}
            goal={goal}
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
