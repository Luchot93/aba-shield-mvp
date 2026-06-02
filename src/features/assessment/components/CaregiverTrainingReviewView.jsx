import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Table primitives — exact match to SkillAcquisitions / MaladaptiveBehaviors ─

const TH = ({ children }) => (
  <th
    className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
    style={{
      background:   '#E8F5F3',
      color:        '#2D7D6F',
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

// ─── Markdown components for AI narrative (mirrors MaladaptiveBehaviorsReviewView) ─

const MD_COMPONENTS = {
  p: ({ children }) => (
    <p className="mb-3 text-[14px] leading-relaxed text-slate-700"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {children}
    </p>
  ),
  strong:  ({ children }) => <strong className="font-bold text-slate-800">{children}</strong>,
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
};

// ─── Shared body-text style ───────────────────────────────────────────────────

const bodyStyle = { fontFamily: 'Georgia, "Times New Roman", serif' };
const labelStyle = { fontFamily: 'DM Sans, sans-serif' };

// ─── CaregiverTrainingReviewView ──────────────────────────────────────────────

export default function CaregiverTrainingReviewView({ session, draftContent }) {
  const sec       = session?.sections?.caregiver_training ?? {};
  const bl        = sec.caregiverBaselines ?? {};
  const formats   = sec.trainingFormat    ?? [];
  const freq      = sec.trainingFrequency ?? '';
  const barriers  = sec.trainingBarriers  ?? '';
  const strengths = sec.caregiverStrengths ?? '';

  const hasPremack       = bl.premack_baseline      !== '' && bl.premack_baseline      != null;
  const hasReinforcement = bl.reinforcement_baseline !== '' && bl.reinforcement_baseline != null;
  const hasBaselines     = hasPremack || hasReinforcement;
  const hasProgram       = formats.length > 0 || !!freq;
  const hasBarriers      = !!barriers.trim();
  const hasStrengths     = !!strengths.trim();
  const hasAnything      = hasBaselines || hasProgram || hasBarriers || hasStrengths || draftContent;

  if (!hasAnything) {
    return (
      <p className="text-[13px] text-slate-400 italic py-4">
        No caregiver training data recorded. Complete the Caregiver Training section in the Interview tab.
      </p>
    );
  }

  return (
    <div>

      {/* ── Observed Baselines table ── */}
      {hasBaselines && (
        <div className="mb-6">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Observed Caregiver Skill Baseline
          </p>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #B2D8D3' }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <TH>Strategy</TH>
                  <TH>Observed Baseline</TH>
                </tr>
              </thead>
              <tbody>
                {hasPremack && (
                  <tr className="bg-white">
                    <TD>Premack Principle (first/then)</TD>
                    <TD>{bl.premack_baseline}%</TD>
                  </tr>
                )}
                {hasReinforcement && (
                  <tr className="bg-white">
                    <TD>Reinforcement Delivery</TD>
                    <TD>{bl.reinforcement_baseline}%</TD>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Training Program ── */}
      {hasProgram && (
        <div className="mb-5">
          {formats.length > 0 && (
            <p className="text-[14px] text-slate-700 mb-1.5 leading-relaxed" style={bodyStyle}>
              <strong style={labelStyle}>Training Format:</strong>{' '}
              {formats.join(', ')}
            </p>
          )}
          {freq && (
            <p className="text-[14px] text-slate-700 mb-1.5 leading-relaxed" style={bodyStyle}>
              <strong style={labelStyle}>Training Frequency:</strong>{' '}
              {freq}
            </p>
          )}
        </div>
      )}

      {/* ── Barriers to Participation ── */}
      {hasBarriers && (
        <p className="text-[14px] text-slate-700 mb-5 leading-relaxed" style={bodyStyle}>
          <strong style={labelStyle}>Barriers to Participation:</strong>{' '}
          {barriers}
        </p>
      )}

      {/* ── Caregiver Strengths ── */}
      {hasStrengths && (
        <p className="text-[14px] text-slate-700 mb-5 leading-relaxed" style={bodyStyle}>
          <strong style={labelStyle}>Caregiver Strengths:</strong>{' '}
          {strengths}
        </p>
      )}

      {/* ── AI narrative (Training Plan & Objectives) ── */}
      {draftContent?.trim() && (
        <div className="mt-4 pt-5 border-t" style={{ borderColor: '#E7E5E4' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Training Plan &amp; Objectives
          </p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {draftContent}
          </ReactMarkdown>
        </div>
      )}

    </div>
  );
}
