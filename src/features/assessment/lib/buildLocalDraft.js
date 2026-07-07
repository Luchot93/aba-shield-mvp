/**
 * buildLocalDraft.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Local (no-API) clinical-markdown draft builder for demo mode.
 *
 * Generates clinical markdown directly from the session's structured data — no
 * API call needed, so the client name, goals, and behaviors are always correct.
 * Used by the demo generation path AND by scoped regeneration in demo mode
 * (where it correctly reflects the CURRENT session data after an edit).
 *
 * Pure function of `session`. No React, no side effects.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function buildLocalDraft(session) {
  const name    = session.clientName ?? 'the client';
  const profile = session.clientProfile ?? {};
  const secs    = session.sections ?? {};
  const dx      = profile.diagnosis ?? 'Autism Spectrum Disorder';
  const icd     = profile.icd10 ? ` (${profile.icd10})` : '';
  const ref     = profile.referringProvider ? `, referred by ${profile.referringProvider}` : '';

  const drafts = {};

  // ── Demographics ────────────────────────────────────────────────────────────
  drafts.demographics = [
    `## Client & Referral Summary`,
    `**Client:** ${name}`,
    profile.dob         ? `**DOB:** ${profile.dob}` : null,
    profile.gender      ? `**Gender:** ${profile.gender}` : null,
    `**Primary Diagnosis:** ${dx}${icd}${ref}`,
    profile.insurerName ? `**Insurance:** ${profile.insurerName}${profile.memberId ? ' | Member ID: ' + profile.memberId : ''}${profile.groupNumber ? ' | Group: ' + profile.groupNumber : ''}` : null,
    secs.demographics?.notes ? `\n${secs.demographics.notes}` : null,
  ].filter(Boolean).join('\n');

  // ── Presenting Concerns ────────────────────────────────────────────────────
  const pcNotes = secs.presenting_concerns?.notes ?? secs.presenting_concerns?.transcript ?? '';
  drafts.presenting_concerns = pcNotes.trim()
    ? `## Presenting Concerns\n\n${pcNotes.trim()}`
    : `## Presenting Concerns\n\nCaregiver and clinical referral identify behavioral and developmental concerns requiring comprehensive ABA assessment. See notes for details.`;

  // ── Self-Help, Daily Living, Safety, Communication, Self-Stim, Crisis ───────
  const simpleSection = (key, title) => {
    const sec = secs[key] ?? {};
    const body = [sec.notes, sec.transcript].filter(Boolean).join('\n\n').trim();
    return body ? `## ${title}\n\n${body}` : `## ${title}\n\nSee clinician notes.`;
  };
  drafts.self_help        = simpleSection('self_help',        'Self-Help Skills');
  drafts.daily_living     = simpleSection('daily_living',     'Daily Living Skills');
  drafts.safety           = simpleSection('safety',           'Safety Concerns');
  drafts.communication    = simpleSection('communication',    'Communication');
  drafts.self_stim        = simpleSection('self_stim',        'Self-Stimulatory Behavior');
  drafts.crisis_plan      = simpleSection('crisis_plan',      'Crisis Plan');
  drafts.caregiver_training = simpleSection('caregiver_training', 'Caregiver Training');

  // ── Medical Necessity ──────────────────────────────────────────────────────
  const mnSec   = secs.medical_necessity ?? {};
  const mnNotes = [mnSec.notes, mnSec.transcript].filter(Boolean).join('\n\n').trim();
  drafts.medical_necessity = [
    `## Medical Necessity`,
    ``,
    `**${name}** carries a primary diagnosis of **${dx}**${icd}${ref}. This diagnosis necessitates intensive, individualized Applied Behavior Analysis (ABA) therapy to address functional impairments across communication, adaptive behavior, and safety.`,
    ``,
    mnNotes || `ABA services are medically necessary to reduce behavioral barriers and build functional skills that cannot be adequately addressed through less intensive interventions. Without ABA, ${name} is at significant risk for continued skill regression and safety incidents.`,
  ].join('\n');

  // ── Skill Acquisitions ─────────────────────────────────────────────────────
  const goals = secs.skill_acquisitions?.skillGoals ?? [];
  if (goals.length > 0) {
    const goalBlocks = goals.map((g, i) => {
      const baseline = g.baselinePct != null ? `${g.baselinePct}%` : 'not recorded';
      const mastery  = g.masteryPct  != null ? `${g.masteryPct}%` : 'not recorded';
      const strats   = (g.teachingStrategies ?? []).join(', ') || 'To be determined';
      return [
        `### Goal ${i + 1}: ${g.targetSkill ?? 'Untitled Goal'}`,
        g.operationalDefinition ? `**Operational Definition:** ${g.operationalDefinition}` : null,
        `**Teaching Strategies:** ${strats}`,
        `**Baseline:** ${baseline} → **Target (LTO):** ${mastery}`,
      ].filter(Boolean).join('\n');
    });
    drafts.skill_acquisitions = `## Skill Acquisition Plan\n\n${goalBlocks.join('\n\n')}`;
  } else {
    const saNotes = [secs.skill_acquisitions?.notes, secs.skill_acquisitions?.transcript].filter(Boolean).join('\n\n').trim();
    drafts.skill_acquisitions = saNotes
      ? `## Skill Acquisition Plan\n\n${saNotes}`
      : `## Skill Acquisition Plan\n\nSkill acquisition targets will be developed based on assessment findings.`;
  }

  // ── Behavior Targets ──────────────────────────────────────────────────────
  const behaviors = secs.behavior_targets?.behaviorTargets ?? [];
  if (behaviors.length > 0) {
    const btBlocks = behaviors.map(bt => {
      const baseline = bt.baselineFrequency ? `${bt.baselineFrequency} per ${bt.frequencyUnit ?? 'day'}` : 'not recorded';
      const target   = bt.targetFrequency   ? `${bt.targetFrequency} per ${bt.frequencyUnit ?? 'day'}`   : 'elimination';
      return [
        `### ${bt.behaviorName ?? 'Untitled Behavior'}`,
        bt.operationalDefinition ? `**Operational Definition:** ${bt.operationalDefinition}` : null,
        bt.antecedents           ? `**Antecedents:** ${bt.antecedents}` : null,
        bt.hypothesizedFunction  ? `**Hypothesized Function:** ${bt.hypothesizedFunction}` : null,
        `**Baseline:** ${baseline} → **Target:** ${target}`,
      ].filter(Boolean).join('\n');
    });
    drafts.behavior_targets = `## Behavior-Reduction Targets\n\n${btBlocks.join('\n\n')}`;
  } else {
    const btNotes = [secs.behavior_targets?.notes, secs.behavior_targets?.transcript].filter(Boolean).join('\n\n').trim();
    drafts.behavior_targets = btNotes
      ? `## Behavior-Reduction Targets\n\n${btNotes}`
      : `## Behavior-Reduction Targets\n\nBehavior targets will be identified based on direct observation and caregiver interview data.`;
  }

  return drafts;
}
