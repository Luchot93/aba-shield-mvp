import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SkillAcquisitionsReviewView from '../assessment/components/SkillAcquisitionsReviewView.jsx';
import MaladaptiveBehaviorsReviewView from '../assessment/components/MaladaptiveBehaviorsReviewView.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROSE_COMPONENTS = {
  p:      ({ children }) => <p className="mb-2.5 text-[13px] text-slate-700 leading-relaxed" style={{ fontFamily:'Georgia, "Times New Roman", serif' }}>{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
  h2:     ({ children }) => <h2 className="text-sm font-bold text-slate-800 mt-4 mb-1.5" style={{ fontFamily:'DM Sans, sans-serif' }}>{children}</h2>,
  h3:     ({ children }) => <h3 className="text-xs font-semibold text-slate-700 mt-3 mb-1" style={{ fontFamily:'DM Sans, sans-serif' }}>{children}</h3>,
  ul:     ({ children }) => <ul className="mb-2.5 pl-4 space-y-0.5">{children}</ul>,
  li:     ({ children }) => <li className="text-[13px] text-slate-700 leading-relaxed" style={{ fontFamily:'Georgia, "Times New Roman", serif' }}>{children}</li>,
};

function approvalBadge(state) {
  const styles = {
    approved: { bg: 'rgba(20,184,166,0.1)', color: '#0D9488', border: 'rgba(20,184,166,0.3)', label: 'Approved' },
    skipped:  { bg: '#F5F5F4', color: '#78716C', border: '#E7E5E4', label: 'Skipped' },
    pending:  { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', label: 'Pending' },
  };
  const s = styles[state] ?? styles.pending;
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// ─── Document status block ────────────────────────────────────────────────────

function DocumentBlock({ documents }) {
  const finalDoc = [...documents].reverse().find(d => d.type === 'final_assessment');
  const draftDoc = [...documents].reverse().find(d => d.type === 'assessment_draft');

  const downloadDoc = (d) => {
    const a = document.createElement('a');
    if (d.dataUrl) {
      a.href = d.dataUrl;
      a.download = d.label;
    } else {
      const blob = new Blob([`Document: ${d.label}`], { type: 'text/plain' });
      a.href = URL.createObjectURL(blob);
      a.download = `${d.label.replace(/\s+/g, '_')}.txt`;
    }
    a.click();
  };

  return (
    <div className="px-4 py-4 border-b border-stone-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Assessment Document</p>

      {finalDoc ? (
        <div className="space-y-2">
          {/* Final */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ background:'rgba(20,184,166,0.05)', borderColor:'rgba(20,184,166,0.25)' }}>
            <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background:'rgba(20,184,166,0.15)', color:'#0D9488', border:'1px solid rgba(20,184,166,0.3)' }}>Final</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{finalDoc.label}</p>
              <p className="text-[10px] text-teal-600">Standardized scores and signatures complete</p>
            </div>
            <button onClick={() => downloadDoc(finalDoc)}
              className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/>
              </svg>
              Download
            </button>
          </div>

          {/* Draft */}
          {draftDoc && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-stone-50">
              <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background:'#FEF3C7', color:'#92400E', border:'1px solid #FDE68A' }}>Draft</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-slate-600 truncate">{draftDoc.label}</p>
                <p className="text-[10px] text-slate-400">Pre-completion — manual scores excluded</p>
              </div>
              <button onClick={() => downloadDoc(draftDoc)}
                className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-500 border border-stone-200 bg-white rounded-lg hover:bg-stone-50 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/>
                </svg>
                Download
              </button>
            </div>
          )}
        </div>
      ) : draftDoc ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50">
            <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background:'#FEF3C7', color:'#92400E', border:'1px solid #FDE68A' }}>Draft</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-700 truncate">{draftDoc.label}</p>
              <p className="text-[10px] text-amber-700">⚠ QABF, BASC-3, Vineland-3 scores and signatures needed</p>
            </div>
            <button onClick={() => downloadDoc(draftDoc)}
              className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-600 border border-stone-200 bg-white rounded-lg hover:bg-stone-50 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/>
              </svg>
              Download
            </button>
          </div>
          <p className="text-[11px] text-slate-500 px-1">
            Complete manual sections in Word, then upload the final report via the checklist.
          </p>
        </div>
      ) : (
        <div className="px-3 py-3 rounded-lg border border-stone-200 bg-stone-50">
          <p className="text-[12px] text-slate-500 text-center">
            No document yet — export from Assessment Review to generate the draft.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Collapsible section card ─────────────────────────────────────────────────

function SectionCard({ title, approvalState, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-stone-50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] font-semibold text-slate-800 truncate">{title}</span>
          {approvalState && approvalBadge(approvalState)}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Graphs strip ─────────────────────────────────────────────────────────────

function GraphsSection({ graphs }) {
  if (graphs === null) {
    return (
      <div className="flex items-center gap-2 py-3">
        <svg className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-[12px] text-slate-400">Generating charts…</span>
      </div>
    );
  }

  const entries = Object.entries(graphs ?? {});
  if (entries.length === 0) {
    return <p className="text-[12px] text-slate-400 italic py-2">No chart data available yet.</p>;
  }

  const labelFor = (key) =>
    key.replace(/^(behavior_|sto_|replacement_|caregiver_)/, '')
       .replace(/_/g, ' ')
       .replace(/\b\w/g, c => c.toUpperCase());

  const typeLabel = (key) => {
    if (key.startsWith('sto_'))          return 'STO Trajectory';
    if (key.startsWith('behavior_'))     return 'Baseline';
    if (key === 'replacement_behaviors') return 'Skill Goals';
    if (key.startsWith('caregiver_'))    return 'Caregiver';
    return '';
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {entries.map(([key, b64]) => (
        <div key={key} className="text-center">
          <img
            src={`data:image/png;base64,${b64}`}
            alt={labelFor(key)}
            className="w-full rounded-lg border border-stone-200 bg-white"
            style={{ height: 110, objectFit: 'contain' }}
          />
          <p className="text-[9px] text-slate-400 mt-1 truncate">{typeLabel(key)} · {labelFor(key)}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Caregiver training summary ───────────────────────────────────────────────

function CaregiverSummary({ section }) {
  if (!section) return <p className="text-[12px] text-slate-400 italic">No caregiver training data.</p>;
  const { caregiverTrainingTargets, trainingFormat, trainingFrequency, trainingBarriers, caregiverStrengths, draftContent } = section;
  const ctTargets = caregiverTrainingTargets ?? [];

  return (
    <div className="space-y-3">
      {ctTargets.length > 0 && (
        <div className="overflow-x-auto rounded-lg" style={{ border:'1px solid #B2D8D3' }}>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {['Goal','Baseline %','STO','LTO'].map(h => (
                  <th key={h} className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest"
                    style={{ background:'#E8F5F3', color:'#2D7D6F', borderRight:'1px solid #B2D8D3', borderBottom:'1px solid #B2D8D3' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctTargets.map(t => {
                const bp  = t.baselinePercent != null ? `${t.baselinePercent}%` : '—';
                const sto = t.sto?.trim() || (t.stoPercent != null ? `${t.stoPercent}%${t.stoWeeks ? ` / ${t.stoWeeks}wk` : ''}` : '—');
                const lto = t.lto?.trim() || (t.ltoPercent != null ? `${t.ltoPercent}%${t.ltoSessions ? ` / ${t.ltoSessions} sessions` : ''}` : '—');
                return (
                  <tr key={t.id} className="bg-white border-b border-stone-100 last:border-0">
                    <td className="px-3 py-1.5 text-[12px] text-slate-700" style={{ borderRight:'1px solid #B2D8D3' }}>{t.goalName || '—'}</td>
                    <td className="px-3 py-1.5 text-[12px] font-medium text-slate-800 tabular-nums" style={{ borderRight:'1px solid #B2D8D3' }}>{bp}</td>
                    <td className="px-3 py-1.5 text-[12px] text-slate-700" style={{ borderRight:'1px solid #B2D8D3' }}>{sto}</td>
                    <td className="px-3 py-1.5 text-[12px] text-slate-700">{lto}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(trainingFormat?.length > 0 || trainingFrequency) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {trainingFormat?.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 font-medium">Format: </span>
              <span className="text-[12px] text-slate-700">{trainingFormat.join(', ')}</span>
            </div>
          )}
          {trainingFrequency && (
            <div>
              <span className="text-[10px] text-slate-500 font-medium">Frequency: </span>
              <span className="text-[12px] text-slate-700">{trainingFrequency}</span>
            </div>
          )}
        </div>
      )}

      {trainingBarriers && (
        <p className="text-[12px] text-slate-700">
          <span className="font-medium text-slate-600">Barriers: </span>{trainingBarriers}
        </p>
      )}

      {caregiverStrengths && (
        <p className="text-[12px] text-slate-700">
          <span className="font-medium text-slate-600">Strengths: </span>{caregiverStrengths}
        </p>
      )}

      {draftContent?.trim() && (
        <div className="pt-2 border-t border-stone-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Training Plan Narrative</p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={PROSE_COMPONENTS}>
            {draftContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// ─── PlanDraftPreview ─────────────────────────────────────────────────────────

export default function PlanDraftPreview({ session, graphs, documents = [] }) {
  if (!session) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[12px] text-slate-400">No assessment session linked yet.</p>
      </div>
    );
  }

  const secs = session.sections ?? {};

  return (
    <div className="flex flex-col" style={{ fontFamily:'DM Sans, sans-serif' }}>

      {/* Document status */}
      <DocumentBlock documents={documents} />

      {/* Medical Necessity */}
      <SectionCard
        title="Medical Necessity"
        approvalState={secs.medical_necessity?.approvalState}
        defaultOpen>
        {secs.medical_necessity?.draftContent?.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={PROSE_COMPONENTS}>
            {secs.medical_necessity.draftContent}
          </ReactMarkdown>
        ) : (
          <p className="text-[12px] text-slate-400 italic">No narrative generated yet.</p>
        )}
      </SectionCard>

      {/* Skill Acquisitions */}
      <SectionCard
        title="Skill Acquisitions"
        approvalState={secs.skill_acquisitions?.approvalState}
        defaultOpen>
        <div className="overflow-x-auto">
          <SkillAcquisitionsReviewView
            session={session}
            draftContent={secs.skill_acquisitions?.draftContent ?? ''}
          />
        </div>
      </SectionCard>

      {/* Maladaptive Behaviors */}
      <SectionCard
        title="Maladaptive Behaviors"
        approvalState={secs.behavior_targets?.approvalState}
        defaultOpen>
        <div className="overflow-x-auto">
          <MaladaptiveBehaviorsReviewView
            session={session}
            draftContent={secs.behavior_targets?.draftContent ?? ''}
          />
        </div>
      </SectionCard>

      {/* Caregiver Training */}
      <SectionCard
        title="Caregiver Training"
        approvalState={secs.caregiver_training?.approvalState}
        defaultOpen={false}>
        <CaregiverSummary section={secs.caregiver_training} />
      </SectionCard>

      {/* Baseline Graphs */}
      <SectionCard title="Baseline Graphs" defaultOpen={false}>
        <GraphsSection graphs={graphs} />
      </SectionCard>

    </div>
  );
}
