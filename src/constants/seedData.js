import { mkChecklist } from './checklist.js';

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
    totalInterviewSections: 11,
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
        baselinePromptingDesc: 'Full physical / hand-over-hand required for all exchanges; 1 of 20 opportunities independent',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Home + school (minimum 2 settings)',
        masteryCriteriaPrompting: 'Independent — no physical or gestural prompt',
        stoPercent: '60', stoSkillDescription: 'PECS card exchange for 3 preferred items', stoWeeks: '12',
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
        baselinePromptingDesc: 'Gestural prompt to correct item required for ~80% of trials; selects correctly 20% independently',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Therapy table + natural environment',
        masteryCriteriaPrompting: 'Independent — no gestural or vocal prompt',
        stoPercent: '80', stoSkillDescription: 'labeling 10 common objects from an array of 3', stoWeeks: '16',
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
        baselinePromptingDesc: 'Full physical prompt required for most actions; 2-3 actions emerging with partial physical only',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Clinic + home',
        masteryCriteriaPrompting: 'Independent — verbal cue only, no physical or gestural',
        stoPercent: '80', stoSkillDescription: 'imitating 5 gross motor actions with partial physical prompt only', stoWeeks: '10',
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
        baselinePromptingDesc: 'Gestural prompt to correct position required; selects correctly ~30% independently',
        masteryCriteriaPercent: '90', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Table — varied array sizes (3 to 5 items)',
        masteryCriteriaPrompting: 'Independent',
        stoPercent: '90', stoSkillDescription: 'matching identical objects in an array of 3', stoWeeks: '8',
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
        baselinePromptingDesc: 'Transitions result in head banging or tantrum/drop approximately 90% of the time; successful transition requires full verbal + gestural + physical prompt chain',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'Home + school, with familiar and unfamiliar adults',
        masteryCriteriaPrompting: 'First-Then visual cue only — no additional verbal or physical prompt',
        stoPercent: '60', stoSkillDescription: 'transitioning within 60 sec for 3 high-priority contexts', stoWeeks: '14',
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
        baselinePromptingDesc: 'Full verbal model required; unprompted help-seeking absent across all probe settings — Marcus escalates to aggression instead',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Home + school + at least 1 community setting',
        masteryCriteriaPrompting: 'Independent — no verbal or gestural prompt',
        stoPercent: '80', stoSkillDescription: 'unprompted help-seeking across 3 task types at home', stoWeeks: '10',
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
        baselinePromptingDesc: 'Completes 3 of 8 steps independently with primary caregiver; 4-6 verbal prompts required; routine averages 55-70 minutes',
        masteryCriteriaPercent: '100', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'Home — must meet criterion with both parents as routine leader',
        masteryCriteriaPrompting: 'Independent (no more than 1 total verbal prompt per routine)',
        stoPercent: '100', stoSkillDescription: '6 of 8 routine steps independently within 45 min', stoWeeks: '12',
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
        baselinePromptingDesc: 'Zero unprompted peer initiations observed across 3 observation sessions; all peer contact is reactive, not initiated',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'School recess + classroom cooperative tasks',
        masteryCriteriaPrompting: 'Independent — no verbal or gestural prompt',
        stoPercent: '80', stoSkillDescription: '1 unprompted peer initiation per session in structured setting', stoWeeks: '16',
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
        baselinePromptingDesc: 'Zero independent bathing completions in past 7 days; 45-60 min refusal episode every evening; sponge bath used as accommodation. Was independent at age 7.',
        masteryCriteriaPercent: '100', masteryCriteriaSessions: '10',
        masteryCriteriaSettings: 'Home — both parents as routine leader across consecutive evenings',
        masteryCriteriaPrompting: 'Visual step sequence + 2-minute advance warning only; no additional verbal or physical prompt',
        stoPercent: '100', stoSkillDescription: 'tolerating water contact for 3 min without refusal or dropping', stoWeeks: '10',
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
        baselinePromptingDesc: 'Full verbal model required; 1 of 20 probed opportunities independent. Typically responds to blocked access with physical aggression or elopement rather than verbal request.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Home + school (minimum 2 settings)',
        masteryCriteriaPrompting: 'Independent — no gestural or verbal prompt',
        stoPercent: '40', stoSkillDescription: 'requesting help or break across 3 demand contexts', stoWeeks: '8',
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
        baselinePromptingDesc: 'Gestural prompt required for second step in most trials; first step followed independently ~80%; combined two-step sequence at 30% accuracy.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '3',
        masteryCriteriaSettings: 'Therapy table + natural environment',
        masteryCriteriaPrompting: 'Independent — no gestural or vocal prompt',
        stoPercent: '80', stoSkillDescription: 'following two-step directions across 5 distinct instruction sets', stoWeeks: '10',
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
        baselinePromptingDesc: '0 unprompted initiations per 30-minute session baseline. Parallel play observed near peers but no directed interaction.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'School recess + structured classroom activity',
        masteryCriteriaPrompting: 'Independent — no adult gestural or verbal cue',
        stoPercent: '40', stoSkillDescription: 'initiating 1 peer interaction per 30-min session in 2 structured contexts', stoWeeks: '12',
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
        baselinePromptingDesc: 'Complete refusal on baseline probes — will not enter bathroom when bathing is announced. Sponge bath accepted 2-3x/week with 2-person assist. Full bath: 0% step completion independent.',
        masteryCriteriaPercent: '80', masteryCriteriaSessions: '5',
        masteryCriteriaSettings: 'Home (bathroom)',
        masteryCriteriaPrompting: '≤1 verbal prompt per step',
        stoPercent: '50', stoSkillDescription: 'completing 5 of 10 hygiene steps with ≤2 prompts per step', stoWeeks: '14',
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
      },
    ],
  },
  caregiver_training: {
    notes: 'Priya Patel is primary implementer — highly motivated, detail-oriented, responds well to written guides and data systems. Raj Patel available evenings and weekends — works long hours in finance. Primary barrier: inconsistency between the two parents on demand follow-through. Priya tends to remove demand after aggression; Raj more likely to insist. Maternal grandparents (Gujarati-speaking) provide weekend care — will need Gujarati translation of core strategies. Current Premack use: Priya observed correct ~40% of probed opportunities. Reinforcement delivery: ~55% within 3 seconds. High family engagement and insight — both parents accurately describe the behavioral functions after minimal explanation.',
    completionState: 'complete',
    approvalState: 'approved',
    caregiverBaselines: { premack_baseline: '40', reinforcement_baseline: '55' },
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
  { id:'c10', name:'Charlotte Davis', dob:'2018-08-22', phone:'(561) 555-0122', address:'3400 PGA Blvd, Palm Beach Gardens, FL',    insurer_name:'Cigna',        health_plan_name:'Cigna Healthspring Florida',                   member_id:'CIG-556634', group_number:'G-55023', referring_provider:'Dr. James Wilson',   referring_provider_npi:'1154728390', referring_provider_phone:'(561) 555-0170', gender:'Female', diagnosis:'ASD Level 1', icd10:'F84.0', parent_name:'Jennifer Davis', parent_relationship:'Mother', parent_email:'j.davis@gmail.com', preferred_language:'English', source:'crm_created', referral_date:'2025-11-12', stage_entered_at:'2026-01-20T10:00:00.000Z', stage:'services',        denial_reason:null,                         bcba_id:'u2', rbt_id:'u4', auth_expiry_date:'2026-05-27', reauth_active:true  },
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
      { id:'n10b', stage:'services',  text:'Reauth paperwork submitted to Cigna. Expect decision within 10 business days per rep.', author:'Jordan Ellis', timestamp:'2026-05-19T11:05:00Z' },
      { id:'n10a', stage:'services',  text:'Family reported positive progress with self-regulation goals this month. Updated behavior plan accordingly.', author:'Jordan Ellis', timestamp:'2026-05-12T16:45:00Z' },
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
    cl.intake = { referral_form:true, insurance_card:true, cde:true, aba_prescription:true, demographics_confirmed:true, insurance_verified:true, benefits_verified:true };
    cl.auth_assessment = { cde_confirmed:true, prescription_confirmed:true, referral_confirmed:true, prior_assessments:true, auth_submitted:true, reference_number:'CIG-AUTH-2026-0318-4821', cpt_97151_received:true, bcba_assigned:true };
    cl.assessment = { bcba_confirmed:true, caregiver_interview:true, direct_observation:true, vineland3:true, vineland3_date:'2026-04-10', basc3:true, basc3_date:'2026-04-10', additional_assessments:true, smart_assessment_submitted:true, baseline_data:true, behaviors_identified:true, final_assessment_report:true };
    cl.plan_draft = { medical_necessity:true, skill_targets:true, behavior_goals:true, intervention_strategies:true, supervision_hours:'2', data_methodology:'Trial-by-trial data collection with same-day ABC notation', baseline_graphs:true, ai_draft_approved:true, treatment_plan_finalized:true };
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
    return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id, checklist:cl, documents:OLIVER_DOCS, activity_log:OLIVER_LOG, case_notes: SEED_NOTES['c5'], assessment_session };
  }

  // ── c14 Diego Reyes — plan_draft (same clinical profile as Oliver) ──────────────
  if (c.id === 'c14') {
    cl.intake        = { referral_form:true, insurance_card:true, cde:true, aba_prescription:true, demographics_confirmed:true, insurance_verified:true, benefits_verified:true };
    cl.auth_assessment = { cde_confirmed:true, prescription_confirmed:true, referral_confirmed:true, prior_assessments:true, auth_submitted:true, reference_number:'CIG-AUTH-2026-0322-7714', cpt_97151_received:true, bcba_assigned:true };
    cl.assessment    = { bcba_confirmed:true, caregiver_interview:true, direct_observation:true, vineland3:true, vineland3_date:'2026-04-15', basc3:true, basc3_date:'2026-04-15', additional_assessments:true, smart_assessment_submitted:true, baseline_data:true, behaviors_identified:true, final_assessment_report:true };
    cl.plan_draft    = { medical_necessity:true, skill_targets:true, behavior_goals:true, intervention_strategies:true, supervision_hours:'2', data_methodology:'', baseline_graphs:true, ai_draft_approved:false, treatment_plan_finalized:false };
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
    return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id_diego, checklist:cl, documents:DIEGO_DOCS, activity_log:DIEGO_LOG, case_notes:[], assessment_session: assessment_session_diego };
  }

  return { ...c, pipeline_entry:true, smart_assessment_session_id: smart_session_id, checklist:cl, documents:[], activity_log:[], case_notes: SEED_NOTES[c.id] || [], assessment_session };
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
