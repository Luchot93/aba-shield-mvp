import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    className="px-3 py-2.5 text-[13px] text-slate-700 align-top"
    style={{
      fontFamily: 'DM Sans, sans-serif',
      lineHeight: 1.65,
      borderBottom: '1px solid #E8F5F3',
      borderRight:  '1px solid #E8F5F3',
    }}>
    {children}
  </td>
);

// ─── Markdown rendering (for AI narrative) ────────────────────────────────────

const VIEW_COMPONENTS = {
  table:    ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table
        className="w-full border-collapse text-[13px]"
        style={{ border: '1px solid #B2D8D3' }}>
        {children}
      </table>
    </div>
  ),
  thead:    ({ children }) => <thead>{children}</thead>,
  tbody:    ({ children }) => <tbody>{children}</tbody>,
  tr:       ({ children }) => <tr>{children}</tr>,
  th:       ({ children }) => <TH>{children}</TH>,
  td:       ({ children }) => <TD>{children}</TD>,
  p:        ({ children }) => (
    <p className="text-[13px] text-slate-700 leading-relaxed mb-3"
       style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </p>
  ),
  strong:   ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
  ul:       ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol:       ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li:       ({ children }) => (
    <li className="text-[13px] text-slate-700" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </li>
  ),
  h3:       ({ children }) => (
    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-4 mb-2">
      {children}
    </p>
  ),
};

// ─── CaregiverTrainingReviewView ──────────────────────────────────────────────

export default function CaregiverTrainingReviewView({ session, draftContent }) {
  const sec      = session?.sections?.caregiver_training ?? {};
  const bl       = sec.caregiverBaselines ?? {};
  const formats  = sec.trainingFormat ?? [];
  const freq     = sec.trainingFrequency ?? '';
  const barriers = sec.trainingBarriers ?? '';
  const strengths = sec.caregiverStrengths ?? '';

  const hasPremack      = bl.premack_baseline !== '' && bl.premack_baseline != null;
  const hasReinforcement = bl.reinforcement_baseline !== '' && bl.reinforcement_baseline != null;
  const hasBaselines    = hasPremack || hasReinforcement;
  const hasProgram      = formats.length > 0 || freq;
  const hasBarriers     = !!barriers.trim();
  const hasStrengths    = !!strengths.trim();

  const SL = ({ children }) => (
    <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
       style={{ color: '#2D7D6F', fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </p>
  );

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Observed Baselines table ── */}
      {hasBaselines && (
        <div className="mb-5">
          <SL>Observed Caregiver Skill Baseline</SL>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]"
                   style={{ border: '1px solid #B2D8D3' }}>
              <thead>
                <tr>
                  <TH>Strategy</TH>
                  <TH>Observed Baseline</TH>
                </tr>
              </thead>
              <tbody>
                {hasPremack && (
                  <tr>
                    <TD>Premack Principle (first/then)</TD>
                    <TD>{bl.premack_baseline}%</TD>
                  </tr>
                )}
                {hasReinforcement && (
                  <tr>
                    <TD>Reinforcement Delivery</TD>
                    <TD>{bl.reinforcement_baseline}%</TD>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Training Program summary ── */}
      {hasProgram && (
        <div className="mb-5">
          <SL>Training Program</SL>
          <div className="space-y-1.5">
            {formats.length > 0 && (
              <div className="flex gap-2 text-[13px] text-slate-700">
                <span className="font-semibold text-slate-500 w-24 flex-shrink-0">Format</span>
                <span>{formats.join(', ')}</span>
              </div>
            )}
            {freq && (
              <div className="flex gap-2 text-[13px] text-slate-700">
                <span className="font-semibold text-slate-500 w-24 flex-shrink-0">Frequency</span>
                <span>{freq}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Barriers ── */}
      {hasBarriers && (
        <div className="mb-5">
          <SL>Barriers to Participation</SL>
          <p className="text-[13px] text-slate-700 leading-relaxed">{barriers}</p>
        </div>
      )}

      {/* ── Caregiver Strengths ── */}
      {hasStrengths && (
        <div className="mb-5">
          <SL>Caregiver Strengths</SL>
          <p className="text-[13px] text-slate-700 leading-relaxed">{strengths}</p>
        </div>
      )}

      {/* ── AI narrative (training plan) ── */}
      {draftContent && (
        <div className="mt-6 pt-5 border-t" style={{ borderColor: '#E7E5E4' }}>
          <SL>Training Plan &amp; Objectives</SL>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={VIEW_COMPONENTS}>
            {draftContent}
          </ReactMarkdown>
        </div>
      )}

      {/* ── Empty state: no structured data and no draft ── */}
      {!hasBaselines && !hasProgram && !hasBarriers && !hasStrengths && !draftContent && (
        <p className="text-[13px] text-slate-400 italic">
          No caregiver training data recorded. Complete the Caregiver Training section in the Interview tab.
        </p>
      )}

    </div>
  );
}
