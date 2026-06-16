import { mkChecklist } from './checklist.js';

// ─── Standard caregiver training target definitions ───────────────────────────
// These two targets are pre-seeded into every new Caregiver Training section.
// isStandard: true prevents deletion; standardKey is used by downstream systems.

const _CT_BASE = {
  baselinePercent: null,
  baselineContext: '',
  stoSteps:        [],
  ltoPercent:      null,
  ltoSessions:     null,
  lto:             '',
};

export const STANDARD_CAREGIVER_TARGET_DEFS = [
  {
    standardKey: 'premack',
    isStandard: true,
    goalName: 'Premack Principle (First-Then)',
    operationalDefinition: 'Caregiver uses "first [non-preferred], then [preferred]" structure consistently, delivering access to the preferred item contingently and only after the requested behavior is completed.',
  },
  {
    standardKey: 'reinforcement',
    isStandard: true,
    goalName: 'Reinforcement Delivery',
    operationalDefinition: 'Caregiver delivers reinforcement within 3 seconds of target behavior at a magnitude matched to the effort required, contingently and only following the desired response.',
  },
];

// Returns a fresh pair of standard targets. seedIdx makes IDs stable for seed data.
// stepsMap: { premack: [...stoSteps], reinforcement: [...stoSteps] } — optional per-target steps.
// ltoMap:   { premack: { ltoPercent, ltoSessions }, reinforcement: { ... } } — optional LTO overrides.
export function makeStandardCaregiverTargets(baselines = {}, seedIdx = null, stepsMap = {}, ltoMap = {}) {
  return STANDARD_CAREGIVER_TARGET_DEFS.map((def, i) => ({
    id: seedIdx != null ? `ctgt_std_${seedIdx}_${i + 1}` : crypto.randomUUID(),
    ..._CT_BASE,
    ...def,
    baselinePercent: baselines[def.standardKey] != null ? Number(baselines[def.standardKey]) : null,
    stoSteps: stepsMap[def.standardKey] ?? [],
    ...(ltoMap[def.standardKey] ?? {}),
  }));
}

const SECTION_ORDER = [
  'demographics','presenting_concerns','self_help','daily_living',
  'safety','communication','self_stim','medical_necessity',
  'behavior_targets','skill_acquisitions','caregiver_training','crisis_plan',
];

const SECTION_TITLES = {
  demographics:'Demographics & Referral Info',
  presenting_concerns:'Presenting Concerns',
  self_help:'Self-Help Skills',
  daily_living:'Daily Living Skills',
  safety:'Safety Concerns',
  communication:'Communication',
  self_stim:'Self-Stimulatory Behavior',
  medical_necessity:'Medical Necessity',
  skill_acquisitions:'Skill Acquisitions',
  behavior_targets:'Maladaptive Behaviors',
  caregiver_training:'Caregiver Training',
  crisis_plan:'Crisis Plan',
};

const makeSections = () => Object.fromEntries(
  SECTION_ORDER.map(key => [key, {
    key,
    title: SECTION_TITLES[key],
    completionState: 'empty',
    notes: '',
    indicators: key === 'behavior_targets' ? [
      { id:'ant-demand',      label:'Antecedent: Demand placed',         count:0, isCustom:false, unit:'tag' },
      { id:'ant-transition',  label:'Antecedent: Transition',            count:0, isCustom:false, unit:'tag' },
      { id:'ant-attention',   label:'Antecedent: Attention withdrawn',   count:0, isCustom:false, unit:'tag' },
    ] : [],
    skillGoals: [],
    behaviorTargets: [],
    // Caregiver Training extra fields (populated only for caregiver_training section)
    ...(key === 'caregiver_training' ? {
      caregiverBaselines: { premack_baseline: '', reinforcement_baseline: '' },
      trainingFormat: [],
      trainingFrequency: '',
      trainingBarriers: '',
      caregiverStrengths: '',
      caregiverTrainingTargets: makeStandardCaregiverTargets({}, key),
    } : {}),
    recordingState: 'idle',
    recordingDurationSeconds: 0,
    transcript: null,
    transcriptFlagged: false,
    hasConflict: false,
    draftContent: null,
    aiOriginalContent: null,
    draftState: 'blank',
    approvalState: 'pending',
    lastSavedAt: null,
  }])
);

// Fields that map from the client record into clientProfile.
// Any that are empty at intake time get flagged in _intakeMissingFields
// so DemographicsForm can show a yellow "needs manual entry" border.
const INTAKE_PROFILE_MAP = [
  { profileKey: 'dob',               clientKey: 'dob'               },
  { profileKey: 'phone',             clientKey: 'phone'             },
  { profileKey: 'address',           clientKey: 'address'           },
  { profileKey: 'insurerName',       clientKey: 'insurer_name'      },
  { profileKey: 'memberId',          clientKey: 'member_id'         },
  { profileKey: 'groupNumber',       clientKey: 'group_number'      },
  { profileKey: 'referringProvider', clientKey: 'referring_provider'},
  { profileKey: 'referralDate',      clientKey: 'referral_date'     },
  { profileKey: 'gender',            clientKey: 'gender'            },
  { profileKey: 'icd10',             clientKey: 'icd10'             },
  { profileKey: 'diagnosis',         clientKey: 'diagnosis'         },
];

export const makeAssessmentSession = (clientId, clientName, bcbaId, bcbaName, client = null) => {
  // Build autofill patch from the client record when provided
  const autofill = {};
  const _intakeMissingFields = [];
  if (client) {
    for (const { profileKey, clientKey } of INTAKE_PROFILE_MAP) {
      const val = client[clientKey] || '';
      autofill[profileKey] = val;
      if (!val) _intakeMissingFields.push(profileKey);
    }
  }

  return {
    id: `session_${clientId}_${Date.now()}`,
    clientId, clientName, bcbaId, bcbaName,
    status: 'not_started',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    consentGranted: false,
    consentGrantedAt: null,
    sectionsWithData: 0,
    sectionsApproved: 0,
    clientProfile: {
      dob: '', phone: '', address: '', referralDate: '',
      insurerName: '', memberId: '', groupNumber: '', referringProvider: '',
      diagnosis: '', gender: '', icd10: '', medicaidId: '',
      assessmentType: 'Initial', assessmentDate: '',
      parentGuardianNames: '', relationship: '', preferredLanguage: 'English',
      reasonForReferral: '', interventionSettings: [],
      ...autofill,             // overwrite blanks with client record values
      _intakeMissingFields,    // tracked for yellow-border indicators in DemographicsForm
    },
    sections: makeSections(),
    result: null,
  };
};

// ─── Mock interview data — pre-filled demo sessions ──────────────────────────

function makeFilledSession(clientId, clientName, bcbaId, bcbaName, sectionData, profileOverrides = {}) {
  const base     = makeAssessmentSession(clientId, clientName, bcbaId, bcbaName);
  const sections = { ...base.sections };

  for (const [key, data] of Object.entries(sectionData)) {
    sections[key] = {
      ...sections[key],
      ...data,                                    // spread ALL seed fields — future-proof
      notes:           data.notes           ?? '',// keep null-safe defaults for critical fields
      transcript:      data.transcript      ?? null,
      completionState: data.completionState ?? 'partial',
    };
  }

  const sectionsWithData = Object.values(sections).filter(
    s => s.key !== 'demographics' && s.completionState !== 'empty',
  ).length;

  return {
    ...base,
    id:               `session_${clientId}_demo`,
    consentGranted:   true,
    consentGrantedAt: '2026-05-20T10:15:00Z',
    status:           'in_progress',
    sectionsWithData,
    sectionsApproved: 0,
    updatedAt:        '2026-05-22T14:30:00Z',
    sections,
    clientProfile:    { ...base.clientProfile, ...profileOverrides },
  };
}

// ── Emma Thompson mock data ──────────────────────────────────────────────────

const EMMA_INTERVIEW_DATA = {
  demographics: {
    notes: 'Emma Thompson, DOB 01/30/2020 (age 6). Dx: ASD Level 3 (Dr. Robert Chen, Dev Peds, 03/2024 — ADOS-2 Module 1, ADI-R, Vineland-3). Insurance: Humana HUM-334490 / G-98712. Lives with both parents + older brother (age 9, NT). Primary language: English. School: Palm Academy, Boca Raton — Kindergarten with 1:1 aide under IEP. SLP 2x/week, OT 1x/week. No prior ABA.',
    completionState: 'complete',
  },
  presenting_concerns: {
    notes: 'Family top concerns: (1) Very limited verbal communication — 8-10 single words used inconsistently, no functional requesting. Uses hand-leading and pointing only. (2) Head banging on hard surfaces 4-8x/day, primarily during transitions and demand presentation. Marks observed; no medical attention needed yet. Parents frightened about escalation. (3) Severe food selectivity — 6 accepted foods only (see self-help). School reports 1 documented peer hitting incident (last week, first time). Family considering more restrictive school placement if no improvement.',
    transcript: "Mom: She still isn't talking to tell us what she needs. She has a few words but she doesn't use them. She just gets frustrated and starts hitting her head on the wall. It happens the most when we try to take something away or ask her to do something she doesn't like. We put padding on the wall in her room. Dad: The school called this week — she hit another kid during free play, which she's never done before. That was a shock. And the feeding is another huge issue. She literally only eats six foods. If we put anything else on her plate she has a complete meltdown.",
    completionState: 'complete',
  },
  self_help: {
    notes: 'Toileting: urinary trained daytime (1-2 accidents/week). Bowel NOT trained — full-time pull-ups. No self-initiation; scheduled toileting every 90 min. Cannot manage clothing during toileting independently. Dressing: full physical assistance for upper body; steps into pants with verbal prompt. No fasteners managed. Tactile sensitivity: seamless socks + tagless shirts required — meltdown if seamed clothing applied. Feeding: 6 accepted foods only — chicken nuggets (specific brand), white rice, plain crackers, apple juice, vanilla wafer cookies, peeled apple slices. No utensils — finger eating. OT feeding eval March 2024: sensory-based avoidance confirmed.',
    completionState: 'partial',
  },
  daily_living: {
    notes: 'Morning routine: fully dependent — all steps require physical prompting. No visual schedule at home (school uses one). Bedtime: semi-structured — bath attempt (often refused), PJs, 30 min tablet, lights out. Takes 60-90 min. Sleep onset generally OK once in bed. Transitions: 70% result in behavioral escalation (head banging or tantrum). Community: avoids grocery stores, restaurants, loud public spaces. Playground tolerated 10-15 min. No chores currently. Leisure: very strong preference for iPad (water videos, satisfying/sensory content on YouTube). Spins objects independently 20-30 min. Independent play: 15-20 min with light-up/spinning toys.',
    completionState: 'partial',
  },
  safety: {
    notes: 'SIB (Head banging): 4-8 episodes/day. Surfaces: walls, floor, occasionally caregiver shoulder. Visible marks observed post-episode; no medical treatment needed. Parents have installed foam padding in bedroom and hallway. Elopement: no history. No water body access (no home pool, backyard fenced). Aggression toward others: school incident (1x hitting peer during free play). No home aggression toward persons currently. Minimal property destruction (knocking over items, not sustained). No law enforcement involvement.',
    transcript: "She bangs her head mostly when we remove something she's enjoying or ask her to transition. The wall in her room — she's done it so many times we put padding up there. We don't have a pool, backyard is fenced. There was one incident at school where she hit another kid but there's no aggression at home toward people. The head banging is the main safety concern for us right now.",
    completionState: 'partial',
    riskLevel: 'High',
    sibPresent: true,
    sibTopography: ['Head banging'],
    sibFrequency: '6',
    sibInjuryHistory: true,
    sibInjuryNotes: 'Visible marks/redness observed post-episode on forehead. No medical treatment required to date. Parents have installed foam padding on bedroom and hallway walls as protective measure.',
    aggressionPresent: true,
    aggressionTopography: ['Open-hand hitting'],
    aggressionTargets: ['Peers'],
    aggressionFrequency: '0',
    aggressionInjuryHistory: false,
    aggressionInjuryNotes: '1 documented incident at school (peer hitting during free play). No injuries reported. First occurrence — no prior home aggression toward persons.',
    elopementPresent: false,
    propertyDestructionPresent: true,
    propertyDestructionNotes: 'Minimal — occasional knocking over of small items. Not sustained or targeted. No significant property damage.',
    envSafety: [
      'Pool / water body secured or no access',
      'Firearms secured or not present',
      'Padding / protective equipment installed',
    ],
    lawEnforcementInvolvement: false,
    hospitalizationHistory: false,
  },
  communication: {
    notes: 'Primarily nonverbal. ~8-10 single words inconsistently (more, no, mama, done, up, ball, go most reliable). No functional requesting with words — uses hand-leading, pointing, reaching. PECS Phase 2 at school (single exchange, prompted). AAC trial started 2 weeks ago (Proloquo2Go, school SLP-led). Receptive: name response ~60% familiar adults. Follows single-step instructions in familiar contexts (sit, come here, give me). Two-step not followed. No consistent yes/no. Identifies some body parts on self. Eye contact limited but improves with preferred items. No reciprocal social communication. No peer-directed communication observed.',
    transcript: "She doesn't talk to tell us things. She takes our hand and pulls us to what she wants or she'll point. At school they do PECS and she can hand the card when prompted but she doesn't go get the card herself. The iPad app is very new — the SLP just started it. We don't really know how to use it at home yet.",
    completionState: 'complete',
    primaryCommunicationModes: ['PECS', 'AAC Device', 'Gestural / Pointing'],
    aacSystem: 'Proloquo2Go',
    aacPhase: 'Trial phase — 2 weeks in, school SLP-led. No independent symbol activation yet; full physical prompt required.',
    pecsPhase: 'II',
    functionalRepertoire: ['Requesting preferred items/activities', 'Protesting / refusing'],
    receptiveSingleStep: '60',
    receptiveTwoStep: '0',
    receptiveMultiStep: false,
    eyeContact: 'Limited',
    initiatesCommunication: 'Rarely',
    turnTaking: 'Absent',
    slpServices: true,
    slpFrequencyPerWeek: '2',
    slpFocus: 'PECS advancement, AAC introduction, functional communication',
  },
  self_stim: {
    notes: 'Object spinning: highest frequency — bottle caps, coins, lids. Can spin continuously 20-30 min. All settings. Mouthing: mouths clothing, toys, non-food objects. School chew necklace in place. Hand flapping: bilateral, during excitement and transitions. Rocking: front-to-back while seated, especially during screen time. Visual fixation: ceiling fans, moving lights, reflective surfaces. All behaviors high-frequency, cross-setting. OT eval: significant sensory seeking — proprioceptive and vestibular. No sensory diet currently in place at home.',
    completionState: 'partial',
  },
  medical_necessity: {
    notes: 'Dx: ASD Level 3 F84.0 — Dr. Robert Chen, Palm Beach Children\'s Hospital Developmental Peds, March 2024. No secondary diagnoses. No current medications. Pediatrician: Dr. Sarah Mills (last visit April 2026, scheduled follow-up September 2026). Emma requires full physical assistance or 1:1 prompting for virtually all ADLs. No functional communication. Daily SIB. Severe food restriction limiting nutritional variety and community participation. 1 peer aggression incident at school. IEP team discussing placement change for fall. Prior non-ABA interventions: SLP (ongoing), OT (ongoing) — insufficient to address behavioral and communication deficits. Recommended intensity: 30 hrs/week center-based + parent training.',
    transcript: "Mom: The diagnosis was March 2024. Dr. Robert Chen at Palm Beach Children's Hospital — he did the full evaluation, the ADOS and the adaptive testing. He diagnosed her with autism Level 3. Our pediatrician Dr. Mills has been recommending ABA since the diagnosis came back. We started with the SLP and OT first because those were already in place through the school. But after a full year of SLP and OT, she still has no functional communication and the behaviors have gotten worse. Dr. Mills made the referral herself. She said SLP and OT alone aren't enough for Emma's level of need and that ABA is the appropriate next level of care. We don't have her on any medications — Dr. Chen said he wants to try behavioral intervention first before considering anything else.",
    completionState: 'complete',
    coOccurringDiagnoses: [],
    medications: [],
    hasPriorABA: false,
    priorABAHistory: [],
    recommendedHoursPerWeek: '30',
    recommendedSetting: 'Center-based',
  },
  skill_acquisitions: {
    notes: 'Family priority targets: (1) Functional requesting — any modality (PECS, AAC, verbal approximation); (2) receptive labeling — objects and pictures; (3) gross motor imitation. School goals: matching identical objects, simple sorting by color/shape. Reinforcer assessment: light-up spinning toys, iPad (water/sensory videos), vanilla wafers, tickle play, vestibular (spinning in chair). Strong preference hierarchy identified. Attending: brief (1-2 min) with high-preference reinforcers. Accepts reinforcers from familiar adults. DTT naive at home; limited exposure at school. Imitation prerequisite: motor imitation emerging (copies large movements with physical prompt).',
    completionState: 'complete',
    skillGoals: [
      {
        id: 'eg1',
        domain: 'Communication',
        targetSkill: 'Functional Requesting (Mand Training)',
        operationalDefinition: 'Emma independently selects and exchanges a PECS card or activates an AAC symbol to request a preferred item or activity within 10 seconds of access opportunity, without physical prompt.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)', 'Natural Environment Teaching (NET)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Partial Physical', promptingLevelCombination: '',
        baselinePercent: '5', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Full physical / hand-over-hand required for all exchanges; 1 of 20 opportunities independent',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Home + school (minimum 2 settings)',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no physical or gestural prompt',
        stoPercent: '60', stoSkillDescription: 'PECS card exchange for 3 preferred items', stoWeeks: '12',
        stoSteps: [
          { id: 'eg1-s1', targetPercent: '20', skillDescription: 'PECS Phase I exchange with full physical prompt faded to partial', durationWeeks: '4' },
          { id: 'eg1-s2', targetPercent: '40', skillDescription: 'independent PECS exchange for 3 highly preferred items', durationWeeks: '4' },
          { id: 'eg1-s3', targetPercent: '60', skillDescription: 'PECS exchange across 5 items in 2 settings', durationWeeks: '4' },
        ],
        generalizationNotes: 'Across 3 communication partners, 2 settings, minimum 5 different preferred items. Priority probe contexts: item removal (Head Banging antecedent) and transition onset (Tantrum/Drop antecedent) — mastery of requesting "break" and "all done" in these exact contexts is the primary behavior-reduction mechanism for both behavior targets.',
      },
      {
        id: 'eg2',
        domain: 'Academic',
        targetSkill: 'Receptive Object Labeling',
        operationalDefinition: 'Emma selects the correct object or picture from an array of 3 when given the verbal label (e.g., "touch ball") within 5 seconds, without additional prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '20', baselineOpportunities: '30',
        baselinePromptingLevel: 'Gestural',
        baselinePromptingDesc: 'Gestural prompt to correct item required for ~80% of trials; selects correctly 20% independently',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Therapy table + natural environment',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no gestural or vocal prompt',
        stoPercent: '80', stoSkillDescription: 'labeling 10 common objects from an array of 3', stoWeeks: '16',
        stoSteps: [
          { id: 'eg2-s1', targetPercent: '40', skillDescription: 'selecting correct object from array of 3 for 5 target items', durationWeeks: '5' },
          { id: 'eg2-s2', targetPercent: '60', skillDescription: 'selecting correct object from array of 3 for 10 target items', durationWeeks: '5' },
        ],
        generalizationNotes: 'Probe with novel objects across categories (food, toys, clothing) and with 2 additional trainers',
      },
      {
        id: 'eg3',
        domain: 'Motor',
        targetSkill: 'Gross Motor Imitation',
        operationalDefinition: 'Emma imitates a gross motor action modeled by the therapist (e.g., clap hands, arms up, stomp feet) within 5 seconds of the verbal cue "do this," without additional prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)', 'Video Modeling'],
        teachingStrategiesOther: '',
        promptingLevel: 'Full Physical', promptingLevelCombination: '',
        baselinePercent: '15', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Full physical prompt required for most actions; 2-3 actions emerging with partial physical only',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Clinic + home',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — verbal cue only, no physical or gestural',
        stoPercent: '80', stoSkillDescription: 'imitating 5 gross motor actions with partial physical prompt only', stoWeeks: '10',
        stoSteps: [
          { id: 'eg3-s1', targetPercent: '30', skillDescription: 'imitating 3 gross motor actions with partial physical prompt', durationWeeks: '3' },
          { id: 'eg3-s2', targetPercent: '60', skillDescription: 'imitating 5 gross motor actions with gestural prompt only', durationWeeks: '4' },
        ],
        generalizationNotes: 'Generalize to novel motor actions across 2 therapists and in natural group play contexts',
      },
      {
        id: 'eg4',
        domain: 'Academic',
        targetSkill: 'Matching Identical Objects',
        operationalDefinition: 'Emma places an object onto its identical match from a field of 3 when instructed "match" within 5 seconds, without prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '30', baselineOpportunities: '20',
        baselinePromptingLevel: 'Gestural',
        baselinePromptingDesc: 'Gestural prompt to correct position required; selects correctly ~30% independently',
        masteryCriteriaPercent: '90', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Table — varied array sizes (3 to 5 items)',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent',
        stoPercent: '90', stoSkillDescription: 'matching identical objects in an array of 3', stoWeeks: '8',
        stoSteps: [
          { id: 'eg4-s1', targetPercent: '50', skillDescription: 'matching identical objects with gestural prompt in array of 3', durationWeeks: '3' },
          { id: 'eg4-s2', targetPercent: '75', skillDescription: 'matching identical objects independently in array of 3', durationWeeks: '3' },
        ],
        generalizationNotes: 'Generalize to non-identical pictures, then object-to-picture matching in varied locations',
      },
      {
        id: 'eg5',
        domain: 'Adaptive / Self-Help',
        targetSkill: 'Transition Tolerance (First-Then Compliance)',
        operationalDefinition: 'Emma transitions from a preferred activity to a non-preferred activity within 60 seconds of a transition cue (verbal + First-Then visual), without engaging in head banging or tantrum/drop behavior, when given a 1-minute countdown and a First-Then visual.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Natural Environment Teaching (NET)', 'Task Analysis / Chaining'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '10', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Transitions result in head banging or tantrum/drop approximately 90% of the time; successful transition requires full verbal + gestural + physical prompt chain',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'Home + school, with familiar and unfamiliar adults',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'First-Then visual cue only — no additional verbal or physical prompt',
        stoPercent: '60', stoSkillDescription: 'transitioning within 60 sec for 3 high-priority contexts', stoWeeks: '14',
        stoSteps: [
          { id: 'eg5-s1', targetPercent: '25', skillDescription: 'transitioning with verbal + gestural prompt for 2 high-priority contexts', durationWeeks: '4' },
          { id: 'eg5-s2', targetPercent: '50', skillDescription: 'transitioning with First-Then visual cue for 3 contexts without SIB', durationWeeks: '5' },
        ],
        generalizationNotes: 'Priority transition probes: iPad → meal, play → departure, preferred toy → bath. Reduction in Tantrum/Drop and Head Banging behavior targets during transition periods serves as direct generalization measure. Coordinate with OT re: proprioceptive heavy work prior to high-risk transitions to reduce sensory-automatic component of SIB.',
      },
    ],
  },
  behavior_targets: {
    notes: 'Target 1: Head banging (SIB). Topography: forceful head-to-surface contact. Frequency: 4-8x/day. Duration: brief (<10 sec/episode). Ant: item removal, activity transitions, demand presentation, waiting. Function: automatic (sensory) + escape (demand). No prior BIP. Target 2: Tantrum/drop (transition-related). Topography: crying, screaming, going limp on floor, refusing to move. Frequency: 3-5x/day. Duration: 5-20 min. Ant: leaving preferred activity, departure cues. Function: escape from transition demands + access to preferred. Family responses: ignore, redirection, offering preferred item — inconsistent outcomes. No formal FBA completed.',
    transcript: "The head banging is our biggest fear. It's when she doesn't want to stop doing something or when we're asking her to do something she doesn't want to do. Lately it's also happening at what feels like random times and we're not always sure what caused it. The dropping — that's when we need to go somewhere, she just goes limp and won't walk. If we try to pick her up during that it makes everything worse.",
    completionState: 'complete',
    behaviorTargets: [
      {
        id: 'bt-emma-1',
        behaviorName: 'Head Banging (SIB)',
        operationalDefinition: 'Emma forcefully contacts her head against a hard surface (floor, wall, table) with sufficient force to produce an audible sound. Each contact counts as one instance.',
        topography: ['Head banging'],
        frequencyPerDay: '6', frequencyUnit: 'day',
        durationSeconds: '8', durationUnit: 'seconds',
        intensityRating: 'Severe',
        antecedents: 'Item or activity removal, activity transitions, demand presentation, unstructured waiting periods',
        primaryTargets: ['Self'],
        hypothesizedFunction: 'Automatic',
        baselineFrequency: '6',
        targetFrequency: '1',
        measurementSystem: 'Event Recording',
        priorFBACompleted: false,
        priorBIPCompleted: false,
        notes: 'FCT replacement: Functional Requesting (Mand Training) — teaching Emma to exchange a PECS card or activate Proloquo2Go to request a preferred item or "break" eliminates the communicative escape function driving this SIB. See Skill Acquisitions: "Functional Requesting (Mand Training)." Automatic/sensory component will be addressed in parallel via sensory diet (OT) and competing preferred stimulation. Family must honor the mand BEFORE SIB occurs to build the replacement behavior; demand removal following SIB should be avoided.',
        stoSteps: [
          { id: 'bts-emma-1-1', targetFrequency: '4', durationWeeks: '4', note: 'Reduce to ≤4 incidents/day with FCT prompting in place' },
          { id: 'bts-emma-1-2', targetFrequency: '3', durationWeeks: '4', note: 'Reduce to ≤3 incidents/day; begin fading FCT prompts' },
          { id: 'bts-emma-1-3', targetFrequency: '1', durationWeeks: '8', note: 'Reduce to ≤1 incident/day; FCT response independent across settings' },
        ],
      },
      {
        id: 'bt-emma-2',
        behaviorName: 'Tantrum / Drop',
        operationalDefinition: 'Emma cries, screams, and goes limp on the floor, refusing to walk or follow direction. Behavior is considered to begin when Emma drops to the floor and ends when she stands and resumes movement independently.',
        topography: ['Crying/screaming', 'Drop/go limp', 'Refusal to move'],
        frequencyPerDay: '4', frequencyUnit: 'day',
        durationSeconds: '10', durationUnit: 'minutes',
        intensityRating: 'Moderate',
        antecedents: 'Departure cues (shoes, jacket, bag), leaving a preferred activity, caregiver verbal instruction to transition',
        primaryTargets: ['Parent'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '4',
        targetFrequency: '1',
        measurementSystem: 'Duration Recording',
        priorFBACompleted: false,
        priorBIPCompleted: false,
        notes: 'Two-pronged skills approach: (1) Functional Requesting (Mand Training) teaches Emma to request a break or "all done" via PECS/AAC before dropping — directly replaces the escape function. (2) Transition Tolerance (First-Then Compliance) skill goal builds gradual tolerance for high-frequency transitions (iPad → meal, play → departure) using visual First-Then cues and countdown timers. Family must stop offering preferred items during tantrum/drop episodes as this reinforces both escape and access functions simultaneously.',
        stoSteps: [
          { id: 'bts-emma-2-1', targetFrequency: '3', durationWeeks: '6', note: 'Reduce to ≤3 tantrums/day using visual First-Then board with transitions' },
          { id: 'bts-emma-2-2', targetFrequency: '1', durationWeeks: '8', note: 'Reduce to ≤1 tantrum/day; FCT "all done" card independent across transitions' },
        ],
      },
    ],
  },
  crisis_plan: {
    notes: 'No prior crisis events, hospitalizations, or law enforcement involvement. Suicidal ideation cannot be directly assessed given communication level — monitor behavioral indicators closely. Communication level precludes verbal expression of distress. Deep pressure (firm hug) effective ~60% per mom report — must be offered, not imposed. Return to baseline: 10–20 min. No medical contraindications. Caregiver has reviewed and signed crisis plan.',
    transcript: "Mom: When she's heading toward a real meltdown there are signs — she starts rocking faster and the flapping gets more intense. And then the crying starts. We take everything away, dim the lights if we can, and we just wait. If she lets us, a firm hug helps. But if we try to block her or talk too much, it's worse. It's never gotten to a point where we needed to call anyone. Dad: She usually calms down within 10 or 15 minutes if we give her space. Then she kind of collapses and wants to cuddle. That's how we know it's over.",
    completionState: 'complete',
    emergencyContacts: [
      { id: 'ec-e1', name: 'Linda Thompson', relationship: 'Mother', phone: '(561) 555-0167', role: 'Primary' },
      { id: 'ec-e2', name: 'David Thompson', relationship: 'Father', phone: '(561) 555-0168', role: 'Backup' },
      { id: 'ec-e3', name: 'Dr. Sarah Mills', relationship: 'Pediatrician', phone: '(561) 555-0200', role: 'Medical' },
    ],
    warningSignsSelected: [
      'Rocking speed increase',
      'Bilateral hand flapping (intensified)',
      'Elevated vocal volume',
      'Crying onset',
    ],
    warningSignsCustom: 'Sustained whining that escalates in pitch; repeated hand-leading toward door (elopement attempt precursor).',
    deEscalationWorks: [
      'Remove all demands',
      'Dim lights',
      'Wait quietly — no talking',
      'Deep pressure / firm hug',
      'Offer chew / fidget tool',
    ],
    deEscalationWorsens: [
      'Physical blocking or restraint',
      'Multiple verbal prompts in sequence',
      'Removing preferred items',
      'Raised voice / urgent tone',
    ],
    deEscalationNotes: 'Deep pressure (firm squeeze hug) is effective approximately 60% of the time per parent report — must be offered, never imposed. Mom is more effective than dad at initiating. Offer chew necklace before meltdown escalates to SIB window.',
    bcbaCallMinutes: '5',
    bcbaCallIncidents: '3',
    bcbaCallWindow: '20',
    call911Threshold: true,
    call911Notes: 'Any SIB resulting in visible bleeding or injury requiring medical attention. Loss of consciousness of any duration.',
    sessionSuspendThreshold: false,
    baselineReturnMin: '10',
    baselineReturnMax: '20',
    postCrisisDebrief: true,
    remorsePresentPostCrisis: false,
    medicalContraindications: ['No physical blocking', 'No physical restraint of any kind'],
    medicalNotes: 'No current medications. No allergies. Seizure history negative. Deep pressure can be used as de-escalation tool with caregiver guidance.',
    caregiverSignedCrisisPlan: true,
    rbtTrainedOnPlan: false,
    crisisPlanInBsp: true,
  },
  caregiver_training: {
    completionState: 'complete',
    caregiverBaselines: { premack_baseline: '15', reinforcement_baseline: '20' },
    trainingFormat: ['In-session coaching', 'Parent sessions', 'Written guides'],
    trainingFrequency: '2x/week',
    trainingBarriers: 'Emma requires constant supervision, limiting Linda\'s availability for focused training. David works full-time and is available evenings only.',
    caregiverStrengths: 'Linda is highly motivated and already uses a visual schedule daily. Both parents are consistent with each other and receptive to feedback.',
    caregiverTrainingTargets: makeStandardCaregiverTargets(
      { premack: 15, reinforcement: 20 },
      'c4',
      {
        premack: [
          { id: 'cgt-premack-c4-1', targetPercent: '40', durationWeeks: '6', note: 'BCBA-guided practice with visual First-Then board during session' },
          { id: 'cgt-premack-c4-2', targetPercent: '65', durationWeeks: '8', note: 'Independent delivery across home routines with weekly coaching check-in' },
        ],
        reinforcement: [
          { id: 'cgt-reinf-c4-1', targetPercent: '45', durationWeeks: '4', note: 'Within-3-second delivery during structured discrete trial practice' },
          { id: 'cgt-reinf-c4-2', targetPercent: '70', durationWeeks: '4', note: 'Generalized across routines; specificity of praise maintained' },
        ],
      },
      {
        premack:      { ltoPercent: 85, ltoSessions: 3 },
        reinforcement: { ltoPercent: 85, ltoSessions: 3 },
      },
    ),
    notes: 'Linda Thompson is primary implementer — highly motivated, uses visual schedule daily. David available evenings and weekends. Focus: Premack principle delivery consistency and reinforcement timing/magnitude. Competency benchmark: 85% correct unprompted use across 3 consecutive observed sessions.',
  },
};

// ── Marcus Rivera mock data ──────────────────────────────────────────────────

const MARCUS_INTERVIEW_DATA = {
  demographics: {
    notes: 'Marcus Rivera, DOB 03/04/2017 (age 9). Dx: ASD Level 2 F84.0 + ADHD Combined F90.2 + GAD F41.1 (Dr. Elena Vargas Psy.D., Jan 2024 — ADOS-2 Module 3, ADI-R, Vineland-3). Insurance: Florida Blue FLB-774421 / G-12390; Medicaid secondary FL-MCD-88221. Lives with parents Daniela + Javier Rivera + sister Sofia (age 6, NT). Spanish spoken by maternal grandparents (afterschool care 3x/week). School: Sunset Elementary, Miami-Dade, 3rd grade — IEP (re-eval Feb 2025), 1:1 aide full-day, SLP 30 min/week, OT 60 min/week. Prior ABA: Sunshine Behavioral Health Oct 2022–Jun 2023, 15 hr/week center (discontinued on relocation). Meds: Guanfacine ER 1mg QD (Dr. Adriana Costa).',
    completionState: 'complete',
  },
  presenting_concerns: {
    notes: 'Family top 3 concerns: (1) Physical aggression toward mom + sister — 3-7 incidents/day, includes hitting, object throwing, and 2 biting incidents past 60 days. Onset worsened Oct 2025 when school paraprofessional reassigned. (2) Regression in bathing — independent at age 7, now refuses completely. 45-60 min standoffs at bathroom door daily. (3) Severe community anxiety — family has avoided restaurants, grocery stores, extended family events for ~4 months. School: 2 documented peer aggression incidents, 1 in-school suspension. IEP team considering placement review.',
    transcript: "Mom: It escalated a lot around October last year when his aide changed at school. That seemed to really destabilize him. And then the hitting at home went from occasional to every single day. He bit me hard enough to leave bruises — twice. And I can't get him in the bath at all now. He used to do it by himself. Something shifted. We've basically stopped going out as a family because I genuinely can't predict what will happen in a store or a restaurant. Dad: At school they've documented two incidents with other kids hitting and he got suspended once. We're worried about his placement.",
    completionState: 'complete',
  },
  self_help: {
    notes: 'Toileting: fully independent, no concerns. Dressing: independent for pullover tops and elastic-waist bottoms. Buttons/snaps require prompting and frequently refused. Shoelaces not mastered — Velcro/slip-on exclusively. Tolerates tooth brushing with verbal prompt. Refuses flossing. Hair combing with minimal prompt. Face washing: ~50% mornings. Bathing: significant regression — was independent at age 7, now refuses bathing entirely. 45-60 min standoffs. Sponge bath used as temporary accommodation. Tactile sensitivity: tagless shirts required, refuses jeans/stiff fabric, limiting wardrobe. Feeding: 12-14 accepted foods — all smooth/mild texture or familiar brand. Chicken nuggets (specific brand), plain pasta, white rice, peeled apple slices, graham crackers, yogurt pouches. No vegetables accepted. OT feeding eval Jan 2025: sensory-based avoidance + conditioned aversion component.',
    completionState: 'partial',
  },
  daily_living: {
    notes: 'Morning routine: visual schedule in use (laminated, bedroom wall) — works ~80% when preferred parent present, drops to ~40% when that parent unavailable. Routine currently 55-70 min; family goal is 30 min. Bedtime: ~90% adherence when started by 8pm. Delayed start results in behavioral escalation. Sleep: no difficulties once routine initiated. Chores: none completed independently. Can carry plate to sink with prompt. Community outings: largely suspended past 4 months (see Presenting Concerns). Prior to regression: managed familiar settings (library, playground, family restaurant). Street safety intact — responds appropriately to crossing cues. Personal safety info: knows full name, home address, caregiver phone numbers. Leisure: LEGO (advanced instruction builds, up to 45 min independent), YouTube (trains/science), backyard trampoline. Screen time: 4-6 hrs/day weekends, unregulated.',
    completionState: 'partial',
  },
  safety: {
    notes: 'Elopement: no history. Pool: above-ground backyard pool, locked gate, supervised only — no unsupervised access reported. SIB: self-hitting (hand to head/face) during severe escalation, 3-5x/week, brief (<30 sec), no medical attention required. Part of escalation sequence. Aggression (PRIMARY CONCERN): open-hand hitting (70% of incidents), object throwing (1-2x/week), biting (2 incidents past 60 days). Targets: mom 60%, sister 30%, school peers (2 documented). No injuries requiring medical care. Visible bruising on mom from biting. No law enforcement. Property destruction: minimal — occasional surface sweep of small items, no sustained destruction. Home: structured, safe, appropriate for ABA delivery.',
    transcript: "He has never tried to run away. The main safety concern in the home is the hitting and the biting. The two biting incidents — he bit me hard enough to leave bruises that lasted almost a week. Both times I had tried to physically redirect him during a severe meltdown, which I now know makes it worse. He's never injured his sister badly but she's frightened of him and avoids him. We have a pool in the backyard but the gate is always locked and he's never tried to go near it unsupervised. No law enforcement, no hospitalizations — nothing like that.",
    completionState: 'complete',
    riskLevel: 'High',
    sibPresent: true,
    sibTopography: ['Face slapping'],
    sibFrequency: '2',
    sibInjuryHistory: false,
    sibInjuryNotes: 'Self-hitting (hand to head/face) occurs during peak escalation, 3-5x/week, episodes brief (<30 sec). No medical attention required. Part of escalation sequence, not a standalone behavior.',
    aggressionPresent: true,
    aggressionTopography: ['Open-hand hitting', 'Biting', 'Object throwing'],
    aggressionTargets: ['Parent / Caregiver', 'Sibling', 'Peers'],
    aggressionFrequency: '5',
    aggressionInjuryHistory: true,
    aggressionInjuryNotes: '2 biting incidents in past 60 days — both directed at mom during physical redirection. Bruising documented lasting ~1 week. 2 school incidents involving peer hitting (1 in-school suspension). No ER visits or medical treatment required.',
    elopementPresent: false,
    propertyDestructionPresent: true,
    propertyDestructionNotes: 'Occasional surface sweep of small items during escalation. No sustained or targeted destruction. No significant property damage reported.',
    envSafety: [
      'Pool / water body secured or no access',
      'Firearms secured or not present',
      'Medications stored out of reach',
    ],
    lawEnforcementInvolvement: false,
    hospitalizationHistory: false,
  },
  communication: {
    notes: 'Verbal — MLU 6-8 words familiar context, shorter under stress. Intelligibility ~90% familiar, 60-70% upset. Uses language to request, protest, comment (trains/science topics), factual questions. Critical gap: does not use language to express internal emotional states, negotiate, or ask for help before escalating. Delayed echolalia (YouTube quotes) during unstructured time/anxiety — regulatory function; immediate echolalia not present. Receptive: multi-step in familiar contexts; drops significantly in novel/anxious settings. Consistent name response with familiar adults. Yes/no reliable. Multi-person instructions inconsistent with strangers. Pragmatics: initiates with adults on preferred topics; peer initiation limited (factual sharing only). Turn-taking 3-4 exchanges preferred topic. Non-literal language (sarcasm, idioms) not understood. Current SLP: Ms. Daniela Cruz (30 min/week, pragmatics and social communication).',
    transcript: "Mom: He talks — a lot actually, when it's about trains or something he's interested in. Full sentences, back and forth, very clear. But the moment something frustrates him or something goes wrong, the language disappears. He doesn't say 'I'm upset' or 'I need help' — he just explodes. It's like the words aren't available to him anymore in those moments. Dad: He can follow instructions when things are calm and he's in a good place. But when he's anxious or we're in a new place, he goes blank — he won't respond even to his name sometimes. Mom: The SLP says he needs to learn to use language to self-advocate in those hard moments, but it's only 30 minutes a week and we can't figure out how to practice it at home without it turning into a fight.",
    completionState: 'complete',
    primaryCommunicationModes: ['Verbal'],
    mluWords: '7',
    intelligibilityFamiliar: '90',
    intelligibilityUnfamiliar: '65',
    functionalRepertoire: [
      'Requesting preferred items/activities',
      'Protesting / refusing',
      'Commenting / sharing information',
      'Greeting familiar people',
      'Answering yes/no questions',
      'Labeling objects/actions',
    ],
    receptiveSingleStep: '90',
    receptiveTwoStep: '70',
    receptiveMultiStep: false,
    eyeContact: 'Variable',
    initiatesCommunication: 'Sometimes',
    turnTaking: 'Present',
    slpServices: true,
    slpFrequencyPerWeek: '1',
    slpFocus: 'Pragmatics and social communication',
  },
  self_stim: {
    notes: 'Hand flapping: highest frequency — 20-30 episodes/day, excitement/anticipation/transitions. Episodes 5-30 sec. Stigmatizing at school — peer teasing reported. Rocking while seated: during tasks and screen time, occasionally disrupts attention. Verbal scripting (delayed echolalia): YouTube content during unstructured time/anxiety; extended periods reported as distressing to family. Repetitive reading of train timetables/maps — regulatory/calming function. Sensory profile: hyperreactivity to unexpected sounds (hand dryers, fire alarms, crowds), tactile defensiveness specific fabrics, mild visual sensitivity to fluorescent environments (school cafeteria). OT eval Jan 2025: sensory modulation difficulties, mixed hyper/hyposensitivity. Proprioceptive seeking also noted. Accommodations: noise-canceling headphones, weighted lap pad, fidget tools at school.',
    completionState: 'partial',
  },
  medical_necessity: {
    notes: 'Dx: ASD Level 2 F84.0, ADOS-2 Module 3 + ADI-R + Vineland-3 (Dr. Vargas, Jan 2024). Co-occurring: ADHD Combined F90.2 + GAD F41.1 (Dr. Costa, March 2025). Meds: Guanfacine ER 1mg QD — no acute behavioral effects. No seizures, cardiac conditions, or treatment contraindications. Daily aggression threatening caregiver and sibling safety. ADL regression (bathing) is clinically significant — previously mastered skill lost. Severe food restriction limiting nutritional variety and community participation. Morning routine failures causing school tardiness. School aggression — potential restrictive placement change. Prior ABA: beneficial per caregiver, regression followed discontinuation — supports reauthorization rationale. Without ABA: worsening trajectory, school placement at risk, community participation eliminated. Recommend: 20-25 hrs/week given severity, functioning, prior partial response, and family engagement.',
    transcript: "Mom: He was diagnosed in January 2024 by Dr. Vargas — she did the full psychological evaluation. Then about a year later, Dr. Costa added the ADHD and anxiety diagnoses. He's been on Guanfacine since March for the ADHD and attention — it takes the edge off a little but we haven't seen a big change in the aggression. He did ABA before, from late 2022 to mid-2023 at Sunshine Behavioral. It was working. He was calmer, the behaviors were less frequent, we had strategies. And then we relocated and had to stop. Within a few months he regressed back to where he was before and then kept getting worse. That regression is the thing that makes us feel like ABA is absolutely necessary. Dr. Costa and Dr. Vargas both wrote letters of support for this referral. Dad: Without this we are genuinely worried about whether we can keep our family safe.",
    completionState: 'complete',
    approvalState: 'approved',
    draftContent: `## Medical Necessity

### Diagnostic Support

Primary diagnosis of Autism Spectrum Disorder, Level 2 (DSM-5, F84.0) confirmed by Dr. Elena Vargas, Psy.D., at Children's Neuropsychology Associates on January 12, 2024. Diagnostic instruments included the ADOS-2 (Module 3), ADI-R, and Vineland-3 Adaptive Behavior Scales. Full neuropsychological report on file. Co-occurring diagnoses: ADHD, Combined Presentation (F90.2) and Generalized Anxiety Disorder (F41.1), both confirmed by Dr. Adriana Costa, M.D., on March 10, 2025.

Current medications: Guanfacine ER 1mg QD (Dr. Adriana Costa, for attention and impulse control). No psychotropic medications for anxiety currently prescribed. No seizure disorder, cardiac conditions, or other medical contraindications to behavioral intervention.

### Functional Impact

The constellation of behavioral excesses and adaptive skill deficits significantly impairs functioning across home, school, and community settings. At home, daily physical aggression — occurring 3–7 times per day including biting with documented bruising — threatens caregiver and sibling safety and has created a household environment the family describes as untenable without structured support. The near-complete regression in independent bathing (a skill mastered at age 7) represents clinically significant adaptive skill loss requiring direct ABA programming. Morning routine breakdowns average 55–70 minutes and have resulted in repeated school tardiness. Severe food selectivity (12–14 accepted foods) limits nutritional variety and community participation.

At school, documented peer aggression has resulted in disciplinary action, 1:1 paraprofessional support, and IEP team review of placement appropriateness. Without ABA intervention, the trajectory indicates continued behavioral escalation, risk of more restrictive school placement, and elimination of community participation.

### Clinical Justification

Applied Behavior Analysis is clinically justified as the appropriate level of care, meeting Florida Blue and Florida Medicaid medical necessity criteria on the following grounds: **(1)** Primary diagnosis of ASD Level 2 (F84.0) confirmed via ADOS-2, ADI-R, and Vineland-3, requiring substantial support across multiple domains; **(2)** co-occurring ADHD Combined (F90.2) and GAD (F41.1) contributing to a complex behavioral profile; **(3)** daily physical aggression including biting with documented bruising, meeting clinical severity threshold; **(4)** clinically significant regression in a previously mastered adaptive skill (independent bathing); **(5)** functional impairment across home, school, and community sufficient to require full-day 1:1 paraprofessional support and has led the family to eliminate all community participation.

Prior ABA services (Sunshine Behavioral Health, Oct 2022–Jun 2023, 15 hrs/week) demonstrated measurable benefit per caregiver report; regression following discontinuation directly supports medical necessity. Letters of support from both Dr. Adriana Costa and Dr. Elena Vargas are on file.

**Recommended intensity:** 20–25 hours/week, center-based with home component, consistent with severity, current functioning, prior partial response, and family engagement. Expected outcomes for the 6-month authorization period include reduction of Physical Aggression from 5/day to ≤1/day; Bathing Refusal duration reduction from 45–60 min to ≤5 min; mastery of Functional Help-Seeking at 80% independent across home and school; and re-establishment of community participation in at least two familiar settings.`,
    coOccurringDiagnoses: [
      { id: 'dx-m1', diagnosis: 'ADHD Combined Type', icd10: 'F90.2', provider: 'Dr. Elena Vargas, Psy.D.', date: 'Jan 2024' },
      { id: 'dx-m2', diagnosis: 'Generalized Anxiety Disorder', icd10: 'F41.1', provider: 'Dr. Adriana Costa', date: 'Mar 2025' },
    ],
    medications: [
      { id: 'med-m1', name: 'Guanfacine ER', dose: '1mg', frequency: 'QD (morning)', prescriber: 'Dr. Adriana Costa', purpose: 'ADHD / attention regulation' },
    ],
    hasPriorABA: true,
    priorABAHistory: [
      { id: 'aba-m1', provider: 'Sunshine Behavioral Health', startDate: 'Oct 2022', endDate: 'Jun 2023', hoursPerWeek: '15', setting: 'Center-based', reasonDiscontinued: 'Family relocation' },
    ],
    recommendedHoursPerWeek: '22',
    recommendedSetting: 'Center-based',
  },
  skill_acquisitions: {
    notes: 'Family priority targets: (1) Functional help-seeking and break-requesting verbally before escalating — critical safety target; (2) morning routine independence, full 8-step within 30 min; (3) peer interaction initiation at school. Academic: 3rd grade content, difficulty with multi-step word problems and written expression. Attention 15-20 min with 1:1 support. Social: no peer friendships. Parallel play in structured settings. No spontaneous peer initiation. Joint attention present but limited. Theory of mind emerging, inconsistent. No social skills group history. Imitation: action imitation strong, vocal imitation moderate. Reinforcers identified: LEGO sets (specific), YouTube access (trains/science), chips/crunchy snacks, trampoline time, computer time.',
    completionState: 'complete',
    approvalState: 'approved',
    skillGoals: [
      {
        id: 'mg1',
        domain: 'Communication',
        targetSkill: 'Functional Help-Seeking (Verbal Request)',
        operationalDefinition: 'Marcus independently vocalizes a contextually appropriate help-seeking statement ("I need help," "Can you help me?", or "I don\'t know how to do this") within 10 seconds of encountering a task difficulty or blocked access, without adult prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)', 'Natural Environment Teaching (NET)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Verbal', promptingLevelCombination: '',
        baselinePercent: '5', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Full verbal model required; unprompted help-seeking absent across all probe settings — Marcus escalates to aggression instead',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Home + school + at least 1 community setting',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no verbal or gestural prompt',
        stoPercent: '80', stoSkillDescription: 'unprompted help-seeking across 3 task types at home', stoWeeks: '10',
        stoSteps: [
          { id: 'mg1-s1', targetPercent: '25', skillDescription: 'vocalizing "help" with verbal model faded to gestural prompt', durationWeeks: '4' },
          { id: 'mg1-s2', targetPercent: '50', skillDescription: 'unprompted help-seeking across 2 task types at home', durationWeeks: '4' },
        ],
        generalizationNotes: 'Generalize across caregivers, RBT, teacher, and paraprofessional. Probe across task types: academic, self-care, play, and blocked access. Priority probe antecedents match the Physical Aggression behavior target: ending preferred activity (tablet, LEGO), grooming demands, sibling disruption, post-school transitions. Reduction in Physical Aggression frequency serves as the primary real-world measure of skill generalization.',
      },
      {
        id: 'mg2',
        domain: 'Adaptive / Self-Help',
        targetSkill: 'Morning Routine Completion (Independent Sequencing)',
        operationalDefinition: 'Marcus completes all 8 steps of the morning routine in correct sequence within 30 minutes using a visual schedule independently, with no more than 1 verbal prompt total per routine.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Task Analysis / Chaining', 'Discrete Trial Training (DTT)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Verbal', promptingLevelCombination: '',
        baselinePercent: '38', baselineOpportunities: '8',
        baselinePromptingLevel: 'Verbal',
        baselinePromptingDesc: 'Completes 3 of 8 steps independently with primary caregiver; 4-6 verbal prompts required; routine averages 55-70 minutes',
        masteryCriteriaPercent: '100', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'Home — must meet criterion with both parents as routine leader',
        masteryCriteriaPromptingLevel: 'Verbal',
        masteryCriteriaPrompting: 'Independent (no more than 1 total verbal prompt per routine)',
        stoPercent: '100', stoSkillDescription: '6 of 8 routine steps independently within 45 min', stoWeeks: '12',
        stoSteps: [
          { id: 'mg2-s1', targetPercent: '50', skillDescription: '4 of 8 routine steps independently using visual schedule', durationWeeks: '4' },
          { id: 'mg2-s2', targetPercent: '75', skillDescription: '6 of 8 routine steps independently within 45 min', durationWeeks: '4' },
        ],
        generalizationNotes: 'The 8 routine steps include: (1) wake up/out of bed, (2) toilet, (3) brush teeth, (4) wash face, (5) bathing — highest resistance step, addressed concurrently via Bathing/Grooming Desensitization skill goal, (6) get dressed, (7) breakfast, (8) backpack ready. Probe weekend routine. Address holiday/schedule-change disruption with advance visual priming. Fade laminated schedule to checklist, then internalized. Full routine completion with bathing included (not sponge bath accommodation) is the mastery criterion.',
      },
      {
        id: 'mg3',
        domain: 'Social',
        targetSkill: 'Peer Interaction Initiation (School Setting)',
        operationalDefinition: 'Marcus independently initiates a non-scripted, contextually appropriate social interaction with a same-age peer (e.g., commenting on shared activity, requesting to join a game, offering a compliment) at least 2 times per 30-minute structured social opportunity, without adult prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Social Stories', 'Video Modeling', 'Peer-Mediated Instruction', 'Natural Environment Teaching (NET)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '0', baselineOpportunities: '10',
        baselinePromptingLevel: 'Gestural',
        baselinePromptingDesc: 'Zero unprompted peer initiations observed across 3 observation sessions; all peer contact is reactive, not initiated',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'School recess + classroom cooperative tasks',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no verbal or gestural prompt',
        stoPercent: '80', stoSkillDescription: '1 unprompted peer initiation per session in structured setting', stoWeeks: '16',
        stoSteps: [
          { id: 'mg3-s1', targetPercent: '30', skillDescription: '1 prompted peer initiation per session using video model', durationWeeks: '5' },
          { id: 'mg3-s2', targetPercent: '55', skillDescription: '1 unprompted peer initiation per session in structured classroom activity', durationWeeks: '5' },
        ],
        generalizationNotes: 'Community generalization (playground, library events) after school mastery achieved. Family-arranged structured playdates as natural environment probe.',
      },
      {
        id: 'mg4',
        domain: 'Adaptive / Self-Help',
        targetSkill: 'Bathing / Grooming Desensitization',
        operationalDefinition: 'Marcus completes the full bathing sequence (enter bathroom, undress, enter shower/tub, tolerate water contact for minimum 5 minutes, wash hair with shampoo, rinse, exit, dry) without verbal refusal, physical resistance, or dropping, when provided with a visual step sequence and a 2-minute advance warning.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Task Analysis / Chaining', 'Natural Environment Teaching (NET)'],
        teachingStrategiesOther: 'Systematic desensitization with gradual water exposure hierarchy',
        promptingLevel: 'Verbal', promptingLevelCombination: '',
        baselinePercent: '0', baselineOpportunities: '7',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Zero independent bathing completions in past 7 days; 45-60 min refusal episode every evening; sponge bath used as accommodation. Was independent at age 7.',
        masteryCriteriaPercent: '100', masteryCriteriaSessions: '10',
        masteryCriteriaSettings: 'Home — both parents as routine leader across consecutive evenings',
        masteryCriteriaPromptingLevel: 'Verbal',
        masteryCriteriaPrompting: 'Visual step sequence + 2-minute advance warning only; no additional verbal or physical prompt',
        stoPercent: '100', stoSkillDescription: 'tolerating water contact for 3 min without refusal or dropping', stoWeeks: '10',
        stoSteps: [
          { id: 'mg4-s1', targetPercent: '30', skillDescription: 'entering bathroom and tolerating water contact on hands for 1 min without refusal', durationWeeks: '4' },
          { id: 'mg4-s2', targetPercent: '60', skillDescription: 'completing shower entry and toleration steps with ≤2 prompts', durationWeeks: '4' },
          { id: 'mg4-s3', targetPercent: '80', skillDescription: 'completing full bathing sequence with visual schedule and ≤1 prompt', durationWeeks: '4' },
        ],
        generalizationNotes: 'Coordinate with OT re: sensory desensitization hierarchy for water temperature (warm preferred) and hair washing (handheld showerhead, no direct overhead spray). Embed bathing as Step 5 of Morning Routine Completion goal sequence once achieved independently in evening context. Reduction in Bathing Refusal behavior target (currently 45-60 min/night) is the direct clinical outcome measure. Marcus may use Functional Help-Seeking ("I need a minute") during steps — honor immediately to build trust and prevent escalation.',
      },
    ],
  },
  behavior_targets: {
    notes: 'Target 1: Physical Aggression. Topography: open-hand hitting 70%, object throwing ~1-2x/week, biting 2 incidents/60 days. Frequency: 3-7x/day. Targets: mom 60%, sister 30%, school peers 2 documented. Ant: ending preferred activity (tablet/LEGO), grooming demands, sibling disruption of preferred activity, schedule change. Highest occurrence: weekday post-school decompression period. Function: escape (primary) — demand consistently removed post-aggression. Attention secondary for sibling incidents. Target 2: Bathing refusal. Topography: verbal refusal, physical resistance at bathroom doorway, dropping/going limp, crying/screaming. Duration: 45-60 min. Daily. Ant: verbal cue that bath time is starting. Function: escape sensory-aversive grooming task. No prior FBA. No BIP in place.',
    transcript: "Post-school is the highest risk time. He gets off the bus, he's done, and if anyone asks anything of him or his sister interrupts his LEGO it escalates fast. I've learned to give transition warnings but it doesn't always work. The biting — that was only me, only during really severe meltdowns when I tried to physically intervene. Both times I was left with bruises that lasted almost a week. I feel like I've started to be afraid of my own child and that feeling is really hard to sit with. The bath is every single night. He stands outside the bathroom door and we go back and forth sometimes for an hour.",
    completionState: 'complete',
    approvalState: 'approved',
    behaviorTargets: [
      {
        id: 'bt-marcus-1',
        behaviorName: 'Physical Aggression',
        operationalDefinition: 'Marcus makes forceful physical contact with another person or throws an object in the direction of a person. Includes open-hand hitting, biting (skin contact with teeth), and object throwing within 3 feet of a person. Each discrete contact or throw counts as one instance.',
        topography: ['Open-hand hitting', 'Biting', 'Object throwing'],
        frequencyPerDay: '5', frequencyUnit: 'day',
        durationSeconds: '10', durationUnit: 'seconds',
        intensityRating: 'Severe',
        antecedents: 'Ending preferred activity (tablet, LEGO), grooming demands, sibling disruption of preferred activity, schedule change, post-school transitions',
        primaryTargets: ['Parent', 'Sibling', 'Peers'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '5',
        targetFrequency: '0',
        measurementSystem: 'Event Recording',
        priorFBACompleted: false,
        priorBIPCompleted: false,
        notes: 'FCT replacement: Functional Help-Seeking (Verbal Request) — Marcus learns to vocalize "I need help," "I need a break," or "I need a minute" BEFORE escalating to physical contact. Treatment plan pairs FCT skill acquisition (see Skill Acquisitions: "Functional Help-Seeking") with extinction of aggression + DRA reinforcing verbal requests. Attention-maintained sibling-directed incidents addressed via differential reinforcement of sibling proximity tolerance. CRITICAL caregiver guidance: do NOT remove the demand following aggression — prompt the verbal help-seeking response instead and immediately honor it. 2 biting incidents in past 60 days involved mom during physical intervention; avoid restraint during peak escalation.',
        stoSteps: [
          { id: 'bts-marcus-1-1', targetFrequency: '3', durationWeeks: '4', note: 'Reduce to ≤3 incidents/day; FCT verbal request prompted before demands' },
          { id: 'bts-marcus-1-2', targetFrequency: '1', durationWeeks: '4', note: 'Reduce to ≤1 incident/day; FCT response independently initiated' },
          { id: 'bts-marcus-1-3', targetFrequency: '0', durationWeeks: '8', note: 'Zero incidents for 3 consecutive weeks across home and community settings' },
        ],
      },
      {
        id: 'bt-marcus-2',
        behaviorName: 'Bathing Refusal',
        operationalDefinition: 'Marcus verbally refuses, physically resists at the bathroom doorway, drops to the floor, or cries/screams in response to a bathing cue. Episode begins at the first verbal refusal or physical resistance and ends when Marcus enters the bathroom and begins the bathing routine without further protest.',
        topography: ['Verbal refusal', 'Drop/go limp', 'Crying/screaming', 'Physical resistance'],
        frequencyPerDay: '1', frequencyUnit: 'day',
        durationSeconds: '50', durationUnit: 'minutes',
        intensityRating: 'Moderate',
        antecedents: 'Verbal cue that bath time is starting, proximity to bathroom, visual cue (towel, caregiver movement toward bathroom)',
        primaryTargets: ['Parent'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '1',
        targetFrequency: '0',
        measurementSystem: 'Duration Recording',
        priorFBACompleted: false,
        priorBIPCompleted: false,
        notes: 'Skill-based dual approach: (1) Morning Routine Completion goal (see Skill Acquisitions) includes bathing as Step 5 of the 8-step visual schedule — systematic desensitization embedded within the routine using backward chaining (enter bathroom → water-only contact → partial bath → full routine). (2) Bathing/Grooming Desensitization skill goal targets sensory tolerance for water temperature and hair washing specifically. FCT overlap: Marcus may use Functional Help-Seeking to request "a minute" during bathing steps — this is reinforced as appropriate self-advocacy. Regression correlates with schedule disruption Oct 2025; consistent schedule restoration is prerequisite intervention. Parent training critical: reinforce each sub-step entered, avoid extended negotiations at bathroom doorway.',
        stoSteps: [
          { id: 'bts-marcus-2-1', targetFrequency: '1', durationWeeks: '6', note: 'Continue at 1/day refusal but reduce episode duration to ≤20 min using visual schedule' },
          { id: 'bts-marcus-2-2', targetFrequency: '0', durationWeeks: '8', note: 'Zero refusals for 3 consecutive weeks; bathing routine completed independently with visual schedule' },
        ],
      },
    ],
  },
  caregiver_training: {
    completionState: 'complete',
    approvalState: 'approved',
    caregiverBaselines: {
      premack_baseline: '35',
      reinforcement_baseline: '50',
    },
    trainingFormat: ['In-session coaching', 'Parent sessions', 'Written guides'],
    trainingFrequency: '2x/week',
    trainingBarriers: 'Daniela (mother) works from home 3 days/week and is the primary implementer; Javier (father) works outside the home Mon–Fri, available evenings and weekends only. Maternal grandparents provide afterschool care 3x/week but speak primarily Spanish — written materials will need Spanish translations. Sofia (age 6, NT sibling) requires supervision during training sessions.',
    caregiverStrengths: 'Daniela demonstrates strong motivation and has already implemented an informal visual schedule with ~80% success rate. She accurately identifies Marcus\'s early warning signs and uses a quiet-space intervention independently. Javier is engaged and participated in today\'s interview. Both parents show excellent data-keeping potential — they track incidents in a shared notes app.',
    caregiverTrainingTargets: makeStandardCaregiverTargets(
      { premack: 35, reinforcement: 50 },
      'c13',
      {
        premack: [
          { id: 'cgt-premack-c13-1', targetPercent: '55', durationWeeks: '4', note: 'Consistent first/then phrasing across home and community settings with BCBA coaching' },
          { id: 'cgt-premack-c13-2', targetPercent: '75', durationWeeks: '4', note: 'Independent delivery; generalized to Javier and grandparents with Spanish visual guides' },
        ],
        reinforcement: [
          { id: 'cgt-reinf-c13-1', targetPercent: '65', durationWeeks: '4', note: 'Within-3-second delivery with appropriate praise specificity during coaching sessions' },
          { id: 'cgt-reinf-c13-2', targetPercent: '80', durationWeeks: '4', note: 'Generalized across caregivers; magnitude matched to task effort independently' },
        ],
      },
      {
        premack:      { ltoPercent: 90, ltoSessions: 3 },
        reinforcement: { ltoPercent: 90, ltoSessions: 3 },
      },
    ),
    transcript: "Dr. Reyes: Tell me about what strategies you've tried at home — things you do instinctively that help Marcus. Daniela: The visual schedule — that was huge. I made it myself from pictures I printed. And the first-then thing, I do that naturally now. Like, first shoes then tablet. It works maybe 40% of the time? But sometimes I forget to say it and just ask him to do things and that goes badly. Javier: On weekends I try to do what Daniela does but I don't always know what step we're on in the routine. We need a shared system. Dr. Reyes: Have you ever had formal ABA parent training? Daniela: At Sunshine they did one parent meeting — it was mostly them telling us what they were doing, not really training us how to do it. Dr. Reyes: Would you be open to training during Marcus's sessions and separate parent coaching sessions? Daniela: Yes, absolutely. That's actually what I've been hoping for. Javier: If there's something we can read or watch on our own time that would help too.",
    notes: 'Observed Daniela\'s spontaneous use of first/then (Premack) — correct structure approximately 35% of interactions observed during home visit intake. Reinforcement delivery observed at 50% — appropriate immediacy but inconsistent praise specificity. Priority skill for caregiver: precise first/then phrasing + consistent reinforcement delivery. Javier to receive Saturday parallel training sessions 2x/month. Grandparent materials: Spanish-language visual guides to be prepared. Competency benchmark: 80% correct unprompted use of both strategies across 3 consecutive observed sessions before independent implementation sign-off.',
    approvalState: 'pending',
    draftContent: null,
    aiOriginalContent: null,
    draftState: 'blank',
    lastSavedAt: null,
  },
  crisis_plan: {
    notes: 'No prior hospitalization, psychiatric crisis, or law enforcement involvement. No suicidal ideation beyond described SIB. No prior formal crisis plan in place — this is first documented plan. Escalation sequence: warning signs → verbal protest → motor agitation → crying/screaming → physical aggression → occasional SIB. Post-episode: Marcus frequently initiates affection and apologizes verbally — remorse awareness confirmed. Guanfacine ER 1mg QD — no acute behavioral effects documented; no contraindications for de-escalation strategies. Physical redirection during escalation has precipitated 2 biting incidents.',
    transcript: "Mom: When it's starting you can see it — he starts pacing and the echolalia gets louder. He'll repeat things more and more and won't make eye contact. Then it goes to verbal protest and then full meltdown. What I've learned is that if I give him the tablet for 5 minutes in a quiet space — no talking, just one simple instruction — he can come back. But if I try to physically redirect him or if his sister comes near during that window, it escalates immediately. He bit me twice when I tried to physically guide him during a crisis. After the meltdown he usually cries and apologizes and wants to hug me. Dad: We don't have any formal plan written anywhere. Nobody gave us one. That's partly why we're here.",
    completionState: 'complete',
    emergencyContacts: [
      { id: 'ec-m1', name: 'Daniela Rivera', relationship: 'Mother', phone: '(305) 555-0302', role: 'Primary' },
      { id: 'ec-m2', name: 'Javier Rivera', relationship: 'Father', phone: '(305) 555-0303', role: 'Backup' },
      { id: 'ec-m3', name: 'Dr. Adriana Costa', relationship: 'Prescribing Physician', phone: '(305) 555-0410', role: 'Medical' },
    ],
    warningSignsSelected: [
      'Increased pacing',
      'Elevated vocal volume',
      'Rising echolalia frequency',
      'Refusal of eye contact / body turned away',
      'Repetitive "no" or vocal protest',
      'Bilateral hand flapping (intensified)',
    ],
    warningSignsCustom: 'Delayed echolalia shifts to more urgent, repetitive phrasing. Marcus will refuse to enter the room where the demand was placed.',
    deEscalationWorks: [
      'Move to quiet low-stimulation space',
      'Offer tablet / screen access',
      'Wait quietly — no talking',
      'Single simple statement only',
      'Remove all demands',
    ],
    deEscalationWorsens: [
      'Physical blocking or restraint',
      'Physical redirection without warning',
      'Multiple verbal prompts in sequence',
      'Extended verbal explanations',
      'Sibling / peer proximity during episode',
      'Raised voice / urgent tone',
    ],
    deEscalationNotes: 'Physical redirection has directly precipitated the 2 documented biting incidents. RBT must never make physical contact during escalation without explicit parent authorization and BCBA guidance. Sibling (Sofia, age 6) must be removed from the area immediately when Marcus enters warning sign phase.',
    bcbaCallMinutes: '7',
    bcbaCallIncidents: '2',
    bcbaCallWindow: '30',
    call911Threshold: true,
    call911Notes: 'Any aggression resulting in injury requiring medical attention. Any self-injurious behavior sustained beyond 2 minutes or resulting in visible skin damage.',
    sessionSuspendThreshold: true,
    sessionSuspendNotes: 'If Marcus initiates biting or object-throwing directed at the RBT, the RBT should calmly move out of range and contact the supervising BCBA immediately. Do not re-engage until BCBA advises.',
    baselineReturnMin: '20',
    baselineReturnMax: '40',
    postCrisisDebrief: true,
    remorsePresentPostCrisis: true,
    remorseNotes: 'Marcus typically initiates verbal apology and physical affection (hug) within 5–10 minutes of returning to baseline. This is a reliable indicator that the episode has fully resolved. Do not attempt to process the event verbally with Marcus during the remorse window — keep it brief and warm.',
    medicalContraindications: ['No physical blocking', 'No physical restraint of any kind'],
    medicalNotes: 'Guanfacine ER 1mg QD (Dr. Adriana Costa) — administered in the morning. No acute behavioral side effects documented. No allergies. No seizure history. Medication does not affect crisis response protocol.',
    caregiverSignedCrisisPlan: false,
    rbtTrainedOnPlan: false,
    crisisPlanInBsp: true,
  },
};

// ── Oliver Patel mock data ────────────────────────────────────────────────────

const OLIVER_INTERVIEW_DATA = {
  demographics: {
    notes: 'Oliver Patel, DOB 06/12/2018 (age 7). Dx: ASD Level 2 F84.0 (Dr. Ana Flores, Pediatric Neurology, March 2024 — ADOS-2 Module 2, ADI-R, Vineland-3). No co-occurring diagnoses. Insurance: Cigna CIG-778823 / G-55023. Lives with parents Priya Patel (primary caregiver) + Raj Patel (father, works long hours in finance). No siblings. English is primary language; Gujarati spoken by maternal grandparents (weekend childcare). School: Riverside Academy, Coconut Grove, Miami — 2nd grade, IEP (annual review Feb 2026), SLP 2x/week school-based. No OT currently. No prior ABA. No medications.',
    completionState: 'complete',
  },
  presenting_concerns: {
    notes: 'Family top 3 concerns: (1) Physical aggression toward Priya during demand presentation — 3-5 incidents/day, hitting and scratching. Onset correlated with start of 2nd grade in September 2025. (2) Elopement and bolting in community settings — has bolted from grocery store 3x, parking lots on 2 occasions. Family has stopped most community outings. (3) Refusal of morning and bedtime hygiene routines — daily 30-45 min standoffs for teeth brushing and bathing. School: 1 documented peer hitting incident, no suspension. IEP team requesting updated behavioral evaluation.',
    transcript: "Priya: The hitting really ramped up when school started this year. It's always when I'm asking him to do something he doesn't want to do — put down the iPad, brush his teeth, come to the table. He just hits or scratches and then runs away. Raj: The community stuff scares us the most. He bolted in the parking lot of the grocery store twice. I ran after him and I was terrified. We basically don't take him anywhere public anymore unless we have two adults. Priya: The hygiene is exhausting too. Every single morning and every night it's a battle. He'll sit at the bathroom door and just cry and we can't get him to brush his teeth without it turning into an hour-long event.",
    completionState: 'complete',
  },
  self_help: {
    notes: 'Toileting: fully independent, daytime and nighttime. No accidents. Manages clothing, wiping, and handwashing independently. Dressing: can manage pullover tops and elastic-waist pants. Refuses buttons, snaps, and zippers. Shoelaces not mastered — Velcro exclusively. Tactile sensitivity: tagless shirts required; refuses certain fabric textures (corduroy, stiff denim). Oral hygiene: significant refusal — teeth brushing results in physical resistance daily; Priya estimates successful brushing 3x/week with 2-person assist. Refuses flossing entirely. Bathing: refuses in bathroom, will accept brief sponge bath with consistent prompting but not daily. Hair washing tolerated monthly with distraction. Feeding: ~10 accepted foods — mac and cheese (specific brand), chicken nuggets, plain rice, peeled apple, yogurt (specific brand), goldfish crackers, plain bread, juice pouches. No vegetables or mixed textures. OT consult recommended but not yet scheduled.',
    completionState: 'partial',
  },
  daily_living: {
    notes: 'Morning routine: no visual schedule currently in use at home (school uses one). Routine takes 60-80 min with 2-3 escalations on average. Raj typically handles morning routine on weekdays before leaving at 7am; handoff to Priya results in elevated resistance. Bedtime: 9-9:30pm target; bedtime routine takes 45-60 min. Screen time: approximately 3-4 hours on weekdays, 5-6 on weekends, primarily iPad (YouTube videos about vehicles, Minecraft). Screen removal is the highest-frequency aggression antecedent. Leisure: strong preference for vehicle videos and Minecraft; can engage independently for up to 60 min with preferred content. Community: family has restricted outings to essential errands with 2 adults or eliminated them. Library and playground attempted twice in past 2 months — both ended early due to behavioral escalation. Knows full name, home address, Priya\'s phone number. Personal safety strength: responds consistently to "stop" in home.',
    completionState: 'partial',
  },
  safety: {
    notes: 'Elopement: HIGH RISK. Oliver has bolted from adult proximity on 5 documented occasions in community settings — grocery store (3x), parking lot (2x). Fastest incident: separated from Priya within 30 seconds of distraction. No water body access (apartment, no pool). Responds to "stop" in home setting but not reliably in high-stimulation community settings. Aggression: open-hand hitting and scratching directed primarily at Priya (90% of incidents), 3-5x/day. No biting. No aggression toward dad. 1 school incident (peer hitting, no injury). No property destruction beyond occasional item sweeping during escalation. No SIB reported. No elopement attempts at school (structured environment). No law enforcement involvement.',
    transcript: "He bolted in the Publix parking lot and ran toward the road. I screamed and he actually stopped at the curb but my heart dropped. He knows his address and my number but in those moments he is not listening to anything. The scratching at home happens so fast — I'll ask him to turn off the iPad and before I can finish the sentence he's already hitting my arm. And then he'll run to his room. He doesn't do it at school, which I find confusing. They say he's well-behaved there.",
    completionState: 'complete',
    riskLevel: 'High',
    sibPresent: false,
    sibTopography: [],
    sibFrequency: '0',
    sibInjuryHistory: false,
    sibInjuryNotes: '',
    aggressionPresent: true,
    aggressionTopography: ['Open-hand hitting', 'Scratching'],
    aggressionTargets: ['Parent / Caregiver'],
    aggressionFrequency: '4',
    aggressionInjuryHistory: false,
    aggressionInjuryNotes: 'Scratches have left marks on Priya\'s forearms. No medical attention required. 1 school incident (peer hitting, no injury noted). Raj has not been targeted.',
    elopementPresent: true,
    propertyDestructionPresent: false,
    propertyDestructionNotes: 'Occasional sweeping of small items during escalation. No sustained destruction.',
    envSafety: [
      'Firearms secured or not present',
      'Medications stored out of reach',
      'Elopement safety plan needed — no current barriers in place',
    ],
    lawEnforcementInvolvement: false,
    hospitalizationHistory: false,
  },
  communication: {
    notes: 'Verbal — MLU 3-5 words in familiar, low-demand settings. Under stress or in novel settings, regresses to 1-2 word utterances or goes non-verbal. Intelligibility ~85% familiar adults. Uses language to request preferred items/activities and to protest. Does not use language to express internal states, request help, or seek a break before escalating. Strong scripted language: repeats lines from vehicle YouTube videos during unstructured time and when anxious. Receptive: single-step instructions followed reliably in familiar contexts; 2-step emerging (70% familiar adult, drops in unfamiliar settings). Consistent name response with Priya and Raj. School SLP: 2x/week (30 min each), focus on expanding expressive vocabulary and AAC introduction. AAC trial (GoTalk) initiated 3 weeks ago at school — no independent use yet. No pragmatics or peer interaction skills currently being targeted.',
    transcript: "He'll ask for things he wants — 'iPad please,' 'more nuggets,' that kind of thing. But when he's frustrated or something is wrong, the language just disappears. He either hits or runs. He can't tell me 'I don't want to' with words in those moments. He just acts. The scripts from YouTube — he'll repeat the same phrases over and over when he's anxious and you can tell it's like a self-calming thing. The school SLP said they want to try the tablet communication device but it's very early.",
    completionState: 'complete',
    primaryCommunicationModes: ['Verbal', 'AAC Device'],
    mluWords: '4',
    intelligibilityFamiliar: '85',
    intelligibilityUnfamiliar: '60',
    functionalRepertoire: [
      'Requesting preferred items/activities',
      'Protesting / refusing',
      'Greeting familiar people',
      'Answering yes/no questions',
    ],
    receptiveSingleStep: '85',
    receptiveTwoStep: '55',
    receptiveMultiStep: false,
    eyeContact: 'Variable',
    initiatesCommunication: 'Sometimes',
    turnTaking: 'Emerging',
    slpServices: true,
    slpFrequencyPerWeek: '2',
    slpFocus: 'Expressive vocabulary expansion, AAC introduction (GoTalk)',
  },
  self_stim: {
    notes: 'Hand flapping: frequent — most prominent during excitement and anticipation, estimated 10-15 episodes/day, each 5-20 sec. No interference with learning tasks. Repetitive questioning: asks the same question repeatedly (e.g., "What time is it?", "Where are we going?") particularly when anxious or during transitions — can persist 5-10 min without resolution. Lining up objects: arranges small objects (cars, blocks) in rows or color groups; 15-25 min sustained independent engagement. This appears to serve a calming regulatory function. No body rocking or mouthing. Sensory profile: hyperreactivity to sudden loud sounds (hand dryers, alarms, crowd noise), tactile sensitivity to fabric textures and oral input (see self-help). Proprioceptive seeking: crashing into furniture, jumping on couch, requests for tight hugs. No formal OT sensory evaluation completed.',
    completionState: 'partial',
  },
  medical_necessity: {
    notes: 'Dx: ASD Level 2 F84.0 (Dr. Ana Flores, Pediatric Neurology, March 2024). No co-occurring diagnoses. No medications. Pediatrician: Dr. Kevin Patel (no relation), last visit April 2026. Daily physical aggression toward primary caregiver. Documented elopement incidents posing acute community safety risk. Severe food selectivity (~10 foods) limiting nutrition and participation. Daily hygiene refusals impacting health. School: peer aggression, IEP team requesting behavioral evaluation. No prior ABA — all current non-ABA services insufficient. Recommended: 20 hrs/week center-based + parent training.',
    transcript: "Dr. Flores did the full evaluation in March 2024 — ADOS, ADI, and the adaptive testing. She diagnosed him with autism Level 2. She specifically said ABA was the recommended treatment from day one. We tried speech therapy at school and that's been ongoing. He's improved his vocabulary a little bit but the behavior has not changed — if anything it's gotten harder this year. Dr. Flores wrote the referral herself and said this is medically necessary. He's on no medications. She wants to try behavioral intervention before anything else.",
    completionState: 'complete',
    approvalState: 'approved',
    draftContent: `## Medical Necessity

### Diagnostic Support

Primary diagnosis of Autism Spectrum Disorder, Level 2 (DSM-5, F84.0) confirmed by Dr. Ana Flores, M.D., Pediatric Neurology, Miami Children's Health System, on March 14, 2024. Diagnostic instruments included the ADOS-2 (Module 2), ADI-R, and Vineland-3 Adaptive Behavior Scales. Full neuropsychological report on file. No co-occurring psychiatric diagnoses. No current medications. No seizure disorder, cardiac conditions, or other medical contraindications to behavioral intervention.

Primary care: Dr. Kevin Patel (Pediatrics). Last well visit April 2026; next scheduled visit October 2026. School-based SLP services ongoing 2x/week (30 min each) — AAC introduction (GoTalk) initiated three weeks prior to this assessment.

### Functional Impact

Oliver's profile of behavioral excesses and adaptive skill deficits significantly impairs his functioning across home and community settings. Daily physical aggression toward his mother — occurring 3–5 times per day — consists of hitting and scratching that leaves visible marks and has created a household dynamic his parents describe as hypervigilant and exhausting. More critically, Oliver has bolted from adult supervision in community settings on five documented occasions, including twice in active parking lots. This elopement risk has led the family to eliminate virtually all community participation, severely limiting Oliver's social development, family quality of life, and caregiver ability to meet routine needs.

Daily refusal of hygiene tasks (teeth brushing, bathing) presents a health risk and is a chronic source of caregiver-child conflict. Severe food selectivity to approximately 10 foods limits nutritional variety. At school, a peer aggression incident has prompted an IEP team request for a formal behavioral evaluation. Without ABA intervention, the family anticipates continued behavioral escalation, ongoing community safety risk from elopement, and increasing social isolation.

### Clinical Justification

Applied Behavior Analysis is clinically justified as the appropriate level of care for Oliver Patel, meeting Cigna medical necessity criteria on the following grounds: **(1)** Primary diagnosis of ASD Level 2 (F84.0) confirmed via ADOS-2 Module 2, ADI-R, and Vineland-3, requiring substantial support across multiple domains; **(2)** documented daily physical aggression toward primary caregiver with visible injury, meeting clinical severity threshold; **(3)** acute community safety risk from elopement — 5 documented incidents including 2 in active parking lots, the most recent requiring caregiver to run into traffic to prevent child from reaching the roadway; **(4)** functional impairment across home, school, and community settings sufficient to prompt IEP behavioral evaluation request and complete suspension of family community participation; and **(5)** current school-based SLP services, while beneficial for vocabulary, have not addressed behavioral excesses, and no prior ABA services have been received. Referring neurologist Dr. Ana Flores recommends ABA as the primary evidence-based treatment indicated for this presentation.

Recommended service intensity: 20 hours per week, center-based with parent training component, consistent with the severity of behavioral presentation, elopement risk, and family's high engagement and motivation. Six-month measurable targets include: Physical Aggression reduction from baseline 4 incidents/day to ≤1 incident/day; elimination of elopement incidents in community settings; mastery of Functional Help-Seeking across home and community; tooth brushing compliance within 5 minutes at 80% of opportunities; and re-establishment of at least two routine community settings (grocery, library).`,
    coOccurringDiagnoses: [],
    medications: [],
    hasPriorABA: false,
    priorABAHistory: [],
    recommendedHoursPerWeek: '20',
    recommendedSetting: 'Center-based',
  },
  skill_acquisitions: {
    notes: 'Family priority targets: (1) Requesting help or break with words before hitting; (2) tolerating transition from preferred iPad activity; (3) peer interaction at school recess; (4) hygiene routine compliance. Reinforcer assessment: vehicle YouTube content (high), Minecraft (high), specific food items (moderate), physical play/rough-housing (moderate). Attending: 5-10 min with high-preference reinforcers on structured tasks. Accepts reinforcers from familiar adults. No prior DTT exposure. Imitation: strong motor imitation repertoire — copies gross and fine motor actions with gestural prompt.',
    completionState: 'complete',
    approvalState: 'approved',
    skillGoals: [
      {
        id: 'op1',
        domain: 'Communication',
        targetSkill: 'Functional Help-Seeking (Verbal Request)',
        operationalDefinition: 'Oliver independently vocalizes "help," "break," or "I need help" within 10 seconds of encountering a blocked access to a preferred item or a non-preferred demand, without prior adult prompting or physical aggression.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)', 'Natural Environment Teaching (NET)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Full Verbal', promptingLevelCombination: '',
        baselinePercent: '5', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Full verbal model required; 1 of 20 probed opportunities independent. Typically responds to blocked access with physical aggression or elopement rather than verbal request.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Home + school (minimum 2 settings)',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no gestural or verbal prompt',
        stoPercent: '40', stoSkillDescription: 'requesting help or break across 3 demand contexts', stoWeeks: '8',
        stoSteps: [
          { id: 'op1-s1', targetPercent: '20', skillDescription: 'vocalizing "help" or "break" with gestural prompt faded across 2 demand types', durationWeeks: '4' },
          { id: 'op1-s2', targetPercent: '40', skillDescription: 'unprompted help-seeking across 3 demand contexts at home', durationWeeks: '4' },
        ],
        generalizationNotes: 'Generalize across both parents, RBT, and school staff. Priority probe: iPad removal demand and hygiene task onset — these are the two highest-frequency aggression antecedents. Coordinate with school SLP re: AAC-based help-seeking as parallel modality.',
      },
      {
        id: 'op2',
        domain: 'Cognitive / Academic',
        targetSkill: 'Following Two-Step Directions',
        operationalDefinition: 'Oliver follows a two-step spoken instruction (e.g., "Put the toy away and then sit down") in correct sequence within 10 seconds of the instruction, without repetition or physical guidance.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '30', baselineOpportunities: '20',
        baselinePromptingLevel: 'Gestural',
        baselinePromptingDesc: 'Gestural prompt required for second step in most trials; first step followed independently ~80%; combined two-step sequence at 30% accuracy.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Therapy table + natural environment',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no gestural or vocal prompt',
        stoPercent: '80', stoSkillDescription: 'following two-step directions across 5 distinct instruction sets', stoWeeks: '10',
        stoSteps: [
          { id: 'op2-s1', targetPercent: '50', skillDescription: 'following two-step directions for 3 instruction sets with gestural prompt on second step', durationWeeks: '4' },
          { id: 'op2-s2', targetPercent: '70', skillDescription: 'following two-step directions independently across 5 instruction sets', durationWeeks: '4' },
        ],
        generalizationNotes: 'Generalize across instruction-givers (Priya, Raj, teacher, RBT). Embed in morning routine sequencing (get backpack AND put on shoes) as natural environment context.',
      },
      {
        id: 'op3',
        domain: 'Social',
        targetSkill: 'Peer Interaction Initiation (School Setting)',
        operationalDefinition: 'Oliver independently initiates a contextually appropriate social interaction with a same-age peer (e.g., verbal comment on shared activity, asking to join, handing an object) at least 2 times per 30-minute structured social opportunity, without adult prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Social Stories', 'Video Modeling', 'Peer-Mediated Instruction'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '0', baselineOpportunities: '30',
        baselinePromptingLevel: 'Gestural',
        baselinePromptingDesc: '0 unprompted initiations per 30-minute session baseline. Parallel play observed near peers but no directed interaction.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'School recess + structured classroom activity',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no adult gestural or verbal cue',
        stoPercent: '40', stoSkillDescription: 'initiating 1 peer interaction per 30-min session in 2 structured contexts', stoWeeks: '12',
        stoSteps: [
          { id: 'op3-s1', targetPercent: '20', skillDescription: 'initiating 1 scripted peer interaction per session with video model support', durationWeeks: '4' },
          { id: 'op3-s2', targetPercent: '40', skillDescription: 'initiating 1 unprompted peer interaction per session in structured play context', durationWeeks: '4' },
          { id: 'op3-s3', targetPercent: '60', skillDescription: 'initiating 2 unprompted peer interactions per session across 2 school contexts', durationWeeks: '4' },
        ],
        generalizationNotes: 'Coordinate with paraprofessional at school for in-vivo social coaching during recess. Target 1-2 identified willing peers for structured interaction practice.',
      },
      {
        id: 'op4',
        domain: 'Adaptive / Self-Help',
        targetSkill: 'Bathing / Grooming Desensitization',
        operationalDefinition: 'Oliver completes all steps of the evening hygiene routine (enter bathroom, undress, enter tub/shower, wash body with cloth, wash hair with shampoo, rinse, exit, dry, dress) within 20 minutes with no more than 1 verbal prompt per step, without behavioral refusal (hitting, crying, leaving bathroom).',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Task Analysis / Chaining', 'Natural Environment Teaching (NET)'],
        teachingStrategiesOther: 'Systematic desensitization with gradual water exposure hierarchy',
        promptingLevel: 'Full Physical', promptingLevelCombination: '',
        baselinePercent: '0', baselineOpportunities: '10',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Complete refusal on baseline probes — will not enter bathroom when bathing is announced. Sponge bath accepted 2-3x/week with 2-person assist. Full bath: 0% step completion independent.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'Home (bathroom)',
        masteryCriteriaPromptingLevel: 'Verbal',
        masteryCriteriaPrompting: '≤1 verbal prompt per step',
        stoPercent: '50', stoSkillDescription: 'completing 5 of 10 hygiene steps with ≤2 prompts per step', stoWeeks: '14',
        stoSteps: [
          { id: 'op4-s1', targetPercent: '20', skillDescription: 'entering bathroom and tolerating water on hands with ≤3 prompts', durationWeeks: '4' },
          { id: 'op4-s2', targetPercent: '50', skillDescription: 'completing 5 of 10 hygiene steps with ≤2 prompts per step', durationWeeks: '5' },
          { id: 'op4-s3', targetPercent: '70', skillDescription: 'completing 8 of 10 hygiene steps independently using visual sequence', durationWeeks: '5' },
        ],
        generalizationNotes: 'Coordinate with OT for sensory desensitization hierarchy (water temperature, tactile input progression). Family to implement nightly with RBT coaching during parent training sessions.',
      },
    ],
  },
  behavior_targets: {
    notes: 'Target 1: Physical Aggression (hitting/scratching). Topography: open-hand hitting and scratching directed at Priya. Frequency: 3-5x/day. Duration: brief (<5 sec/episode). Ant: demand presentation (iPad removal, hygiene tasks, meal transition), blocked access to preferred items. Function: escape (primary). Target 2: Elopement/Bolting. Topography: running from adult proximity without permission. Frequency: 2x per community outing. Duration: variable. Ant: community settings (grocery, parking lot, unfamiliar environment), elopement-opportunity cues (open doors, momentary loss of hand contact). Function: escape (from demands/unfamiliar stimulation) + automatic (movement/sensory seeking). School: behaviors are not observed in school — behavior is home and community specific, consistent with high structure and predictability of school environment.',
    transcript: "The hitting is always when I'm asking him to stop something or do something. I'll say 'Oliver, time to turn off iPad' and his hand goes up before I can even take the device. He doesn't pause or protest first — it's very fast. The running is different — it feels almost like excitement or overwhelm at the same time. He doesn't look back. He just goes. The school says he's never bolted or hit anyone there. They have a very structured environment with consistent routines.",
    completionState: 'complete',
    approvalState: 'approved',
    behaviorTargets: [
      {
        id: 'bt-op1',
        behaviorName: 'Physical Aggression',
        operationalDefinition: 'Oliver makes forceful physical contact with another person using an open hand (hitting) or fingernails (scratching). Each discrete contact event is scored as one instance. Accidental physical contact (bumping, brushing past) is not scored.',
        topography: ['Open-hand hitting', 'Scratching'],
        frequencyPerDay: '4', frequencyUnit: 'day',
        durationSeconds: '3', durationUnit: 'seconds',
        intensityRating: 'Moderate',
        antecedents: 'Demand presentation: iPad or screen removal, hygiene task initiation (teeth brushing, bathing announcement), meal transition. Blocked access to preferred item. Unpredicted schedule change.',
        primaryTargets: ['Parent / Caregiver'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '4',
        targetFrequency: '1',
        measurementSystem: 'Event Recording',
        priorFBACompleted: false,
        priorBIPCompleted: false,
        notes: 'FCT replacement: Oliver will request "help" or "break" to escape non-preferred demands before aggression occurs. The speed of escalation (pre-verbal → aggression within seconds) requires priming the FCT vocabulary immediately before high-risk demand contexts. RBT must present the demand, allow 3-second independent response window, then prompt FCT if no verbal request occurs — before the demand is repeated. Demand removal must not follow aggression; FCT response must be honored to maintain the replacement behavior.',
        stoSteps: [
          { id: 'bts-op1-1', targetFrequency: '2', durationWeeks: '4', note: 'Reduce to ≤2 incidents/day with FCT priming before high-risk demands' },
          { id: 'bts-op1-2', targetFrequency: '1', durationWeeks: '8', note: 'Reduce to ≤1 incident/day; FCT "help" or "break" request independent' },
        ],
      },
      {
        id: 'bt-op2',
        behaviorName: 'Elopement / Bolting',
        operationalDefinition: 'Oliver moves away from the supervising adult\'s direct supervision in a community setting without permission, defined as moving more than 10 feet from the adult without pausing in response to the adult\'s verbal cue ("Stop" or "Wait"). Each episode of separation is scored as one instance.',
        topography: ['Running', 'Moving away without permission'],
        frequencyPerDay: '2', frequencyUnit: 'outing',
        durationSeconds: '30', durationUnit: 'seconds',
        intensityRating: 'Severe',
        antecedents: 'Community settings with open spaces (grocery stores, parking lots, parks). Transition between indoor and outdoor. Momentary loss of hand contact. Caregiver distraction (phone, conversation with another adult). Novel or stimulating environment.',
        primaryTargets: ['Self'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '2',
        targetFrequency: '0',
        measurementSystem: 'Event Recording',
        priorFBACompleted: false,
        priorBIPCompleted: false,
        notes: 'Safety priority: elopement in traffic-adjacent settings is the highest safety risk in this case. Graduated community exposure hierarchy required before unsupervised family community outings. Caregiver training in physical proximity management (hand-holding protocol, safety vest use in high-risk settings) must be completed before community sessions. Target behavior reduction to 0 incidents — any elopement in community is unacceptable given traffic proximity history. Wrist-to-wrist strap is an interim safety accommodation to be used until FCT and community tolerance are established.',
        stoSteps: [
          { id: 'bts-op2-1', targetFrequency: '1', durationWeeks: '6', note: 'Reduce to ≤1 elopement/outing with wrist-strap protocol and hand-holding training in place' },
          { id: 'bts-op2-2', targetFrequency: '0', durationWeeks: '8', note: 'Zero elopement incidents across 3 consecutive community outings without physical restraint aid' },
        ],
      },
    ],
  },
  caregiver_training: {
    notes: 'Priya Patel is primary implementer — highly motivated, detail-oriented, responds well to written guides and data systems. Raj Patel available evenings and weekends — works long hours in finance. Primary barrier: inconsistency between the two parents on demand follow-through. Priya tends to remove demand after aggression; Raj more likely to insist. Maternal grandparents (Gujarati-speaking) provide weekend care — will need Gujarati translation of core strategies. Current Premack use: Priya observed correct ~40% of probed opportunities. Reinforcement delivery: ~55% within 3 seconds. High family engagement and insight — both parents accurately describe the behavioral functions after minimal explanation.',
    completionState: 'complete',
    approvalState: 'approved',
    caregiverBaselines: { premack_baseline: '40', reinforcement_baseline: '55' },
    caregiverTrainingTargets: makeStandardCaregiverTargets(
      { premack: 40, reinforcement: 55 },
      'c5',
      {
        premack: [
          { id: 'cgt-premack-c5-1', targetPercent: '60', durationWeeks: '4', note: 'Consistent first/then delivery across both parents; demand follow-through alignment addressed' },
          { id: 'cgt-premack-c5-2', targetPercent: '80', durationWeeks: '4', note: 'Generalized to grandparents with Gujarati-translated visual materials; Raj maintenance monitored' },
        ],
        reinforcement: [
          { id: 'cgt-reinf-c5-1', targetPercent: '70', durationWeeks: '4', note: 'Within-3-second contingent delivery across home activities with parent data tracking' },
          { id: 'cgt-reinf-c5-2', targetPercent: '85', durationWeeks: '4', note: 'Independent delivery across both parents and novel settings; Priya data system in place' },
        ],
      },
      {
        premack:      { ltoPercent: 90, ltoSessions: 3 },
        reinforcement: { ltoPercent: 90, ltoSessions: 3 },
      },
    ),
    trainingFormat: ['In-session coaching', 'Parent sessions', 'Written guides'],
    trainingFrequency: '2x/week',
    trainingBarriers: 'Raj\'s work schedule limits weekday availability. Grandparents are Gujarati-speaking — English guides will need translation. Priya reports high stress and fatigue from daily behavioral challenges.',
    caregiverStrengths: 'Both parents demonstrate strong insight into behavioral functions. Priya is highly organized and comfortable with data collection. Family is highly motivated — primary driver for referral was parent safety concern, not just school recommendation.',
  },
  crisis_plan: {
    notes: 'No prior crisis events, hospitalizations, or law enforcement. No suicidal ideation or SIB requiring medical attention. Elopement is the primary acute safety concern. Warning signs: increased repetitive questioning, body tension, pulling away from hand-hold. De-escalation: remove demands, offer preferred item proactively, proprioceptive input (bear hug or firm shoulder squeeze). Caregiver signed crisis plan at assessment completion.',
    transcript: "When he's about to bolt or have a meltdown I can tell by his body — he starts pulling away from me and doing these repetitive questions, like asking the same thing over and over even after I've answered. And then he's gone before I can react. To calm him down: I take everything off the table, offer something he likes, and sometimes a tight hug helps. Talking to him when he's in that state makes it worse — he stops hearing words. It usually takes about 15 minutes to come down fully.",
    completionState: 'complete',
    approvalState: 'approved',
    emergencyContacts: [
      { id:'ec-op1', name:'Priya Patel', relationship:'Mother', phone:'(786) 555-0134', role:'Primary' },
      { id:'ec-op2', name:'Raj Patel', relationship:'Father', phone:'(786) 555-0135', role:'Backup' },
      { id:'ec-op3', name:'Dr. Ana Flores', relationship:'Neurologist', phone:'(305) 555-0220', role:'Medical' },
    ],
    warningSignsSelected: [
      'Repetitive questioning (same question 3+ times)',
      'Body pulling away from hand-hold',
      'Increased pace of movement',
      'Reduced verbal responsiveness',
    ],
    warningSignsCustom: 'Rigid body posture when transitioning from preferred activity. Visual scanning of exits in community settings.',
    deEscalationWorks: [
      'Remove all demands immediately',
      'Offer a preferred item or activity proactively',
      'Deep pressure / firm bear hug (if accepted)',
      'Proprioceptive input — heavy work activity',
      'Quiet space with reduced stimulation',
    ],
    deEscalationWorsens: [
      'Maintaining demands during escalation',
      'Multiple verbal prompts or questions',
      'Physical restraint or blocking',
      'Raised voice or urgent tone',
    ],
    deEscalationNotes: 'Wrist-to-wrist physical contact (parent holding child\'s wrist) used as interim elopement prevention in community — must be distinguished from restraint. Acceptable only as proactive prevention, not reactive response. Priya to signal Raj or second adult before releasing hand in any open space.',
    bcbaCallMinutes: '5',
    bcbaCallIncidents: '2',
    bcbaCallWindow: '20',
    call911Threshold: false,
    call911Notes: 'Call 911 if Oliver elopes and is not recovered within 2 minutes, or if he is in immediate danger of physical injury.',
    sessionSuspendThreshold: false,
    baselineReturnMin: '10',
    baselineReturnMax: '20',
    postCrisisDebrief: true,
    remorsePresentPostCrisis: true,
    remorseNotes: 'Oliver typically seeks affection from Priya 5-15 minutes after returning to baseline. This is a reliable sign the episode has fully resolved. Do not process verbally during this window.',
    medicalContraindications: ['No physical restraint'],
    medicalNotes: 'No medications. No allergies. No seizure history. No medical contraindications to any behavioral intervention modality.',
    caregiverSignedCrisisPlan: true,
    rbtTrainedOnPlan: false,
    crisisPlanInBsp: true,
  },
};

// ── James Martinez mock data ─────────────────────────────────────────────────

const JAMES_INTERVIEW_DATA = {
  behavior_targets: {
    completionState: 'complete',
    approvalState: 'approved',
    notes: 'Target 1: Physical Aggression. Topography: hitting, kicking, biting staff/peers. Frequency: 8x/day. Ant: demand presentation, item removal, peer proximity. Function: escape + access. Target 2: Vocal Disruption. Topography: screaming and shouting during academic and self-care tasks. Frequency: 12x/day. Ant: non-preferred activities, transitions. Function: escape. Target 3: Property Destruction. Topography: knocking over materials, tearing papers. Frequency: 4x/day. Ant: difficult tasks, frustration. Function: escape + attention.',
    behaviorTargets: [
      {
        id: 'bt-c11-1',
        behaviorName: 'Physical Aggression',
        operationalDefinition: 'CLIENT makes forceful physical contact with another person by hitting, kicking, or biting. Each discrete contact event is scored as one instance. Accidental contact during gross motor activities is not scored.',
        topography: ['Open-hand hitting', 'Kicking', 'Biting'],
        frequencyPerDay: '8', frequencyUnit: 'day',
        durationSeconds: '3', durationUnit: 'seconds',
        intensityRating: 'Severe',
        antecedents: 'Demand presentation, removal of preferred item, proximity of peers during unstructured time',
        primaryTargets: ['Staff / Therapist', 'Peers'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '8',
        targetFrequency: '1',
        stoSteps: [
          { id: 'sto-c11-1-1', targetFrequency: '6', durationWeeks: '6', note: 'Reduce to ≤6 incidents/day using FCT "break" card; demand fading initiated' },
          { id: 'sto-c11-1-2', targetFrequency: '3', durationWeeks: '6', note: 'Reduce to ≤3 incidents/day; FCT generalized across staff and settings' },
          { id: 'sto-c11-1-3', targetFrequency: '1', durationWeeks: '6', note: 'Reduce to ≤1 incident/day with independent FCT use across demands' },
        ],
        measurementSystem: 'Event Recording',
        priorFBACompleted: true, priorBIPCompleted: false,
        notes: '',
      },
      {
        id: 'bt-c11-2',
        behaviorName: 'Vocal Disruption',
        operationalDefinition: 'CLIENT produces loud screaming or shouting at a volume that disrupts ongoing activities. Episode begins at onset of vocalization above conversational volume and ends when CLIENT is silent or speaking at conversational level for 5 consecutive seconds.',
        topography: ['Screaming', 'Shouting'],
        frequencyPerDay: '12', frequencyUnit: 'day',
        durationSeconds: '30', durationUnit: 'seconds',
        intensityRating: 'Moderate',
        antecedents: 'Non-preferred academic tasks, hygiene routines, transition away from preferred activity',
        primaryTargets: ['Self'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '12',
        targetFrequency: '2',
        stoSteps: [
          { id: 'sto-c11-2-1', targetFrequency: '9', durationWeeks: '6', note: 'Reduce to ≤9 episodes/day with visual task schedule and advance warnings' },
          { id: 'sto-c11-2-2', targetFrequency: '5', durationWeeks: '6', note: 'Reduce to ≤5 episodes/day using self-monitoring card across tasks' },
          { id: 'sto-c11-2-3', targetFrequency: '2', durationWeeks: '6', note: 'Reduce to ≤2 episodes/day; replacement behavior (quiet request) independent' },
        ],
        measurementSystem: 'Event Recording',
        priorFBACompleted: false, priorBIPCompleted: false,
        notes: '',
      },
      {
        id: 'bt-c11-3',
        behaviorName: 'Property Destruction',
        operationalDefinition: 'CLIENT intentionally knocks over materials, tears papers, or throws objects resulting in damage. Each discrete destructive act is scored as one instance. Accidental drops are not scored.',
        topography: ['Knocking over materials', 'Tearing papers', 'Throwing objects'],
        frequencyPerDay: '4', frequencyUnit: 'day',
        durationSeconds: '2', durationUnit: 'seconds',
        intensityRating: 'Moderate',
        antecedents: 'Difficult task demands, frustration during academic work, attention redirection to non-preferred items',
        primaryTargets: ['Environment'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '4',
        targetFrequency: '0',
        stoSteps: [
          { id: 'sto-c11-3-1', targetFrequency: '2', durationWeeks: '6', note: 'Reduce to ≤2 incidents/day using task modification and environmental arrangement' },
          { id: 'sto-c11-3-2', targetFrequency: '0', durationWeeks: '8', note: 'Zero incidents for 3 consecutive weeks; replacement behavior (verbal/gestural protest) independent' },
        ],
        measurementSystem: 'Event Recording',
        priorFBACompleted: false, priorBIPCompleted: false,
        notes: '',
      },
    ],
  },
  skill_acquisitions: {
    completionState: 'complete',
    approvalState: 'approved',
    notes: 'Family priorities: (1) functional communication to replace aggression and vocal disruption; (2) following multi-step instructions independently; (3) social interaction with peers.',
    skillGoals: [
      {
        id: 'sg-c11-1',
        domain: 'Communication',
        targetSkill: 'Functional Communication (Mand Training)',
        operationalDefinition: 'James independently vocalizes or uses an AAC symbol to request a preferred item, activity, or break within 10 seconds of access opportunity, without physical prompting, across 3 consecutive sessions.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)', 'Natural Environment Teaching (NET)', 'Functional Communication Training (FCT)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '20', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Verbal',
        baselinePromptingDesc: 'Full verbal prompt required for 80% of request opportunities; spontaneous mands observed in 4 of 20 high-preference probes only',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Clinic + home (minimum 2 settings)',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no verbal or gestural prompt',
        stoSteps: [
          { id: 'sg-c11-1-s1', targetPercent: '45', skillDescription: 'requesting preferred items and break using 1-word vocalization or AAC with gestural model', durationWeeks: '6' },
          { id: 'sg-c11-1-s2', targetPercent: '65', skillDescription: 'requesting across 3 categories (item, activity, break) without physical prompt', durationWeeks: '6' },
        ],
        stoPercent: '', stoSkillDescription: '', stoWeeks: '', sto: '',
        generalizationNotes: 'Priority probe: demand presentation contexts that historically trigger aggression — mand for "break" or "help" must be established before demand fading begins.',
      },
      {
        id: 'sg-c11-2',
        domain: 'Academic',
        targetSkill: 'Following 2-Step Instructions',
        operationalDefinition: 'James independently follows a 2-step verbal instruction (e.g., "get your pencil and sit down") within 10 seconds of delivery, completing both steps in correct sequence, without repetition or physical prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)', 'Task Analysis / Chaining'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '15', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Verbal + Gestural',
        baselinePromptingDesc: 'Completes step 1 in 60% of probes with verbal prompt; step 2 requires gestural or physical prompt in 90% of trials',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Clinic + home',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no verbal repetition or gestural prompt',
        stoSteps: [
          { id: 'sg-c11-2-s1', targetPercent: '40', skillDescription: 'following 2-step instructions involving preferred materials with gestural prompt for step 2', durationWeeks: '6' },
          { id: 'sg-c11-2-s2', targetPercent: '65', skillDescription: 'following 2-step instructions across 5 instruction types without gestural prompt', durationWeeks: '6' },
        ],
        stoPercent: '', stoSkillDescription: '', stoWeeks: '', sto: '',
        generalizationNotes: 'Coordinate with school staff to align instruction formats. Begin with high-preference step 1 to build compliance momentum.',
      },
    ],
  },
  caregiver_training: {
    completionState: 'complete',
    approvalState: 'approved',
    notes: 'Rosa Martinez is primary implementer, highly motivated but limited English proficiency — Spanish preferred for all coaching sessions. Key targets: naturalistic teaching delivery and behavior-specific praise.',
    caregiverBaselines: { premack_baseline: '30', reinforcement_baseline: '40' },
    trainingFormat: ['In-session coaching', 'Home visits'],
    trainingFrequency: '2x/month',
    trainingBarriers: 'Language barrier (Spanish primary); work schedule; limited experience with structured behavioral strategies.',
    caregiverStrengths: 'Strong attachment to James; highly consistent with routines; open to learning; responds well to role-play demonstration.',
    caregiverTrainingTargets: [
      {
        id: 'ctgt_jm_1',
        isStandard: false,
        standardKey: null,
        goalName: 'Natural environment teaching',
        operationalDefinition: 'Caregiver embeds learning opportunities into daily routines (meals, play, hygiene) by following child\'s lead, pairing instruction with preferred items, and providing immediate reinforcement for target responses.',
        baselinePercent: 30,
        baselineContext: 'Observed during initial caregiver interview and home visit',
        stoSteps: [
          { id: 'ctgt-jm-1-1', targetPercent: '55', durationWeeks: '6', note: 'BCBA-guided NET practice during meals and play; at least 3 embedded trials observed per session' },
          { id: 'ctgt-jm-1-2', targetPercent: '75', durationWeeks: '6', note: 'Independent NET delivery across 3 daily routines with written cue card faded out' },
        ],
        ltoPercent: 90, ltoSessions: 5, lto: '',
      },
      {
        id: 'ctgt_jm_2',
        isStandard: false,
        standardKey: null,
        goalName: 'Behavior-specific praise',
        operationalDefinition: 'Caregiver delivers verbal praise that names the specific behavior (e.g., "Great job asking for a break using your words!") within 3 seconds of the target behavior, rather than generic praise or no acknowledgment.',
        baselinePercent: 40,
        baselineContext: 'Observed during initial caregiver interview and home visit',
        stoSteps: [
          { id: 'ctgt-jm-2-1', targetPercent: '60', durationWeeks: '6', note: 'BCBA models and caregiver practices during session; specificity prompts faded from verbal to written' },
          { id: 'ctgt-jm-2-2', targetPercent: '78', durationWeeks: '6', note: 'Independent behavior-specific praise across communication and compliance targets' },
        ],
        ltoPercent: 90, ltoSessions: 5, lto: '',
      },
    ],
  },
};

// ── Charlotte Davis mock data ────────────────────────────────────────────────

const CHARLOTTE_INTERVIEW_DATA = {
  demographics: {
    notes: 'Charlotte Davis, DOB 08/22/2018 (age 7). Dx: ASD Level 1 F84.0 (Dr. James Wilson, Jupiter Medical Center Developmental Peds, Oct 2024 — ADOS-2 Module 3, ADI-R, Vineland-3). No secondary diagnoses. Insurance: Cigna Healthspring Florida CIG-556634 / G-55023. Lives with mother Jennifer Davis (primary caregiver) in Palm Beach Gardens. No siblings. Jennifer is employed part-time; available for sessions Mon–Thu. School: Palm Beach Gardens Elementary, 1st grade — attends general education classroom with resource room pull-out 45 min/day (reading support); no 1:1 aide. IEP: behavior support plan in place. SLP: 30 min/week through school. No prior ABA services.',
    completionState: 'complete',
  },
  presenting_concerns: {
    notes: 'Jennifer\'s top concerns: (1) Transition-related tantrums — Charlotte screams, cries, and drops to the floor whenever an activity ends or a demand is placed. Averaging 5 episodes/day at home, up to 8 on school days. (2) Elopement — Charlotte has run away from Jennifer in parking lots and a playground twice in the past 2 months; one near-miss incident near a roadway. Jennifer now avoids community settings without a second adult present. (3) Task refusal — Charlotte refuses the majority of non-preferred demands (academic, hygiene, chores) averaging ~25 refusals/day. Transition protocols at school partially effective but inconsistent at home. Family priorities: reduce elopement risk first, then tantrums, then task compliance.',
    transcript: "The running is the scariest part. We were in the parking lot at the mall and she just bolted. I had the groceries and she was through two rows of cars before I caught her. It happened again at the playground — she ran toward the road and I had to sprint. I don't go anywhere alone with her now unless there's another adult or I have her in a stroller, which she's starting to refuse. The tantrums happen constantly — as soon as I say it's time to stop something, or when she has to do something she doesn't want to do, it's instant crying and dropping. School says they use a visual schedule and it helps some, but at home I can't seem to get it to work the same way.",
    completionState: 'complete',
  },
  self_help: {
    notes: 'Toileting: fully trained, day and night. Self-initiates reliably; manages clothing independently. Dressing: independent for most clothing — manages shirt on/off, pants, velcro shoes. Buttons and zippers require adult assistance. Tactile sensitivity: mild — prefers soft fabrics, tolerates seams with no behavioral response. Feeding: age-appropriate variety; no significant food selectivity. Will try new foods with verbal encouragement in low-demand contexts. Minor preference for specific plate/cup but no behavioral escalation if unavailable. Hygiene: tooth brushing — 50% compliance; hair brushing — frequent refusal (~75%); bathing — compliant 4 of 7 days with verbal prompt, 3 of 7 require significant caregiver prompting or refusal. Personal hygiene refusals addressed in Task Refusal behavior target.',
    completionState: 'complete',
  },
  daily_living: {
    notes: 'Morning routine: takes 60–75 min with significant caregiver prompting at each step. Charlotte capable of most steps independently but requires repeated verbal prompts and frequently refuses (see Task Refusal). Visual schedule implemented at school with good results — not yet in use at home; Jennifer interested in implementing. Bedtime: generally cooperative once routine initiated (~30 min); occasional refusal to put away tablet. Sleep onset: 15–20 min. No night waking. Community outings: severely limited by elopement risk and tantrum likelihood in public settings. Family has not visited grocery stores or restaurants in ~8 weeks without a second adult. Leisure: iPad (games and YouTube — 3–4 hrs/day unregulated), playground (when safe), crafts. Chores: none consistently completed — task refusal prevents initiation. Jennifer has attempted reward charts without sustained success.',
    completionState: 'complete',
  },
  safety: {
    notes: 'Elopement is the primary safety concern. Two documented near-miss incidents in the past 60 days — both in community settings with vehicular traffic present. Charlotte does not look for traffic before entering roadways. No pool at home; backyard is fenced with latched gate. Elopement in school: no documented incidents — structured campus and adult supervision sufficient. Aggression: hitting and pushing directed at Jennifer during demand presentation or item removal; 5 incidents/day average, no injuries to date. No sibling in the home. No SIB. No property destruction incidents beyond knocking over materials during tantrums. No prior law enforcement contact.',
    transcript: "I think about it all the time — what would happen if I wasn't fast enough. She doesn't look for cars. She doesn't understand the danger. She just runs when she wants to get away from something. And it's always in response to a demand or a transition — she's not running toward something, she's running away from me. The hitting is upsetting but it doesn't scare me the same way. She hits when I take something away or when I ask her to stop. It stings but she's seven and small. It's the elopement I lie awake about.",
    completionState: 'complete',
    riskLevel: 'High',
    sibPresent: false,
    aggressionPresent: true,
    aggressionTopography: ['Open-hand hitting', 'Pushing'],
    aggressionTargets: ['Parent / Caregiver'],
    aggressionFrequency: '5',
    aggressionInjuryHistory: false,
    aggressionInjuryNotes: 'No injuries reported. Hitting force low relative to child size — stings but no bruising or marks.',
    elopementPresent: true,
    elopementFrequency: '2',
    elopementNotes: 'Two documented community incidents in 60 days. Both in parking lots or near roadways. One near-miss with vehicular traffic. No school elopement.',
    propertyDestructionPresent: false,
    envSafety: ['Pool / water body secured or no access', 'Firearms secured or not present'],
    lawEnforcementInvolvement: false,
    hospitalizationHistory: false,
  },
  communication: {
    notes: 'Verbal communication age-appropriate in preferred contexts. MLU 5–7 words. Intelligibility: ~95% familiar adults, ~80% unfamiliar. Charlotte communicates effectively to request preferred items, comment on preferred topics, and protest. Critical gap: does not use verbal language to request a break, ask for help, or negotiate during demand situations — instead escalates directly to tantrum, elopement, or aggression. No AAC system. Receptive: follows multi-step instructions in low-demand familiar contexts; compliance drops dramatically under demand. Consistent yes/no. Full name, address, and caregiver phone number known — appropriate for age. Pragmatics: initiates conversation on preferred topics (animals, princess themes); peer interaction age-appropriate in unstructured play; turn-taking 3–5 exchanges. No language-related school concerns; reading at grade level per teacher report. SLP focus is social communication pragmatics only.',
    completionState: 'complete',
    primaryCommunicationModes: ['Verbal Speech'],
    aacSystem: null,
    functionalRepertoire: ['Requesting preferred items/activities', 'Protesting / refusing', 'Commenting on preferred topics', 'Basic conversation'],
    receptiveSingleStep: '95',
    receptiveTwoStep: '85',
    receptiveMultiStep: true,
    eyeContact: 'Adequate',
    initiatesCommunication: 'Frequently',
    turnTaking: '3-5 exchanges on preferred topics',
    slpServices: true,
    slpFrequencyPerWeek: '1',
    slpFocus: 'Social communication pragmatics',
  },
  self_stim: {
    notes: 'Hand flapping: bilateral, during excitement and high-interest moments — low frequency, non-disruptive. Spinning: occasional self-spinning in open spaces. Rocking: mild, seated, during video watching. No mouthing. No sensory behaviors that significantly interfere with learning. OT evaluation has not been conducted — Jennifer has not noted significant sensory concerns. No sensory diet in place. Self-stimulatory behaviors present at subclinical frequency and do not constitute a treatment target at this time; BCBA will monitor for escalation.',
    completionState: 'partial',
  },
  medical_necessity: {
    notes: 'Dx: ASD Level 1 F84.0 — Dr. James Wilson, Jupiter Medical Center Developmental Peds, Oct 2024. ADOS-2 Module 3, ADI-R, Vineland-3 administered. No secondary diagnoses. No current medications. Pediatrician: Dr. Michelle Park (last visit Sep 2025; next scheduled Apr 2026). No medical contraindications to any behavioral intervention modality. No seizure history. No cardiac conditions. Despite Level 1 classification, Charlotte\'s functional impairment is clinically significant: elopement creates acute safety risk with documented near-miss incidents; task refusal prevents participation in educational programming and daily routines; aggression disrupts family functioning and caregiver-child relationship. No prior ABA. School behavior support plan in place but insufficient to address community and home generalization deficits. Prior non-ABA intervention: SLP 30 min/week (school) — does not address behavioral targets. Recommended intensity: 10–15 hrs/week center-based with parent training; less-restrictive intervention has been tried and is insufficient. Medical necessity clearly established.',
    transcript: "She has the diagnosis from Dr. Wilson at Jupiter Medical — he did the full evaluation in October, the ADOS and the Vineland testing. He actually said her profile was interesting because her language is good but her behavior is more severe than you'd expect for Level 1. He's the one who strongly recommended ABA. Our pediatrician Dr. Park agreed. Charlotte doesn't have any medical problems — no medications, no allergies, nothing like that. The school has a behavior support plan but it only applies at school and it doesn't stop the elopement at home or in the community. They've never seen her run at school because there's always an adult near her in a structured setting. But at home with just me, it's a real emergency.",
    completionState: 'complete',
    approvalState: 'approved',
    draftContent: `## Medical Necessity

### Diagnostic Support

Primary diagnosis of Autism Spectrum Disorder, Level 1 (DSM-5, F84.0) confirmed by Dr. James Wilson, Developmental Pediatrics, Jupiter Medical Center, October 2024. Diagnostic instruments included the ADOS-2 (Module 3), ADI-R, and Vineland-3 Adaptive Behavior Scales. Full evaluation report on file. No co-occurring psychiatric diagnoses. No current medications. Pediatrician: Dr. Michelle Park (last visit September 2025). No seizure history, cardiac conditions, or medical contraindications to behavioral intervention.

### Functional Impact

Despite a Level 1 ASD classification, Charlotte's behavioral profile produces clinically significant functional impairment across home and community settings. Elopement represents the highest-acuity concern: Charlotte has eloped into active traffic on two documented occasions, requiring caregiver physical intervention to prevent injury. This behavior has effectively eliminated all unsupported community participation (grocery shopping, parks, family outings) and creates daily acute safety demands on the primary caregiver.

Task refusal occurs approximately 25 times per day and has disrupted morning routines, school preparation, and structured learning activities. Aggression toward the caregiver (5 incidents/day at baseline) has strained the caregiver-child relationship and limited Jennifer Davis's ability to implement any behavioral strategies without professional support. The school's existing behavior support plan addresses in-school behavior only and has not produced generalization to home or community settings.

No prior ABA services have been received. Less-restrictive interventions — including school-based behavior support and incidental SLP services — have been insufficient to address the safety-critical behavioral targets identified in this assessment.

### Clinical Justification

Applied Behavior Analysis is clinically indicated and medically necessary for Charlotte Davis on the following grounds: **(1)** confirmed primary diagnosis of ASD Level 1 (F84.0) with substantial functional impairment disproportionate to diagnostic severity level; **(2)** documented acute elopement safety risk with two confirmed near-miss traffic incidents; **(3)** behavioral targets (elopement, task refusal, aggression) that have not responded to less-restrictive, school-based interventions; **(4)** caregiver urgently requires structured behavioral training to implement evidence-based safety protocols, transition supports, and reinforcement procedures with fidelity.

**Recommended intensity:** 10–12 hours/week, center-based with parent training component, consistent with severity profile, safety risk level, and caregiver availability. Expected outcomes for the 6-month authorization period include reduction of elopement attempts from 10/day to ≤2/day; reduction of task refusal from 25/day to ≤8/day; reduction of aggression from 5/day to ≤1/day; caregiver-implemented First-Then transition protocol with ≥80% independent delivery accuracy; mastery of PECS-based communication exchange for 3 functional requests.`,
    coOccurringDiagnoses: [],
    medications: [],
    hasPriorABA: false,
    priorABAHistory: [],
    recommendedHoursPerWeek: '12',
    recommendedSetting: 'Center-based',
  },
  crisis_plan: {
    notes: 'No prior crisis events, hospitalizations, or law enforcement involvement. Elopement is the highest-risk behavior — all crisis protocols prioritize preventing and responding to elopement. Aggression incidents are low-severity and managed with standard redirectional strategies. Charlotte responds to calm, low-tone verbal cues when not at peak agitation. Return to baseline: 5–10 min with space and low demand. Caregiver has reviewed and signed crisis plan.',
    transcript: "When she's about to run I can sometimes see it coming — she gets this look, kind of goes still, and then she's off. If I block her physically she escalates to hitting immediately. The best thing is to get in front of her calmly before she bolts and redirect to something she likes. Once she's in full tantrum, I just give her space and wait it out. Talking to her when she's in it makes everything worse. Usually 5 to 10 minutes and she's done and she comes to me and wants a hug. The hitting — I just block with my arm and don't react. Reacting makes it go on longer.",
    completionState: 'complete',
    emergencyContacts: [
      { id: 'ec-c1', name: 'Jennifer Davis', relationship: 'Mother', phone: '(561) 555-0122', role: 'Primary' },
      { id: 'ec-c2', name: 'Robert Davis', relationship: 'Father (non-custodial)', phone: '(561) 555-0135', role: 'Backup' },
      { id: 'ec-c3', name: 'Dr. Michelle Park', relationship: 'Pediatrician', phone: '(561) 555-0200', role: 'Medical' },
    ],
    warningSignsSelected: [
      'Goes still / body tenses before elopement',
      'Elevated vocal volume',
      'Crying onset',
      'Reaching for door or gate',
    ],
    warningSignsCustom: 'Eye contact breaks and Charlotte scans for an exit — most reliable early indicator of imminent elopement attempt.',
    deEscalationWorks: [
      'Calm, low-tone verbal redirect before peak agitation',
      'Offer preferred item or activity as transition',
      'Physical space / no hovering',
      'Wait quietly during tantrum without verbal prompts',
    ],
    deEscalationWorsens: [
      'Physical blocking once elopement has initiated',
      'Repeated verbal prompts during tantrum',
      'Raised voice or urgent tone',
      'Removing preferred item during tantrum',
    ],
    deEscalationNotes: 'Physical blocking after elopement initiates immediately escalates to hitting. Intercept before movement begins or redirect via preferred item. During tantrums: minimum interaction, wait for the natural end of the episode before re-engaging.',
    bcbaCallMinutes: '10',
    bcbaCallIncidents: '2',
    bcbaCallWindow: '15',
    call911Threshold: true,
    call911Notes: 'Elopement into vehicular traffic or other high-risk environment and child cannot be safely retrieved. Any injury requiring medical attention.',
    sessionSuspendThreshold: false,
    baselineReturnMin: '5',
    baselineReturnMax: '10',
    postCrisisDebrief: false,
    remorsePresentPostCrisis: true,
    remorseNotes: 'Charlotte typically seeks physical affection (hug) 2–5 minutes after returning to baseline — this is the reliable end-of-episode signal and the moment to re-engage. Do not re-present the demand that precipitated the episode immediately; allow 5 min minimum before reintroducing.',
    medicalContraindications: ['No prone restraint', 'No physical blocking once elopement has initiated'],
    medicalNotes: 'No medications. No allergies. No seizure history. No medical contraindications to behavioral intervention. Physical blocking is contraindicated not for medical but for behavioral reasons — escalates to hitting.',
    caregiverSignedCrisisPlan: true,
    rbtTrainedOnPlan: true,
    crisisPlanInBsp: true,
  },
  behavior_targets: {
    completionState: 'complete',
    approvalState: 'approved',
    notes: 'Target 1: Tantrum. Topography: crying, screaming, drop to floor. Frequency: 5x/day. Ant: denied access, transitions. Function: escape + access. Target 2: Elopement. Topography: running from caregiver without permission. Frequency: 10x/day. Ant: transitions, open doors. Function: escape + automatic. Target 3: Task Refusal. Topography: verbal refusal, turning/walking away. Frequency: 25x/day. Ant: non-preferred demands. Function: escape. Target 4: Aggression. Topography: hitting, pushing. Frequency: 5x/day. Ant: demand presentation, item removal. Function: escape + access.',
    behaviorTargets: [
      {
        id: 'bt-c10-1',
        behaviorName: 'Tantrum',
        operationalDefinition: 'CLIENT cries, screams, and/or drops to the floor following a denied access event or transition demand. Episode begins at first vocalization or drop and ends when CLIENT is standing quietly for 10 consecutive seconds.',
        topography: ['Crying/screaming', 'Drop/go limp'],
        frequencyPerDay: '5', frequencyUnit: 'day',
        durationSeconds: '5', durationUnit: 'minutes',
        intensityRating: 'Moderate',
        antecedents: 'Denied access to preferred items or activities; transition away from preferred activity; delayed reinforcement',
        primaryTargets: ['Self', 'Parent / Caregiver'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '5',
        targetFrequency: '1',
        stoSteps: [
          { id: 'sto-c10-1-1', targetFrequency: '4', durationWeeks: '4', note: '' },
          { id: 'sto-c10-1-2', targetFrequency: '3', durationWeeks: '4', note: '' },
          { id: 'sto-c10-1-3', targetFrequency: '2', durationWeeks: '4', note: '' },
          { id: 'sto-c10-1-4', targetFrequency: '1', durationWeeks: '4', note: '' },
        ],
        measurementSystem: 'Event Recording',
        priorFBACompleted: false, priorBIPCompleted: false,
        notes: '',
      },
      {
        id: 'bt-c10-2',
        behaviorName: 'Elopement',
        operationalDefinition: 'CLIENT moves more than 10 feet from the supervising adult without permission, defined as failing to stop within 3 seconds of a verbal cue ("stop" or "come back").',
        topography: ['Running', 'Moving away without permission'],
        frequencyPerDay: '10', frequencyUnit: 'day',
        durationSeconds: '30', durationUnit: 'seconds',
        intensityRating: 'Severe',
        antecedents: 'Transitions, open doors, community settings, demand presentation',
        primaryTargets: ['Self'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '10',
        targetFrequency: '0',
        stoSteps: [
          { id: 'sto-c10-2-1', targetFrequency: '7', durationWeeks: '4', note: '' },
          { id: 'sto-c10-2-2', targetFrequency: '4', durationWeeks: '4', note: '' },
          { id: 'sto-c10-2-3', targetFrequency: '2', durationWeeks: '4', note: '' },
          { id: 'sto-c10-2-4', targetFrequency: '0', durationWeeks: '4', note: '' },
        ],
        measurementSystem: 'Event Recording',
        priorFBACompleted: false, priorBIPCompleted: false,
        notes: '',
      },
      {
        id: 'bt-c10-3',
        behaviorName: 'Task Refusal',
        operationalDefinition: 'CLIENT fails to comply with an instruction within 5 seconds, including turning away, saying "no," pushing materials away, or walking away from the task.',
        topography: ['Verbal refusal', 'Turning away', 'Walking away from task'],
        frequencyPerDay: '25', frequencyUnit: 'day',
        durationSeconds: '2', durationUnit: 'minutes',
        intensityRating: 'Mild',
        antecedents: 'Non-preferred demands, academic tasks, hygiene routines',
        primaryTargets: ['Self'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '25',
        targetFrequency: '5',
        measurementSystem: 'Event Recording',
        priorFBACompleted: false, priorBIPCompleted: false,
        notes: '',
        stoSteps: [
          { id: 'bts-c10-3-1', targetFrequency: '15', durationWeeks: '4', note: 'Reduce to ≤15 refusals/day using visual schedule and first-then supports' },
          { id: 'bts-c10-3-2', targetFrequency: '10', durationWeeks: '4', note: 'Reduce to ≤10 refusals/day; begin fading visual prompts for preferred tasks' },
          { id: 'bts-c10-3-3', targetFrequency: '5', durationWeeks: '8', note: 'Reduce to ≤5 refusals/day across academic, hygiene, and non-preferred tasks' },
        ],
      },
      {
        id: 'bt-c10-4',
        behaviorName: 'Aggression',
        operationalDefinition: 'CLIENT makes forceful physical contact with another person by hitting or pushing. Each discrete contact event is scored as one instance. Accidental bumping is not scored.',
        topography: ['Open-hand hitting', 'Pushing'],
        frequencyPerDay: '5', frequencyUnit: 'day',
        durationSeconds: '2', durationUnit: 'seconds',
        intensityRating: 'Moderate',
        antecedents: 'Demand presentation, item removal, transition',
        primaryTargets: ['Parent / Caregiver'],
        hypothesizedFunction: 'Escape',
        baselineFrequency: '5',
        targetFrequency: '0',
        measurementSystem: 'Event Recording',
        priorFBACompleted: false, priorBIPCompleted: false,
        notes: '',
        stoSteps: [
          { id: 'bts-c10-4-1', targetFrequency: '2', durationWeeks: '4', note: 'Reduce to ≤2 incidents/day with FCT "break" card prompted before demand escalation' },
          { id: 'bts-c10-4-2', targetFrequency: '0', durationWeeks: '8', note: 'Zero incidents for 3 consecutive weeks; FCT request independent across demand contexts' },
        ],
      },
    ],
  },
  skill_acquisitions: {
    completionState: 'complete',
    approvalState: 'approved',
    notes: 'Family priority targets: (1) functional communication to replace tantrums and elopement; (2) transition compliance; (3) self-regulation/emotion identification.',
    skillGoals: [
      {
        id: 'sg-c10-1',
        domain: 'Communication',
        targetSkill: 'Mand Training (Functional Requesting)',
        operationalDefinition: 'Charlotte independently selects and exchanges a communication symbol or vocalizes a 1–2 word request for a preferred item or activity within 10 seconds of access opportunity, without physical or gestural prompting.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Discrete Trial Training (DTT)', 'Natural Environment Teaching (NET)'],
        teachingStrategiesOther: '',
        promptingLevel: 'Gestural', promptingLevelCombination: '',
        baselinePercent: '15', baselineOpportunities: '20',
        baselinePromptingLevel: 'Gestural',
        baselinePromptingDesc: 'Gestural prompt required for 85% of request opportunities; vocalizes approximations with full prompt in 3 of 20 probes',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Home + clinic (minimum 2 settings)',
        masteryCriteriaPromptingLevel: 'Independent',
        masteryCriteriaPrompting: 'Independent — no gestural or verbal prompt',
        stoSteps: [
          { id: 'sg-c10-1-s1', targetPercent: '30', skillDescription: 'requesting preferred items using 1-word vocalizations with gestural model', durationWeeks: '4' },
          { id: 'sg-c10-1-s2', targetPercent: '60', skillDescription: 'requesting preferred items using 1–2 word phrases without physical prompt', durationWeeks: '4' },
        ],
        stoPercent: '', stoSkillDescription: '', stoWeeks: '', sto: '',
        generalizationNotes: 'Generalize across both parents, RBT, and school staff. Priority probe: denied access to iPad (primary Tantrum antecedent) — mand for "break" or "help" must precede all elopement and tantrum prevention protocols.',
      },
      {
        id: 'sg-c10-2',
        domain: 'Adaptive / Self-Help',
        targetSkill: 'Transition Compliance (First-Then)',
        operationalDefinition: 'Charlotte transitions from a preferred to a non-preferred activity within 60 seconds of a transition cue (verbal + First-Then visual), without engaging in elopement or tantrum behavior, when a 2-minute advance warning and First-Then visual are provided.',
        definitionIsAiGenerated: false, definitionIsLoading: false,
        teachingStrategies: ['Natural Environment Teaching (NET)', 'Task Analysis / Chaining'],
        teachingStrategiesOther: '',
        promptingLevel: 'Verbal', promptingLevelCombination: '',
        baselinePercent: '10', baselineOpportunities: '20',
        baselinePromptingLevel: 'Full Physical',
        baselinePromptingDesc: 'Transitions result in elopement or tantrum approximately 90% of the time; successful transition requires full verbal + physical prompt chain',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'Home + community',
        masteryCriteriaPromptingLevel: 'Verbal',
        masteryCriteriaPrompting: 'Verbal cue only; no physical or gestural prompt',
        stoSteps: [
          { id: 'sg-c10-2-s1', targetPercent: '40', skillDescription: 'complying with transition within 60s given First-Then visual + verbal warning', durationWeeks: '6' },
          { id: 'sg-c10-2-s2', targetPercent: '65', skillDescription: 'complying with transition across 3 transition types without elopement', durationWeeks: '6' },
        ],
        stoPercent: '', stoSkillDescription: '', stoWeeks: '', sto: '',
        generalizationNotes: 'Coordinate transition protocol with school staff. Fade First-Then visual to verbal-only once 80% criterion met in 2 settings.',
      },
    ],
  },
  caregiver_training: {
    completionState: 'complete',
    approvalState: 'approved',
    notes: 'Jennifer Davis is primary implementer. Highly motivated and engaged. Key targets: Premack principle delivery consistency and reinforcement timing.',
    caregiverBaselines: { premack_baseline: '20', reinforcement_baseline: '35' },
    trainingFormat: ['In-session coaching', 'Parent sessions'],
    trainingFrequency: '2x/week',
    trainingBarriers: 'Work schedule limits weekday session availability.',
    caregiverStrengths: 'Highly motivated and receptive to feedback. Good insight into behavioral functions.',
    caregiverTrainingTargets: [
      {
        id: 'ctgt_1',
        isStandard: true,
        standardKey: 'premack',
        goalName: 'Consistent Premack delivery',
        operationalDefinition: 'Caregiver delivers access to preferred activity only after target behavior is performed, not before or without it',
        baselinePercent: 20,
        baselineContext: 'Observed during initial intake home visit',
        stoSteps: [
          { id: 'cgt-premack-c10-1', targetPercent: '45', durationWeeks: '6', note: 'BCBA-guided practice with visual First-Then board; demand follow-through emphasized' },
          { id: 'cgt-premack-c10-2', targetPercent: '70', durationWeeks: '6', note: 'Independent delivery across tasks; generalized to father with written guide' },
        ],
        ltoPercent: 90, ltoSessions: 5, lto: '',
      },
      {
        id: 'ctgt_2',
        isStandard: true,
        standardKey: 'reinforcement',
        goalName: 'Reinforcement timing and magnitude',
        operationalDefinition: 'Caregiver delivers reinforcer within 3 seconds of target behavior at a level matched to the effort required',
        baselinePercent: 35,
        baselineContext: 'Observed during initial intake home visit',
        stoSteps: [
          { id: 'cgt-reinf-c10-1', targetPercent: '55', durationWeeks: '4', note: 'Within-3-second delivery with effort-matched magnitude during coaching sessions' },
          { id: 'cgt-reinf-c10-2', targetPercent: '75', durationWeeks: '4', note: 'Generalized across routines; praise specificity and consistency maintained independently' },
        ],
        ltoPercent: 90, ltoSessions: 5, lto: '',
      },
    ],
  },
};

export const SEED_CLIENTS = () => [
  { id:'c1',  name:'Liam Rodriguez',  dob:'2018-03-15', phone:'(786) 555-0121', address:'1432 SW 8th St, Miami, FL 33135',          insurer_name:'Aetna',        health_plan_name:'Aetna Better Health of Florida',              member_id:'AET-884421', group_number:'G-44210', referring_provider:'Dr. Maria Santos',  referring_provider_npi:'1245319599', referring_provider_phone:'(786) 555-0300', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Maria Rodriguez', parent_relationship:'Mother', parent_email:'m.rodriguez@gmail.com', preferred_language:'English', source:'imported',    referral_date:'2026-04-10', stage_entered_at:'2026-04-10T09:00:00.000Z', stage:'intake',          denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c2',  name:'Sophia Kim',      dob:'2019-07-22', phone:'(305) 555-0198', address:'7821 N Kendall Dr, Miami, FL 33156',        insurer_name:'UnitedHealth', health_plan_name:'UnitedHealthcare Community Plan of Florida',   member_id:'UHC-229934', group_number:'G-77811', referring_provider:'Dr. John Park',      referring_provider_npi:'1497758544', referring_provider_phone:'(305) 555-0410', gender:'Female', diagnosis:'ASD Level 1', icd10:'F84.0', parent_name:'James Kim', parent_relationship:'Father', parent_email:'j.kim@gmail.com', preferred_language:'English', source:'crm_created', referral_date:'2026-04-15', stage_entered_at:'2026-04-15T10:30:00.000Z', stage:'intake',          denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c3',  name:'Noah Carter',     dob:'2017-11-08', phone:'(954) 555-0143', address:'3201 Coral Way, Coral Gables, FL 33134',   insurer_name:'Florida Blue', health_plan_name:'Florida Blue Community Health Plan',          member_id:'FLB-558871', group_number:'G-12390', referring_provider:'Dr. Elaine Torres',  referring_provider_npi:'1083712934', referring_provider_phone:'(954) 555-0520', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Rachel Carter', parent_relationship:'Mother', parent_email:'r.carter@gmail.com', preferred_language:'English', source:'imported',    referral_date:'2026-03-28', stage_entered_at:'2026-04-01T08:00:00.000Z', stage:'auth_assessment', denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c4',  name:'Emma Thompson',   dob:'2020-01-30', phone:'(561) 555-0167', address:'9400 Glades Rd, Boca Raton, FL 33434',     insurer_name:'Humana',       health_plan_name:'Humana Healthy Horizons in Florida',          member_id:'HUM-334490', group_number:'G-98712', referring_provider:'Dr. Robert Chen',    referring_provider_npi:'1336198450', referring_provider_phone:'(561) 555-0200', gender:'Female', diagnosis:'ASD Level 3', icd10:'F84.0', parent_name:'Linda Thompson', parent_relationship:'Mother', parent_email:'linda.thompson@gmail.com', preferred_language:'English', source:'crm_created', referral_date:'2026-04-02', stage_entered_at:'2026-04-22T09:15:00.000Z', stage:'assessment',      denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c5',  name:'Oliver Patel',    dob:'2018-06-12', phone:'(786) 555-0134', address:'2100 Biscayne Blvd, Miami, FL 33137',      insurer_name:'Cigna',        health_plan_name:'Cigna Healthspring Florida',                   member_id:'CIG-778823', group_number:'G-55023', referring_provider:'Dr. Ana Flores',     referring_provider_npi:'1619028374', referring_provider_phone:'(305) 555-0220', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Priya Patel', parent_relationship:'Mother', parent_email:'priya.patel@gmail.com', preferred_language:'English', source:'imported',    referral_date:'2026-03-15', stage_entered_at:'2026-06-04T09:00:00.000Z', stage:'submitted',       denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c6',  name:'Ava Nguyen',      dob:'2019-09-05', phone:'(305) 555-0189', address:'5540 NW 7th Ave, Miami, FL 33127',         insurer_name:'Aetna',        health_plan_name:'Aetna Better Health of Florida',              member_id:'AET-991102', group_number:'G-44210', referring_provider:'Dr. Luis Mendez',    referring_provider_npi:'1750892013', referring_provider_phone:'(305) 555-0630', gender:'Female', diagnosis:'ASD Level 1', icd10:'F84.0', parent_name:'Trang Nguyen', parent_relationship:'Mother', parent_email:'trang.nguyen@gmail.com', preferred_language:'Vietnamese', source:'crm_created', referral_date:'2026-02-28', stage_entered_at:'2026-05-19T14:00:00.000Z', stage:'submitted',       denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c7',  name:'Ethan Williams',  dob:'2017-04-18', phone:'(954) 555-0156', address:'800 E Broward Blvd, Ft. Lauderdale, FL',   insurer_name:'Florida Blue', health_plan_name:'Florida Blue Community Health Plan',          member_id:'FLB-447721', group_number:'G-12390', referring_provider:'Dr. Sarah Johnson',  referring_provider_npi:'1821934056', referring_provider_phone:'(954) 555-0740', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Michael Williams', parent_relationship:'Father', parent_email:'m.williams@gmail.com', preferred_language:'English', source:'imported',    referral_date:'2026-02-10', stage_entered_at:'2026-04-05T10:00:00.000Z', stage:'denied',          denial_reason:'Medical necessity not established', bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c8',  name:'Isabella Moore',  dob:'2018-12-25', phone:'(786) 555-0177', address:'6100 SW 57th Ave, South Miami, FL 33143',  insurer_name:'UnitedHealth', health_plan_name:'UnitedHealthcare Community Plan of Florida',   member_id:'UHC-883312', group_number:'G-77811', referring_provider:'Dr. Mark Davis',     referring_provider_npi:'1902847123', referring_provider_phone:'(786) 555-0850', gender:'Female', diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Sarah Moore', parent_relationship:'Mother', parent_email:'s.moore@gmail.com', preferred_language:'English', source:'crm_created', referral_date:'2026-01-20', stage_entered_at:'2026-03-10T09:00:00.000Z', stage:'authorized',      denial_reason:null,                         bcba_id:'u2', rbt_id:'u4', auth_expiry_date:'2026-12-31', reauth_active:false },
  { id:'c9',  name:'Mason Garcia',    dob:'2019-03-14', phone:'(305) 555-0145', address:'11200 SW 8th St, Miami, FL 33174',         insurer_name:'Humana',       health_plan_name:'Humana Healthy Horizons in Florida',          member_id:'HUM-229908', group_number:'G-98712', referring_provider:'Dr. Patricia Lee',   referring_provider_npi:'1073619284', referring_provider_phone:'(305) 555-0960', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Carmen Garcia', parent_relationship:'Mother', parent_email:'carmen.garcia@gmail.com', preferred_language:'Spanish', source:'imported',    referral_date:'2026-01-05', stage_entered_at:'2026-03-25T08:30:00.000Z', stage:'staffing',        denial_reason:null,                         bcba_id:'u2', rbt_id:'u4', auth_expiry_date:'2026-12-15', reauth_active:false },
  { id:'c10', name:'Charlotte Davis', dob:'2018-08-22', phone:'(561) 555-0122', address:'3400 PGA Blvd, Palm Beach Gardens, FL',    insurer_name:'Cigna',        health_plan_name:'Cigna Healthspring Florida',                   member_id:'CIG-556634', group_number:'G-55023', referring_provider:'Dr. James Wilson',   referring_provider_npi:'1154728390', referring_provider_phone:'(561) 555-0170', gender:'Female', diagnosis:'ASD Level 1', icd10:'F84.0', parent_name:'Jennifer Davis', parent_relationship:'Mother', parent_email:'j.davis@gmail.com', preferred_language:'English', source:'crm_created', referral_date:'2025-11-12', stage_entered_at:'2026-01-20T10:00:00.000Z', stage:'services',        denial_reason:null,                         bcba_id:'u2', rbt_id:'u4', auth_expiry_date:'2026-07-31', reauth_active:true  },
  { id:'c11', name:'James Martinez',  dob:'2017-05-30', phone:'(786) 555-0190', address:'1800 Coral Way, Miami, FL 33145',          insurer_name:'Aetna',        health_plan_name:'Aetna Better Health of Florida',              member_id:'AET-664433', group_number:'G-44210', referring_provider:'Dr. Angela Rivera',  referring_provider_npi:'1235816047', referring_provider_phone:'(786) 555-0280', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Rosa Martinez', parent_relationship:'Mother', parent_email:'r.martinez@gmail.com', preferred_language:'Spanish', source:'imported',    referral_date:'2025-10-08', stage_entered_at:'2025-12-15T09:00:00.000Z', stage:'services',        denial_reason:null,                         bcba_id:'s1', rbt_id:'s5', auth_expiry_date:'2026-05-20', reauth_active:true  },
  { id:'c12', name:'Amelia Wilson',   dob:'2020-02-14', phone:'(954) 555-0133', address:'2800 Hollywood Blvd, Hollywood, FL 33020', insurer_name:'Florida Blue', health_plan_name:'Florida Blue Community Health Plan',          member_id:'FLB-112298', group_number:'G-12390', referring_provider:'Dr. Kevin Brown',    referring_provider_npi:'1316924875', referring_provider_phone:'(954) 555-0390', gender:'Female', diagnosis:'ASD Level 3', icd10:'F84.0', parent_name:'Thomas Wilson', parent_relationship:'Father', parent_email:'t.wilson@gmail.com', preferred_language:'English', source:'crm_created', referral_date:'2026-03-01', stage_entered_at:'2026-03-05T11:00:00.000Z', stage:'auth_assessment', denial_reason:null,                         bcba_id:'s2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c13', name:'Marcus Rivera',   dob:'2017-03-04', phone:'(305) 555-0302', address:'4820 SW 137th Ave, Miami, FL 33175',       insurer_name:'Florida Blue', health_plan_name:'Florida Blue Community Health Plan',          member_id:'FLB-774421', group_number:'G-12390', referring_provider:'Dr. Adriana Costa',  referring_provider_npi:'1407536982', referring_provider_phone:'(305) 555-0410', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Daniela Rivera', parent_relationship:'Mother', parent_email:'d.rivera@gmail.com', preferred_language:'Spanish', source:'imported',    referral_date:'2026-05-01', stage_entered_at:'2026-05-02T08:00:00.000Z', stage:'assessment',      denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c14', name:'Diego Reyes',     dob:'2018-06-12', phone:'(786) 555-0211', address:'3450 NW 5th Ave, Miami, FL 33127',         insurer_name:'Cigna',        health_plan_name:'Cigna Healthspring Florida',                   member_id:'CIG-884432', group_number:'G-55023', referring_provider:'Dr. Ana Flores',     referring_provider_npi:'1619028374', referring_provider_phone:'(305) 555-0220', gender:'Male',   diagnosis:'ASD Level 2', icd10:'F84.0', parent_name:'Ana Reyes', parent_relationship:'Mother', parent_email:'ana.reyes@gmail.com', preferred_language:'Spanish', source:'imported',    referral_date:'2026-03-20', stage_entered_at:'2026-05-28T10:00:00.000Z', stage:'plan_draft',      denial_reason:null,                         bcba_id:'u2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
].map(c => {
  const cl = mkChecklist();
  // Pre-complete c7 (Ethan Williams) denied checklist so resolve button is enabled
  if (c.id === 'c7') {
    cl.denied.denial_reason = 'Medical necessity not established';
    cl.denied.peer_to_peer_scheduled = true;
    cl.denied.supporting_docs = true;
    cl.denied.peer_to_peer_completed = true;
  }

  const SEED_NOTES = {
    c5: [
      { id:'on1', stage:'assessment',  text:'Initial caregiver interview completed with Priya Patel (~90 min). Escape function hypothesis strongly supported by intake data. Elopement safety plan discussed — wrist-to-wrist protocol recommended for community settings until treatment gains are established.', author:'Dr. Ana Reyes', timestamp:'2026-04-08T14:00:00Z' },
      { id:'on2', stage:'assessment',  text:'Direct observation (30 min, home): clear behavioral escalation on iPad removal demand — hitting within 2-3 seconds of instruction. No FCT repertoire observed. Oliver responded positively to First-Then visual cue when presented proactively before demand. Strong motor imitation confirmed. Vineland-3 and BASC-3 administered.', author:'Dr. Ana Reyes', timestamp:'2026-04-10T16:00:00Z' },
      { id:'on3', stage:'plan_draft',  text:'Treatment plan reviewed with Priya and Raj Patel (phone call, 45 min). Both parents supportive of FCT as primary approach. Raj expressed elopement safety as highest priority — confirmed wrist-strap interim protocol for community. Parent training schedule set for 2x/week alongside RBT sessions.', author:'Dr. Ana Reyes', timestamp:'2026-05-14T11:30:00Z' },
    ],
    c9: [
      { id:'n9b', stage:'staffing',  text:'RBT confirmed availability for 3x/week sessions starting next Monday. Parent agreed to morning slot.', author:'Tanya Reyes', timestamp:'2026-05-18T09:15:00Z' },
      { id:'n9a', stage:'authorized', text:'Called caregiver, left voicemail re: schedule change for upcoming assessment week.', author:'Dr. Priya Sharma', timestamp:'2026-05-15T14:32:00Z' },
    ],
    c10: [
      { id:'n10g', stage:'services',   text:'Reauth paperwork submitted to Cigna. Expect decision within 10 business days per rep. Included updated behavioral graphs, progress report, and Vineland-3 update.', author:'Dr. Ana Reyes', timestamp:'2026-05-14T11:05:00Z' },
      { id:'n10f', stage:'services',   text:'Jennifer reported Charlotte initiated a verbal request for "break" independently during a non-preferred task at home for the first time. Transition compliance up to ~60% per parent report. RBT confirmed similar gains in clinic. Updated STO tracking — Tantrum STO 3 nearly met.', author:'Dr. Ana Reyes', timestamp:'2026-05-01T09:30:00Z' },
      { id:'n10e', stage:'services',   text:'Supervision session with James Torres (30 min). Reviewed ABC data from past month. Discussed prompt fading plan for Mand Training — moving to gestural-only starting next week. Throwing objects emerging behavior is stabilizing; FCT "I need help" card introduced and James is collecting frequency data.', author:'Dr. Ana Reyes', timestamp:'2026-03-03T14:00:00Z' },
      { id:'n10d', stage:'services',   text:'Caregiver training session 2 completed with Jennifer Davis (60 min in-clinic). Role-played First-Then board delivery for transition routine. Jennifer\'s Premack delivery consistency has improved to ~45%. Reinforcement timing improving but still inconsistent on non-preferred tasks — will target specifically in session 3.', author:'Dr. Ana Reyes', timestamp:'2026-01-12T15:00:00Z' },
      { id:'n10c', stage:'plan_draft', text:'Treatment plan review call with Jennifer Davis (45 min). Reviewed all four behavior-reduction goals and two skill targets. Jennifer agreed with the STO schedule and First-Then transition protocol. Parent training set for 2x/month in-clinic. Signed treatment plan received by fax — uploading now.', author:'Dr. Ana Reyes', timestamp:'2026-01-05T13:00:00Z' },
      { id:'n10b', stage:'assessment', text:'Direct observation completed (45 min, clinic). All four target behaviors confirmed. Tantrum duration averaging ~8 min; Elopement clear escape function — immediately tries doors during transitions. Task refusal highest frequency (~25/day). BCBA observed strong imitation skills and good eye contact — favorable prognosis for Mand Training. Vineland-3 and BASC-3 administered and scored.', author:'Dr. Ana Reyes', timestamp:'2025-12-01T16:00:00Z' },
      { id:'n10a', stage:'assessment', text:'Caregiver interview completed with Jennifer Davis (~75 min). Confirmed ASD Level 1 diagnosis and all four target behaviors. Jennifer identified transition compliance as top priority — Charlotte elopement incidents have resulted in two near-miss safety events near roadways. First-Then visual support has shown promising early results at home per parent report. Assessment report generation queued.', author:'Dr. Ana Reyes', timestamp:'2025-11-25T14:30:00Z' },
    ],
    c11: [
      { id:'n11a', stage:'services',  text:'Discussed session frequency reduction with caregiver — agreed to move from 5x to 4x/week pending reauth approval.', author:'Dr. Rachel Kim', timestamp:'2026-05-17T10:20:00Z' },
    ],
  };

  const assessment_session =
    c.id === 'c4' ? makeFilledSession(c.id, c.name, c.bcba_id, 'Dr. Ana Reyes', EMMA_INTERVIEW_DATA, {
      dob:                c.dob,
      phone:              c.phone,
      address:            c.address,
      insurerName:        c.insurer_name,
      memberId:           c.member_id,
      groupNumber:        c.group_number,
      referringProvider:  c.referring_provider,
      referralDate:       c.referral_date,
      gender:             'Female',
      diagnosis:          'Autism Spectrum Disorder, Level 3',
      icd10:              'F84.0',
      medicaidId:         '',
      assessmentDate:     '2026-05-22',
      assessmentType:     'Initial',
      preferredLanguage:  'English',
      parentGuardianNames:'Linda & David Thompson',
      relationship:       'Parents',
      reasonForReferral:  'ABA evaluation for significant behavioral challenges and communication delays',
      _intakeMissingFields: [],
    }) :
    c.id === 'c13' ? makeFilledSession(c.id, c.name, c.bcba_id, 'Dr. Ana Reyes', MARCUS_INTERVIEW_DATA, {
      dob:                c.dob,
      phone:              c.phone,
      address:            c.address,
      insurerName:        c.insurer_name,
      memberId:           c.member_id,
      groupNumber:        c.group_number,
      referringProvider:  c.referring_provider,
      referralDate:       c.referral_date,
      gender:             'Male',
      diagnosis:          'Autism Spectrum Disorder, Level 2',
      icd10:              'F84.0',
      medicaidId:         'FL-MCD-88221',
      assessmentDate:     '2026-05-22',
      assessmentType:     'Initial',
      preferredLanguage:  'English',
      parentGuardianNames:'Daniela & Javier Rivera',
      relationship:       'Parents',
      reasonForReferral:  'ABA evaluation for behavioral escalation, ADL regression, and community avoidance',
      _intakeMissingFields: [],
    }) :
    c.id === 'c5' ? (() => {
      const s = makeFilledSession(c.id, c.name, c.bcba_id, 'Dr. Ana Reyes', OLIVER_INTERVIEW_DATA, {
        dob:                c.dob,
        phone:              c.phone,
        address:            c.address,
        insurerName:        c.insurer_name,
        memberId:           c.member_id,
        groupNumber:        c.group_number,
        referringProvider:  c.referring_provider,
        referralDate:       c.referral_date,
        gender:             'Male',
        diagnosis:          'Autism Spectrum Disorder, Level 2',
        icd10:              'F84.0',
        medicaidId:         '',
        assessmentDate:     '2026-04-18',
        assessmentType:     'Initial',
        preferredLanguage:  'English',
        parentGuardianNames:'Priya & Raj Patel',
        relationship:       'Parents',
        reasonForReferral:  'ABA evaluation for physical aggression, elopement safety risk, and hygiene refusal',
        _intakeMissingFields: [],
      });
      // Mark session as fully complete — BCBA exported the assessment report
      const sectionCount = Object.values(s.sections).filter(sec => sec.key !== 'demographics').length;
      return { ...s, status: 'complete', sectionsApproved: sectionCount };
    })() :
    c.stage === 'assessment' ? makeAssessmentSession(c.id, c.name, c.bcba_id, 'Dr. Ana Reyes', c) :
    null;

  // smart_assessment_session_id is only set after the BCBA exports the assessment (completes the session).
  // Clients still at 'assessment' stage have not exported yet — their session is in_progress,
  // so smart_assessment_session_id stays null; the bridge shows "Continue Smart Assessment →".
  // c5 (Oliver Patel) is at plan_draft — already exported, so his id is stamped.
  const smart_session_id = c.id === 'c5' && assessment_session
    ? assessment_session.id
    : null;

  // Oliver Patel: patch completed checklists, documents, and activity log
  if (c.id === 'c5') {
    cl.intake = { referral_form:true, insurance_card:true, cde:true, aba_prescription:true, consent_signed:true, demographics_confirmed:true, referral_source:'Dr. Ana Flores · (305) 555-0220', insurance_plan:'Cigna Health', member_id_verified:'CIG-884432 / G-55023', copay_deductible:'$0 copay, $0 deductible remaining', preferred_language:'English', insurance_verified:true, benefits_verified:true };
    cl.auth_assessment = { cde_confirmed:true, prescription_confirmed:true, referral_confirmed:true, prior_assessments:true, auth_submitted:true, submission_date:'2026-03-28', units_requested:'16', expected_response_date:'2026-04-11', auth_portal:'Availity', reference_number:'CIG-AUTH-2026-0318-4821', cpt_97151_received:true, bcba_assigned:true };
    cl.assessment = { bcba_confirmed:true, caregiver_interview:true, direct_observation:true, vineland3:true, vineland3_date:'2026-04-10', basc3:true, basc3_date:'2026-04-10', additional_assessments:true, smart_assessment_submitted:true, baseline_data:true, behaviors_identified:true, final_assessment_report:true };
    cl.plan_draft = { medical_necessity:true, skill_targets:true, behavior_goals:true, intervention_strategies:true, hours_97153:'80', hours_97155:'12', hours_97156:'8', data_methodology:'Trial-by-trial data collection with same-day ABC notation', plan_start_date:'2026-06-01', plan_end_date:'2026-11-30', sessions_per_week:'10', session_duration_min:'120', baseline_graphs:true, ai_draft_approved:true, treatment_plan_finalized:true };
    const OLIVER_DOCS = [
      { id:'odoc1', type:'referral_form',      label:'Oliver_Patel_ABA_Referral_Dr_Flores.pdf',              uploaded_at:'2026-03-15T10:00:00.000Z', by:'Admin User',     stage:'intake'          },
      { id:'odoc2', type:'insurance_card',     label:'Cigna_Insurance_Card_Oliver_Patel.pdf',                 uploaded_at:'2026-03-15T10:05:00.000Z', by:'Admin User',     stage:'intake'          },
      { id:'odoc3', type:'cde',                label:'Oliver_Patel_CDE_Dr_Flores_2024.pdf',                   uploaded_at:'2026-03-15T10:10:00.000Z', by:'Admin User',     stage:'intake'          },
      { id:'odoc4', type:'aba_prescription',   label:'Oliver_Patel_ABA_Script_2026.pdf',                      uploaded_at:'2026-03-15T10:15:00.000Z', by:'Admin User',     stage:'intake'          },
      { id:'odoc5', type:'prior_assessments',  label:'Oliver_Patel_Neuropsych_Eval_Dr_Flores_2024.pdf',       uploaded_at:'2026-03-28T09:00:00.000Z', by:'Dr. Ana Reyes',  stage:'auth_assessment' },
      { id:'odoc6', type:'assessment_draft',   label:'Oliver_Patel_ABA_Assessment_Draft_2026-04-18.docx',     uploaded_at:'2026-04-18T16:30:00.000Z', by:'Dr. Ana Reyes',  stage:'assessment'      },
      { id:'odoc7', type:'final_assessment',   label:'Oliver_Patel_ABA_Assessment_FINAL_2026-05-10.pdf',      uploaded_at:'2026-05-10T11:00:00.000Z', by:'Dr. Ana Reyes',  stage:'assessment'      },
    ];
    const OLIVER_LOG = [
      // newest first — matches app prepend behavior
      { id:'olog1',  action:'Moved to Submitted',                                                           by:'Dr. Ana Reyes', ts:'2026-06-04T09:00:00Z' },
      { id:'olog2',  action:'Checked: Treatment plan finalized',                                            by:'Dr. Ana Reyes', ts:'2026-05-19T14:00:00Z' },
      { id:'olog3',  action:'Checked: AI draft reviewed and approved by BCBA',                             by:'Dr. Ana Reyes', ts:'2026-05-19T13:45:00Z' },
      { id:'olog4',  action:'Updated: Data-collection methodology',                                        by:'Dr. Ana Reyes', ts:'2026-05-19T13:30:00Z' },
      { id:'olog5',  action:'Updated: Supervision & caregiver training hours',                             by:'Dr. Ana Reyes', ts:'2026-05-13T10:00:00Z' },
      { id:'olog6',  action:'Moved to Plan Draft',                                                         by:'Dr. Ana Reyes', ts:'2026-05-10T12:00:00Z' },
      { id:'olog7',  action:'Uploaded: Final assessment report uploaded — Oliver_Patel_ABA_Assessment_FINAL.docx', by:'Dr. Ana Reyes', ts:'2026-05-10T11:15:00Z' },
      { id:'olog8',  action:'Smart Assessment continued',                                                  by:'Dr. Ana Reyes', ts:'2026-04-18T16:00:00Z' },
      { id:'olog9',  action:'Checked: Caregiver interview completed',                                      by:'Dr. Ana Reyes', ts:'2026-04-08T13:00:00Z' },
      { id:'olog10', action:'Moved to Assessment',                                                         by:'Admin User',    ts:'2026-03-28T11:00:00Z' },
      { id:'olog11', action:'BCBA assigned: Dr. Ana Reyes',                                                by:'Admin User',    ts:'2026-03-25T11:00:00Z' },
      { id:'olog12', action:'Checked: CPT 97151 authorization received',                                   by:'Admin User',    ts:'2026-03-25T10:45:00Z' },
      { id:'olog13', action:'Updated: Submission reference number',                                        by:'Dr. Ana Reyes', ts:'2026-03-18T10:30:00Z' },
      { id:'olog14', action:'Checked: Authorization submitted to insurer',                                 by:'Dr. Ana Reyes', ts:'2026-03-18T10:15:00Z' },
      { id:'olog15', action:'Moved to Auth Assessment',                                                    by:'Admin User',    ts:'2026-03-16T14:00:00Z' },
      { id:'olog16', action:'Checked: Benefits verification completed',                                    by:'Admin User',    ts:'2026-03-16T13:45:00Z' },
      { id:'olog17', action:'Checked: Insurance information verified',                                     by:'Admin User',    ts:'2026-03-16T13:30:00Z' },
      { id:'olog18', action:'Uploaded: ABA prescription / script',                                         by:'Admin User',    ts:'2026-03-15T16:00:00Z' },
      { id:'olog19', action:'Uploaded: Comprehensive Diagnostic Evaluation (CDE)',                         by:'Admin User',    ts:'2026-03-15T15:30:00Z' },
      { id:'olog20', action:'Uploaded: Insurance card',                                                    by:'Admin User',    ts:'2026-03-15T15:00:00Z' },
      { id:'olog21', action:'Uploaded: Referral request form',                                             by:'Admin User',    ts:'2026-03-15T09:00:00Z' },
    ];
    return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id, checklist:cl, documents:OLIVER_DOCS, activity_log:OLIVER_LOG, case_notes: SEED_NOTES['c5'], assessment_session, service_session_logs: [], caregiver_training_session_logs: [] };
  }

  // ── c14 Diego Reyes — plan_draft (same clinical profile as Oliver) ──────────────
  if (c.id === 'c14') {
    cl.intake        = { referral_form:true, insurance_card:true, cde:true, aba_prescription:true, consent_signed:true, demographics_confirmed:true, referral_source:'Primary care physician — Dr. Ana Flores', insurance_plan:'Cigna Health', member_id_verified:'CIG-884432', copay_deductible:'$0 copay, $0 deductible remaining', insurance_verified:true, benefits_verified:true };
    cl.auth_assessment = { cde_confirmed:true, prescription_confirmed:true, referral_confirmed:true, prior_assessments:true, auth_submitted:true, submission_date:'2026-04-01', units_requested:'16', expected_response_date:'2026-04-15', auth_portal:'Availity', reference_number:'CIG-AUTH-2026-0322-7714', cpt_97151_received:true, bcba_assigned:true };
    cl.assessment    = { bcba_confirmed:true, caregiver_interview:true, direct_observation:true, vineland3:true, vineland3_date:'2026-04-15', basc3:true, basc3_date:'2026-04-15', additional_assessments:true, smart_assessment_submitted:true, baseline_data:true, behaviors_identified:true, final_assessment_report:true };
    cl.plan_draft    = { medical_necessity:true, skill_targets:true, behavior_goals:true, intervention_strategies:true, hours_97153:'80', hours_97155:'12', hours_97156:'8', data_methodology:'', plan_start_date:'2026-06-01', plan_end_date:'2026-11-30', sessions_per_week:'10', session_duration_min:'120', baseline_graphs:true, ai_draft_approved:false, treatment_plan_finalized:false };
    const DIEGO_DOCS = [
      { id:'ddoc1', type:'referral_form',    label:'Diego_Reyes_ABA_Referral_Dr_Flores.pdf',              uploaded_at:'2026-03-20T10:00:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'ddoc2', type:'insurance_card',   label:'Cigna_Insurance_Card_Diego_Reyes.pdf',                 uploaded_at:'2026-03-20T10:05:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'ddoc3', type:'cde',              label:'Diego_Reyes_CDE_Dr_Flores_2024.pdf',                   uploaded_at:'2026-03-20T10:10:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'ddoc4', type:'aba_prescription', label:'Diego_Reyes_ABA_Script_2026.pdf',                      uploaded_at:'2026-03-20T10:15:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'ddoc5', type:'prior_assessments',label:'Diego_Reyes_Neuropsych_Eval_Dr_Flores_2024.pdf',       uploaded_at:'2026-04-02T09:00:00.000Z', by:'Dr. Ana Reyes', stage:'auth_assessment' },
      { id:'ddoc6', type:'assessment_draft', label:'Diego_Reyes_ABA_Assessment_Draft_2026-04-25.docx',     uploaded_at:'2026-04-25T16:30:00.000Z', by:'Dr. Ana Reyes', stage:'assessment'      },
      { id:'ddoc7', type:'final_assessment', label:'Diego_Reyes_ABA_Assessment_FINAL_2026-05-15.pdf',       uploaded_at:'2026-05-15T11:00:00.000Z', by:'Dr. Ana Reyes', stage:'assessment'      },
    ];
    const DIEGO_LOG = [
      { id:'dlog1',  action:'Moved to Plan Draft',                                                         by:'Dr. Ana Reyes', ts:'2026-05-28T10:00:00Z' },
      { id:'dlog2',  action:'Uploaded: Final assessment report uploaded — Diego_Reyes_ABA_Assessment_FINAL.docx', by:'Dr. Ana Reyes', ts:'2026-05-15T11:15:00Z' },
      { id:'dlog3',  action:'Smart Assessment continued',                                                  by:'Dr. Ana Reyes', ts:'2026-04-25T16:00:00Z' },
      { id:'dlog4',  action:'Checked: Caregiver interview completed',                                      by:'Dr. Ana Reyes', ts:'2026-04-12T13:00:00Z' },
      { id:'dlog5',  action:'Moved to Assessment',                                                         by:'Admin User',    ts:'2026-04-02T11:00:00Z' },
      { id:'dlog6',  action:'BCBA assigned: Dr. Ana Reyes',                                                by:'Admin User',    ts:'2026-03-30T11:00:00Z' },
      { id:'dlog7',  action:'Checked: CPT 97151 authorization received',                                   by:'Admin User',    ts:'2026-03-30T10:45:00Z' },
      { id:'dlog8',  action:'Updated: Submission reference number',                                        by:'Dr. Ana Reyes', ts:'2026-03-22T10:30:00Z' },
      { id:'dlog9',  action:'Checked: Authorization submitted to insurer',                                 by:'Dr. Ana Reyes', ts:'2026-03-22T10:15:00Z' },
      { id:'dlog10', action:'Moved to Auth Assessment',                                                    by:'Admin User',    ts:'2026-03-21T14:00:00Z' },
      { id:'dlog11', action:'Checked: Benefits verification completed',                                    by:'Admin User',    ts:'2026-03-21T13:45:00Z' },
      { id:'dlog12', action:'Uploaded: Referral request form',                                             by:'Admin User',    ts:'2026-03-20T09:00:00Z' },
    ];
    const assessment_session_diego = (() => {
      const s = makeFilledSession(c.id, c.name, c.bcba_id, 'Dr. Ana Reyes', OLIVER_INTERVIEW_DATA, {
        gender:'Male', diagnosis:'Autism Spectrum Disorder, Level 2', icd10:'F84.0',
        assessmentDate:'2026-04-25', assessmentType:'Initial',
        parentGuardianNames:'Carmen & Rafael Reyes', relationship:'Parents',
        reasonForReferral:'ABA evaluation for physical aggression, elopement safety risk, and hygiene refusal',
        dob:'2018-06-12', phone:'(786) 555-0211', address:'3450 NW 5th Ave, Miami, FL 33127',
        insurerName:'Cigna', memberId:'CIG-884432', groupNumber:'G-55023',
        referringProvider:'Dr. Ana Flores', referralDate:'2026-03-20',
      });
      const sectionCount = Object.values(s.sections).filter(sec => sec.key !== 'demographics').length;
      return { ...s, status:'complete', sectionsApproved: sectionCount };
    })();
    const smart_session_id_diego = `sas_${c.id}_${Date.now()}`;
    return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id_diego, checklist:cl, documents:DIEGO_DOCS, activity_log:DIEGO_LOG, case_notes:[], assessment_session: assessment_session_diego, service_session_logs: [], caregiver_training_session_logs: [] };
  }

  // ── c10 Charlotte Davis — services (Cigna, reauth active) ──────────────────
  if (c.id === 'c10') {
    cl.intake         = { referral_form:true, insurance_card:true, cde:true, aba_prescription:true, consent_signed:true, demographics_confirmed:true, referral_source:'Dr. James Wilson · (561) 555-0170', insurance_plan:'Cigna Healthspring Florida', member_id_verified:'CIG-556634 / G-55023', copay_deductible:'$0 copay, $0 deductible remaining', preferred_language:'English', insurance_verified:true, benefits_verified:true };
    cl.auth_assessment = { cde_confirmed:true, prescription_confirmed:true, referral_confirmed:true, prior_assessments:true, auth_submitted:true, submission_date:'2025-11-20', units_requested:'16', expected_response_date:'2025-12-04', auth_portal:'Availity', reference_number:'CIG-AUTH-2025-1120-3301', cpt_97151_received:true, bcba_assigned:true };
    cl.assessment     = { bcba_confirmed:true, caregiver_interview:true, direct_observation:true, vineland3:true, vineland3_date:'2025-12-01', basc3:true, basc3_date:'2025-12-01', additional_assessments:true, smart_assessment_submitted:true, baseline_data:true, behaviors_identified:true, final_assessment_report:true, observation_date:'2025-12-01', additional_assessments_detail:'ABLLS-R screening, VBMAPP partial administration' };
    cl.plan_draft     = { medical_necessity:true, skill_targets:true, behavior_goals:true, intervention_strategies:true, hours_97153:'80', hours_97155:'12', hours_97156:'8', data_methodology:'Event recording with same-day ABC notation', plan_start_date:'2026-01-20', plan_end_date:'2026-07-20', sessions_per_week:'10', session_duration_min:'120', baseline_graphs:true, ai_draft_approved:true, treatment_plan_finalized:true };
    cl.submitted      = { plan_submitted:true, plan_submission_date:'2026-01-05', approval_uploaded:true, auth_reference_number:'CIG-AUT-2026-0105-9901', authorized_97153:'80', authorized_97155:'12', authorized_97156:'8', auth_start_date:'2026-01-20', auth_end_date:'2026-07-20' };
    cl.authorized     = { bcba_matches_auth:true, bcba_credentials_verified:true, rbt_assigned:true, rbt_cert_valid:true, rbt_credentials_attached:true, schedule_template:'Mon/Wed/Fri 9am–1pm, Tue/Thu 10am–12pm', session_location:'Center-based', scheduled_hours_week:'19', scheduled_97155_week:'3', scheduled_97156_week:'2' };
    cl.staffing       = { caregiver_availability:true, schedule_coordinated:true, first_session_scheduled:true, first_session_date:'2026-01-20', first_session_time:'9:00 AM', session_location:'Center-based' };
    cl.services_reauth = { progress_report:true, updated_graphs:true, vineland3_updated:true, basc3_updated:false, reauth_submitted:false, reauth_submission_date:'', hours_consumed_97153:'72', hours_consumed_97155:'11', hours_consumed_97156:'7' };

    const assessment_session_charlotte = (() => {
      const s = makeFilledSession(c.id, c.name, c.bcba_id, 'Dr. Ana Reyes', CHARLOTTE_INTERVIEW_DATA, {
        dob: c.dob, phone: c.phone, address: c.address,
        insurerName: c.insurer_name, memberId: c.member_id, groupNumber: c.group_number,
        referringProvider: c.referring_provider, referralDate: c.referral_date,
        gender: 'Female', diagnosis: 'Autism Spectrum Disorder, Level 1', icd10: 'F84.0',
        medicaidId: '', assessmentDate: '2025-12-01', assessmentType: 'Initial',
        preferredLanguage: 'English', parentGuardianNames: 'Jennifer Davis',
        relationship: 'Mother', reasonForReferral: 'ABA evaluation for behavior reduction and skill development',
        _intakeMissingFields: [],
      });
      const sectionCount = Object.values(s.sections).filter(sec => sec.key !== 'demographics').length;
      return { ...s, status: 'complete', sectionsApproved: sectionCount };
    })();

    const C10_SERVICE_SESSION_LOGS = [
      {
        id: 'slog_c10_1', clientId: 'c10', rbtId: 'u4', rbtName: 'James Torres',
        sessionDate: '2025-11-17', sessionNumber: 1, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c10-1', behaviorName: 'Tantrum',      isNew: false, baselineFrequency: 5,  sessionFrequency: 3,  currentStoNumber: 2, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-2', behaviorName: 'Elopement',    isNew: false, baselineFrequency: 10, sessionFrequency: 8,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-3', behaviorName: 'Task Refusal', isNew: false, baselineFrequency: 25, sessionFrequency: 22, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-4', behaviorName: 'Aggression',   isNew: false, baselineFrequency: 5,  sessionFrequency: 4,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2025-11-17T12:00:00.000Z',
      },
      {
        id: 'slog_c10_2', clientId: 'c10', rbtId: 'u4', rbtName: 'James Torres',
        sessionDate: '2025-12-08', sessionNumber: 2, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c10-1', behaviorName: 'Tantrum',      isNew: false, baselineFrequency: 5,  sessionFrequency: 2,  currentStoNumber: 2, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-2', behaviorName: 'Elopement',    isNew: false, baselineFrequency: 10, sessionFrequency: 7,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-3', behaviorName: 'Task Refusal', isNew: false, baselineFrequency: 25, sessionFrequency: 18, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-4', behaviorName: 'Aggression',   isNew: false, baselineFrequency: 5,  sessionFrequency: 3,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2025-12-08T12:00:00.000Z',
      },
      {
        id: 'slog_c10_3', clientId: 'c10', rbtId: 'u4', rbtName: 'James Torres',
        sessionDate: '2026-01-12', sessionNumber: 3, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c10-1', behaviorName: 'Tantrum',          isNew: false, baselineFrequency: 5,  sessionFrequency: 2,  currentStoNumber: 2, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-2', behaviorName: 'Elopement',        isNew: false, baselineFrequency: 10, sessionFrequency: 6,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-3', behaviorName: 'Task Refusal',     isNew: false, baselineFrequency: 25, sessionFrequency: 16, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-4', behaviorName: 'Aggression',       isNew: false, baselineFrequency: 5,  sessionFrequency: 3,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: null,        behaviorName: 'Throwing objects', isNew: true,  baselineFrequency: null, sessionFrequency: 5, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: 'CLIENT intentionally throws objects when denied access to preferred items', newBehaviorFunction: 'tangible', newBehaviorSeverity: 'moderate', firstSeenDate: '2026-01-12' },
        ],
        skillEntries: [],
        createdAt: '2026-01-12T12:00:00.000Z',
      },
      {
        id: 'slog_c10_4', clientId: 'c10', rbtId: 'u4', rbtName: 'James Torres',
        sessionDate: '2026-02-09', sessionNumber: 4, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c10-1', behaviorName: 'Tantrum',          isNew: false, baselineFrequency: 5,  sessionFrequency: 2,  currentStoNumber: 3, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-2', behaviorName: 'Elopement',        isNew: false, baselineFrequency: 10, sessionFrequency: 5,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-3', behaviorName: 'Task Refusal',     isNew: false, baselineFrequency: 25, sessionFrequency: 15, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-4', behaviorName: 'Aggression',       isNew: false, baselineFrequency: 5,  sessionFrequency: 2,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: null,        behaviorName: 'Throwing objects', isNew: false, baselineFrequency: null, sessionFrequency: 4, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2026-02-09T12:00:00.000Z',
      },
      {
        id: 'slog_c10_5', clientId: 'c10', rbtId: 'u4', rbtName: 'James Torres',
        sessionDate: '2026-03-10', sessionNumber: 5, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c10-1', behaviorName: 'Tantrum',          isNew: false, baselineFrequency: 5,  sessionFrequency: 1,  currentStoNumber: 3, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-2', behaviorName: 'Elopement',        isNew: false, baselineFrequency: 10, sessionFrequency: 4,  currentStoNumber: 3, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-3', behaviorName: 'Task Refusal',     isNew: false, baselineFrequency: 25, sessionFrequency: 14, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-4', behaviorName: 'Aggression',       isNew: false, baselineFrequency: 5,  sessionFrequency: 2,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: null,        behaviorName: 'Throwing objects', isNew: false, baselineFrequency: null, sessionFrequency: 3, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [
          { skillId: null, skillName: 'Waiting for preferred item', isNew: true, firstSeenDate: '2026-03-10', notes: '' },
        ],
        createdAt: '2026-03-10T12:00:00.000Z',
      },
      {
        id: 'slog_c10_6', clientId: 'c10', rbtId: 'u4', rbtName: 'James Torres',
        sessionDate: '2026-04-14', sessionNumber: 6, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c10-1', behaviorName: 'Tantrum',          isNew: false, baselineFrequency: 5,  sessionFrequency: 1,  currentStoNumber: 3, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-2', behaviorName: 'Elopement',        isNew: false, baselineFrequency: 10, sessionFrequency: 3,  currentStoNumber: 3, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-3', behaviorName: 'Task Refusal',     isNew: false, baselineFrequency: 25, sessionFrequency: 12, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c10-4', behaviorName: 'Aggression',       isNew: false, baselineFrequency: 5,  sessionFrequency: 1,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: null,        behaviorName: 'Throwing objects', isNew: false, baselineFrequency: null, sessionFrequency: 3, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2026-04-14T12:00:00.000Z',
      },
    ];

    const C10_CAREGIVER_TRAINING_LOGS = [
      {
        id: 'ctlog_c10_1', clientId: 'c10', bcbaId: 'u2', bcbaName: 'Dr. Ana Reyes',
        sessionDate: '2025-12-01', sessionNumber: 1, notes: '',
        trainingEntries: [
          { targetId: 'ctgt_1', goalName: 'Consistent Premack delivery',       baselinePercent: 20, sessionPercent: 30, stoStatus: 'in_progress', currentStoNumber: 1 },
          { targetId: 'ctgt_2', goalName: 'Reinforcement timing and magnitude', baselinePercent: 35, sessionPercent: 45, stoStatus: 'in_progress', currentStoNumber: 1 },
        ],
        createdAt: '2025-12-01T12:00:00.000Z',
      },
      {
        id: 'ctlog_c10_2', clientId: 'c10', bcbaId: 'u2', bcbaName: 'Dr. Ana Reyes',
        sessionDate: '2026-01-12', sessionNumber: 2, notes: '',
        trainingEntries: [
          { targetId: 'ctgt_1', goalName: 'Consistent Premack delivery',       baselinePercent: 20, sessionPercent: 45, stoStatus: 'in_progress', currentStoNumber: 1 },
          { targetId: 'ctgt_2', goalName: 'Reinforcement timing and magnitude', baselinePercent: 35, sessionPercent: 58, stoStatus: 'in_progress', currentStoNumber: 1 },
        ],
        createdAt: '2026-01-12T14:00:00.000Z',
      },
      {
        id: 'ctlog_c10_3', clientId: 'c10', bcbaId: 'u2', bcbaName: 'Dr. Ana Reyes',
        sessionDate: '2026-03-03', sessionNumber: 3, notes: '',
        trainingEntries: [
          { targetId: 'ctgt_1', goalName: 'Consistent Premack delivery',       baselinePercent: 20, sessionPercent: 62, stoStatus: 'met',         currentStoNumber: 2 },
          { targetId: 'ctgt_2', goalName: 'Reinforcement timing and magnitude', baselinePercent: 35, sessionPercent: 72, stoStatus: 'in_progress', currentStoNumber: 1 },
        ],
        createdAt: '2026-03-03T12:00:00.000Z',
      },
    ];

    const C10_DOCS = [
      { id:'c10doc1',  type:'referral_form',     label:'Charlotte_Davis_ABA_Referral_Dr_Wilson.pdf',            uploaded_at:'2025-11-12T10:00:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'c10doc2',  type:'insurance_card',    label:'Cigna_Insurance_Card_Charlotte_Davis.pdf',               uploaded_at:'2025-11-12T10:05:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'c10doc3',  type:'cde',               label:'Charlotte_Davis_CDE_Dr_Wilson_2024.pdf',                 uploaded_at:'2025-11-12T10:10:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'c10doc4',  type:'aba_prescription',  label:'Charlotte_Davis_ABA_Script_2025.pdf',                    uploaded_at:'2025-11-12T10:15:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'c10doc5',  type:'consent',           label:'Charlotte_Davis_Consent_Packet_Signed.pdf',              uploaded_at:'2025-11-12T10:20:00.000Z', by:'Admin User',    stage:'intake'          },
      { id:'c10doc6',  type:'prior_assessments', label:'Charlotte_Davis_Prior_Psych_Eval_Dr_Wilson_2024.pdf',    uploaded_at:'2025-11-20T09:00:00.000Z', by:'Dr. Ana Reyes', stage:'auth_assessment'  },
      { id:'c10doc7',  type:'assessment_draft',  label:'Charlotte_Davis_ABA_Assessment_Draft_2025-12-05.docx',  uploaded_at:'2025-12-05T16:30:00.000Z', by:'Dr. Ana Reyes', stage:'assessment'       },
      { id:'c10doc8',  type:'final_assessment',  label:'Charlotte_Davis_ABA_Assessment_FINAL_2025-12-10.pdf',   uploaded_at:'2025-12-10T11:00:00.000Z', by:'Dr. Ana Reyes', stage:'assessment'       },
      { id:'c10doc9',  type:'treatment_plan',    label:'Charlotte_Davis_Treatment_Plan_SIGNED_2026-01-05.pdf',  uploaded_at:'2026-01-05T14:00:00.000Z', by:'Dr. Ana Reyes', stage:'plan_draft'       },
      { id:'c10doc10', type:'auth_approval',     label:'Cigna_Auth_Approval_Charlotte_Davis_Jan2026.pdf',        uploaded_at:'2026-01-15T11:00:00.000Z', by:'Admin User',    stage:'submitted'        },
      { id:'c10doc11', type:'progress_report',   label:'Charlotte_Davis_Progress_Report_Q1_2026.pdf',            uploaded_at:'2026-05-01T10:00:00.000Z', by:'Dr. Ana Reyes', stage:'services'         },
      { id:'c10doc12', type:'behavioral_graphs', label:'Charlotte_Davis_Behavioral_Graphs_May2026.pdf',          uploaded_at:'2026-05-01T10:15:00.000Z', by:'Dr. Ana Reyes', stage:'services'         },
    ];

    const C10_LOG = [
      // newest first
      { id:'c10log1',  action:'Reauthorization cycle initiated — auth expires Jul 31, 2026',                                  by:'Dr. Ana Reyes', ts:'2026-05-14T11:00:00Z' },
      { id:'c10log2',  action:'Uploaded: Behavioral graphs — Charlotte_Davis_Behavioral_Graphs_May2026.pdf',                   by:'Dr. Ana Reyes', ts:'2026-05-01T10:15:00Z' },
      { id:'c10log3',  action:'Uploaded: Progress report — Charlotte_Davis_Progress_Report_Q1_2026.pdf',                       by:'Dr. Ana Reyes', ts:'2026-05-01T10:00:00Z' },
      { id:'c10log4',  action:'Updated: Hours used this auth period (97153: 72h · 97155: 11h · 97156: 7h)',                    by:'Dr. Ana Reyes', ts:'2026-05-01T09:45:00Z' },
      { id:'c10log5',  action:'Session logged — Caregiver training session 3 (Dr. Ana Reyes)',                                 by:'Dr. Ana Reyes', ts:'2026-03-03T12:00:00Z' },
      { id:'c10log6',  action:'Session logged — RBT behavior session 5 (James Torres)',                                        by:'James Torres',  ts:'2026-03-10T12:00:00Z' },
      { id:'c10log7',  action:'Session logged — RBT behavior session 4 (James Torres)',                                        by:'James Torres',  ts:'2026-02-09T12:00:00Z' },
      { id:'c10log8',  action:'Session logged — Caregiver training session 2 (Dr. Ana Reyes)',                                 by:'Dr. Ana Reyes', ts:'2026-01-12T14:00:00Z' },
      { id:'c10log9',  action:'Session logged — RBT behavior session 3 (James Torres) · New behavior flagged: Throwing objects', by:'James Torres', ts:'2026-01-12T12:00:00Z' },
      { id:'c10log10', action:'Moved to In Services',                                                                          by:'Admin User',    ts:'2026-01-20T10:00:00Z' },
      { id:'c10log11', action:'Checked: First session completed',                                                              by:'James Torres',  ts:'2026-01-20T09:30:00Z' },
      { id:'c10log12', action:'Moved to Staffing',                                                                             by:'Admin User',    ts:'2026-01-17T15:00:00Z' },
      { id:'c10log13', action:'Updated: First session date — Jan 20, 2026 at 9:00 AM',                                        by:'Admin User',    ts:'2026-01-17T14:45:00Z' },
      { id:'c10log14', action:'Updated: Weekly schedule and session location',                                                  by:'Admin User',    ts:'2026-01-16T11:30:00Z' },
      { id:'c10log15', action:'RBT assigned: James Torres',                                                                    by:'Admin User',    ts:'2026-01-16T11:00:00Z' },
      { id:'c10log16', action:'Checked: BCBA credentials verified',                                                            by:'Admin User',    ts:'2026-01-15T14:00:00Z' },
      { id:'c10log17', action:'Moved to Authorized',                                                                           by:'Admin User',    ts:'2026-01-15T13:30:00Z' },
      { id:'c10log18', action:'Uploaded: Authorization approval document — Cigna_Auth_Approval_Charlotte_Davis_Jan2026.pdf',    by:'Admin User',    ts:'2026-01-15T11:00:00Z' },
      { id:'c10log19', action:'Updated: Authorization reference number — CIG-AUT-2026-0105-9901',                              by:'Admin User',    ts:'2026-01-15T10:45:00Z' },
      { id:'c10log20', action:'Moved to Submitted',                                                                            by:'Dr. Ana Reyes', ts:'2026-01-05T14:30:00Z' },
      { id:'c10log21', action:'Uploaded: Signed treatment plan — Charlotte_Davis_Treatment_Plan_SIGNED_2026-01-05.pdf',        by:'Dr. Ana Reyes', ts:'2026-01-05T14:00:00Z' },
      { id:'c10log22', action:'Checked: AI draft reviewed and approved by BCBA',                                               by:'Dr. Ana Reyes', ts:'2026-01-05T13:30:00Z' },
      { id:'c10log23', action:'Updated: CPT hours (97153: 80h · 97155: 12h · 97156: 8h) and data-collection methodology',     by:'Dr. Ana Reyes', ts:'2026-01-05T12:00:00Z' },
      { id:'c10log24', action:'Moved to Plan Draft',                                                                           by:'Dr. Ana Reyes', ts:'2025-12-15T10:00:00Z' },
      { id:'c10log25', action:'Uploaded: Final assessment report — Charlotte_Davis_ABA_Assessment_FINAL_2025-12-10.pdf',       by:'Dr. Ana Reyes', ts:'2025-12-10T11:00:00Z' },
      { id:'c10log26', action:'Smart Assessment exported — assessment report generated',                                        by:'Dr. Ana Reyes', ts:'2025-12-05T16:30:00Z' },
      { id:'c10log27', action:'Smart Assessment continued',                                                                    by:'Dr. Ana Reyes', ts:'2025-12-01T16:00:00Z' },
      { id:'c10log28', action:'Session logged — Caregiver training session 1 (Dr. Ana Reyes)',                                 by:'Dr. Ana Reyes', ts:'2025-12-01T12:00:00Z' },
      { id:'c10log29', action:'Session logged — RBT behavior session 2 (James Torres)',                                        by:'James Torres',  ts:'2025-12-08T12:00:00Z' },
      { id:'c10log30', action:'Session logged — RBT behavior session 1 (James Torres)',                                        by:'James Torres',  ts:'2025-11-17T12:00:00Z' },
      { id:'c10log31', action:'Moved to Assessment',                                                                           by:'Admin User',    ts:'2025-12-02T09:00:00Z' },
      { id:'c10log32', action:'BCBA assigned: Dr. Ana Reyes',                                                                  by:'Admin User',    ts:'2025-12-02T08:45:00Z' },
      { id:'c10log33', action:'Checked: CPT 97151 authorization received',                                                     by:'Admin User',    ts:'2025-12-02T08:30:00Z' },
      { id:'c10log34', action:'Uploaded: Prior assessments — Charlotte_Davis_Prior_Psych_Eval_Dr_Wilson_2024.pdf',             by:'Dr. Ana Reyes', ts:'2025-11-20T09:00:00Z' },
      { id:'c10log35', action:'Checked: Authorization submitted to insurer',                                                   by:'Dr. Ana Reyes', ts:'2025-11-20T08:45:00Z' },
      { id:'c10log36', action:'Updated: Submission reference number — CIG-AUTH-2025-1120-3301',                                by:'Dr. Ana Reyes', ts:'2025-11-20T08:30:00Z' },
      { id:'c10log37', action:'Moved to Auth Assessment',                                                                      by:'Admin User',    ts:'2025-11-14T15:00:00Z' },
      { id:'c10log38', action:'Checked: Benefits verification completed',                                                      by:'Admin User',    ts:'2025-11-14T14:45:00Z' },
      { id:'c10log39', action:'Checked: Insurance information verified',                                                       by:'Admin User',    ts:'2025-11-14T14:30:00Z' },
      { id:'c10log40', action:'Uploaded: Consent packet signed',                                                               by:'Admin User',    ts:'2025-11-12T10:20:00Z' },
      { id:'c10log41', action:'Uploaded: ABA prescription / script',                                                           by:'Admin User',    ts:'2025-11-12T10:15:00Z' },
      { id:'c10log42', action:'Uploaded: Comprehensive Diagnostic Evaluation (CDE)',                                           by:'Admin User',    ts:'2025-11-12T10:10:00Z' },
      { id:'c10log43', action:'Uploaded: Insurance card',                                                                      by:'Admin User',    ts:'2025-11-12T10:05:00Z' },
      { id:'c10log44', action:'Uploaded: Referral request form',                                                               by:'Admin User',    ts:'2025-11-12T10:00:00Z' },
      { id:'c10log45', action:'Client record created',                                                                         by:'Admin User',    ts:'2025-11-12T09:45:00Z' },
    ];

    const smart_session_id_charlotte = assessment_session_charlotte.id;

    const reassessment_cycle1_charlotte = {
      ...makeReassessmentSession(
        c,
        assessment_session_charlotte,
        C10_SERVICE_SESSION_LOGS,
        'Nov 1, 2025',
        'Apr 30, 2026',
      ),
      status: 'in_progress',
    };

    return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id_charlotte, checklist:cl, documents: C10_DOCS, activity_log: C10_LOG, case_notes: SEED_NOTES[c.id] || [], assessment_session: assessment_session_charlotte, service_session_logs: C10_SERVICE_SESSION_LOGS, caregiver_training_session_logs: C10_CAREGIVER_TRAINING_LOGS, reassessment_sessions: [reassessment_cycle1_charlotte] };
  }

  // ── c11 James Martinez — services (Aetna, reauth active) ───────────────────
  if (c.id === 'c11') {
    cl.intake         = { referral_form:true, insurance_card:true, cde:true, aba_prescription:true, consent_signed:true, demographics_confirmed:true, referral_source:'Dr. Angela Rivera · (786) 555-0280', insurance_plan:'Aetna Better Health of Florida', member_id_verified:'AET-664433 / G-44210', copay_deductible:'$0 copay, $0 deductible remaining', preferred_language:'Spanish', insurance_verified:true, benefits_verified:true };
    cl.auth_assessment = { cde_confirmed:true, prescription_confirmed:true, referral_confirmed:true, prior_assessments:true, auth_submitted:true, submission_date:'2025-10-28', units_requested:'16', expected_response_date:'2025-11-11', auth_portal:'Availity', reference_number:'AET-AUTH-2025-1028-5513', cpt_97151_received:true, bcba_assigned:true };
    cl.assessment     = { bcba_confirmed:true, caregiver_interview:true, direct_observation:true, vineland3:true, vineland3_date:'2025-11-10', basc3:true, basc3_date:'2025-11-10', additional_assessments:true, smart_assessment_submitted:true, baseline_data:true, behaviors_identified:true, final_assessment_report:true };
    cl.plan_draft     = { medical_necessity:true, skill_targets:true, behavior_goals:true, intervention_strategies:true, hours_97153:'80', hours_97155:'12', hours_97156:'8', data_methodology:'Event recording with daily ABC notation; Spanish-language data sheets provided to caregiver', plan_start_date:'2025-12-15', plan_end_date:'2026-06-15', sessions_per_week:'10', session_duration_min:'120', baseline_graphs:true, ai_draft_approved:true, treatment_plan_finalized:true };
    cl.submitted      = { plan_submitted:true, plan_submission_date:'2025-12-01', approval_uploaded:true, auth_reference_number:'AET-AUT-2025-1201-7742', authorized_97153:'80', authorized_97155:'12', authorized_97156:'8', auth_start_date:'2025-12-15', auth_end_date:'2026-06-15' };
    cl.authorized     = { bcba_matches_auth:true, bcba_credentials_verified:true, rbt_assigned:true, rbt_cert_valid:true, rbt_credentials_attached:true, schedule_template:'Mon/Wed/Fri 10am–2pm, Tue/Thu 9am–11am', session_location:'Center-based', scheduled_hours_week:'19', scheduled_97155_week:'3', scheduled_97156_week:'2' };
    cl.staffing       = { caregiver_availability:true, schedule_coordinated:true, first_session_scheduled:true, first_session_date:'2025-12-15', first_session_time:'10:00 AM', session_location:'Center-based' };
    cl.services_reauth = { progress_report:false, updated_graphs:false, vineland3_updated:false, basc3_updated:false, reauth_submitted:false, reauth_submission_date:'', hours_consumed_97153:'', hours_consumed_97155:'', hours_consumed_97156:'' };

    const assessment_session_james = (() => {
      const s = makeFilledSession(c.id, c.name, c.bcba_id, 'Dr. Rachel Kim', JAMES_INTERVIEW_DATA, {
        dob: c.dob, phone: c.phone, address: c.address,
        insurerName: c.insurer_name, memberId: c.member_id, groupNumber: c.group_number,
        referringProvider: c.referring_provider, referralDate: c.referral_date,
        gender: 'Male', diagnosis: 'Autism Spectrum Disorder, Level 2', icd10: 'F84.0',
        medicaidId: '', assessmentDate: '2025-11-10', assessmentType: 'Initial',
        preferredLanguage: 'Spanish', parentGuardianNames: 'Rosa Martinez',
        relationship: 'Mother', reasonForReferral: 'ABA evaluation for physical aggression, vocal disruption, and limited functional communication',
        _intakeMissingFields: [],
      });
      const sectionCount = Object.values(s.sections).filter(sec => sec.key !== 'demographics').length;
      return { ...s, status: 'complete', sectionsApproved: sectionCount };
    })();

    const C11_SERVICE_SESSION_LOGS = [
      {
        id: 'slog_c11_1', clientId: 'c11', rbtId: 's5', rbtName: 'Tanya Reyes',
        sessionDate: '2025-12-22', sessionNumber: 1, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c11-1', behaviorName: 'Physical Aggression', isNew: false, baselineFrequency: 8,  sessionFrequency: 7,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-2', behaviorName: 'Vocal Disruption',    isNew: false, baselineFrequency: 12, sessionFrequency: 11, currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-3', behaviorName: 'Property Destruction', isNew: false, baselineFrequency: 4,  sessionFrequency: 3,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2025-12-22T12:00:00.000Z',
      },
      {
        id: 'slog_c11_2', clientId: 'c11', rbtId: 's5', rbtName: 'Tanya Reyes',
        sessionDate: '2026-01-26', sessionNumber: 2, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c11-1', behaviorName: 'Physical Aggression', isNew: false, baselineFrequency: 8,  sessionFrequency: 6,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-2', behaviorName: 'Vocal Disruption',    isNew: false, baselineFrequency: 12, sessionFrequency: 9,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-3', behaviorName: 'Property Destruction', isNew: false, baselineFrequency: 4,  sessionFrequency: 3,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2026-01-26T12:00:00.000Z',
      },
      {
        id: 'slog_c11_3', clientId: 'c11', rbtId: 's5', rbtName: 'Tanya Reyes',
        sessionDate: '2026-03-02', sessionNumber: 3, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c11-1', behaviorName: 'Physical Aggression', isNew: false, baselineFrequency: 8,  sessionFrequency: 4,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-2', behaviorName: 'Vocal Disruption',    isNew: false, baselineFrequency: 12, sessionFrequency: 7,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-3', behaviorName: 'Property Destruction', isNew: false, baselineFrequency: 4,  sessionFrequency: 2,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2026-03-02T12:00:00.000Z',
      },
      {
        id: 'slog_c11_4', clientId: 'c11', rbtId: 's5', rbtName: 'Tanya Reyes',
        sessionDate: '2026-04-06', sessionNumber: 4, notes: '',
        behaviorEntries: [
          { behaviorId: 'bt-c11-1', behaviorName: 'Physical Aggression', isNew: false, baselineFrequency: 8,  sessionFrequency: 3,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-2', behaviorName: 'Vocal Disruption',    isNew: false, baselineFrequency: 12, sessionFrequency: 5,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
          { behaviorId: 'bt-c11-3', behaviorName: 'Property Destruction', isNew: false, baselineFrequency: 4,  sessionFrequency: 1,  currentStoNumber: 1, stoStatus: 'in_progress', newBehaviorDefinition: '', newBehaviorFunction: '', newBehaviorSeverity: '', firstSeenDate: null },
        ],
        skillEntries: [],
        createdAt: '2026-04-06T12:00:00.000Z',
      },
    ];

    const smart_session_id_james = assessment_session_james.id;
    return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id_james, checklist:cl, documents:[], activity_log:[], case_notes: SEED_NOTES[c.id] || [], assessment_session: assessment_session_james, service_session_logs: C11_SERVICE_SESSION_LOGS, caregiver_training_session_logs: [] };
  }

  return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id, checklist:cl, documents:[], activity_log:[], case_notes: SEED_NOTES[c.id] || [], assessment_session, service_session_logs: [], caregiver_training_session_logs: [] };
});

export const SEED_STAFF = () => [
  { id:'u2',  name:'Dr. Ana Reyes',    initials:'AR', email:'ana@abashield.com',       phone:'(555) 100-0001', role:'bcba', cert_number:'BCBA-223344', cert_expiry:'2027-09-30', cert_effective_date:'2025-09-30', status:'active',  title:'Clinical Director',              npi:'1578234690', caqh_id:'CAQH-448821', hire_date:'2022-08-15', supervisor:null          },
  { id:'u4',  name:'James Torres',     initials:'JT', email:'james@abashield.com',     phone:'(555) 100-0002', role:'rbt',  cert_number:'RBT-112200',  cert_expiry:'2027-08-15', cert_effective_date:'2025-08-15', status:'active',  title:'Registered Behavior Technician', npi:'',           caqh_id:'',            hire_date:'2023-03-10', supervisor:'Dr. Ana Reyes' },
  { id:'s1',  name:'Dr. Rachel Kim',   initials:'RK', email:'r.kim@abashield.com',     phone:'(555) 201-0034', role:'bcba', cert_number:'BCBA-112233', cert_expiry:'2027-06-30', cert_effective_date:'2025-06-30', status:'active',  title:'Senior BCBA',                    npi:'1023847561', caqh_id:'CAQH-331094', hire_date:'2021-05-03', supervisor:null          },
  { id:'s2',  name:'Marcus Webb',      initials:'MW', email:'m.webb@abashield.com',    phone:'(555) 304-0187', role:'bcba', cert_number:'BCBA-445566', cert_expiry:'2026-11-15', cert_effective_date:'2024-11-15', status:'active',  title:'BCBA',                           npi:'1902384751', caqh_id:'CAQH-229403', hire_date:'2023-01-16', supervisor:null          },
  { id:'s3',  name:'Dr. Priya Sharma', initials:'PS', email:'p.sharma@abashield.com',  phone:'(555) 407-0256', role:'bcba', cert_number:'BCBA-778899', cert_expiry:'2027-03-31', cert_effective_date:'2025-03-31', status:'active',  title:'BCBA',                           npi:'1234098765', caqh_id:'CAQH-558812', hire_date:'2022-11-07', supervisor:null          },
  { id:'s4',  name:'Jordan Ellis',     initials:'JE', email:'j.ellis@abashield.com',   phone:'(555) 512-0093', role:'bcba', cert_number:'BCBA-334455', cert_expiry:'2026-06-20', cert_effective_date:'2024-06-20', status:'active',  title:'BCBA',                           npi:'1678345091', caqh_id:'CAQH-774403', hire_date:'2024-02-19', supervisor:null          },
  { id:'s5',  name:'Tanya Reyes',      initials:'TR', email:'t.reyes@abashield.com',   phone:'(555) 618-0342', role:'rbt',  cert_number:'RBT-881122',  cert_expiry:'2026-12-31', cert_effective_date:'2024-12-31', status:'active',  title:'Registered Behavior Technician', npi:'',           caqh_id:'',            hire_date:'2023-09-25', supervisor:'Dr. Rachel Kim' },
  { id:'s6',  name:'Devon Clark',      initials:'DC', email:'d.clark@abashield.com',   phone:'(555) 720-0165', role:'rbt',  cert_number:'RBT-334455',  cert_expiry:'2026-10-15', cert_effective_date:'2024-10-15', status:'active',  title:'Registered Behavior Technician', npi:'',           caqh_id:'',            hire_date:'2024-04-08', supervisor:'Dr. Ana Reyes' },
  { id:'s7',  name:'Aaliyah Foster',   initials:'AF', email:'a.foster@abashield.com',  phone:'(555) 823-0471', role:'rbt',  cert_number:'RBT-667788',  cert_expiry:'2027-01-28', cert_effective_date:'2025-01-28', status:'active',  title:'Registered Behavior Technician', npi:'',           caqh_id:'',            hire_date:'2024-07-14', supervisor:'Dr. Priya Sharma' },
  { id:'s8',  name:'Carlos Mendez',    initials:'CM', email:'c.mendez@abashield.com',  phone:'(555) 916-0088', role:'rbt',  cert_number:'RBT-990011',  cert_expiry:'2026-08-10', cert_effective_date:'2024-08-10', status:'active',  title:'Registered Behavior Technician', npi:'',           caqh_id:'',            hire_date:'2023-06-01', supervisor:'Marcus Webb'  },
  { id:'s9',  name:'Yuki Tanaka',      initials:'YT', email:'y.tanaka@abashield.com',  phone:'(555) 103-0529', role:'rbt',  cert_number:'RBT-223344',  cert_expiry:'2027-04-22', cert_effective_date:'2025-04-22', status:'active',  title:'Registered Behavior Technician', npi:'',           caqh_id:'',            hire_date:'2025-11-03', supervisor:'Jordan Ellis' },
  { id:'s10', name:'Brianna Stone',    initials:'BS', email:'b.stone@abashield.com',   phone:'(555) 205-0617', role:'rbt',  cert_number:'RBT-556677',  cert_expiry:'2026-07-05', cert_effective_date:'2024-07-05', status:'active',  title:'Registered Behavior Technician', npi:'',           caqh_id:'',            hire_date:'2025-12-10', supervisor:'Dr. Priya Sharma' },
];

export const SEED_USERS = [
  { id:'u1', name:'Admin User',    email:'admin@abashield.com', role:'admin' },
  { id:'u2', name:'Dr. Ana Reyes', email:'ana@abashield.com',   role:'bcba'  },
  { id:'u3', name:'Dr. Sara Kim',  email:'sara@abashield.com',  role:'bcaba' },
  { id:'u4', name:'James Torres',  email:'james@abashield.com', role:'rbt'   },
];

export const makeServiceSessionLog = (
  clientId, rbtId, rbtName, sessionDate,
  behaviorEntries = [], skillEntries = [], notes = '',
) => ({
  id: `slog_${clientId}_${Date.now()}`,
  clientId,
  rbtId,
  rbtName,
  sessionDate,
  sessionNumber: 0,
  notes,
  behaviorEntries: behaviorEntries.map(e => ({
    behaviorId:           e.behaviorId           ?? null,
    behaviorName:         e.behaviorName         ?? '',
    isNew:                e.isNew                ?? false,
    baselineFrequency:    e.baselineFrequency     ?? null,
    sessionFrequency:     e.sessionFrequency      ?? null,
    currentStoNumber:     e.currentStoNumber      ?? 1,
    stoStatus:            e.stoStatus             ?? 'in_progress',
    newBehaviorDefinition:e.newBehaviorDefinition ?? '',
    newBehaviorFunction:  e.newBehaviorFunction   ?? '',
    newBehaviorSeverity:  e.newBehaviorSeverity   ?? '',
    firstSeenDate:        e.firstSeenDate         ?? null,
  })),
  skillEntries: skillEntries.map(e => ({
    skillId:    e.skillId    ?? null,
    skillName:  e.skillName  ?? '',
    isNew:      e.isNew      ?? false,
    firstSeenDate: e.firstSeenDate ?? null,
    notes:      e.notes      ?? '',
  })),
  createdAt: new Date().toISOString(),
});

export const makeCaregiverTrainingSessionLog = (
  clientId, bcbaId, bcbaName, sessionDate,
  trainingEntries = [], notes = '',
) => ({
  id: `ctlog_${clientId}_${Date.now()}`,
  clientId,
  bcbaId,
  bcbaName,
  sessionDate,
  sessionNumber: 0,
  notes,
  trainingEntries: trainingEntries.map(e => ({
    targetId:        e.targetId        ?? null,
    goalName:        e.goalName        ?? '',
    baselinePercent: e.baselinePercent ?? null,
    sessionPercent:  e.sessionPercent  ?? null,
    stoStatus:       e.stoStatus       ?? 'not_yet_started',
    currentStoNumber:e.currentStoNumber ?? 1,
  })),
  createdAt: new Date().toISOString(),
});

export const makeReassessmentSession = (
  client, initialSession, sessionLogs, authPeriodStart, authPeriodEnd,
) => {
  const base = makeAssessmentSession(
    client.id, client.name, client.bcba_id,
    initialSession?.bcbaName ?? '',
    client,
  );

  // ── helpers ────────────────────────────────────────────────────────────────

  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

  const computeTrend = (avg, baseline) => {
    if (avg === null || baseline === null || baseline === 0) return 'flat';
    const pct = ((avg - baseline) / baseline) * 100;
    if (pct < -5) return 'improving';
    if (pct >  5) return 'worsening';
    return 'flat';
  };

  const linkedSessionLogIds = (sessionLogs ?? []).map(l => l.id);

  // ── (2) originalBehaviorSummary ────────────────────────────────────────────
  // Pre-pass: collect every behavior key ever logged as isNew, so we can exclude
  // their subsequent isNew:false entries from the original-behavior aggregation.
  const everNewKeys = new Set();
  for (const log of (sessionLogs ?? [])) {
    for (const entry of (log.behaviorEntries ?? [])) {
      if (entry.isNew) everNewKeys.add(entry.behaviorId ?? entry.behaviorName);
    }
  }

  // Collect all entries where isNew === false AND never appeared as isNew
  const origMap = new Map();
  for (const log of (sessionLogs ?? [])) {
    for (const entry of (log.behaviorEntries ?? [])) {
      if (entry.isNew) continue;
      const key = entry.behaviorId ?? entry.behaviorName;
      if (everNewKeys.has(key)) continue;
      if (!origMap.has(key)) {
        origMap.set(key, {
          behaviorId:        entry.behaviorId,
          behaviorName:      entry.behaviorName,
          baselineFrequency: entry.baselineFrequency,
          frequencies:       [],
          lastEntry:         null,
        });
      }
      const rec = origMap.get(key);
      rec.frequencies.push(entry.sessionFrequency);
      rec.lastEntry = entry;
    }
  }

  const originalBehaviorSummary = Array.from(origMap.values()).map(rec => {
    const avg = mean(rec.frequencies);
    return {
      behaviorId:          rec.behaviorId,
      behaviorName:        rec.behaviorName,
      baselineFrequency:   rec.baselineFrequency,
      sessionsLogged:      rec.frequencies.length,
      averageFrequency:    avg !== null ? Math.round(avg * 100) / 100 : null,
      lastSessionFrequency:rec.lastEntry?.sessionFrequency ?? null,
      percentReduction:    (avg !== null && rec.baselineFrequency)
        ? Math.round(((rec.baselineFrequency - avg) / rec.baselineFrequency) * 10000) / 100
        : null,
      trend:               computeTrend(avg, rec.baselineFrequency),
      currentStoNumber:    rec.lastEntry?.currentStoNumber ?? 1,
      stoStatus:           rec.lastEntry?.stoStatus ?? 'in_progress',
    };
  });

  // ── (3) newBehaviorSummary ─────────────────────────────────────────────────
  const newMap = new Map();
  for (const log of (sessionLogs ?? [])) {
    for (const entry of (log.behaviorEntries ?? [])) {
      if (!entry.isNew && !newMap.has(entry.behaviorName)) continue;
      if (!entry.isNew) continue;
      const key = entry.behaviorName;
      if (!newMap.has(key)) {
        newMap.set(key, {
          behaviorName:       entry.behaviorName,
          firstSeenDate:      entry.firstSeenDate,
          rbtDefinitionDraft: entry.newBehaviorDefinition,
          function:           entry.newBehaviorFunction,
          severity:           entry.newBehaviorSeverity,
          firstFrequency:     entry.sessionFrequency,
          frequencies:        [],
        });
      }
      newMap.get(key).frequencies.push(entry.sessionFrequency);
    }
    // also collect subsequent non-isNew entries for known new behaviors (by name only)
  }
  // collect follow-on frequencies for new behaviors (after first-seen log)
  const newBehaviorNames = new Set(newMap.keys());
  for (const log of (sessionLogs ?? [])) {
    for (const entry of (log.behaviorEntries ?? [])) {
      if (entry.isNew || !newBehaviorNames.has(entry.behaviorName)) continue;
      newMap.get(entry.behaviorName).frequencies.push(entry.sessionFrequency);
    }
  }

  const newBehaviorSummary = Array.from(newMap.values()).map(rec => {
    const allFreqs = rec.frequencies;
    const avg = mean(allFreqs);
    const baseline = rec.firstFrequency;
    return {
      behaviorName:        rec.behaviorName,
      firstSeenDate:       rec.firstSeenDate,
      rbtDefinitionDraft:  rec.rbtDefinitionDraft,
      function:            rec.function,
      severity:            rec.severity,
      baselineFrequency:   baseline,
      averageFrequency:    avg !== null ? Math.round(avg * 100) / 100 : null,
      trend:               computeTrend(avg, baseline),
      bcbaDefinitionFinal: '',
      includedInPlan:      null,
      stoStructure:        [],
    };
  });

  // ── (4) originalSkillSummary ───────────────────────────────────────────────
  const initialSkillGoals =
    initialSession?.sections?.skill_acquisitions?.skillGoals ?? [];

  const originalSkillSummary = initialSkillGoals.map(goal => ({
    skillId:        goal.id,
    skillName:      goal.targetSkill ?? goal.skillName ?? '',
    domain:         goal.domain ?? '',
    baselinePercent:Number(goal.baselinePercent ?? 0),
    currentPercent: null,
    status:         'new',
  }));

  // ── (5) newSkillSummary ────────────────────────────────────────────────────
  const seenSkills = new Map();
  for (const log of (sessionLogs ?? [])) {
    for (const entry of (log.skillEntries ?? [])) {
      if (!entry.isNew) continue;
      if (!seenSkills.has(entry.skillName)) {
        seenSkills.set(entry.skillName, {
          skillId:              entry.skillId,
          skillName:            entry.skillName,
          firstSeenDate:        entry.firstSeenDate,
          rbtNotes:             entry.notes,
          bcbaGoalName:         '',
          bcbaDefinition:       '',
          bcbaDomain:           '',
          includedInPlan:       null,
          stoStructure:         [],
        });
      }
    }
  }
  const newSkillSummary = Array.from(seenSkills.values());

  // ── (6) caregiverTrainingSummary ───────────────────────────────────────────
  const ctTargets =
    initialSession?.sections?.caregiver_training?.caregiverTrainingTargets ?? [];
  const ctLogs = client.caregiver_training_session_logs ?? [];

  const caregiverTrainingSummary = ctTargets.map(target => {
    const entries = ctLogs.flatMap(log =>
      (log.trainingEntries ?? []).filter(e => e.targetId === target.id),
    );
    if (!entries.length) {
      return {
        targetId:             target.id,
        goalName:             target.goalName,
        baselinePercent:      target.baselinePercent,
        sessionsLogged:       0,
        averageSessionPercent:null,
        lastSessionPercent:   null,
        trend:                'flat',
        stoStatus:            'not_yet_started',
        currentStoNumber:     1,
        sto: (() => {
          const validSteps = (target.stoSteps ?? []).filter(
            s => s.targetPercent !== '' && s.targetPercent != null,
          );
          if (validSteps.length > 0) {
            return validSteps.map((s, i) =>
              `STO ${i + 1}: ${s.targetPercent}% within ${s.durationWeeks ?? '?'} wks`,
            ).join('; ');
          }
          if (target.stoPercent != null && target.stoPercent !== '') {
            return `${target.stoPercent}% accuracy over ${target.stoWeeks} weeks`;
          }
          return target.sto ?? '';
        })(),
        lto:                  target.ltoPercent != null
          ? `${target.ltoPercent}% accuracy across ${target.ltoSessions} sessions`
          : (target.lto ?? ''),
      };
    }
    const percents = entries.map(e => e.sessionPercent);
    const avg = mean(percents);
    const last = entries[entries.length - 1];
    const baseline = target.baselinePercent ?? null;
    const trend = (avg === null || baseline === null)
      ? 'flat'
      : avg > baseline + 5 ? 'improving'
      : avg < baseline - 5 ? 'worsening'
      : 'flat';
    return {
      targetId:             target.id,
      goalName:             target.goalName,
      baselinePercent:      baseline,
      sessionsLogged:       entries.length,
      averageSessionPercent:avg !== null ? Math.round(avg * 100) / 100 : null,
      lastSessionPercent:   last?.sessionPercent ?? null,
      trend,
      stoStatus:            last?.stoStatus ?? 'not_yet_started',
      currentStoNumber:     last?.currentStoNumber ?? 1,
      sto: (() => {
        const validSteps = (target.stoSteps ?? []).filter(
          s => s.targetPercent !== '' && s.targetPercent != null,
        );
        if (validSteps.length > 0) {
          return validSteps.map((s, i) =>
            `STO ${i + 1}: ${s.targetPercent}% within ${s.durationWeeks ?? '?'} wks`,
          ).join('; ');
        }
        if (target.stoPercent != null && target.stoPercent !== '') {
          return `${target.stoPercent}% accuracy over ${target.stoWeeks} weeks`;
        }
        return target.sto ?? '';
      })(),
      lto:                  target.ltoPercent != null
        ? `${target.ltoPercent}% accuracy across ${target.ltoSessions} sessions`
        : (target.lto ?? ''),
    };
  });

  // ── (7) prefill sections 1-7 and crisis_plan from initial session ─────────
  // Copies the BCBA's notes/transcript so the reassessment starts pre-populated.
  // Section 8 (medical_necessity) and the progress_note are intentionally left blank.
  const PREFILL_KEYS = [
    'demographics', 'presenting_concerns', 'self_help', 'daily_living',
    'safety', 'communication', 'self_stim', 'crisis_plan',
  ];

  const prefillSections = {};
  for (const key of PREFILL_KEYS) {
    const src = initialSession?.sections?.[key];
    if (!src) continue;
    const hasContent = !!(src.notes?.trim() || src.transcript);
    prefillSections[key] = {
      ...base.sections[key],
      notes:           src.notes      ?? '',
      transcript:      src.transcript ?? null,
      completionState: hasContent ? 'complete' : 'empty',
      prefillSource:   'initial_assessment',
    };
  }

  // ── assemble ───────────────────────────────────────────────────────────────
  return {
    ...base,
    sections:               { ...base.sections, ...prefillSections },
    id: `session_${client.id}_reassessment_${Date.now()}`,
    sessionType:            'reassessment',
    authPeriodStart,
    authPeriodEnd,
    linkedSessionLogIds,
    originalBehaviorSummary,
    newBehaviorSummary,
    originalSkillSummary,
    newSkillSummary,
    caregiverTrainingSummary,
    progressNarrativeText:  '',
  };
};
