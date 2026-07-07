import React from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeBaseline(goal) {
  if (!goal.baselinePercent && goal.baselinePercent !== 0) return '–';
  const pct    = goal.baselinePercent;
  const opps   = goal.baselineOpportunities || '?';
  const prompt = goal.baselinePromptingLevel || goal.promptingLevel?.[0] || null;
  const promptPart = prompt ? ` with ${prompt} prompting` : '';
  return `Client demonstrates ${pct}% correct${promptPart} across ${opps} opportunities.`;
}

function computeMastery(goal) {
  const pct      = goal.masteryCriteriaPercent   || '80';
  const sessions = goal.masteryCriteriaSessions  || '3';
  const settings = goal.masteryCriteriaSettings  || '2';
  const prompt   = goal.masteryCriteriaPromptingLevel || goal.masteryCriteriaPrompting || 'independent';
  return `Client will demonstrate ${goal.targetSkill || 'the target skill'} with ${pct}% accuracy across ${sessions} consecutive sessions across ${settings} opportunities/trials with ${prompt} level of prompting.`;
}

function computeSTO(goal) {
  // Tier 0 — BCBA-defined multi-step milestones
  if ((goal.stoSteps ?? []).length > 0) {
    return goal.stoSteps.map((s, i) =>
      `STO ${i + 1}: Client will demonstrate ${s.skillDescription || goal.targetSkill || 'the target skill'} with ${s.targetPercent || '?'}% accuracy across ${goal.masteryCriteriaSessions || '3'} consecutive sessions within ${s.durationWeeks || '?'} weeks.`
    ).join('\n');
  }
  // Tier 1 — structured single-step fields (only when the BCBA entered a real STO %)
  if (goal.stoPercent) {
    const desc  = goal.stoSkillDescription || (goal.targetSkill || 'the target skill');
    const weeks = goal.stoWeeks        || '12';
    const sessions = goal.masteryCriteriaSessions || '3';
    return `Client will demonstrate ${desc} with ${goal.stoPercent}% accuracy across ${sessions} consecutive sessions within ${weeks} weeks.`;
  }
  // Tier 2 — legacy free-text
  if (goal.sto) return goal.sto;
  // No STO defined — never fabricate one (mirrors computeSkillSTO in generateAssessmentDoc.js).
  return '—';
}

// Extract [BCBA to complete: ...] blocks from draftContent
function extractBcbaNotes(draftContent) {
  if (!draftContent) return [];
  const re = /\[BCBA to complete:[^\]]*\]/g;
  const matches = [];
  let m;
  while ((m = re.exec(draftContent)) !== null) matches.push(m[0]);
  return matches;
}

// Extract overview/intro text (everything before the first goal block)
function extractOverview(draftContent) {
  if (!draftContent) return '';
  // Take text before first '##' goal heading
  const idx = draftContent.search(/^##\s+\d/m);
  if (idx === -1) return '';
  return draftContent.slice(0, idx)
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[BCBA to complete:[^\]]*\]/g, '')
    .trim();
}

// ─── Table ────────────────────────────────────────────────────────────────────

const TH = ({ children }) => (
  <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
    style={{ background: '#E8F5F3', color: '#2D7D6F', borderBottom: '1px solid #B2D8D3', borderRight: '1px solid #B2D8D3' }}>
    {children}
  </th>
);

const TD = ({ children }) => (
  <td className="px-3 py-2.5 text-[13px] text-slate-700 align-top last:border-r-0"
    style={{ fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.65, borderRight: '1px solid #B2D8D3' }}>
    {children}
  </td>
);

// ─── GoalBlock ────────────────────────────────────────────────────────────────

function GoalBlock({ goal, index }) {
  const strategiesArr = Array.isArray(goal.teachingStrategies) ? goal.teachingStrategies : [];
  const strategiesParts = [...strategiesArr];
  if (goal.teachingStrategiesOther?.trim()) strategiesParts.push(goal.teachingStrategiesOther.trim());
  const strategies = strategiesParts.join(', ');

  return (
    <div className="mb-8">
      {/* Goal heading */}
      <h3 className="text-[15px] font-bold text-slate-800 mb-2"
        style={{ fontFamily: 'DM Sans, sans-serif' }}>
        Goal {index + 1}: {goal.targetSkill || 'Untitled Goal'}
      </h3>

      {/* Operational definition */}
      {goal.operationalDefinition && (
        <p className="text-[14px] text-slate-700 mb-2 leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <strong style={{ fontFamily: 'DM Sans, sans-serif' }}>Operational Definition:</strong>{' '}
          {goal.operationalDefinition}
        </p>
      )}

      {/* Teaching strategies */}
      {strategies && (
        <p className="text-[14px] text-slate-700 mb-3 leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <strong style={{ fontFamily: 'DM Sans, sans-serif' }}>Teaching Strategies:</strong>{' '}
          {strategies}
        </p>
      )}

      {/* Data table */}
      <div className="overflow-x-auto mb-3 rounded-lg" style={{ border: '1px solid #B2D8D3' }}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <TH>Target Behavior</TH>
              <TH>6-Month Target (STO)</TH>
              <TH>Baseline Data</TH>
              <TH>Mastery Criteria (LTO)</TH>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <TD>{goal.targetSkill || '–'}</TD>
              <TD>
                {(goal.stoSteps ?? []).length > 0
                  ? <span style={{ whiteSpace: 'pre-line' }}>{computeSTO(goal)}</span>
                  : computeSTO(goal)
                }
              </TD>
              <TD>{computeBaseline(goal)}</TD>
              <TD>{computeMastery(goal)}</TD>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Generalization */}
      {goal.generalizationNotes && (
        <p className="text-[14px] text-slate-700 leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <strong style={{ fontFamily: 'DM Sans, sans-serif' }}>Generalization &amp; Maintenance:</strong>{' '}
          {goal.generalizationNotes}
        </p>
      )}
    </div>
  );
}

// ─── SkillAcquisitionsReviewView ──────────────────────────────────────────────

export default function SkillAcquisitionsReviewView({ session, draftContent }) {
  const skillGoals  = session?.sections?.skill_acquisitions?.skillGoals ?? [];
  const overview    = extractOverview(draftContent);
  const bcbaNotes   = extractBcbaNotes(draftContent);

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Overview paragraph */}
      {overview && (
        <p className="text-[14px] text-slate-700 mb-6 leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {overview}
        </p>
      )}

      {/* One block per goal */}
      {skillGoals.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">
          No skill goals found. Add goals in the Interview tab.
        </p>
      ) : (
        skillGoals.map((goal, i) => (
          <GoalBlock key={goal.id ?? i} goal={goal} index={i} />
        ))
      )}

      {/* BCBA Clinical Notes */}
      {bcbaNotes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Clinical Notes
          </p>
          {bcbaNotes.map((note, i) => (
            <span key={i} className="placeholder-block block mb-2">
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
