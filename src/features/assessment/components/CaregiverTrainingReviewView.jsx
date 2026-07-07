import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
function computeReviewSTO(t) {
  // Only render BCBA-defined STO. Never fabricate one (mirrors computeCaregiverSTO
  // in generateAssessmentDoc.js). No baseline-derived midpoint fallback.
  const validSteps = (t.stoSteps ?? []).filter(
    s => s.targetPercent !== '' && s.targetPercent != null,
  );
  if (validSteps.length > 0) {
    return validSteps.map((s, i) =>
      `STO ${i + 1}: ${s.targetPercent}% accuracy within ${s.durationWeeks || '?'} wks`,
    );
  }
  // Legacy free-text / stoPercent (BCBA-entered)
  if (t.sto?.trim()) return [t.sto];
  if (t.stoPercent != null) {
    return [t.stoWeeks != null
      ? `${t.stoPercent}% over ${t.stoWeeks} weeks`
      : `${t.stoPercent}%`];
  }
  return ['—'];
}

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
  const formats   = sec.trainingFormat    ?? [];
  const freq      = sec.trainingFrequency ?? '';
  const barriers  = sec.trainingBarriers  ?? '';
  const strengths = sec.caregiverStrengths ?? '';
  const targets   = sec.caregiverTrainingTargets ?? [];

  const hasProgram       = formats.length > 0 || !!freq;
  const hasBarriers      = !!barriers.trim();
  const hasStrengths     = !!strengths.trim();
  const hasAnything      = targets.length > 0 || hasProgram || hasBarriers || hasStrengths || draftContent;

  if (!hasAnything) {
    return (
      <p className="text-[13px] text-slate-400 italic py-4">
        No caregiver training data recorded. Complete the Caregiver Training section in the Interview tab.
      </p>
    );
  }

  return (
    <div>

      {/* ── Training Targets table ── */}
      {targets.length > 0 && (
        <div className="mb-6">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#2D7D6F' }}>
            Training Targets
          </p>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #B2D8D3' }}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <TH>Goal</TH>
                  <TH>Baseline %</TH>
                  <TH>STO</TH>
                  <TH>LTO</TH>
                </tr>
              </thead>
              <tbody>
                {targets.map((t, i) => {
                  const bpNum = t.baselinePercent !== null && t.baselinePercent !== ''
                    ? Number(t.baselinePercent) : null;
                  const stoLines = computeReviewSTO(t);
                  const ltoText = t.lto?.trim()
                    ? t.lto
                    : `Caregiver will demonstrate ${t.goalName || 'the target skill'} with ${t.ltoPercent != null ? t.ltoPercent : '?'}% accuracy across ${t.ltoSessions != null ? t.ltoSessions : '?'} consecutive caregiver training sessions.`;

                  return (
                    <tr key={t.id ?? i} className="bg-white">
                      <TD>{t.goalName || <span className="text-slate-400 italic">Untitled</span>}</TD>
                      <TD>{bpNum !== null ? `${bpNum}%${t.baselineContext?.trim() ? ` (${t.baselineContext.trim()})` : ''}` : '–'}</TD>
                      <TD>
                        {stoLines.length === 1 ? stoLines[0] : (
                          <div className="space-y-1">
                            {stoLines.map((line, li) => (
                              <p key={li} className="text-[12px]">{line}</p>
                            ))}
                          </div>
                        )}
                      </TD>
                      <TD>{ltoText}</TD>
                    </tr>
                  );
                })}
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
