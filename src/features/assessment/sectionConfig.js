/**
 * sectionConfig.js
 * Full configuration for all 11 assessment interview sections.
 * Each section has guided prompts grouped by topic.
 * Groups marked isBcbaOnly render with an amber tint and "BCBA CLINICAL NOTES" label.
 */

export const SECTION_ORDER = [
  'demographics',
  'presenting_concerns',
  'self_help',
  'daily_living',
  'safety',
  'communication',
  'self_stim',
  'medical_necessity',
  'behavior_targets',
  'skill_acquisitions',
  'crisis_plan',
];

export const SECTION_TITLES = {
  demographics:        'Demographics & Referral Info',
  presenting_concerns: 'Presenting Concerns',
  self_help:           'Self-Help Skills',
  daily_living:        'Daily Living Skills',
  safety:              'Safety Concerns',
  communication:       'Communication',
  self_stim:           'Self-Stimulatory Behavior',
  medical_necessity:   'Medical Necessity',
  skill_acquisitions:  'Skill Acquisitions',
  behavior_targets:    'Behavior Targets',
  crisis_plan:         'Crisis Plan',
};

export const SECTION_CONFIG = {
  demographics: {
    key: 'demographics',
    title: 'Demographics & Referral Info',
    promptGroups: [
      {
        label: 'Client Information',
        isBcbaOnly: false,
        prompts: [
          "What is the client's full legal name and preferred name?",
          "What is the client's date of birth and current age?",
          "What is the client's gender identity and preferred pronouns?",
          "What is the primary language spoken at home? Are there other languages?",
          "What is the client's current diagnosis? When was it given and by whom?",
          "Are there any secondary diagnoses (ADHD, anxiety, OCD, intellectual disability)?",
          "What is the current address and primary phone number for the family?",
        ],
      },
      {
        label: 'Insurance & Referral',
        isBcbaOnly: false,
        prompts: [
          "Who is the referring provider and what is their contact information?",
          "What is the name of the insurance carrier, member ID, and group number?",
          "Is there a Medicaid ID? Is Medicaid the primary or secondary payer?",
          "What is the reason for referral as stated by the referring provider?",
          "Has the family received ABA services before? If so, where and for how long?",
        ],
      },
      {
        label: 'Family & Support System',
        isBcbaOnly: false,
        prompts: [
          "Who are the primary caregivers and what is their relationship to the client?",
          "Who else lives in the home? Are there siblings — ages and any special needs?",
          "Are there any custody arrangements or legal guardianship considerations?",
          "What school does the client attend, what grade, and what supports are in place (IEP, 504)?",
          "Are there other current therapies — speech, OT, PT, counseling? How often?",
        ],
      },
    ],
  },

  presenting_concerns: {
    key: 'presenting_concerns',
    title: 'Presenting Concerns',
    promptGroups: [
      {
        label: 'Primary Concerns',
        isBcbaOnly: false,
        prompts: [
          "What are the family's top 2–3 concerns that brought them to seek ABA services today?",
          "How long have these concerns been present? Did anything specific seem to trigger their onset?",
          "Which behaviors or skill deficits most significantly impact daily life at home?",
          "Which concerns are most urgent for the family to address first?",
          "How do these concerns affect sibling relationships or other family members?",
        ],
      },
      {
        label: 'School & Community',
        isBcbaOnly: false,
        prompts: [
          "Are the same concerns present at school or in the community, or are they home-specific?",
          "Has the school expressed concerns? Have there been disciplinary incidents or suspensions?",
          "Are there activities, outings, or social situations the family currently avoids?",
          "Have there been any incidents in the community (stores, restaurants, public spaces)?",
        ],
      },
      {
        label: 'Clinical Impression',
        isBcbaOnly: true,
        prompts: [
          "Based on caregiver report, what appear to be the primary functions of the presenting behaviors?",
          "Are there indications of trauma history, attachment concerns, or adverse childhood experiences?",
          "Does the severity and breadth of concerns align with the documented diagnosis?",
          "Are there any red flags suggesting need for immediate higher level of care or safety referral?",
          "Note any discrepancies between caregiver report and existing records.",
        ],
      },
    ],
  },

  self_help: {
    key: 'self_help',
    title: 'Self-Help Skills',
    promptGroups: [
      {
        label: 'Toileting',
        isBcbaOnly: false,
        prompts: [
          "Is the client fully toilet trained? If not, what stage are they at?",
          "Does the client initiate bathroom trips independently or require prompts?",
          "Are there accidents? How frequent and in what contexts?",
          "Can the client manage clothing, wiping, flushing, and handwashing independently?",
          "Are there any sensory issues related to the bathroom (toilets, paper, sink)?",
        ],
      },
      {
        label: 'Dressing & Grooming',
        isBcbaOnly: false,
        prompts: [
          "Can the client dress and undress independently? What clothing items are challenging?",
          "Does the client manage fasteners — buttons, zippers, snaps, shoelaces?",
          "Are there clothing or texture sensitivities that limit wardrobe or cause distress?",
          "Can the client brush teeth, comb hair, and wash hands/face independently?",
          "Does the client bathe or shower independently? With what level of assistance?",
        ],
      },
      {
        label: 'Feeding & Eating',
        isBcbaOnly: false,
        prompts: [
          "Does the client have a restricted diet? How many foods will they eat?",
          "Can the client use utensils (fork, spoon, knife) appropriately for their age?",
          "Does the client drink from an open cup or straw? Any liquid restrictions?",
          "Are there mealtime behaviors that disrupt family routines (tantrums, food throwing)?",
          "Has feeding been evaluated by an OT, SLP, or feeding specialist?",
        ],
      },
      {
        label: 'Clinical Notes',
        isBcbaOnly: true,
        prompts: [
          "Note significant adaptive behavior deficits in self-help relative to chronological age.",
          "Are self-help deficits primarily skill-based or motivation/compliance-based?",
          "Document any sensory processing patterns that appear to drive self-help avoidance.",
          "Identify highest-priority self-help skills for ABA programming.",
        ],
      },
    ],
  },

  daily_living: {
    key: 'daily_living',
    title: 'Daily Living Skills',
    promptGroups: [
      {
        label: 'Home Routines',
        isBcbaOnly: false,
        prompts: [
          "Does the client follow a morning routine independently or require step-by-step prompting?",
          "Can the client complete household chores appropriate for their age (tidying, dishes, laundry)?",
          "Does the client have a consistent bedtime routine? Are there sleep difficulties?",
          "How does the client handle transitions between activities — home to school, activity to activity?",
          "Does the client understand concepts of time (schedules, waiting, how long until)?",
        ],
      },
      {
        label: 'Community & Independence',
        isBcbaOnly: false,
        prompts: [
          "Can the client navigate familiar community settings with appropriate behavior?",
          "Does the client demonstrate street safety (stopping at crossings, not running into traffic)?",
          "Can the client make simple purchases or handle money at an age-appropriate level?",
          "Is the client able to use community resources (library, playground, store) with family?",
          "Does the client know personal information (name, address, phone number) for safety?",
        ],
      },
      {
        label: 'Leisure & Recreation',
        isBcbaOnly: false,
        prompts: [
          "What does the client do for fun? How much screen time per day?",
          "Does the client engage in any structured leisure activities (sports, art, music)?",
          "Can the client play independently for age-appropriate periods without adult prompting?",
          "Are there preferred activities that can be used as reinforcers in programming?",
        ],
      },
      {
        label: 'Clinical Notes',
        isBcbaOnly: true,
        prompts: [
          "Assess daily living skills against Vineland or similar adaptive measure expectations.",
          "Note any significant discrepancy between cognitive ability and daily living performance.",
          "Identify daily living targets most amenable to ABA skill-building approaches.",
        ],
      },
    ],
  },

  safety: {
    key: 'safety',
    title: 'Safety Concerns',
    promptGroups: [
      {
        label: 'Elopement & Wandering',
        isBcbaOnly: false,
        prompts: [
          "Has the client ever eloped (run away from caregivers, left a safe area)?",
          "What are the known triggers for elopement? Where does the client run to?",
          "What safety measures are currently in place (locks, alarms, ID bracelet, GPS)?",
          "Has local law enforcement or emergency services ever been involved?",
          "Does the client have any water safety awareness? Access to pools, lakes, or water bodies?",
        ],
      },
      {
        label: 'Self-Injurious Behavior (SIB)',
        isBcbaOnly: false,
        prompts: [
          "Does the client engage in any self-injurious behavior? Describe the topography.",
          "How frequent and intense is the SIB? Has it resulted in injury requiring medical attention?",
          "What are the known antecedents or triggers for SIB?",
          "What has the family tried to address SIB? What has been helpful or unhelpful?",
        ],
      },
      {
        label: 'Aggression & Property Destruction',
        isBcbaOnly: false,
        prompts: [
          "Does the client display aggression toward others (hitting, biting, kicking, scratching)?",
          "Who are the most frequent targets — caregivers, siblings, peers, strangers?",
          "Does the client destroy property? Describe severity and frequency.",
          "Have any injuries occurred to others? Has there been any involvement of authorities?",
        ],
      },
      {
        label: 'Clinical Safety Assessment',
        isBcbaOnly: true,
        prompts: [
          "Does the level of safety concern warrant immediate crisis referral or higher level of care?",
          "Document risk level for SIB, aggression, and elopement (low/moderate/high/severe).",
          "Are there mandated reporting considerations based on information shared today?",
          "Does the home environment appear safe and structured enough to support ABA services?",
          "Note any disclosures related to abuse, neglect, or domestic violence — follow facility protocols.",
        ],
      },
    ],
  },

  communication: {
    key: 'communication',
    title: 'Communication',
    promptGroups: [
      {
        label: 'Expressive Language',
        isBcbaOnly: false,
        prompts: [
          "How does the client primarily communicate — verbally, gestures, pictures, device, signing?",
          "If verbal, what is the mean length of utterance? Single words, phrases, sentences, or conversational?",
          "Is the client's speech intelligible to familiar and unfamiliar listeners?",
          "Does the client use language to request, protest, comment, and ask questions?",
          "Is there echolalia (immediate or delayed)? What function does it appear to serve?",
        ],
      },
      {
        label: 'Receptive Language',
        isBcbaOnly: false,
        prompts: [
          "Does the client follow one-step, two-step, or multi-step instructions?",
          "Does the client respond to their name consistently?",
          "Does the client understand yes/no questions reliably?",
          "Can the client identify objects, pictures, body parts, and people by name?",
          "Does the client follow instructions across different people and settings?",
        ],
      },
      {
        label: 'Pragmatics & Social Communication',
        isBcbaOnly: false,
        prompts: [
          "Does the client initiate communication spontaneously or primarily respond?",
          "Does the client make eye contact and attend to the speaker during interactions?",
          "Can the client take turns in a conversation or play activity?",
          "Does the client understand and use non-literal language (jokes, sarcasm, idioms)?",
          "Is there a current AAC system in place? What device or system and how long in use?",
        ],
      },
      {
        label: 'SLP Coordination',
        isBcbaOnly: true,
        prompts: [
          "Note current SLP involvement and most recent evaluation findings.",
          "Identify communication targets where ABA and SLP programming should be coordinated.",
          "Document primary mode of communication for use in all ABA programming.",
          "Is a functional communication training (FCT) approach indicated? Note potential mands.",
        ],
      },
    ],
  },

  self_stim: {
    key: 'self_stim',
    title: 'Self-Stimulatory Behavior',
    promptGroups: [
      {
        label: 'Topography & Frequency',
        isBcbaOnly: false,
        prompts: [
          "What self-stimulatory behaviors does the client engage in (hand flapping, rocking, spinning, etc.)?",
          "How frequently do these behaviors occur? Are they constant, periodic, or situational?",
          "How long do individual episodes last?",
          "In what settings or situations are the behaviors most prominent?",
          "In what situations are the behaviors least prominent or absent?",
        ],
      },
      {
        label: 'Impact & Function',
        isBcbaOnly: false,
        prompts: [
          "Do the behaviors interfere with learning, social interaction, or daily activities?",
          "Does the client appear to engage in these behaviors for sensory input or regulation?",
          "Are the behaviors stigmatizing in community or school settings?",
          "Has the family or school tried to reduce these behaviors? What happened?",
          "Does the client engage in these behaviors more when anxious, bored, or overstimulated?",
        ],
      },
      {
        label: 'Sensory Profile',
        isBcbaOnly: false,
        prompts: [
          "Does the client have known sensory sensitivities (sounds, textures, lights, smells)?",
          "Has an OT conducted a sensory evaluation? What were the findings?",
          "Are there sensory-seeking behaviors beyond the self-stim topographies noted?",
          "What sensory tools or strategies does the family currently use?",
        ],
      },
      {
        label: 'Clinical Notes',
        isBcbaOnly: true,
        prompts: [
          "Assess whether self-stimulatory behaviors are automatically reinforced and clinically significant.",
          "Note whether behaviors warrant direct reduction programming or are acceptable to maintain.",
          "If reduction is warranted, document rationale for medical necessity.",
          "Consider whether sensory diet or environmental modifications should be part of the plan.",
        ],
      },
    ],
  },

  medical_necessity: {
    key: 'medical_necessity',
    title: 'Medical Necessity',
    promptGroups: [
      {
        label: 'Diagnostic Support',
        isBcbaOnly: false,
        prompts: [
          "Who provided the ASD or other qualifying diagnosis? What assessment tools were used?",
          "When was the most recent diagnostic evaluation? Are there updated reports available?",
          "What co-occurring conditions are documented (ID, ADHD, anxiety, epilepsy, GI issues)?",
          "Is the client currently on any medications? What for and who prescribes?",
          "Are there any upcoming medical appointments or evaluations planned?",
        ],
      },
      {
        label: 'Functional Impact',
        isBcbaOnly: false,
        prompts: [
          "How do the presenting concerns impact the client's ability to function at home?",
          "How do the concerns impact functioning at school or in the community?",
          "Are there activities of daily living the client cannot perform safely without ABA services?",
          "Has the family tried other interventions before pursuing ABA? What were the results?",
          "What would happen if ABA services were NOT provided at this time?",
        ],
      },
      {
        label: 'Clinical Justification',
        isBcbaOnly: true,
        prompts: [
          "Document the specific deficits and excesses that meet the insurer's medical necessity criteria.",
          "Clearly articulate why ABA is the appropriate level of care given the clinical presentation.",
          "Note any safety risks that independently support medical necessity.",
          "Identify the intensity of services being recommended and the clinical rationale for that level.",
          "Document what progress is expected and within what timeframe.",
          "Note any barriers to service delivery and how they will be addressed.",
        ],
      },
    ],
  },

  skill_acquisitions: {
    key: 'skill_acquisitions',
    title: 'Skill Acquisitions',
    promptGroups: [
      {
        label: 'Academic & Pre-Academic',
        isBcbaOnly: false,
        prompts: [
          "What academic skills is the client working on at school (reading, writing, math)?",
          "What pre-academic skills are emerging or targeted — colors, letters, numbers, shapes?",
          "Can the client attend to a task for age-appropriate periods of time?",
          "Does the client follow classroom routines and group instruction?",
        ],
      },
      {
        label: 'Social Skills',
        isBcbaOnly: false,
        prompts: [
          "Does the client have any peer friendships? How are peer interactions typically initiated?",
          "Can the client engage in cooperative play, parallel play, or only solitary play?",
          "Does the client demonstrate joint attention — sharing, pointing, showing?",
          "Does the client demonstrate perspective-taking or theory of mind skills?",
          "Are there social skill groups or programs the client participates in?",
        ],
      },
      {
        label: 'Imitation & Learning Readiness',
        isBcbaOnly: false,
        prompts: [
          "Does the client imitate actions, motor movements, and sounds?",
          "Does the client sit and attend in structured learning tasks?",
          "Does the client respond to praise and tangible reinforcers?",
          "Has the client received discrete trial training (DTT) before?",
        ],
      },
      {
        label: 'Family Priorities',
        isBcbaOnly: false,
        prompts: [
          "What are the top 3 skills the family most wants the client to gain in the next 6 months?",
          "Are there specific skills needed for school placement or transition planning?",
          "What does a successful day look like for this client? What would need to change to get there?",
        ],
      },
      {
        label: 'Treatment Planning Notes',
        isBcbaOnly: true,
        prompts: [
          "Identify skill targets that are developmentally appropriate and clinically justified.",
          "Prioritize targets based on family goals, safety, and functional impact.",
          "Note which targets will be addressed via DTT, naturalistic teaching, and parent training.",
          "Identify prerequisite skills needed before higher-level targets can be introduced.",
        ],
      },
    ],
  },

  behavior_targets: {
    key: 'behavior_targets',
    title: 'Behavior Targets',
    promptGroups: [
      {
        label: 'Behavior Identification',
        isBcbaOnly: false,
        prompts: [
          "Describe each challenging behavior in observable, measurable terms.",
          "For each behavior — how often does it occur (per hour, day, week)?",
          "How intense is each behavior (mild disruption to injury-level severity)?",
          "How long do episodes typically last?",
          "When did each behavior first emerge? Has frequency or intensity changed over time?",
        ],
      },
      {
        label: 'Antecedents & Setting Events',
        isBcbaOnly: false,
        prompts: [
          "What typically happens right before the behavior occurs (antecedents)?",
          "Are there setting events that make the behavior more likely (illness, poor sleep, schedule changes)?",
          "Are there specific people, places, times of day, or activities associated with the behavior?",
          "Are there situations where the behavior never or rarely occurs?",
          "Does the behavior look different in different settings?",
        ],
      },
      {
        label: 'Consequences & Maintaining Variables',
        isBcbaOnly: false,
        prompts: [
          "What typically happens immediately after the behavior (how do caregivers respond)?",
          "Does the behavior result in access to preferred items, activities, or attention?",
          "Does the behavior result in escape from demands, tasks, or people?",
          "Have any behavior intervention strategies been tried? What worked or didn't?",
          "Has a prior FBA or BIP been completed? Is it available for review?",
        ],
      },
      {
        label: 'Functional Hypothesis',
        isBcbaOnly: true,
        prompts: [
          "Based on caregiver report, what is your preliminary functional hypothesis for each behavior?",
          "Are behaviors maintained by attention, escape, access to tangibles, or automatic reinforcement?",
          "Are there multiple functions operating across different contexts?",
          "Is a formal functional behavior assessment (FBA) indicated before treatment?",
          "Note any behaviors that may require a behavior support plan review by the team.",
        ],
      },
    ],
  },

  crisis_plan: {
    key: 'crisis_plan',
    title: 'Crisis Plan',
    promptGroups: [
      {
        label: 'Risk History',
        isBcbaOnly: false,
        prompts: [
          "Has the client ever required emergency services, hospitalization, or crisis intervention?",
          "Has there been any history of suicidal ideation, self-harm, or statements of wanting to hurt others?",
          "Have there been any incidents requiring police or law enforcement involvement?",
          "Is there a prior crisis plan in place? Is it current and accessible to caregivers?",
        ],
      },
      {
        label: 'Warning Signs & Escalation',
        isBcbaOnly: false,
        prompts: [
          "What are the early warning signs that the client is escalating toward a crisis?",
          "What strategies have helped de-escalate the client in the past?",
          "What strategies have made things worse and should be avoided?",
          "How long does it typically take for the client to return to baseline after an episode?",
          "Are there any medical conditions (seizures, asthma, allergies) that must be considered in a crisis?",
        ],
      },
      {
        label: 'Emergency Contacts & Protocols',
        isBcbaOnly: false,
        prompts: [
          "Who should be contacted first if a crisis occurs during a session?",
          "What is the family's protocol for calling emergency services?",
          "Are there specific instructions for how to interact with law enforcement regarding this client?",
          "Is the client's treating physician or psychiatrist aware of the ABA services starting?",
          "Does the client carry any medical ID or emergency information card?",
        ],
      },
      {
        label: 'Clinical Crisis Protocol',
        isBcbaOnly: true,
        prompts: [
          "Document the specific crisis protocol to be included in the behavior support plan.",
          "Identify the threshold at which the RBT must call the BCBA during a session.",
          "Specify any physical management procedures authorized, if any, and required training.",
          "Note any restrictions or contraindications for specific crisis responses.",
          "Confirm the family has signed the crisis plan acknowledgment prior to service start.",
          "Identify whether a higher level of care or psychiatric consultation is warranted before services begin.",
        ],
      },
    ],
  },
};

export function getSectionConfig(key) {
  return SECTION_CONFIG[key] ?? null;
}
