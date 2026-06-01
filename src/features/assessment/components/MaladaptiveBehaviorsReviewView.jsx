import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Computed STO / LTO helpers ───────────────────────────────────────────────

function computeBtBaseline(bt) {
  if (!bt.baselineFrequency) return '—';
  return `${bt.baselineFrequency} per ${bt.frequencyUnit || 'day'}`;
}

function computeBtSTO(bt) {
  const base = parseFloat(bt.baselineFrequency) || 0;
  const unit = bt.frequencyUnit || 'day';
  if (!base) return `Reduce ${bt.behaviorName || 'behavior'} frequency by 50% within 12 weeks`;
  const half = Math.ceil(base * 0.5);
  return `Reduce to ${half} per ${unit} within 12 weeks`;
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

// ─── Table primitives (matching teal palette) ─────────────────────────────────

const TH = ({ children }) => (
  <th
    className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
    style={{
      background: '#E8F5F3',
      color: '#2D7D6F',
      borderBottom: '1px solid #B2D8D3',
      borderRight:  '1px solid #B2D8D3',
    }}>
    {children}
  </th>
);

const TD = ({ children }) => (
  <td
    className="px-3 py-2.5 text-[13px] text-slate-700 align-top last:border-r-0"
    style={{
      fontFamily:  'Georgia, "Times New Roman", serif',
      lineHeight:  1.65,
      borderRight: '1px solid #B2D8D3',
    }}>
    {children}
  </td>
);

// ─── Markdown view components (teal tables) ───────────────────────────────────
// Re-used for the Functional Hypothesis narrative block below the table.

const MD_COMPONENTS = {
  p: ({ children }) => (
    <p className="mb-3 text-[14px] leading-relaxed text-slate-700"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => <strong className="font-bold text-slate-800">{children}</strong>,
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-slate-800 mt-5 mb-2"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-1.5"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </h3>
  ),
  ul: ({ children }) => <ul className="mb-3 pl-4 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 pl-4 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => (
    <li className="text-[13px] text-slate-700 leading-relaxed"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {children}
    </li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-[12px] border-collapse"
        style={{ border: '1px solid #B2D8D3' }}>
        {children}
      </table>
    </div>
  ),
  thead:  ({ children }) => <thead style={{ background: '#E8F5F3' }}>{children}</thead>,
  tbody:  ({ children }) => <tbody>{children}</tbody>,
  tr:     ({ children }) => (
    <tr className="md-table-row" style={{ borderBottom: '1px solid #B2D8D3' }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold"
      style={{ color: '#2D7D6F', borderRight: '1px solid #B2D8D3', wordBreak: 'break-word' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-slate-700 align-top"
      style={{ borderRight: '1px solid #B2D8D3', wordBreak: 'break-word' }}>
      {children}
    </td>
  ),
};

// ─── BehaviorBlock ────────────────────────────────────────────────────────────

function BehaviorBlock({ bt, index }) {
  return (
    <div className="mb-8">
      {/* Behavior name heading */}
      <h3 className="text-[15px] font-bold text-slate-800 mb-2"
        style={{ fontFamily: 'DM Sans, sans-serif' }}>
        Behavior {index + 1}: {bt.behaviorName || 'Untitled Behavior'}
      </h3>

      {/* Operational definition */}
      {bt.operationalDefinition && (
        <p className="text-[14px] text-slate-700 mb-2 leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <strong style={{ fontFamily: 'DM Sans, sans-serif' }}>Operational Definition:</strong>{' '}
          {bt.operationalDefinition}
        </p>
      )}

      {/* Antecedents */}
      {bt.antecedents && (
        <p className="text-[14px] text-slate-700 mb-3 leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <strong style={{ fontFamily: 'DM Sans, sans-serif' }}>Antecedents:</strong>{' '}
          {bt.antecedents}
        </p>
      )}

      {/* 5-column data table */}
      <div className="overflow-x-auto mb-3 rounded-lg" style={{ border: '1px solid #B2D8D3' }}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <TH>Target Behavior</TH>
              <TH>Hypothesized Function</TH>
              <TH>Baseline Rate</TH>
              <TH>Short-Term Objective (STO)</TH>
              <TH>Long-Term Objective (LTO)</TH>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <TD>{bt.behaviorName || '—'}</TD>
              <TD>{bt.hypothesizedFunction || '—'}</TD>
              <TD>{computeBtBaseline(bt)}</TD>
              <TD>{computeBtSTO(bt)}</TD>
              <TD>{computeBtLTO(bt)}</TD>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MaladaptiveBehaviorsReviewView ──────────────────────────────────────────

export default function MaladaptiveBehaviorsReviewView({ session, draftContent }) {
  const behaviorTargets = session?.sections?.behavior_targets?.behaviorTargets ?? [];

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* One block per behavior target */}
      {behaviorTargets.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">
          No maladaptive behaviors documented. Add behaviors in the Interview tab.
        </p>
      ) : (
        behaviorTargets.map((bt, i) => (
          <BehaviorBlock key={bt.id ?? i} bt={bt} index={i} />
        ))
      )}

      {/* Functional Hypothesis narrative — from behavior_targets.draftContent */}
      {/* This maps to §16 Hypothesis-Based Interventions in the Word doc        */}
      {draftContent?.trim() && (
        <div className="mt-4 pt-5 border-t" style={{ borderColor: '#E7E5E4' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Functional Hypothesis
          </p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {draftContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
