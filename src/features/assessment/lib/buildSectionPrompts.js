/**
 * buildSectionPrompts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure function — no side effects, no imports, no React.
 *
 * Takes a fully-populated `session` object (from assessmentStore / seedData)
 * and returns { [sectionKey]: promptString } for every section.
 *
 * Each prompt string is a self-contained clinical data summary that Claude
 * uses to write one section of the assessment report. The strings include
 * EVERY structured field collected by the corresponding form component, plus
 * the free-text notes and the interview transcript.
 *
 * Usage:
 *   import { buildSectionPrompts } from './lib/buildSectionPrompts.js';
 *   const prompts = buildSectionPrompts(session);
 *   // prompts.communication → full prompt string for the communication section
 *
 * Demo mode: this module is imported but its output is never used when
 *   VITE_DEMO_MODE=true. Safe to call at any time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { computeStoPercent } from '../assessmentStore.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const yn   = (v) => v === true ? 'Yes' : v === false ? 'No' : 'Not recorded';
const list = (arr) => (arr && arr.length) ? arr.join(', ') : 'None recorded';
const val  = (v, fallback = 'Not recorded') => (v !== '' && v != null) ? String(v) : fallback;
const pct  = (v) => (v !== '' && v != null) ? `${v}%` : 'Not recorded';

// ─── Client profile (Demographics) ───────────────────────────────────────────

function buildDemographics(session) {
  const p = session.clientProfile ?? {};
  const lines = [
    `CLIENT: ${session.clientName}`,
    `DOB: ${val(p.dob)} | Gender: ${val(p.gender)}`,
    `Primary Diagnosis: ${val(p.diagnosis)} (ICD-10: ${val(p.icd10)})`,
    `Assessment Type: ${val(p.assessmentType)} | Assessment Date: ${val(p.assessmentDate)}`,
    `Referring Provider: ${val(p.referringProvider)} | Referral Date: ${val(p.referralDate)}`,
    `Insurer: ${val(p.insurerName)} | Member ID: ${val(p.memberId)} | Group: ${val(p.groupNumber)}`,
    p.medicaidId ? `Medicaid ID: ${p.medicaidId}` : null,
    `Parent/Guardian: ${val(p.parentGuardianNames)} (${val(p.relationship)})`,
    `Preferred Language: ${val(p.preferredLanguage)}`,
    `Intervention Settings: ${list(p.interventionSettings)}`,
    `Reason for Referral: ${val(p.reasonForReferral)}`,
    `Phone: ${val(p.phone)} | Address: ${val(p.address)}`,
  ].filter(Boolean).join('\n');

  const sec = session.sections?.demographics ?? {};
  return `${lines}\n\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`;
}

// ─── Communication ────────────────────────────────────────────────────────────

function buildCommunication(session) {
  const sec = session.sections?.communication ?? {};
  const modes = list(sec.primaryCommunicationModes);
  const hasVerbal = (sec.primaryCommunicationModes ?? []).includes('Verbal');
  const hasAAC    = (sec.primaryCommunicationModes ?? []).includes('AAC Device');
  const hasPECS   = (sec.primaryCommunicationModes ?? []).includes('PECS');

  const lines = [
    `PRIMARY COMMUNICATION MODE(S): ${modes}`,
    hasVerbal ? [
      `  Mean Length of Utterance: ${val(sec.mluWords)} words`,
      `  Intelligibility (familiar listeners): ${pct(sec.intelligibilityFamiliar)}`,
      `  Intelligibility (unfamiliar listeners): ${pct(sec.intelligibilityUnfamiliar)}`,
    ].join('\n') : null,
    hasAAC ? [
      `  AAC System: ${val(sec.aacSystem)}`,
      `  AAC Phase/Level: ${val(sec.aacPhase)}`,
    ].join('\n') : null,
    hasPECS ? `  PECS Phase: ${val(sec.pecsPhase)}` : null,
    `\nFUNCTIONAL REPERTOIRE: ${list(sec.functionalRepertoire)}`,
    `\nRECEPTIVE LANGUAGE:`,
    `  Single-step instructions: ${pct(sec.receptiveSingleStep)} of opportunities`,
    `  Two-step instructions: ${pct(sec.receptiveTwoStep)} of opportunities`,
    `  Follows multi-step (3+): ${yn(sec.receptiveMultiStep)}`,
    `\nSOCIAL COMMUNICATION / PRAGMATICS:`,
    `  Eye Contact: ${val(sec.eyeContact)}`,
    `  Initiates Communication: ${val(sec.initiatesCommunication)}`,
    `  Turn-Taking: ${val(sec.turnTaking)}`,
    `\nSLP SERVICES: ${yn(sec.slpServices)}`,
    sec.slpServices ? `  Frequency: ${val(sec.slpFrequencyPerWeek)} session(s)/week | Focus: ${val(sec.slpFocus)}` : null,
    `\nINTERVIEW TRANSCRIPT:\n${val(sec.transcript, 'No transcript recorded')}`,
    `\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].filter(Boolean).join('\n');

  return lines;
}

// ─── Safety ───────────────────────────────────────────────────────────────────

function buildSafety(session) {
  const sec = session.sections?.safety ?? {};

  const sibBlock = sec.sibPresent ? [
    `  Topography: ${list(sec.sibTopography)}`,
    `  Frequency: ${val(sec.sibFrequency)} times/day`,
    `  Injury history: ${yn(sec.sibInjuryHistory)}`,
    sec.sibInjuryHistory ? `  Injury notes: ${val(sec.sibInjuryNotes)}` : null,
  ].filter(Boolean).join('\n') : '  Not present';

  const aggBlock = sec.aggressionPresent ? [
    `  Topography: ${list(sec.aggressionTopography)}`,
    `  Primary targets: ${list(sec.aggressionTargets)}`,
    `  Frequency: ${val(sec.aggressionFrequency)} times/day`,
    `  Documented injuries to others: ${yn(sec.aggressionInjuryHistory)}`,
    sec.aggressionInjuryHistory ? `  Injury notes: ${val(sec.aggressionInjuryNotes)}` : null,
  ].filter(Boolean).join('\n') : '  Not present';

  const lines = [
    `OVERALL RISK LEVEL: ${val(sec.riskLevel)}`,
    `\nSELF-INJURIOUS BEHAVIOR (SIB): ${yn(sec.sibPresent)}`,
    sibBlock,
    `\nAGGRESSION TOWARD OTHERS: ${yn(sec.aggressionPresent)}`,
    aggBlock,
    `\nELOPEMENT RISK: ${yn(sec.elopementPresent)}`,
    sec.elopementPresent ? `  Notes: ${val(sec.elopementNotes)}` : null,
    `\nPROPERTY DESTRUCTION: ${yn(sec.propertyDestructionPresent)}`,
    sec.propertyDestructionPresent ? `  Notes: ${val(sec.propertyDestructionNotes)}` : null,
    `\nENVIRONMENTAL SAFETY MEASURES IN PLACE: ${list(sec.envSafety)}`,
    `\nPRIOR INCIDENTS:`,
    `  Law enforcement involvement: ${yn(sec.lawEnforcementInvolvement)}`,
    `  Psychiatric hospitalization or crisis stabilization: ${yn(sec.hospitalizationHistory)}`,
    (sec.lawEnforcementInvolvement || sec.hospitalizationHistory) ? `  Incident notes: ${val(sec.priorIncidentNotes)}` : null,
    `\nINTERVIEW TRANSCRIPT:\n${val(sec.transcript, 'No transcript recorded')}`,
    `\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].filter(Boolean).join('\n');

  return lines;
}

// ─── Medical Necessity ────────────────────────────────────────────────────────

function buildMedicalNecessity(session) {
  const sec = session.sections?.medical_necessity ?? {};

  const dxBlock = (sec.coOccurringDiagnoses ?? []).length
    ? sec.coOccurringDiagnoses.map((d, i) =>
        `  ${i + 1}. ${val(d.diagnosis)} (${val(d.icd10)}) — ${val(d.provider)}, ${val(d.date)}`
      ).join('\n')
    : '  None recorded';

  const medBlock = (sec.medications ?? []).length
    ? sec.medications.map((m, i) =>
        `  ${i + 1}. ${val(m.name)} ${val(m.dose)} ${val(m.frequency)} — Prescriber: ${val(m.prescriber)} | Purpose: ${val(m.purpose)}`
      ).join('\n')
    : '  None recorded';

  const abaBlock = sec.hasPriorABA && (sec.priorABAHistory ?? []).length
    ? sec.priorABAHistory.map((a, i) =>
        `  ${i + 1}. ${val(a.provider)} | ${val(a.startDate)}–${val(a.endDate)} | ${val(a.hoursPerWeek)} hrs/wk | Setting: ${val(a.setting)} | Discontinued: ${val(a.reasonDiscontinued)}`
      ).join('\n')
    : '  No prior ABA history';

  const lines = [
    `CO-OCCURRING DIAGNOSES:\n${dxBlock}`,
    `\nCURRENT MEDICATIONS:\n${medBlock}`,
    `\nPRIOR ABA HISTORY: ${yn(sec.hasPriorABA)}\n${abaBlock}`,
    `\nRECOMMENDED INTENSITY: ${val(sec.recommendedHoursPerWeek)} hours/week`,
    `RECOMMENDED SETTING: ${val(sec.recommendedSetting)}`,
    `\nINTERVIEW TRANSCRIPT:\n${val(sec.transcript, 'No transcript recorded')}`,
    `\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].join('\n');

  return lines;
}

// ─── Caregiver Training ───────────────────────────────────────────────────────

function buildCaregiverTraining(session) {
  const sec     = session.sections?.caregiver_training ?? {};
  const targets = sec.caregiverTrainingTargets ?? [];

  const targetsBlock = targets.length
    ? [
        `CAREGIVER TRAINING TARGETS:`,
        ...targets.map((t, i) => {
          const bp = t.baselinePercent !== null && t.baselinePercent !== ''
            ? Number(t.baselinePercent) : null;

          const validSteps = (t.stoSteps ?? []).filter(
            s => s.targetPercent !== '' && s.targetPercent != null,
          );

          const stoBlock = validSteps.length > 0
            ? [
                `  - STOs:`,
                ...validSteps.map((s, si) =>
                  `    STO ${si + 1}: Caregiver will demonstrate ${t.goalName || 'the target skill'} with ${s.targetPercent}% accuracy within ${s.durationWeeks || '?'} consecutive weeks.${s.note ? ` (${s.note})` : ''}`,
                ),
              ].join('\n')
            : (() => {
                const stoPercent = bp !== null ? (computeStoPercent(bp) ?? bp) : '?';
                return `  - STO: Caregiver will demonstrate ${t.goalName || 'the target skill'} with ${stoPercent}% accuracy (auto-computed).`;
              })();

          const ltoText = t.lto?.trim()
            ? t.lto
            : `Caregiver will demonstrate ${t.goalName || 'the target skill'} with ${t.ltoPercent != null ? t.ltoPercent : '?'}% accuracy across ${t.ltoSessions != null ? t.ltoSessions : '?'} consecutive caregiver training sessions.`;

          return [
            `  TARGET ${i + 1}:`,
            `  - Goal: ${val(t.goalName)}`,
            `  - Operational Definition: ${val(t.operationalDefinition)}`,
            `  - Baseline: ${bp !== null ? `${bp}%${t.baselineContext?.trim() ? ` — ${t.baselineContext.trim()}` : ''}` : 'Not recorded'}`,
            stoBlock,
            `  - LTO: ${ltoText}`,
          ].join('\n');
        }),
      ].join('\n')
    : null;

  return [
    targetsBlock,
    `\nTRAINING FORMAT: ${list(sec.trainingFormat)}`,
    `TRAINING FREQUENCY: ${val(sec.trainingFrequency)}`,
    `BARRIERS TO PARTICIPATION: ${val(sec.trainingBarriers, 'None reported')}`,
    `CAREGIVER STRENGTHS: ${val(sec.caregiverStrengths, 'None reported')}`,
    `\nINTERVIEW TRANSCRIPT:\n${val(sec.transcript, 'No transcript recorded')}`,
    `\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].filter(Boolean).join('\n');
}

// ─── Crisis Plan ──────────────────────────────────────────────────────────────

function buildCrisisPlan(session) {
  const sec = session.sections?.crisis_plan ?? {};

  const contactBlock = (sec.emergencyContacts ?? []).length
    ? sec.emergencyContacts.map((c, i) =>
        `  ${i + 1}. ${val(c.name)} (${val(c.relationship)}) — ${val(c.phone)} [${val(c.role)}]`
      ).join('\n')
    : '  None recorded';

  const lines = [
    `EMERGENCY CONTACTS:\n${contactBlock}`,
    `\nESCALATION WARNING SIGNS:\n  ${list(sec.warningSignsSelected)}`,
    sec.warningSignsCustom ? `  Additional: ${sec.warningSignsCustom}` : null,
    `\nDE-ESCALATION — WHAT WORKS:\n  ${list(sec.deEscalationWorks)}`,
    sec.deEscalationWorksOther ? `  Other: ${sec.deEscalationWorksOther}` : null,
    `\nDE-ESCALATION — WHAT WORSENS:\n  ${list(sec.deEscalationWorsens)}`,
    sec.deEscalationWorsensOther ? `  Other: ${sec.deEscalationWorsensOther}` : null,
    sec.deEscalationNotes ? `\nDE-ESCALATION CLINICAL NOTES:\n  ${sec.deEscalationNotes}` : null,
    `\nRBT RESPONSE PROTOCOL:`,
    `  Contact supervising BCBA when behavior exceeds ${val(sec.bcbaCallMinutes)} consecutive minutes`,
    `  or ${val(sec.bcbaCallIncidents)} incidents within ${val(sec.bcbaCallWindow)} minutes`,
    `  Call 911 threshold: ${yn(sec.call911Threshold)}`,
    sec.call911Threshold ? `  911 threshold description: ${val(sec.call911Notes)}` : null,
    `  Session suspend protocol: ${yn(sec.sessionSuspendThreshold)}`,
    sec.sessionSuspendThreshold ? `  Suspend conditions: ${val(sec.sessionSuspendNotes)}` : null,
    `\nRETURN TO BASELINE: ${val(sec.baselineReturnMin)}–${val(sec.baselineReturnMax)} minutes`,
    `Post-crisis debrief required: ${yn(sec.postCrisisDebrief)}`,
    `Client shows post-episode remorse: ${yn(sec.remorsePresentPostCrisis)}`,
    sec.remorsePresentPostCrisis ? `  Remorse pattern: ${val(sec.remorseNotes)}` : null,
    `\nMEDICAL CONTRAINDICATIONS: ${list(sec.medicalContraindications)}`,
    sec.medicalNotes ? `Medical notes: ${sec.medicalNotes}` : null,
    `\nPLAN ACKNOWLEDGMENT:`,
    `  Caregiver signed: ${yn(sec.caregiverSignedCrisisPlan)}`,
    `  RBT trained on plan: ${yn(sec.rbtTrainedOnPlan)}`,
    `  Include in BSP: ${yn(sec.crisisPlanInBsp)}`,
    `\nINTERVIEW TRANSCRIPT:\n${val(sec.transcript, 'No transcript recorded')}`,
    `\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].filter(Boolean).join('\n');

  return lines;
}

// ─── Behavior Targets ─────────────────────────────────────────────────────────

function buildBehaviorTargets(session) {
  const sec  = session.sections?.behavior_targets ?? {};
  const targets = sec.behaviorTargets ?? [];

  const targetsBlock = targets.length
    ? targets.map((bt, i) => [
        `  TARGET ${i + 1}: ${val(bt.behaviorName)}`,
        `  Operational Definition: ${val(bt.operationalDefinition)}`,
        `  Topography: ${list(bt.topography)}`,
        `  Frequency: ${val(bt.frequencyPerDay)} per ${val(bt.frequencyUnit)}`,
        `  Duration: ~${val(bt.durationSeconds)} ${val(bt.durationUnit)} per episode`,
        `  Intensity: ${val(bt.intensityRating)}`,
        `  Antecedents: ${val(bt.antecedents)}`,
        `  Primary targets (who is affected): ${list(bt.primaryTargets)}`,
        `  Hypothesized function: ${val(bt.hypothesizedFunction)}`,
        `  Baseline frequency: ${val(bt.baselineFrequency)}/day | Target frequency (LTO): ${val(bt.targetFrequency)}/day`,
        (bt.stoSteps ?? []).length > 0
          ? `  Short-Term Objectives (BCBA-defined):\n${bt.stoSteps.map((s, si) =>
              `    STO ${si + 1}: Reduce to ${s.targetFrequency || '?'} per ${bt.frequencyUnit || 'day'} for ${s.durationWeeks || '?'} consecutive weeks`
            ).join('\n')}`
          : null,
        `  Measurement system: ${val(bt.measurementSystem)}`,
        `  Prior FBA: ${yn(bt.priorFBACompleted)} | Prior BIP: ${yn(bt.priorBIPCompleted)}`,
        bt.notes ? `  Clinical notes: ${bt.notes}` : null,
      ].filter(Boolean).join('\n')
    ).join('\n\n')
    : '  No behavior targets recorded';

  return [
    targetsBlock,
    `\nINTERVIEW TRANSCRIPT:\n${val(sec.transcript, 'No transcript recorded')}`,
    `\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].join('\n');
}

// ─── Skill Acquisitions ───────────────────────────────────────────────────────

function buildSkillAcquisitions(session) {
  const sec   = session.sections?.skill_acquisitions ?? {};
  const goals = sec.skillGoals ?? [];

  const goalsBlock = goals.length
    ? goals.map((g, i) => [
        `  GOAL ${i + 1}: ${val(g.targetSkill)} [Domain: ${val(g.domain, 'Not categorized')}]`,
        `  Operational Definition: ${val(g.operationalDefinition)}`,
        `  Teaching Strategies: ${list(g.teachingStrategies)}${g.teachingStrategiesOther ? ` + ${g.teachingStrategiesOther}` : ''}`,
        `  Baseline: ${pct(g.baselinePercent)} correct across ${val(g.baselineOpportunities)} opportunities with ${val(g.baselinePromptingLevel) || val(g.promptingLevel)} prompting`,
        g.baselinePromptingDesc ? `  Baseline detail: ${g.baselinePromptingDesc}` : null,
        `  Mastery Criteria: ${pct(g.masteryCriteriaPercent)} across ${val(g.masteryCriteriaSessions)} consecutive sessions, ${val(g.masteryCriteriaSettings)} people/settings, with ${val(g.masteryCriteriaPromptingLevel)} prompting`,
        (g.stoSteps ?? []).length > 0
          ? `  Short-Term Objectives (BCBA-defined):\n${(g.stoSteps).map((s, si) =>
              `    STO ${si + 1}: Client will demonstrate ${s.skillDescription || g.targetSkill} with ${s.targetPercent || '?'}% accuracy across ${g.masteryCriteriaSessions || '3'} sessions within ${s.durationWeeks || '?'} weeks`
            ).join('\n')}`
          : (g.stoPercent || g.stoSkillDescription || g.stoWeeks)
            ? (() => {
                const stoP = g.stoPercent || Math.round(Number(g.masteryCriteriaPercent || 80) * 0.5);
                const stoDesc = g.stoSkillDescription || g.targetSkill || 'the target skill';
                const stoWks = g.stoWeeks || '12';
                return `  Short-Term Objective (STO): Client will demonstrate ${stoDesc} with ${stoP}% accuracy across ${g.masteryCriteriaSessions || '3'} sessions within ${stoWks} weeks`;
              })()
          : g.sto
            ? `  Short-Term Objective (STO): ${g.sto}`
          : null,
        g.generalizationNotes ? `  Generalization plan: ${g.generalizationNotes}` : null,
      ].filter(Boolean).join('\n')
    ).join('\n\n')
    : '  No skill goals recorded';

  return [
    goalsBlock,
    `\nCLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].join('\n');
}

// ─── Behavioral indicators helper ─────────────────────────────────────────────

function buildIndicators(sec) {
  const active = (sec.indicators ?? []).filter(i => i.count > 0);
  if (!active.length) return null;
  return `ANTECEDENT / BEHAVIOR TALLY:\n${active.map(i => `  ${i.label}: ${i.count}`).join('\n')}`;
}

// ─── Generic sections (indicators + transcript + notes) ───────────────────────

function buildGenericSection(session, sectionKey) {
  const sec          = session.sections?.[sectionKey] ?? {};
  const indicators   = buildIndicators(sec);
  return [
    indicators,
    `INTERVIEW TRANSCRIPT:\n${val(sec.transcript, 'No transcript recorded')}`,
    `CLINICIAN NOTES:\n${val(sec.notes, 'None')}`,
  ].filter(Boolean).join('\n\n');
}

// ─── Master builder ───────────────────────────────────────────────────────────

/**
 * buildSectionPrompts(session)
 *
 * Returns an object mapping each section key to a fully-populated prompt string.
 * Every structured field from every form is included.
 *
 * @param {object} session - The full assessment session object
 * @returns {{ [sectionKey: string]: string }}
 */
export function buildSectionPrompts(session) {
  return {
    demographics:       buildDemographics(session),
    presenting_concerns: buildGenericSection(session, 'presenting_concerns'),
    self_help:          buildGenericSection(session, 'self_help'),
    daily_living:       buildGenericSection(session, 'daily_living'),
    safety:             buildSafety(session),
    communication:      buildCommunication(session),
    self_stim:          buildGenericSection(session, 'self_stim'),
    medical_necessity:  buildMedicalNecessity(session),
    behavior_targets:   buildBehaviorTargets(session),
    skill_acquisitions: buildSkillAcquisitions(session),
    caregiver_training: buildCaregiverTraining(session),
    crisis_plan:        buildCrisisPlan(session),
  };
}
