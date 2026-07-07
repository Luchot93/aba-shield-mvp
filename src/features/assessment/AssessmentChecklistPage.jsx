import React, { useState } from 'react';
import { SECTION_ORDER, SECTION_TITLES } from './sectionConfig.js';
import { setDraftContent, sectionsWithChanges, sectionsMissingSTO } from './assessmentStore.js';
import { generateDraft } from './lib/generateDraft.js';
import { sectionHasData } from './lib/buildSectionPrompts.js';
import { buildLocalDraft } from './lib/buildLocalDraft.js';
import { sectionPromptHashes } from './lib/draftHash.js';
import { regenerateSections } from './lib/runGeneration.js';

// ─── Demo drafts (Marcus – fictional ABA assessment) ──────────────────────────

const MARCUS_DRAFTS = {

  demographics: `## Client & Referral Summary

**Client:** Marcus D. Rivera | **DOB:** March 4, 2017 (Age 9) | **Pronouns:** He/Him

**Primary Language:** English (Spanish spoken at home by maternal grandparents)

**Diagnosis:** Autism Spectrum Disorder, Level 2 (DSM-5), confirmed by Dr. Elena Vargas, Psy.D., at Children's Neuropsychology Associates on January 12, 2024. Secondary diagnoses include Attention-Deficit/Hyperactivity Disorder, Combined Presentation, and Generalized Anxiety Disorder.

**Insurance:** Florida Blue | Member ID: FLB-774421 | Group: G-12390 | Medicaid secondary payer (ID: FL-MCD-88221)

**Referring Provider:** Dr. Adriana Costa, M.D. (Developmental Pediatrics, Miami Children's Health System) — referred for comprehensive ABA assessment due to significant behavioral escalation and regression in adaptive skills over the prior 6 months.

**Family & Support System:** Marcus lives with his mother (Daniela Rivera, primary caregiver) and father (Javier Rivera) in a two-parent household. One younger sibling, Sofia (age 6), no reported developmental concerns. Maternal grandparents provide after-school childcare three days per week.

**School:** Marcus attends 3rd grade at Sunset Elementary, Miami-Dade County Public Schools, under a current IEP (re-evaluation completed February 2025). Services include 30 min/week speech-language therapy, 60 min/week OT, and a 1:1 paraprofessional aide for full school day. No current PT services.

**Prior ABA Services:** Marcus received ABA through Sunshine Behavioral Health (October 2022–June 2023, 15 hrs/week center-based). Services were discontinued when the family relocated. No ABA services in the interim period.

**Assessment Date:** May 22, 2026 | **Assessment Type:** Initial Comprehensive | **BCBA:** Dr. Ana Reyes, BCBA-D`,

  presenting_concerns: `## Presenting Concerns

### Primary Concerns Identified by Caregiver

The Rivera family identified three primary concerns prompting this referral. First and most urgent, Marcus has displayed a significant increase in physical aggression toward family members — primarily his mother and younger sibling — over the past six months. Incidents occur daily and include hitting with an open hand, throwing objects, and on two occasions biting his mother's arm hard enough to leave marks. The family reports that the escalation coincided with a school schedule change in October 2025 when Marcus's paraprofessional aide was reassigned.

Second, the family reports near-complete refusal of previously mastered self-care routines, particularly bathing. Marcus, who was independently bathing by age 7, now requires 45–60 minutes of caregiver prompting and frequently meltdowns at the bathroom door, sometimes resulting in aggression. This regression was not preceded by any identified medical event.

Third, caregiver reports marked anxiety in non-routine situations. Family has avoided restaurants, grocery stores, and extended family gatherings for approximately four months due to Marcus's distress response to unpredictable environments. This has significantly impacted family quality of life.

### School & Community

School reports corroborate aggression, noting 3 documented incidents of hitting peers in the past two months. Marcus has received in-school suspension on one occasion. The IEP team has recommended increasing paraprofessional support but this has not yet been implemented pending this ABA evaluation. Community avoidance is family-reported; school behavior appears to be improving with structured routine and predictability.

### Clinical Impression

Interview data strongly supports an escape function as the primary maintaining variable for Physical Aggression. Aggression consistently results in demand removal at home, and the onset correlation with the paraprofessional aide reassignment in October 2025 is clinically significant — the loss of structured 1:1 predictability at school appears to have increased Marcus's overall demand burden, generalizing the escape-maintained pattern into home settings. Attention is a secondary function for sibling-directed incidents, where Marcus's behavior reliably produces caregiver proximity. Biting, which has occurred exclusively during physical intervention attempts, further supports an escape hypothesis: the behavior escalated specifically in contexts where the demand was being maintained despite prior protest.

The abrupt regression in bathing — a skill Marcus had mastered independently by age 7 — warrants consultation with OT Ms. Sarah Mills to assess for new or shifting sensory processing changes since the January 2025 evaluation. Coordinating with Dr. Adriana Costa to rule out co-occurring medical contributors is also recommended. The regression does not appear to have a medical trigger per current history, but the sensory profile and anxiety diagnosis make an updated sensory assessment clinically appropriate before assuming purely behavioral function.

The severity of aggression and the functional impact across home and school settings indicate immediate clinical priority for behavior reduction programming alongside skill acquisition. No indications requiring immediate higher level of care at this time, though threshold for psychiatric consultation should be discussed with the family if aggression escalates further.`,

  self_help: `## Self-Help Skills

### Toileting

Marcus is fully toilet trained for both bowel and bladder. He independently initiates bathroom trips without prompting during the school day. No enuresis or encopresis reported. He manages clothing, wiping, flushing, and handwashing with minimal verbal reminders for handwashing duration. No sensory concerns related to the bathroom environment other than sensitivity to hand dryers (avoids public restrooms with automatic dryers).

### Dressing & Grooming

Marcus dresses and undresses independently for the most part. He can manage pullover shirts, elastic-waist pants, and slip-on shoes reliably. Buttons and snaps require prompting and often result in task refusal. Shoelaces are not yet mastered; family uses Velcro or slip-on styles exclusively. He tolerates tooth brushing with verbal prompting but refuses flossing. Hair combing is completed with minimal prompting. Face washing is intermittent — compliant approximately 50% of mornings per caregiver report.

Clothing sensitivities are notable: Marcus wears only tagless shirts and refuses jeans or any stiff fabric. This limits wardrobe substantially but family has accommodated by purchasing adaptive clothing.

### Feeding & Eating

Marcus's diet is highly restricted. Caregiver estimates 12–14 accepted foods, all of which are smooth in texture, mild in flavor, or familiar brands. Preferred foods include plain pasta, white rice, chicken nuggets (specific brand only), apple slices (peeled), graham crackers, and specific pouched yogurts. Refuses all vegetables and most proteins other than chicken. He uses a fork reliably but refuses spoons; drinks from a straw cup and refuses open cups at home (uses open cup at school under teacher support). Mealtime is a significant source of family stress — transition to table requires prompting, and new foods presented at meals result in behavioral escalation approximately 70% of the time.

A feeding evaluation was completed by OT Sarah Mills (January 2025) — results documented problem as primarily sensory-based avoidance with conditioned aversive response component.

### Clinical Notes

The most functionally significant self-help targets for ABA programming are dressing (buttons and snaps, shoelace tying) and bathing desensitization. These skills carry direct daily living impact and, in the case of bathing, overlap directly with the Bathing Refusal behavior target. Coordination with OT Ms. Sarah Mills — who conducted the feeding evaluation in January 2025 and identified sensory-based avoidance with a conditioned aversive response component — is recommended to develop an integrated feeding and grooming protocol. Feeding targets should be introduced gradually using a food chaining approach consistent with the OT's findings; ABA can reinforce approach behavior while OT manages sensory hierarchy.

Clothing sensitivities function as a meaningful setting event for morning behavioral escalation. When sensory-aversive clothing is applied (seamed tags, stiff fabric), Marcus's threshold for behavioral escalation during subsequent demands decreases substantially. Ensuring compliant adaptive clothing is available and managing the dressing sequence proactively is a recommended caregiver training priority.`,

  daily_living: `## Daily Living Skills

### Morning & Home Routines

The morning routine is the most challenging daily transition for the Rivera household. Marcus requires a consistent visual schedule, which is currently in use (laminated picture schedule on the bedroom wall), but frequently resists or skips steps when the schedule is altered or when a preferred adult (his father) is not present. On mornings when Mr. Rivera works early, task completion drops from approximately 80% to 40% of morning routine steps without full completion, per caregiver report.

Bedtime routine is more stable: Marcus follows a consistent sequence (shower-currently-refused, so replaced with sponge bath, pajamas, 20 minutes of preferred tablet time, story, lights out) with approximately 90% adherence when the routine begins by 8:00 PM. Delayed starts or deviations from sequence result in behavioral escalation.

Marcus does not yet complete household chores consistently. He can carry his plate to the sink with a prompt but does not independently tidy spaces, assist with laundry, or perform other expected age-appropriate household contributions. This is an identified family priority.

### Community & Independence

Community outings have been largely suspended by the family over the past four months due to behavioral escalation in unpredictable settings (see Presenting Concerns). Prior to this regression, Marcus could navigate familiar community environments (local playground, family's preferred restaurant, the public library) with caregiver supervision and minimal incident. Street safety awareness is appropriate — he stops at crossings and responds to caregiver signals. He does not yet manage purchases or money independently, which is appropriate given age and current functioning.

Marcus knows his first and last name, home address, and caregiver phone numbers — a meaningful safety strength.

### Leisure & Recreation

Preferred activities include watching specific YouTube channels (trains, science experiments), LEGO building (highly skilled — creates complex builds from instruction manuals), and outdoor trampoline. Screen time is currently unregulated and estimated at 4–6 hours per day on weekends. Marcus does not participate in organized sports or community activities outside school. He can engage in independent play with LEGO for up to 45 minutes, which is a functional leisure skill and a meaningful reinforcer for programming.

### Clinical Notes

Based on caregiver report, the morning routine currently averages 55–70 minutes with 8 discrete steps; completion drops from approximately 80% to 40% when Marcus's preferred parent (his father) is unavailable. Steps involving sensory demands — particularly face washing and bathing — present the highest resistance and are priority targets for task analysis and backward chaining instruction. The visual schedule currently in use (laminated, bedroom wall) is an existing strength to preserve and build upon; fading to a portable checklist is a medium-term goal once step compliance is established with both caregivers.

Community reintegration is a long-term clinical priority. Marcus previously managed familiar environments (library, local playground, the family's preferred restaurant) and community access is a meaningful quality-of-life goal the family has explicitly named. A graduated community exposure hierarchy — beginning with brief, predictable outings to known locations at low-demand times — should be incorporated into the treatment plan once behavioral stabilization at home is achieved.

LEGO building (up to 45 minutes independent engagement, advanced instruction-manual builds) and YouTube access (trains and science content) are confirmed high-preference reinforcers and will be embedded as contingent reinforcement across the treatment plan. The family has expressed interest in age-appropriate household chore participation as a skill-building target; carrying dishes, sorting laundry, and setting the table are recommended starting points to build contribution and independence within the home routine.`,

  safety: `## Safety Concerns

### Elopement & Wandering

No history of elopement or wandering reported. Marcus has never left a safe area without caregiver permission. Family does not report any concerns about this domain. No safety measures specific to elopement are in place. Marcus demonstrates appropriate response to "stop" commands in outdoor settings per caregiver report. Water safety: family has an above-ground pool in the backyard; Marcus can swim with supervision but does not swim independently, and pool area has a locking gate which remains latched. No incidents of unsupervised pool access reported.

### Self-Injurious Behavior

Marcus engages in head-directed hitting (hand to head/face, self-administered) during escalated behavioral episodes. This behavior occurs approximately 3–5 times per week during severe escalation and has not resulted in injury requiring medical attention. Duration of SIB episodes is typically brief (under 30 seconds), and the behavior appears to be part of a broader escalation sequence rather than a primary presenting behavior. No head-banging against surfaces reported.

### Aggression & Property Destruction

Physical aggression toward others is the primary safety concern (see Presenting Concerns). Topography includes open-hand hitting, object throwing (typically lightweight objects within reach), and biting. His mother is the most frequent target, followed by his younger sibling. Peers at school have been targeted on two documented occasions. There has been no property destruction resulting in significant damage; Marcus occasionally sweeps items off surfaces during escalation but does not engage in sustained property destruction.

No law enforcement involvement. No injuries to others requiring medical attention, though his mother reports bruising from the biting incidents.

### Clinical Safety Assessment

Aggression risk is rated HIGH at initial presentation. This rating reflects: (1) daily frequency of 3–7 incidents per day over a sustained period; (2) topography that includes biting, with two documented incidents in the past 60 days producing visible bruising lasting approximately one week on the primary caregiver; (3) the escalating trajectory over the past eight months; and (4) safety impact on the younger sibling, who has begun actively avoiding Marcus and limiting normal household activity as a result. Open-hand hitting (approximately 70% of incidents) and object throwing (1–2 times per week) round out the topography. No injuries have required medical attention; however, the biting incidents meet the threshold for injury-producing behavior and must be addressed as the primary clinical urgency. Physical intervention by caregivers during escalation has directly precipitated both biting incidents — this is a critical safety note for RBT training and caregiver guidance.

Mandated reporting requirements were reviewed during this clinical interview. No indicators meeting reporting threshold were identified at this time. This review has been documented in session notes per agency protocol.

Home environment appears structured, supportive, and appropriate for ABA services. Family is engaged, consistent, and motivated. No concerns regarding child welfare at this time.`,

  communication: `## Communication

### Expressive Language

Marcus communicates primarily through verbal speech. Mean length of utterance is estimated at 6–8 words in familiar contexts; shorter in high-demand or anxious situations. Speech intelligibility is good — familiar and unfamiliar listeners understand Marcus approximately 90% of the time under normal conditions; intelligibility decreases to approximately 60–70% when he is upset or speaking rapidly.

Marcus uses language to request preferred items and activities, protest non-preferred tasks, comment on topics of interest (particularly trains and science), and ask questions about factual topics. He struggles to use language to negotiate, express internal emotional states, or ask for help before escalating, which is a clinically significant gap.

Echolalia is present in a delayed form: Marcus frequently quotes YouTube video scripts during unstructured time or when anxious. Family and teacher report that delayed echolalia serves an apparent self-regulatory function in anxious situations. Immediate echolalia is not reported.

### Receptive Language

Marcus follows multi-step instructions reliably in predictable, familiar contexts (home, familiar school routines). In novel or anxiety-provoking situations, receptive accuracy drops significantly. He responds to his name consistently with familiar adults; inconsistently with unfamiliar people. He reliably understands yes/no questions, identifies objects, pictures, body parts, and people, and follows instructions across different familiar adults. New adults and novel settings temporarily disrupt instruction-following.

### Pragmatics & Social Communication

Marcus initiates communication spontaneously when motivated by a topic of personal interest — he will approach adults to share train-related information or recent YouTube content. Initiations toward peers are limited and typically related to sharing factual information rather than collaborative play. He makes eye contact inconsistently; more reliable with familiar adults than peers or strangers.

Conversational turn-taking in structured adult-led contexts is functional (3–4 exchanges on preferred topics). Peer-to-peer conversation is limited. Non-literal language (sarcasm, idioms) is largely not understood; Marcus takes most statements literally.

No AAC system is in place. Verbal speech is the primary communication mode. Current SLP (Ms. Daniela Cruz, 30 min/week at school) is focused on pragmatics and social communication.

### SLP Coordination Notes

Coordination with Ms. Daniela Cruz (SLP, 30 min/week at Sunset Elementary, focus: pragmatics and social communication) is a clinical priority. The most significant communication gap identified in this assessment is Marcus's inability to use language to request help or a break before escalating behaviorally — this absence of functional self-advocacy language is the direct antecedent to physical aggression across the majority of observed incidents. Functional Communication Training (FCT) targeting help-seeking mands — specifically "I need help," "I need a break," and "I need a minute" — will serve as the primary replacement behavior for the Physical Aggression behavior target, and should be a shared ABA-SLP goal with consistent implementation across both contexts.

Additional verbal behavior targets to embed across ABA session activities include: labeling internal emotional states (frustrated, scared, overwhelmed), conversational turn-taking in non-preferred task contexts, and requesting negotiation language for transition demands (e.g., "Can I finish this first?"). These targets align directly with Ms. Cruz's pragmatics focus and will be coordinated to ensure consistency of language models and reinforcement across providers. Shared data tracking on unprompted help-seeking mands across school and ABA contexts is recommended.`,

  self_stim: `## Self-Stimulatory Behavior

### Topography & Frequency

Marcus engages in several self-stimulatory behaviors. Most prominent is hand-flapping, which occurs with high frequency (estimated 20–30 episodes per day) particularly during periods of excitement, anticipation, or transitions. Hand-flapping episodes last 5–30 seconds. Secondary self-stimulatory behaviors include rocking in place during seated activities (observed during structured tasks and screen time) and repetitive verbal scripts — typically quoting YouTube content — during unstructured time.

Additionally, Marcus engages in repetitive re-reading of train timetables and route maps; this is a functionally similar behavior that occurs during leisure time and appears to serve a calming/regulatory function.

### Impact & Function

Hand-flapping does not significantly interfere with learning in structured settings — Marcus can engage academically while flapping. However, the behavior has been identified by school staff and peers as stigmatizing; several peer teasing incidents have been reported, and this appears to contribute to Marcus's social anxiety in school. Rocking during seated tasks can occasionally displace attention from the task at hand, per teacher report.

Verbal scripting appears primarily automatic (sensory/regulatory) but at elevated frequency it blocks communication exchanges and is reported by caregivers as distressing when it persists for extended periods.

Behaviors are most prominent during transitions, after school during decompression time, and when anxiety is elevated. They are least prominent during preferred, highly engaging activities (LEGO building, tablet viewing, calm familiar routines).

### Sensory Profile

Marcus has documented sensory sensitivities including hyperreactivity to unexpected loud sounds (hand dryers, fire alarms, crowd noise), tactile defensiveness for specific fabric textures (see Self-Help: Feeding & Clothing section), and mild visual sensitivity in bright fluorescent environments (school cafeteria is reported as particularly challenging). An OT sensory evaluation was completed by Ms. Sarah Mills (January 2025) — sensory profile indicates sensory modulation difficulties with mixed hyper/hyposensitivity pattern. Proprioceptive seeking behaviors (crashing into furniture, seeking deep pressure) noted in the report.

Sensory tools currently in use: noise-canceling headphones at school, weighted lap pad during circle time, fidget tools.

### Clinical Notes

Clinical review of Marcus's self-stimulatory behaviors indicates that hand-flapping, rocking, and verbal scripting are primarily automatic in function and serve a sensory-regulatory role. Reduction programming for these behaviors is not recommended as a first-line clinical priority; targeting automatic sensory behaviors for elimination without a comprehensive functional behavior assessment and clear evidence of functional impairment is inconsistent with current ethical practice standards. The stigmatizing impact of hand-flapping at school is a legitimate clinical concern — the appropriate first-line response is environmental modification (education of peers and school staff regarding Marcus's regulatory needs, neurodiversity-affirming framing) rather than behavior reduction.

Coordination with Ms. Sarah Mills (OT, evaluation completed January 2025, documented sensory modulation difficulties with mixed hyper/hyposensitivity and proprioceptive seeking) is recommended to integrate the existing sensory diet into ABA session planning. The sensory accommodations currently in use at school — noise-canceling headphones, weighted lap pad, fidget tools — should be consistently available during ABA sessions as well. This integration is expected to reduce the overall frequency of self-regulatory behaviors in high-demand contexts by addressing the sensory antecedents that elevate them.`,

  medical_necessity: `## Medical Necessity

### Diagnostic Support

Marcus's primary diagnosis of Autism Spectrum Disorder, Level 2 (DSM-5, F84.0) was established by Dr. Elena Vargas, Psy.D., at Children's Neuropsychology Associates on January 12, 2024. Diagnostic instruments used included the ADOS-2 (Module 3), ADI-R, and Vineland-3 Adaptive Behavior Scales. Full neuropsychological report on file. Most recent re-evaluation date: January 12, 2024 — within 24 months.

Co-occurring diagnoses: ADHD, Combined Presentation (F90.2); Generalized Anxiety Disorder (F41.1). Both confirmed by Dr. Adriana Costa, M.D., developmental pediatrician, on March 10, 2025.

Current medications: Guanfacine ER 1mg QD (prescribed by Dr. Costa, titrated November 2024 for attention and impulse control); no psychotropic medications for anxiety currently prescribed. No seizure disorder, cardiac conditions, or other medical contraindications to behavioral intervention.

Upcoming medical: Follow-up with Dr. Costa scheduled June 2026 for medication management review.

### Functional Impact

Marcus's constellation of deficits and behavioral excesses significantly impairs functioning across home, school, and community settings. At home, daily physical aggression threatens caregiver and sibling safety and has created a household environment described by the family as "walking on eggshells." The near-total loss of independent bathing — a previously mastered adaptive skill — represents a clinically significant regression requiring direct intervention. Severely restricted diet limits Marcus's ability to participate in community and social eating contexts. Morning routine breakdowns contribute to family-wide stress and have resulted in Marcus arriving late to school on multiple occasions.

At school, documented aggression toward peers has resulted in disciplinary action and contributes to the paraprofessional support requirement. Social isolation due to communication and pragmatic language deficits limits educational participation. Without ABA services, the family anticipates that Marcus's behavioral escalation will continue to worsen, that school placement may become more restrictive, and that community participation will cease entirely.

### Clinical Justification

Applied Behavior Analysis is clinically justified as the appropriate level of care for Marcus Rivera, meeting Florida Blue and Florida Medicaid medical necessity criteria on the following grounds: (1) Primary diagnosis of ASD Level 2 (F84.0), confirmed via ADOS-2 Module 3, ADI-R, and Vineland-3 Adaptive Behavior Scales, requiring substantial support across multiple domains; (2) co-occurring ADHD Combined Presentation (F90.2) and Generalized Anxiety Disorder (F41.1), both confirmed by Dr. Adriana Costa on March 10, 2025, contributing to a complex behavioral profile; (3) documented daily behavioral excesses posing an active safety risk to caregivers and siblings — physical aggression at 3–7 incidents per day, including biting with documented visible bruising — meeting clinical severity threshold; (4) clinically significant regression in a previously mastered adaptive skill (independent bathing, age 7), representing a meaningful loss of functional independence; and (5) functional impairment across home, school, and community settings sufficient to require full-day 1:1 paraprofessional school support and has led the family to eliminate all community participation over the past four months.

Prior ABA services through Sunshine Behavioral Health (October 2022–June 2023, 15 hours/week, center-based) were beneficial per caregiver report, with demonstrated behavioral improvement during the service period. Regression occurred within months of discontinuation following family relocation, directly supporting medical necessity for reauthorization. Both the referring developmental pediatrician (Dr. Adriana Costa) and the diagnosing psychologist (Dr. Elena Vargas) have provided letters of support for this referral.

Recommended service intensity: 20–25 hours per week, center-based with home component, consistent with the severity of behavioral presentation, current functioning level, prior partial response, and level of family engagement. Expected treatment targets and measurable outcomes for the 6-month authorization period include: Physical Aggression reduction from baseline 5 incidents/day to ≤1 incident/day; Bathing Refusal duration reduction from 45–60 minutes to ≤5 minutes; mastery of Functional Help-Seeking (80% independent across home and school settings); Morning Routine Completion within 30 minutes at 100% step accuracy; and re-establishment of community participation in at least two familiar settings. Identified barriers include after-school scheduling and transportation coordination, and language access — the maternal grandparents, who provide after-school care three days per week, are Spanish-speaking. Spanish-language caregiver training materials and a bilingual clinical contact are recommended components of the treatment plan.`,

  skill_acquisitions: `## 1. **Functional Help-Seeking (Verbal Request)**

**OPERATIONAL DEFINITION**
Marcus will independently vocalize a contextually appropriate help-seeking statement (e.g., "I need help," "Can you help me?", or "I don't know how to do this") within 10 seconds of encountering a task difficulty or blocked access to a preferred item, without prior adult prompting.

**TEACHING STRATEGIES**
Functional Communication Training (FCT) embedded in discrete trial and natural environment teaching. Begin with high-motivation tasks where Marcus already demonstrates frustration (e.g., difficult LEGO builds, blocked tablet access). Use least-to-most prompting hierarchy: expectant delay (5 sec) → gestural → partial verbal → full verbal model. Reinforce with immediate access to help and praise. Differentially reinforce unprompted responses with higher-magnitude reinforcers.

**BASELINE & MASTERY TABLE**
| Measure | Baseline | Mastery Criterion |
|---|---|---|
| % Independent Help-Requests | 5% (1 of 20 probed opportunities) | 80% across 3 consecutive sessions |
| Contexts | Home structured only | Home + school + community |
| Prompt Level | Full verbal model required | Independent (no prompt) |

**GENERALIZATION**
Generalize help-seeking across settings (home, school, community), communication partners (parents, RBT, teacher, paraprofessional, peers), and task types. Coordinate with SLP Ms. Cruz for embedding within school speech sessions.

---

## 2. **Morning Routine Completion (Independent Sequencing)**

**OPERATIONAL DEFINITION**
Marcus will complete all 8 steps of the morning routine (wake, dress, brush teeth, wash face, eat breakfast, pack backpack, shoes on, door-ready) in correct sequence within a 30-minute window, using a visual schedule independently, with no more than 1 verbal prompt total per routine.

**TEACHING STRATEGIES**
Backward chaining from the final step. Pair each step completion with a token on a visual token board (8 tokens = access to 5-minute preferred activity before school). Use first-then visual cues for transition resistance. Gradually fade visual schedule to a checklist, then to internalized routine. Parent training to ensure consistent implementation across both caregivers.

**BASELINE & MASTERY TABLE**
| Measure | Baseline | Mastery Criterion |
|---|---|---|
| Steps Completed Independently | 3 of 8 (38%) with primary caregiver present | 8 of 8 (100%) |
| Prompts Required | 4–6 verbal prompts | ≤1 verbal prompt |
| Routine Duration | 55–70 minutes | ≤30 minutes |

**GENERALIZATION**
Generalize across both parents as routine leaders. Probe weekend routine for maintenance. Address holiday/schedule-change disruption with advance visual priming.

---

## 3. **Peer Interaction Initiation (School Setting)**

**OPERATIONAL DEFINITION**
Marcus will independently initiate a non-scripted, contextually appropriate social interaction with a same-age peer (e.g., commenting on shared activity, requesting to join a game, offering a compliment) at least 2 times per 30-minute structured social opportunity, without adult prompting.

**TEACHING STRATEGIES**
Social skills group format using BST (instruction, modeling, rehearsal, feedback). Identify 2–3 preferred peers at school for structured peer-mediated intervention. Script fading for common opening lines. Video modeling using preferred train/LEGO content framed as social conversations. Coordinate with paraprofessional for in-vivo prompting and praise during structured recess activities.

**BASELINE & MASTERY TABLE**
| Measure | Baseline | Mastery Criterion |
|---|---|---|
| Unprompted Peer Initiations | 0 per 30-min session | 2+ per 30-min session |
| Response Accuracy | n/a | Contextually appropriate (scored via behavior-specific rating) |
| Settings | n/a | School recess + classroom cooperative tasks |

**GENERALIZATION**
Community social settings (playground, library events) after school mastery achieved. Family-arranged structured playdates as natural environment generalization context.`,

  behavior_targets: `## Behavior Targets

### Target Behavior 1: Physical Aggression

**Operational Definition:** Any instance of Marcus making forceful physical contact with another person's body using his hand, foot, or mouth, including but not limited to: open-hand hitting, closed-fist hitting, kicking, biting, or scratching. Object throwing directed at another person is included. Incidental physical contact (bumping while walking) is not scored.

**Frequency & Intensity:** Per caregiver report, physical aggression occurs 3–7 times per day across a typical weekday. The most severe incidents involve biting (2 documented incidents in the past 60 days). Intensity ranges from mild (open-hand swipe resulting in no mark) to moderate (biting leaving visible bruising). No incidents requiring emergency medical care, but the escalating trajectory is clinically significant.

**Topography Detail:** Open-hand hitting is most common (estimated 70% of incidents), directed primarily at mother (60%) and sister (30%). Object throwing is situational (approximately 1–2x per week). Biting has occurred exclusively toward mother during severe escalation episodes.

**Antecedents Identified:** (1) Transition demands — particularly ending preferred activities (tablet, LEGO); (2) Non-preferred task demands — especially grooming tasks; (3) Sibling interaction disrupting Marcus's preferred activities; (4) Unexpected changes to schedule or routine. Behavior is most likely on weekday afternoons after school (decompression period) and on mornings when the routine deviates from expected.

**Maintaining Variables:** Escape from demands appears to be the primary function based on caregiver report — aggression consistently results in removal of the demand. Attention may be a secondary function when sibling is involved. Family has historically removed demands following aggression due to safety concerns, which has likely strengthened the behavior over time.

### Functional Hypothesis

Based on indirect assessment data collected during this caregiver interview, the hypothesized function of Physical Aggression is negative reinforcement (escape from demands), with attention as a secondary function for sibling-directed incidents. This hypothesis is supported by: (1) consistent demand removal following aggressive incidents as reported by both caregivers across multiple settings; (2) highest behavioral occurrence during demand-rich periods — weekday post-school transitions, morning grooming demands, and sibling interactions that disrupt preferred activities; (3) temporal onset correlation with loss of structured 1:1 support following aide reassignment in October 2025; and (4) the two biting incidents occurring exclusively during physical intervention — a context in which demands were being actively maintained despite protest. Administration of the Functional Assessment Screening Tool (FAST) by the primary caregiver is recommended prior to BIP finalization, as the volume and specificity of interview data collected is sufficient to begin preliminary BIP development in parallel. Reinforcement contingencies to address in the BIP include: eliminating demand removal contingent on aggression, implementing FCT to provide a functional escape route, and differentially reinforcing appropriate verbal help-seeking and break-requesting across all caregivers and settings.

For Bathing Refusal, the functional hypothesis is escape from a sensory-aversive grooming task. The antecedent (verbal bathing cue, proximity to bathroom) is highly specific and the consequence (avoidance of the bathing sequence) is consistent across all reported episodes. A sensory desensitization hierarchy coordinated with OT is the indicated intervention approach.

**Proposed Intervention Strategy (Preliminary):**
- FCT to replace aggression with appropriate help-seeking and break-requesting
- Antecedent modifications: visual transition warnings (5-minute, 2-minute, 1-minute), demand fading for grooming tasks, structured sibling boundary protocols
- Planned ignoring for minor aggression with immediate redirection to alternative behavior
- Parent training: caregiver consistency in demand presentation and not removing demands following aggression

All aggressive incidents will be measured using event recording with same-day ABC (Antecedent-Behavior-Consequence) notation completed by the RBT in session and by caregivers via a structured daily log. A minimum of 10 school days of baseline data will be collected across both home and school contexts before implementing extinction or differential reinforcement components of the BIP. Baseline data will be graphed and reviewed with the supervising BCBA prior to BIP activation. Duration recording will be used for Bathing Refusal episodes, defined as onset at first verbal refusal through caregiver's report of routine completion or episode end.`,

  caregiver_training: `## Caregiver Training Program

### Training Rationale

Caregiver training is a medically necessary component of Marcus's ABA programming. Consistent implementation of behavioral strategies across home settings is required to generalize treatment gains beyond clinic sessions and to prevent inadvertent reinforcement of maladaptive behaviors. Daniela Rivera serves as the primary home implementer, with Javier Rivera and the maternal grandparents functioning as secondary implementers.

Observed baseline data indicate that Premack (first-then) contingencies and reinforcement delivery procedures are currently being used inconsistently. Daniela demonstrated the Premack principle correctly in approximately 35% of observed opportunities and appropriate reinforcement delivery in approximately 50% of opportunities during the intake observation. These baseline rates are below the threshold required for reliable home generalization and justify a structured caregiver training program as part of the ABA authorization.

### Training Objectives

**Short-Term Objectives (0–3 months):**
- Daniela will demonstrate correct use of Premack (first-then) contingencies with 70% accuracy across 3 consecutive direct observation probes.
- Daniela will deliver contingent reinforcement within 3 seconds of the target behavior with 70% accuracy across 3 consecutive probe sessions.
- Both parents will correctly identify Marcus's early warning signs from a standardized checklist with 100% accuracy.

**Long-Term Objective (6 months):**
- All primary caregivers (Daniela, Javier) will demonstrate 90% accuracy on Premack and reinforcement delivery across 3 independent probes conducted without RBT verbal support.
- Grandparents will demonstrate 80% accuracy on the priority strategies after 3 translated written guide reviews and 2 coached practice sessions.

### Training Plan

Training will be conducted through in-session coaching (RBT modeling and feedback during active ABA sessions) and bi-weekly parent sessions with the supervising BCBA. Written guides will be prepared and translated into Spanish for the maternal grandparents. Initial sessions will focus on reinforcement identification, contingency delivery, and data recording using a simplified frequency tally sheet. Video modeling of correct strategy use will be recorded during early sessions and shared with Javier for review outside of his work schedule.

Progress toward competency benchmarks will be reviewed monthly at caregiver check-in meetings and incorporated into the authorization renewal narrative.`,

  crisis_plan: `## Crisis Plan

### Risk History

No history of hospitalization, acute psychiatric crisis, or emergency services involvement related to behavioral or psychiatric presentations. No suicidal ideation, self-harm (beyond SIB described in Safety section), or homicidal statements reported. Law enforcement has not been involved. No prior formal crisis plan is in place. Family has managed behavioral crises informally without documented protocols.

### Warning Signs & Escalation Sequence

Caregiver-identified early warning signs that Marcus is approaching a behavioral crisis include:
- Increased pace of walking or pacing
- Onset of delayed echolalia (scripting) at elevated volume or frequency
- Refusal to make eye contact combined with turned body posture
- Hand-flapping at higher intensity than baseline
- Verbal repetition of "no" or "I don't want to" to non-presented demands

**Escalation sequence as reported by caregiver:** Early warning signs → verbal protest ("No!" "Stop it!") → increased motor agitation (pacing, flapping, rocking) → crying or screaming → physical aggression → in some cases, SIB (self-hitting)

**De-escalation strategies that have worked:** Offering a brief break in a quiet, low-stimulation space; allowing 5 minutes of access to preferred tablet content; deep pressure (bear hug, weighted blanket); reducing all verbal demands during escalation; speaking in a calm, low tone with simple language.

**Strategies that worsen escalation:** Restraint or physical blocking without warning; attempting to reason or explain consequences during escalation; multiple verbal prompts or questions in rapid succession; sibling presence during episodes; raising voice tone.

**Return to baseline:** Typically 20–40 minutes following peak escalation. Family reports Marcus often initiates affection (hugs, apologizing) after returning to baseline, which is consistent with remorse awareness.

**Medical considerations:** No seizure disorder, allergies, or cardiac conditions requiring specific crisis protocol modifications. Guanfacine ER administered in the morning — no acute behavioral effects noted.

### Emergency Contacts & Protocols

- **Primary emergency contact:** Daniela Rivera (mother) — (305) 555-0302
- **Secondary:** Javier Rivera (father) — (305) 555-0303
- **Treating physician:** Dr. Adriana Costa (prescribing physician) — (305) 555-0410
- **Family protocol for emergency services:** Family will call 911 if Marcus or another person is in immediate danger of injury they cannot manage. They have been counseled to inform dispatch that Marcus has autism and to request a CIT (Crisis Intervention Team) officer if available in their jurisdiction.

### Clinical Crisis Protocol

RBT-to-BCBA call threshold: any biting incident regardless of injury; any physical aggression resulting in visible injury to another person; any behavioral episode (combined escalation and return-to-baseline period) lasting more than 20 consecutive minutes without improvement. The BCBA must be reached within 30 minutes of incident onset; the RBT should attempt contact within 7 minutes of incident and document all attempts.

Physical management procedures: No physical management or blocking procedures are authorized under this crisis plan. The RBT's response is limited to (1) moving out of Marcus's immediate reach, (2) removing the younger sibling and other at-risk individuals from the environment calmly and without escalation, and (3) creating distance while maintaining calm, low-verbal presence. Physical redirection has directly precipitated both documented biting incidents — RBTs must not attempt to physically guide or redirect Marcus during a crisis episode. Session suspension is indicated if Marcus initiates biting toward the RBT or directs object-throwing at the RBT with intent; the RBT should move out of range, contact the supervising BCBA immediately, and not re-engage until BCBA advises. This crisis plan must be reviewed, signed, and on file before services begin. Signature of both primary caregivers and the supervising BCBA is required.

Psychiatric consultation with Dr. Adriana Costa is recommended prior to or concurrent with ABA service initiation. Given the current frequency of physical aggression, the presence of biting producing documented injury, and the co-occurring Generalized Anxiety Disorder diagnosis, a medication review — specifically to assess whether pharmacological support for anxiety and impulse dysregulation may be appropriate alongside ABA — is clinically warranted. Dr. Costa is the treating physician and is already involved in this referral; a formal consultation request should be made at intake.`,
};

// ─── Loading messages ─────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Reading interview transcripts…',
  'Synthesizing clinical notes…',
  'Structuring presenting concerns…',
  'Drafting skill acquisition goals…',
  'Building behavior target narratives…',
  'Compiling medical necessity justification…',
  'Assembling crisis plan protocols…',
  'Formatting document sections…',
  'Applying clinical standards…',
  'Checking grammar and clinical terminology…',
  'Finalizing assessment document…',
];

// ─── Checklist row icons ──────────────────────────────────────────────────────

function IconComplete() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#34D399" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  );
}

function IconConflict() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#FBBF24" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
  );
}

function IconEmpty() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#CBD5E1" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/>
    </svg>
  );
}

// ─── Demo drafts (Emma – fictional ABA assessment) ───────────────────────────

const EMMA_DRAFTS = {

  demographics: `## Client & Referral Summary

**Client:** Emma J. Thompson | **DOB:** January 30, 2020 (Age 6) | **Pronouns:** She/Her

**Primary Language:** English

**Diagnosis:** Autism Spectrum Disorder, Level 3 (DSM-5), confirmed by Dr. Sarah Patel, Psy.D., at Palm Beach Developmental Center on October 8, 2023. No secondary diagnoses on file.

**Insurance:** Humana | Member ID: HUM-334490 | Group: G-98712 | No Medicaid on file

**Referring Provider:** Dr. Robert Chen, M.D. (Developmental Pediatrics, Palm Beach Children's Hospital) — referred for comprehensive ABA assessment due to severe communication delays, daily self-injurious behavior, and significant food selectivity impacting nutritional status.

**Family & Support System:** Emma lives with her mother (Sarah Thompson, primary caregiver) and father (James Thompson) in a two-parent household in Boca Raton, FL. No siblings reported. Extended family support is limited; paternal grandparents reside out of state.

**School:** Emma attends Palm Beach Gardens Early Childhood Center, a specialized autism program. She receives 20 hrs/week of speech-language therapy, 60 min/week OT, and is supported by a 1:1 paraprofessional throughout the school day. Applied Behavior Analysis services are delivered in the school setting 10 hrs/week through a separate provider.

**Prior ABA Services:** Emma began ABA services at age 3 through Little Steps ABA (March 2023–present), transitioning from clinic-based (20 hrs/week) to home/school split model (15 hrs/week) in January 2025. The current referral seeks a fresh comprehensive assessment to update programming given significant behavioral escalation.

**Assessment Date:** May 22, 2026 | **Assessment Type:** Initial Comprehensive | **BCBA:** Dr. Ana Reyes, BCBA-D`,

  presenting_concerns: `## Presenting Concerns

### Primary Concerns Identified by Caregiver

The Thompson family identified three primary concerns prompting this referral. First and most urgent, Emma engages in daily head banging on hard surfaces at a frequency of 4–8 episodes per day, primarily during transitions and demand presentation. Parents have observed visible marks on her forehead and report heightened anxiety about long-term injury. No medical attention has been required to date, though parents report the behavior is escalating in intensity.

Second, Emma has extremely limited verbal communication — approximately 8–10 single words used inconsistently, with no functional requesting observed. She communicates primarily through hand-leading and pointing. Parents describe frustration-related aggression toward family members (scratching, pinching) that appears to increase when her communicative attempts are not understood.

Third, severe food selectivity has been identified as a critical concern. Emma accepts only 6 foods: plain pasta (specific brand), white bread, apple juice (specific brand), vanilla wafers, strawberry yogurt (pouched), and chicken breast (prepared in a specific way). Parents report mealtimes lasting 45–90 minutes with frequent behavioral escalation when non-preferred foods are presented. The referring provider has expressed concern regarding nutritional adequacy.

### School & Community

School reports corroborate communication delays and note that Emma's peer interactions are limited to proximity-based parallel play. The school-based BCBA has documented elopement attempts when transitioning between school buildings (2–3 per week). No community outings have occurred in the past three months due to family avoidance of public settings.

### Clinical Impression

The severity of self-injurious behavior and the functional impact on communication and safety across home and school settings indicate immediate clinical priority for a comprehensive behavior assessment, including functional analysis if clinically indicated. Communication augmentation (AAC evaluation) is strongly recommended in coordination with the SLP. Feeding concerns should be addressed via a multi-disciplinary approach including OT and dietary consultation.`,

  self_help: `## Self-Help Skills

### Toileting

Emma is partially toilet trained. She is reliably continent for urine during the school day with a timed toileting schedule (every 60 min with verbal prompt). She initiates toileting independently approximately 20% of opportunities at home; school rate is approximately 50%. Bowel training is not yet established — parents report she withholds until a pullup is provided at naptime. She does not manage clothing for toileting independently; requires partial physical assistance for pants down/up. Handwashing is prompted and completed with hand-over-hand for soap application.

### Dressing & Grooming

Emma can remove shoes (Velcro fasteners), pull off socks, and pull pants down from the waist. Dressing skills are emerging — she can pull a shirt over her head with setup but cannot orient the garment. She tolerates hair combing with a wide-tooth comb if completed quickly (under 30 seconds); extended grooming results in behavioral escalation. Tooth brushing is completed with full physical assistance; Emma bites the toothbrush and requires a vibrating brush that she tolerates better than standard brushes.

Tactile sensitivities are significant: Emma wears only soft, seamless clothing. Tags must be removed from all garments. She refuses socks with seams and shoes with tight fastenings. Parents have purchased adaptive clothing exclusively.

### Feeding & Eating

As noted in presenting concerns, Emma accepts 6 foods. She uses a spoon for yogurt reliably and eats finger foods independently. She does not use a fork consistently. She drinks from a spouted cup and is transitioning to a straw — currently at 40% independent straw use. Open cups are not yet introduced. Mealtime duration is extended; caloric intake is monitored by the family's pediatrician with iron supplementation currently prescribed.

### Clinical Notes

Toilet training is an immediate clinical priority. Emma currently has urinary continence during the school day on a timed schedule (every 90 minutes with verbal prompt) but does not self-initiate; home initiation rate is approximately 20% per caregiver report. Bowel training has not yet been established — Emma relies on pull-ups at naptime for bowel elimination and full-time pull-ups otherwise. ABA toilet training programming will target: (1) independent toileting initiation using a schedule-fading protocol, moving from prompted every 90 minutes toward self-initiated trips; (2) pants management (pulling down and up) as a prerequisite self-help step, addressed via task analysis and physical prompting hierarchy; and (3) generalization across home and school settings and multiple caregivers. Coordination with Emma's school team is needed to align home and school schedules.

Coordination with OT on the feeding protocol is recommended, building on the March 2024 sensory-based avoidance assessment. A food chaining approach, targeting foods adjacent to Emma's current 6 accepted foods along sensory dimensions (texture, color, brand), is the appropriate starting point. ABA can support approach behavior and reinforce exploration without requiring consumption, in coordination with OT's sensory hierarchy.

Tactile sensitivities — specifically the requirement for seamless socks and tagless shirts, and behavioral escalation when seamed or ill-fitting clothing is applied — function as a significant daily antecedent to behavioral escalation. Mornings involving clothing management before the sensory preferences are met are elevated-risk periods for head banging and transition refusal. Ensuring compliant adaptive clothing and building tolerance gradually via desensitization is a clinical priority, coordinated with OT.`,

  daily_living: `## Daily Living Skills

### Morning & Home Routines

The morning routine is highly structured and requires consistent adult support throughout. Emma follows a picture schedule with photographs (not icons) — parent reports she requires photo-specific images and will not follow drawn or cartoon symbols. With the photo schedule and consistent adult presence, she completes approximately 65% of morning routine steps with partial physical assistance. Steps involving sensory input (face washing, hair brushing) are the most resistant and are frequently skipped.

Transitions between activities require advance visual warnings (visual timer set for 2 minutes before transition). Without this support, transitions reliably produce self-injurious behavior. Parents have implemented the 2-minute warning consistently for 8 months with moderate success — escalation at transitions has decreased approximately 40% per parent report.

Bedtime routine is the most stable: Emma follows a bath (sponge format, as full bath is refused), pajamas, and book sequence with approximately 80% adherence. She falls asleep independently after the routine approximately 70% of nights; the remaining 30% require parental presence for 20–40 minutes.

### Community & Independence

Community access has been suspended for the past three months. Previously, Emma tolerated brief outings to the pediatrician and drive-through settings with preparation. She was never able to access grocery stores, restaurants, or other sensory-rich environments without significant behavioral escalation.

Street safety awareness is not yet functional — Emma does not respond reliably to "stop" in novel outdoor environments. Parents use a wrist-to-wrist tether for all outdoor activities. Elopement risk is high and is flagged as a safety priority.

### Leisure & Recreation

Preferred activities include cause-and-effect toy play, tablet-based video apps (specifically Baby Shark and Blippi), swinging on a backyard swing, and tactile bins (rice, water beads). Emma engages in independent play with preferred toys for up to 15–20 minutes. She does not engage in symbolic or pretend play. Screen time is approximately 3–4 hours per day; parents use screen access as the primary reinforcer across the day.

### Clinical Notes

Visual supports are an established strength in Emma's learning profile. Photo-based visual schedules (photographs, not icons or cartoon symbols) are effective at school and should be implemented consistently at home — Emma does not currently have a visual schedule at home, and the absence of this structure is a contributing factor to the high rate of transition-related behavioral escalation (approximately 70% of transitions result in head banging or tantrum). Providing caregivers with a home photo schedule replicating the school format is a first-session priority.

Elopement is an immediate safety priority and must be addressed in the crisis plan and caregiver training before ABA home services begin. Emma has eloped from the school building twice this academic year and from the home front yard on three documented occasions since October. While door-top deadbolts and a door alarm have been effective at home since installation, elopement risk must be explicitly included in the RBT safety protocol, and visual supervision at all times during home sessions is required.

Current reinforcer menu is dominated by iPad access (water videos, sensory YouTube content) estimated at 3–4 hours/day. While screen access is a reliable reinforcer, over-reliance on a single category reduces schedule flexibility and potency. Preference assessment should be completed in the first week of services to identify and rank alternative high-preference reinforcers. Based on parent interview, high-value candidates include: light-up spinning toys, vestibular stimulation (spinning in a therapy chair), vanilla wafer cookies, and tickle play. Expanding the reinforcer menu across sensory categories will improve treatment efficiency and allow natural environment teaching in non-screen contexts.`,

  safety: `## Safety Concerns

### Elopement & Wandering

Elopement is identified as a high-priority safety concern. Emma has eloped from the school building on two documented occasions this academic year. At home, she has opened the front door and walked into the yard without caregiver awareness on three occasions, most recently in March 2026. The family has installed door-top deadbolt locks and a door alarm, which have effectively prevented recurrence since installation. School is in process of implementing a door proximity protocol.

Emma does not respond consistently to her name in high-arousal or distracted states. She does not respond reliably to "stop" or "wait" in outdoor environments. She does not have a concept of traffic danger — will walk into a street without hesitation. Caregiver always uses a wrist-to-wrist safety tether in outdoor settings.

### Self-Injurious Behavior

Head banging is the primary self-injurious behavior. Emma makes contact between her forehead or top of head and hard surfaces (walls, floors, table edges). Frequency is 4–8 episodes per day; duration ranges from 1 to 3 head impacts per episode. Force appears to vary with emotional escalation — mild contact in low-level frustration, harder contact during full behavioral escalation. Parents have placed foam padding on wall corners at home.

No self-biting, eye-poking, or skin-picking behaviors reported.

### Aggression Toward Others

Emma engages in scratching and pinching when communication attempts fail or when demands are presented. Incidents occur 2–3 times per day on average. Primary targets are parents and the school paraprofessional. No biting toward others reported.

### Clinical Notes

Functional behavior assessment is required before implementing behavior reduction programming for head banging and aggression. At minimum, an indirect assessment (MAS or FAST completed by primary caregivers) and systematic direct observation across home and school contexts should be completed. Given the frequency, intensity, and injury risk of head banging (4–8 episodes/day, visible marks documented, escalating force during full behavioral escalation), a structured functional analysis is recommended prior to any extinction-based procedures. School direct observation data, including ABCs across naturally occurring episodes, should be obtained and reviewed before programming begins.

Elopement emergency protocol: Emma must never be in a home session without locked perimeter security (door-top deadbolts active, door alarm armed). RBT must maintain direct visual supervision at all times during sessions. If elopement occurs during an ABA session, the RBT must follow immediately using a calm, neutral tone without shouting; contact the supervising BCBA within 15 minutes of any elopement incident; and complete an incident report prior to session end. Do not physically block or grab Emma during active elopement — maintain proximity and guide back to safe area calmly.

Evaluation of sensory regulation supports is recommended via coordination with Emma's OT (see self_stim section). Proprioceptive and vestibular input prior to high-demand transitions has been identified as a potential antecedent modification to reduce the sensory-automatic component of head banging.

Mandated reporting requirements were reviewed during this clinical interview. The documented SIB (visible marks from head banging) was assessed in context — parents have installed protective foam padding and are actively seeking appropriate intervention. No indicators meeting threshold for a mandated report were identified at this time. This review has been documented in session notes.`,

  communication: `## Communication

### Expressive Language

Emma's expressive communication is significantly below age expectations. She uses approximately 8–10 single words inconsistently: "no," "mama," "more," "up," "out," "eat," "bye," "mine," and two approximations for preferred food items. Word use is not reliable across contexts — words observed in one setting are frequently not reproduced in another. No spontaneous two-word combinations have been observed by caregivers or school staff.

Emma communicates primarily through physical means: hand-leading to desired items or locations, reaching toward preferred objects, and proximity to caregivers. She uses pointing to indicate refusal (pointing away) more reliably than to request.

### Receptive Language

Emma follows familiar single-step instructions in structured settings with visual support (e.g., "sit down" paired with visual schedule step) with approximately 70% accuracy. Novel single-step instructions without visual support are followed approximately 30% of the time. She does not follow two-step instructions consistently. She identifies approximately 15–20 familiar objects by pointing to them when named, primarily food items and classroom objects from her school routine.

### Augmentative & Alternative Communication

Emma currently uses a 12-symbol PECS binder (Phase I–II) at school. Home implementation of PECS has been inconsistent — parents report the binder is used at meals approximately 50% of the time. An AAC device evaluation was recommended by the school SLP in January 2026 and has not yet been completed; this assessment is being used to support that recommendation.

### Clinical Notes

Coordination with the school SLP is an immediate clinical priority. Emma is currently in Phase II of PECS at school (single exchange, prompted) and an AAC trial (Proloquo2Go) was initiated two weeks prior to this assessment, with full physical prompting still required for all symbol activations. The family reports home implementation of PECS is inconsistent — the binder is used at meals approximately 50% of the time — and they have not received sufficient training to support the AAC device at home. Providing parent training in PECS Phase II–III and introductory Proloquo2Go navigation is a first-month priority.

The highest-frequency communication needs identified in this assessment are: requesting food (meal and snack contexts, multiple times daily), requesting "break" or "all done" during demand contexts (the communicative escape function directly linked to head banging), and indicating "help" when task difficulty triggers frustration. These three mand targets — food request, break, help — should be the initial PECS and AAC programming priorities, coordinated across ABA, school SLP, and home contexts.

Current PECS communication binder contents should be documented at intake. Core vocabulary items "help," "break," "I want," and "all done" should be added as immediate targets if not already present. Coordination with the school SLP to ensure consistent symbol sets across PECS binder and Proloquo2Go device vocabulary is essential for cross-modality learning.`,

  self_stim: `## Self-Stimulatory Behavior

### Observed Stereotypies

Emma engages in several repetitive behaviors that appear to serve a sensory function. Primary stereotypies include hand-flapping (bilateral, observed during transitions and periods of heightened emotion — both excitement and distress), toe-walking (consistent, all day without shoes, approximately 50% with shoes), and visual tracking of moving objects (spinning coins, ceiling fans, tablet loading icons — can engage for 5–10 minutes without interruption).

Secondary stereotypies include rubbing the back of her left hand against her face (most frequent during screen time and during quiet activities), and vocalizing with a high-pitched tonal pattern during play with cause-and-effect toys. This vocalization does not appear to serve a communicative function; it occurs in the absence of social audience and continues when social attention is withdrawn.

### Impact on Daily Functioning

Stereotypy does not appear to be significantly impairing across most settings, with the exception of visual tracking of spinning objects — this behavior can crowd out instructional engagement for extended periods and is noted by school staff as a barrier to participation during group activities.

Toe-walking has been flagged by the pediatric orthopedist as requiring monitoring; no intervention recommended at this time.

### Clinical Notes

Clinical review of Emma's stereotypy profile indicates that the majority of her repetitive behaviors (hand-flapping, rocking, high-pitched vocalizing, face-rubbing) serve a sensory-regulatory or automatic function and should not be targeted for reduction without functional behavior assessment confirming a function other than sensory regulation. Reducing automatic sensory behaviors without addressing the underlying sensory need is likely to increase behavioral stress and may elevate head banging frequency, making this a clinical risk rather than a treatment benefit.

Object spinning and visual fixation (ceiling fans, reflective surfaces) are more complex cases. When visual fixation crowds out instructional engagement — which school staff have documented during group activities — Response Interruption and Redirection (RIRD) is an evidence-based procedure that may be appropriate; however, it should only be implemented following baseline data collection confirming that visual stereotypy is interfering with learning opportunities, and in coordination with OT's sensory diet to address the underlying sensory need.

Baseline rates for all stereotypies should be documented during the first two weeks of service via session observation, including frequency counts and percentage of intervals engaged in each behavior across instructional and unstructured contexts. OT coordination is recommended to implement a sensory diet targeting proprioceptive and vestibular input (identified as primary seeking domains in the OT evaluation) as an antecedent modification across the school day and home routine — no sensory diet is currently in place at home, which represents a gap in the existing intervention ecosystem.`,

  medical_necessity: `## Medical Necessity

### Diagnosis and Functional Impact

Emma Thompson carries a diagnosis of Autism Spectrum Disorder, Level 3 (DSM-5, F84.0), confirmed by Dr. Sarah Patel, Psy.D., on October 8, 2023. This diagnosis is defined by requiring very substantial support in both social communication and restricted, repetitive behaviors. Emma's clinical presentation is consistent with a Level 3 classification: she has minimal verbal communication, significant difficulties with daily living skills, and engages in self-injurious behavior that poses an ongoing safety risk.

The clinical findings documented in this assessment support the medical necessity for Applied Behavior Analysis services at a comprehensive intensity level. Emma's deficits in communication (expressive language at approximately 18-month developmental level), self-care skills (toileting, dressing, grooming requiring substantial adult support), and adaptive behavior (Vineland-3 estimated composite in the 40–50 standard score range based on parent interview) indicate functional limitations that ABA services are designed to address through evidence-based behavioral intervention.

### Safety Considerations

Daily self-injurious behavior (head banging, 4–8 episodes/day), elopement risk with documented incidents at school and home, and aggression toward caregivers (2–3 incidents/day) represent active safety concerns requiring immediate intervention. The absence of reliable receptive safety responses ("stop," "wait") and the presence of traffic-oblivious elopement elevate the clinical urgency of this case.

### Justification for Service Hours

Based on the severity of Emma's presenting profile, recommendation is for 30–35 hours per week of ABA services inclusive of direct therapy and supervision. This level of intensity is consistent with published research recommendations for children with Level 3 ASD profiles, limited communication, and active self-injurious behavior. Services will be provided across home and school settings to promote generalization.

### Clinical Notes

Completion of a standardized adaptive behavior assessment — Vineland-3 or ABAS-3 — is required to formally document the functional deficit baseline that supports the recommended 30 hours per week service intensity. Parent interview data collected during this assessment suggests a Vineland Adaptive Behavior Composite in the 40–50 standard score range, consistent with the Level 3 ASD classification, but formal administration is necessary for insurance authorization documentation. The diagnostic evaluation completed by Dr. Robert Chen (Palm Beach Children's Hospital, March 2024) included the Vineland-3 as part of the diagnostic battery — obtaining this report on file will supplement or replace the need for a full re-administration if the report is recent enough to meet the insurer's documentation window.

Humana's authorization requirements for the recommended 30 hours per week should be confirmed with the clinical authorization team at intake. Typical documentation requirements include: diagnostic records (ADOS-2, ADI-R, Vineland-3 from March 2024 evaluation), referring provider letter from Dr. Robert Chen or current pediatrician Dr. Sarah Mills, this completed ABA assessment report, and a signed treatment plan with measurable goals. Parent-signed informed consent and crisis plan acknowledgment are required before services begin. The IEP team's current discussion regarding potential placement change for fall adds clinical urgency to the authorization timeline — this context should be noted in the authorization request letter.`,

  skill_acquisitions: `## Skill Acquisition Plan

### Overview

Emma's skill acquisition programming will target communication, daily living, and safety domains as immediate priorities given the severity of functional deficits and safety risk identified in this assessment. Goals are organized by target domain and written to be measurable, observable, and achievable within the projected authorization period.

### Priority Skill Areas

**1. Functional Communication via AAC**
Emma will learn to use a speech-generating device (AAC) to make requests across at least 10 high-preference items/activities, using core vocabulary with 80% accuracy across 3 consecutive sessions with 2 communication partners in 2 settings.

**2. Mand Training — PECS Phase III–IV**
Emma will use PECS to discriminate symbols and request preferred items from a field of 6 symbols with 80% accuracy across 3 consecutive sessions without physical prompting.

**3. Toilet Training — Initiation**
Emma will independently initiate toileting (approach toilet, pull down pants, sit, complete elimination) across 80% of naturally occurring urge opportunities at home, as measured over 5 consecutive data collection days.

**4. Dressing — Pants On/Off**
Emma will independently put on and take off elastic-waist pants with verbal prompt only, 80% accuracy across 3 consecutive sessions.

**5. Safety Response — Stop on Signal**
Emma will stop walking and remain stationary for 5 seconds in response to "stop" signal from any familiar adult in outdoor environments, across 80% of probed opportunities over 3 consecutive sessions.

### Clinical Notes

A formal preference assessment should be completed during the first week of services to establish a ranked reinforcer hierarchy for use across all skill acquisition programs. Based on parent interview, the following items have been identified as high-preference candidates: light-up spinning toys, iPad access (water/sensory YouTube videos), vanilla wafer cookies, vestibular input (spinning in a therapy chair), and tickle play. Multiple stimuli without replacement (MSWO) or paired choice assessment across these categories will generate a valid reinforcer hierarchy for initial programming.

Coordination with the school SLP on AAC device selection and Proloquo2Go vocabulary programming is required before communication skill acquisition programs can be finalized. The vocabulary sets trained in ABA must align with those in use during school SLP sessions to ensure cross-context generalization and avoid teaching competing symbol-label pairings.

Baseline data for all five skill targets must be collected via structured probe sessions before programming begins — minimum of 3 probe sessions across 2 days per target. Task analyses and prompting hierarchies for Toilet Training (initiation fading) and Functional Requesting (PECS Phase II–III advancement and AAC activation) must be written and reviewed with the supervising BCBA prior to initial treatment sessions. Data collection sheets with frequency, duration, or percentage correct formats (as appropriate per target) should be prepared and reviewed with the RBT at the initial training meeting.`,

  behavior_targets: `## Behavior Targets

### Target Behavior 1: Head Banging (Self-Injurious Behavior)

**Operational Definition:** Emma makes physical contact between her head (forehead, crown, or temple) and any hard surface (wall, floor, table) with observable force. Each contact counts as one instance. A new instance is recorded if more than 3 seconds have elapsed without contact.

**Baseline:** 4–8 instances per day across home and school settings (parent interview; school data collection forthcoming).

**Hypothesized Function:** Escape from demand / access to attention when communication attempts fail. Head banging appears to reliably produce task termination and caregiver attention, both of which are hypothesized to maintain the behavior. Sensory function cannot be ruled out — a formal functional analysis is recommended.

**Intervention Approach:** (1) Antecedent modification: reduce task difficulty through errorless learning, provide advance warning before demands; (2) FCT: teach functional alternative to request break and help using AAC; (3) Differential reinforcement of alternative behavior (DRA): reinforce communication attempts with high-magnitude reinforcement; (4) Safety protocol: ensure soft environment during escalation; do not reinforce SIB with preferred item access.

**Goal:** Reduce head banging to ≤1 instance per day across 5 consecutive school days and 5 consecutive home-data days as measured by direct observation and parent/RBT data.

---

### Target Behavior 2: Aggression (Scratching/Pinching)

**Operational Definition:** Emma uses her fingers or nails to make direct contact with another person's skin with observable force (visible mark or verbal/behavioral pain response from recipient), or applies sustained pinching pressure to another person's skin. Each instance is recorded at onset of contact.

**Baseline:** 2–3 instances per day (parent report; school data collection forthcoming).

**Hypothesized Function:** Access to communication / escape from demand. Incidents cluster around communication failure (not understood) and during transitions when caregiver attention shifts away.

**Intervention Approach:** (1) FCT using AAC and PECS to build alternative communicative repertoire; (2) Antecedent modifications to reduce communication failure opportunities; (3) Safety protocol for RBT and caregivers; (4) Reinforcement of appropriate contact and communication attempts.

**Goal:** Reduce aggression to ≤1 instance per week across 4 consecutive weeks as measured by RBT session data and parent daily logs.

### Clinical Notes

Functional behavior assessment is required before implementing any extinction-based procedures for Head Banging or Tantrum/Drop. At minimum, an indirect assessment (MAS completed by both primary caregivers independently) and systematic direct observation across home and school settings must be completed and reviewed with the supervising BCBA. Given the safety risk of SIB — observable marks documented, force escalating with emotional arousal, frequency averaging 6 episodes per day — a structured functional analysis in a controlled setting is strongly recommended prior to implementing differential reinforcement or extinction components of the behavior plan. This recommendation is consistent with BACB ethical guidelines for behaviors posing risk of physical harm.

School direct observation data must be obtained from Emma's school-based BCBA (who currently delivers 10 hours per week through a separate provider) before home programming begins. Coordinating with the existing provider to review their behavioral data, current protocols, and any informal functional assessment data already collected will prevent contradictory procedures across settings and may significantly accelerate the assessment phase.

RBT and caregiver safety protocols must be established and trained before first session: (1) No physical blocking of head banging — create safe space by padding or moving Emma to a padded area if possible without escalating; (2) Do not remove demands or provide preferred items contingent on head banging or tantrum/drop; (3) BCBA contact threshold: any SIB resulting in visible skin break, bruise, or injury; any single head impact against a hard surface with significant force; any behavioral episode exceeding 15 minutes continuous escalation without response to prevention strategies.`,

  caregiver_training: `## Caregiver Training Program

### Training Rationale

Caregiver training is a medically necessary component of Emma's ABA programming. Linda Thompson (mother) is the primary home implementer and has demonstrated strong motivation and baseline knowledge of behavioral strategies. Observed baseline data show that Linda correctly applied Premack contingencies in approximately 60% of opportunities and delivered reinforcement correctly in approximately 55% of opportunities during the intake observation. While above floor-level performance, consistent 80%+ accuracy is required before independent home implementation of Emma's behavior support plan is appropriate, particularly given the safety risks associated with head banging and elopement.

David Thompson (father) participates primarily on evenings and weekends and has not yet been formally assessed; initial training goals will focus on Linda achieving competency before extending the full protocol to David.

### Training Objectives

**Short-Term Objectives (0–3 months):**
- Linda will demonstrate correct use of Premack (first-then) contingencies with 75% accuracy across 3 consecutive direct observation probes.
- Linda will identify all 5 of Emma's primary reinforcers from a standardized preference assessment checklist with 100% accuracy.
- Linda will correctly implement the elopement prevention protocol (door alarm activation, outdoor supervision procedure) during 3 consecutive probe observations.

**Long-Term Objective (6 months):**
- Linda and David will both demonstrate 90% accuracy on Premack delivery, reinforcement, and safety protocols across 3 independent probes.
- David will complete a minimum of 4 parent training sessions and demonstrate competency on priority strategies.

### Training Plan

Training will be conducted through in-session coaching during Emma's ABA sessions (1 hour per week) and monthly parent-only sessions with the supervising BCBA. Written strategy guides will be provided at each training milestone. Video modeling of correct responses to head banging and elopement precursors will be created during sessions and shared with David for asynchronous review.

Given Emma's school-based services (10 hours/week with a separate provider), coordination with the school BCBA will be pursued to align home and school caregiver training protocols and prevent contradictory prompting hierarchies across settings.`,

  crisis_plan: `## Crisis Plan

### Behavioral Risk Summary

Emma presents with two behaviors that elevate safety risk and require a documented crisis response protocol: (1) Self-injurious behavior (head banging) with potential for injury during high-intensity episodes, and (2) Elopement with documented incidents and traffic safety concerns.

### Head Banging — Crisis Response Protocol

**Escalation indicators:** Increased hand-flapping frequency, high-pitched vocalizations, sweeping objects off surfaces, refusal to redirect from demand.

**Prevention:** Implement 2-minute visual warning before all transitions; reduce demand complexity at first sign of escalation; ensure preferred items are accessible and not blocked.

**During episode:** (1) Move Emma to a padded area or away from hard surfaces if safe to do so without physical escalation; (2) Minimize verbal output — no commands, no reasoning, no emotional responses; (3) Do not remove demands as a direct consequence of head banging (extinction); (4) Wait for behavioral escalation to pass before re-introducing demand.

**After episode:** Document time, antecedent, duration, and intensity in data system within 1 hour. If injury occurs, notify BCBA immediately and document incident report. If injury requires medical attention, notify parents and follow mandatory reporting protocol.

**Threshold for emergency services:** If Emma makes continuous, escalating head contact for more than 3 minutes without response to protective positioning, or if a single impact produces visible laceration or loss of consciousness — call 911 and contact parents immediately.

### Elopement — Crisis Response Protocol

**Prevention:** Ensure door alarms are active at all home settings; maintain visual awareness of Emma's location during all outdoor activities; always use wrist-to-wrist tether outdoors.

**If elopement occurs:** (1) Follow immediately — do not shout or pursue in a way that may reinforce the behavior; (2) Use a neutral, calm tone to redirect back to safe area; (3) Do not leave Emma unsupervised during active elopement risk; (4) Notify BCBA and parents within 15 minutes of any elopement incident.

**School protocol:** Notify school administration immediately. Incident report required within same school day. Review with IEP team if elopement occurs more than once in a 30-day period.

### Emergency Contacts

- **Primary (Parent):** Linda Thompson (mother) — (561) 555-0167
- **Secondary (Parent):** David Thompson (father) — (561) 555-0168
- **Supervising BCBA:** Dr. Ana Reyes, BCBA-D — available via agency emergency line during session hours
- **Treating Pediatrician:** Dr. Sarah Mills — (561) 555-0200
- **Agency Emergency Line:** Contact the ABA Shield clinical on-call line for any incident outside of BCBA direct availability

### Plan Review

This crisis plan should be reviewed with all team members (RBTs, parents, school staff) prior to initiating ABA services and at each authorization renewal. Update if new behaviors emerge or intensity of existing behaviors changes significantly.`,
};

// ── Oliver Patel drafts ───────────────────────────────────────────────────────

const OLIVER_DRAFTS = {

  demographics: `## Client & Referral Summary

**Client:** Oliver K. Patel | **DOB:** June 12, 2018 (Age 7) | **Pronouns:** He/Him

**Primary Language:** English (Gujarati spoken at home by maternal grandparents)

**Diagnosis:** Autism Spectrum Disorder, Level 2 (DSM-5, F84.0), confirmed by Dr. Ana Flores, M.D., Pediatric Neurology, Miami Children's Health System, on March 14, 2024. No co-occurring psychiatric diagnoses.

**Insurance:** Cigna | Member ID: CIG-778823 | Group: G-55023

**Referring Provider:** Dr. Ana Flores, M.D. (Pediatric Neurology, Miami Children's Health System) — referred for comprehensive ABA assessment due to daily physical aggression toward primary caregiver, acute elopement safety risk in community settings, and hygiene routine refusals.

**Family & Support System:** Oliver lives with his mother (Priya Patel, primary caregiver) and father (Raj Patel, finance professional with limited weekday availability). No siblings. Maternal grandparents provide weekend childcare; English is primary language, Gujarati spoken at home.

**School:** Oliver attends 2nd grade at Riverside Academy, Coconut Grove, Miami, under a current IEP (annual review February 2026). School-based SLP services 2x/week (30 minutes each) focused on expressive vocabulary expansion and AAC introduction (GoTalk, initiated 3 weeks prior to this assessment). No OT services currently enrolled.

**Prior ABA Services:** None. Oliver has never received ABA services. Current school-based SLP is the only behavioral intervention in place.

**Assessment Date:** April 18, 2026 | **Assessment Type:** Initial Comprehensive | **BCBA:** Dr. Ana Reyes, BCBA-D`,

  presenting_concerns: `## Presenting Concerns

### Primary Concerns Identified by Caregiver

The Patel family identified three primary concerns prompting this referral. First, Oliver displays daily physical aggression toward his mother — occurring 3–5 times per day — consisting of open-hand hitting and scratching directed exclusively at Priya Patel during demand presentation. The behavior emerges within seconds of instruction delivery (iPad removal, hygiene task initiation, meal transition) and has been escalating since the start of the 2025–2026 school year. Scratches have produced visible marks on Priya's forearms on multiple occasions.

Second and most acutely concerning from a safety standpoint, Oliver has bolted from adult supervision in community settings on five documented occasions — three times in a grocery store and twice in active parking lots. The most recent parking lot incident required Priya to run toward a roadway to retrieve Oliver before he reached traffic. The family has since suspended virtually all community outings and will only go out with two adults present.

Third, Oliver refuses all hygiene routines — teeth brushing and bathing result in daily 30–45 minute standoffs involving crying, pulling away, and behavioral escalation. Successful teeth brushing currently requires a two-person effort approximately three times per week. Bathing is managed via sponge bath only.

### School & Community

Oliver's school behavior stands in marked contrast to home: no aggression or elopement has been documented at Riverside Academy. Teachers and the IEP team report compliance with structure and routines in the school setting. One peer hitting incident was documented on the school record; the IEP team has requested a formal behavioral evaluation in response. The discrepancy between school and home behavior is consistent with the high predictability and 1:1 structure at school reducing the escape demand that drives aggression at home.

### Clinical Impression

The behavioral presentation is clinically straightforward in its function: Physical Aggression is escape-maintained, occurring within seconds of demand presentation, with demand removal as the consistent consequence. The speed of escalation — Oliver moves from instruction to physical aggression in 2–3 seconds with no apparent protest or warning — suggests either a limited functional language repertoire for escape requests, or that verbal protest has not been differentially reinforced relative to physical responses in the past. Functional Communication Training targeting "help" and "break" mands is the indicated primary intervention.

Elopement presents as a mixed function. Community antecedents include transition demands, open exits, and highly stimulating unfamiliar environments — consistent with both escape from demands and automatic reinforcement (movement-seeking). Safety management must be the immediate first priority: caregiver training in physical proximity management and a graduated community exposure hierarchy are required before expanding community outing attempts. The family is currently avoiding all community outings — this restriction, while understandable, eliminates the very opportunities needed to build tolerance. A structured, carefully graduated exposure plan will be critical to restoring community access.

Hygiene refusal is escape-maintained with a likely sensory avoidance component. Coordination with OT for a systematic desensitization approach is recommended.`,

  self_help: `## Self-Help Skills

### Toileting

Oliver is fully toilet trained for both bowel and bladder, daytime and nighttime. He independently initiates bathroom trips without prompting and manages all associated tasks (clothing, wiping, flushing, handwashing) without adult assistance. No enuresis or encopresis. No sensory concerns with the bathroom environment itself — the toilet and hand-washing routine are well-tolerated. Refusal is specific to teeth brushing and bathing, not the bathroom space itself.

### Dressing & Grooming

Oliver can manage pullover shirts and elastic-waist pants independently. Buttons, snaps, and zippers are not yet mastered and frequently result in task refusal when attempted. Shoelaces are not mastered; family uses Velcro footwear exclusively. Tactile sensitivities affect wardrobe: tagless shirts are required; Oliver refuses corduroy, stiff denim, and certain synthetic fabrics. Family has accommodated by maintaining a wardrobe of soft, tagless clothing.

Oral hygiene is a significant clinical target. Teeth brushing results in active physical resistance (pulling away, crying, hitting) approximately 70% of morning and evening attempts. Successful brushing is estimated at three times per week and requires two adults — one to stabilize and one to brush. Duration is typically under 30 seconds. Flossing is not yet attempted. Hair washing is tolerated approximately monthly with distraction support.

### Bathing

Bathing represents the most significant hygiene deficit. Oliver refuses entry to the bathtub or shower when bathing is announced and will escalate to crying and hitting within 30 seconds of bathroom approach cues. The family has transitioned entirely to sponge baths (2–3 per week) conducted on the bathroom floor with preferred YouTube content playing on a tablet. Full immersion bathing: 0% step completion at baseline.

The clinical profile suggests a sensory-based avoidance pattern (water temperature, tactile input, spray sensation) with a conditioned escape response to bathroom approach cues. OT consultation is recommended prior to initiating a systematic desensitization hierarchy. ABA will target step-by-step approach behavior using a graduated exposure protocol beginning with proximity to the bathroom during non-bathing times.

### Feeding

Oliver's diet consists of approximately 10 accepted foods: macaroni and cheese (specific brand), chicken nuggets, plain white rice, peeled apple slices, pouched yogurt (specific brand), Goldfish crackers, plain bread, apple juice pouches, vanilla wafers, and Cheerios. Mixed textures, sauces, and vegetables are refused. Meals are a low-escalation context when preferred foods are served; behavioral escalation occurs when a non-preferred food is introduced or when a preferred food is unavailable. OT feeding evaluation has not yet been completed; referral is recommended.`,

  daily_living: `## Daily Living Skills

### Morning & Home Routines

Oliver does not currently have a visual schedule in place at home, despite using one successfully at school. Morning routine duration is 60–80 minutes and includes 2–3 behavioral escalations on average. The handoff between Raj (who manages the morning routine before leaving for work at 7:00 AM) and Priya is a particularly high-risk transition — Oliver's compliance drops substantially when his father leaves and his mother takes over. This pattern suggests a preference-based compliance discrepancy that will be an early parent training focus.

Bedtime routine targets 9:00–9:30 PM and takes 45–60 minutes. The routine includes dinner cleanup, teeth brushing (the highest-resistance step), pajamas, and 20 minutes of preferred screen time before lights out. Screen removal at the end of the night is a consistent aggression antecedent.

Screen time is currently unregulated: estimated 3–4 hours on weekdays and 5–6 hours on weekends, primarily iPad (vehicle YouTube channels, Minecraft). No screen time boundary system is in place. Screen access is the most powerful reinforcer in Oliver's repertoire and is embedded in virtually every behavioral incident as either the antecedent (removal demand) or the consequence (restored after de-escalation).

### Community & Independence

Community access has been largely suspended over the past several months following the most recent parking lot elopement incident. The family will only attempt outings with two adults present, which limits frequency to weekends when Raj is available. Prior to the current restrictions, Oliver could manage familiar, low-stimulation settings (a nearby park, the pediatrician's office) with one-on-one adult supervision and minimal preparation.

Oliver knows his full name, home address, and his mother's phone number — a meaningful safety strength. He responds consistently to "stop" commands in home settings from both parents but does not generalize this response reliably in community settings, particularly when motivated to move toward a visual target or exit.

### Leisure & Recreation

Strong and sustained engagement with two primary preferred activities: vehicle and machinery YouTube content (can watch independently for 60+ minutes) and Minecraft (independent structured play 30–45 minutes). These are the highest-value reinforcers for programming. Secondary preferences include physical play (rough-housing with Raj, jumping on couch) and lining up objects. Oliver has no organized recreational activities outside school. Family reports limited peer social experience; no playdates have occurred in the past four months.`,

  safety: `## Safety Concerns

### Elopement & Wandering

Elopement is assessed as HIGH RISK. Oliver has bolted from direct adult supervision in community settings on five documented occasions over the past six months. Incidents occurred in a grocery store (3 times) and in active parking lots (2 times). The most recent parking lot incident required Priya to run toward an active roadway to intercept Oliver before he reached traffic. This incident meets the threshold for an acute safety concern requiring immediate intervention.

Oliver responds consistently to "stop" in home settings from both parents but does not generalize this response in high-stimulation community environments. There is no current physical safety barrier or proximity management protocol in place for community settings. No home elopement incidents reported. School has reported no elopement. The family has appropriately restricted community outings in response.

### Aggression

Physical aggression is rated as MODERATE risk. Topography includes open-hand hitting and scratching directed exclusively toward Priya Patel in the home. Aggression frequency is 3–5 incidents per day. Scratches have produced visible marks on Priya's forearms. No injuries requiring medical attention. Oliver has not aggressed toward Raj, school staff, or peers beyond one documented school incident (peer hitting, no injury). Aggression has not been observed in the school setting.

No biting, kicking, or object throwing has been reported. No property destruction beyond occasional sweeping of small items during escalation.

### Self-Injurious Behavior

No SIB reported beyond incidental scratching of own forearms during escalation episodes (non-targeted, not sustained). No head banging, face hitting, or other self-directed injury. No medical attention required. SIB is not considered a current behavior target.

### Clinical Safety Assessment

Elopement risk is rated HIGH at initial presentation. This rating reflects: (1) five documented incidents in 6 months, including two in traffic-adjacent environments; (2) the absence of a reliable "stop" response generalized to community settings; (3) an escape-and-movement function that motivates rapid, directional running toward stimulating targets; and (4) the family's suspension of community outings — an appropriate immediate response that does not address the underlying deficit. Elopement prevention must be addressed as the top clinical priority before any community-based programming is attempted.

Physical aggression risk is MODERATE — present daily, producing visible marks, but limited in topography and targets. No biting, no multi-target incidents, no sustained escalation requiring emergency response. Priority is FCT to provide a functional escape pathway before demand intensity increases in treatment.

Mandated reporting requirements were reviewed during this clinical interview. No indicators meeting reporting threshold were identified at this time. This review is documented in session notes per agency protocol.`,

  communication: `## Communication

### Expressive Language

Oliver communicates primarily through verbal speech with a mean length of utterance of approximately 3–5 words in familiar, low-demand settings. Under stress, demand presentation, or novel environments, MLU decreases to 1–2 words or Oliver goes non-verbal. Intelligibility is approximately 85% with familiar adults and 60% with unfamiliar listeners. Oliver uses language reliably to request preferred items and activities (e.g., "iPad please," "more nuggets," "go outside") and to protest non-preferred tasks (e.g., "No," "Stop it," "I don't want to"). He does not use language to express internal emotional states, request help proactively, or seek a break before behaviorally escalating. This is the primary communication gap relevant to treatment.

Delayed echolalia is present — Oliver repeats phrases from vehicle YouTube content during unstructured time and in anxious situations. This scripting behavior appears to serve a regulatory function and is most prominent during transitions and novel settings. Immediate echolalia is not reported.

### Receptive Language

Oliver follows single-step instructions reliably in familiar, predictable settings (85% accuracy with both parents). Two-step instruction following is emerging but inconsistent (approximately 55% accuracy in familiar contexts, decreasing substantially in novel or high-demand situations). He responds to his name consistently with both parents and with his teacher. He reliably understands yes/no questions, identifies common objects and pictures, and follows routine-based instructions (sit down, come here, put it away). Non-literal language (jokes, sarcasm, idioms) is not reliably understood.

### Pragmatics & Social Communication

Oliver initiates communication primarily to access preferred items or activities. He does not yet initiate for social sharing or peer interaction. Eye contact is variable — more reliable with familiar adults than strangers, decreasing under demand pressure. Turn-taking in structured adult-directed exchanges is emerging (2–3 exchanges on preferred topics). No spontaneous peer interaction has been observed by parents or school.

AAC trial (GoTalk) was initiated three weeks prior to this assessment by the school SLP — no independent symbol activation observed yet. Physical prompt required for all device activations. Family has not yet learned the system for home use.

### SLP Coordination

Coordination with the school SLP is a clinical priority, particularly for FCT implementation. The highest-priority functional communication target — requesting "help" and "break" — should be a shared ABA-SLP goal implemented consistently across ABA sessions, school speech, and home routines. Consistency of vocabulary (same words/symbols used across all settings) is critical for rapid acquisition. If GoTalk activation can be incorporated as an alternative to or alongside verbal requesting, a multimodal FCT approach should be explored with the SLP to ensure the modality used in ABA sessions is also available and reinforced at school.`,

  self_stim: `## Self-Stimulatory Behavior

### Topography & Frequency

Oliver's most prominent self-stimulatory behavior is hand-flapping, which occurs with moderate frequency (estimated 10–15 episodes per day) during periods of excitement, anticipation, and transition. Episodes last 5–20 seconds. Hand-flapping is most prominent when Oliver is anticipating a preferred activity (iPad access, going to the park, seeing a family member he enjoys). A second prominent behavior is repetitive questioning — Oliver asks the same question repeatedly (e.g., "Where are we going?", "What time is it?", "Are we almost there?") particularly during transitions, novel outings, and any change from expected routine. These question sequences can persist for 5–10 minutes without resolution regardless of the caregiver's answer. This behavior is reported as distressing to Priya, particularly during community outings where the questioning increases anxiety in both.

Oliver also engages in systematic object lining — arranging small objects (toy cars, blocks, household items) in rows or color-sorted groups. This activity lasts 15–25 minutes of independent engagement and appears to serve a calming, regulatory function. It is a meaningful source of independent leisure skill and a reliable indicator that Oliver is self-regulating.

### Impact & Function

Hand-flapping does not interfere with learning tasks or structured activities. Object lining provides functional independent leisure time. Repetitive questioning is the most functionally impairing of the three behaviors — it increases caregiver frustration and stress during high-demand contexts (transitions, community outings) and is reported as a reliable pre-escalation indicator when anxiety is elevated. Clinically, the questioning pattern functions as an anxiety-driven information-seeking behavior rather than a purely automatic behavior. Providing advance visual priming (schedule, visual countdown) before high-risk transitions reduces the frequency per parent report.

### Sensory Profile

No formal OT sensory evaluation has been completed. Caregiver-reported sensory profile: hyperreactivity to sudden, unexpected loud sounds (hand dryers, fire alarms, crowd noise); tactile sensitivity to oral inputs (toothbrush bristles, water spray during bathing) and fabric textures (see Self-Help). Proprioceptive seeking behaviors are prominent — crashing into furniture, jumping on couch, requesting tight bear hugs from Raj. These suggest a proprioceptive-seeking sensory profile that will need to be addressed in the treatment plan through embedded heavy-work activities and an OT referral for a formal sensory evaluation.

OT referral is recommended prior to or concurrent with ABA service initiation for both the feeding restriction and the hygiene desensitization protocol.`,

  medical_necessity: `## Medical Necessity

### Diagnostic Support

Primary diagnosis of Autism Spectrum Disorder, Level 2 (DSM-5, F84.0) confirmed by Dr. Ana Flores, M.D., Pediatric Neurology, Miami Children's Health System, on March 14, 2024. Diagnostic instruments included the ADOS-2 (Module 2), ADI-R, and Vineland-3 Adaptive Behavior Scales. Full neurological and developmental evaluation report on file. No co-occurring psychiatric diagnoses. No current medications. No seizure disorder, cardiac conditions, or other contraindications to behavioral intervention.

Primary care: Dr. Kevin Patel (Pediatrics, no relation to client). Last well visit April 2026. School-based SLP services ongoing (2x/week, expressive vocabulary and AAC introduction). No OT services currently enrolled.

### Functional Impact

Oliver's constellation of behavioral excesses and adaptive skill deficits significantly impairs functioning across home and community settings. Daily physical aggression toward his mother — 3–5 incidents per day producing visible scratching marks — has created a home environment characterized by hypervigilance and caregiver-child conflict. More critically, Oliver has bolted from adult supervision in traffic-adjacent community settings on five occasions, including a parking lot incident requiring the caregiver to run toward an active roadway. This acute elopement safety risk has led the family to eliminate virtually all community participation, with severe consequences for Oliver's social development, family quality of life, and the caregiver's ability to meet routine household needs.

Daily refusal of hygiene routines presents a direct health risk (dental and skin hygiene) and is a chronic source of conflict. Severe food selectivity limits nutritional variety. At school, a peer aggression incident has prompted IEP team request for formal behavioral evaluation. Without ABA, the family anticipates continued behavioral escalation, ongoing acute elopement risk, and progressive social isolation.

### Clinical Justification

Applied Behavior Analysis is clinically justified as the appropriate level of care for Oliver Patel, meeting Cigna medical necessity criteria on the following grounds: **(1)** Primary diagnosis of ASD Level 2 (F84.0) confirmed via ADOS-2 Module 2, ADI-R, and Vineland-3, requiring substantial support across multiple functional domains; **(2)** documented daily physical aggression toward primary caregiver producing visible injury, meeting clinical severity threshold; **(3)** acute community safety risk from elopement — 5 documented incidents, including 2 requiring emergency caregiver response in traffic-adjacent settings; **(4)** functional impairment across home, school, and community settings sufficient to prompt IEP behavioral evaluation and family suspension of all community participation; and **(5)** no prior ABA services received — all current SLP-only intervention insufficient to address behavioral excesses and safety concerns. Referring neurologist Dr. Ana Flores recommends ABA as the primary evidence-based treatment indicated for this presentation.

Recommended service intensity: 20 hours per week, center-based with parent training component. Six-month measurable targets: Physical Aggression reduction from 4 incidents/day to ≤1 incident/day; elimination of elopement in community settings; Functional Help-Seeking at 80% independent across settings; teeth brushing compliance within 5 minutes; and re-establishment of two routine community outings per week.`,

  skill_acquisitions: `## 1. **Functional Help-Seeking (Verbal Request)**

**OPERATIONAL DEFINITION**
Oliver will independently vocalize "help," "break," or "I need help" within 10 seconds of encountering a blocked preferred item or non-preferred demand, without prior adult prompting or physical aggression.

**TEACHING STRATEGIES**
Functional Communication Training (FCT) embedded in discrete trial and natural environment teaching. Begin with demand contexts where aggression is most predictable (iPad removal, hygiene task onset). Use expectant delay (3 seconds) → gestural → partial verbal → full verbal prompt hierarchy. Immediately honor the mand with brief demand removal and preferred access. Differentially reinforce unprompted responses with higher-magnitude reinforcers. Coordinate with school SLP for parallel implementation.

**BASELINE & MASTERY TABLE**
| Measure | Baseline | Mastery Criterion |
|---|---|---|
| % Independent Help-Requests | 5% (1 of 20 probed opportunities) | 80% across 3 consecutive sessions |
| Contexts | Home structured | Home + school + community |
| Prompt Level | Full verbal model required | Independent — no prompt |

**GENERALIZATION**
Generalize across both parents, RBT, and school staff. Priority probes: iPad removal and hygiene task onset. Coordinate with SLP for AAC device integration.

---

## 2. **Following Two-Step Directions**

**OPERATIONAL DEFINITION**
Oliver will follow a two-step spoken instruction in correct sequence within 10 seconds of delivery, without instruction repetition or physical guidance.

**TEACHING STRATEGIES**
Discrete Trial Training with varied instruction sets. Begin with high-success first steps to build responding momentum. Use least-to-most prompt hierarchy (expectant delay → gestural → partial physical). Token board for compliance streaks.

**BASELINE & MASTERY TABLE**
| Measure | Baseline | Mastery Criterion |
|---|---|---|
| Two-Step Sequence Accuracy | 30% across 20 probed trials | 80% across 3 consecutive sessions |
| Prompt Level | Gestural required for second step | Independent — no gestural or vocal |
| Settings | Home structured | Home + school + community |

**GENERALIZATION**
Generalize across instruction-givers (Priya, Raj, teacher, RBT). Embed in morning routine (get backpack AND put on shoes) and school transitions.

---

## 3. **Peer Interaction Initiation (School Setting)**

**OPERATIONAL DEFINITION**
Oliver will independently initiate a contextually appropriate social interaction with a same-age peer at least 2 times per 30-minute structured social opportunity, without adult prompting.

**TEACHING STRATEGIES**
Social Skills group using BST (instruction, modeling, rehearsal, feedback). Video modeling with vehicle/Minecraft context. Peer-mediated intervention with 1–2 identified school peers. In-vivo coaching by paraprofessional during structured recess.

**BASELINE & MASTERY TABLE**
| Measure | Baseline | Mastery Criterion |
|---|---|---|
| Unprompted Peer Initiations | 0 per 30-min session | 2+ per 30-min session |
| Response Quality | n/a | Contextually appropriate (rated) |
| Settings | n/a | School recess + classroom activity |

**GENERALIZATION**
Structured family playdates as natural generalization after school mastery. Community social settings (park, library) after stable peer initiation established.

---

## 4. **Bathing / Grooming Desensitization**

**OPERATIONAL DEFINITION**
Oliver will complete all steps of the evening hygiene routine within 20 minutes with ≤1 verbal prompt per step, without behavioral refusal (hitting, crying, leaving bathroom).

**TEACHING STRATEGIES**
Task Analysis / Chaining with systematic desensitization (graduated water exposure hierarchy). Coordinate with OT for sensory protocol. Embed high-preference reinforcement contingent on each step completion. Begin hierarchy with bathroom proximity during non-bathing times.

**BASELINE & MASTERY TABLE**
| Measure | Baseline | Mastery Criterion |
|---|---|---|
| Steps Completed Independently | 0 of 10 (complete refusal) | 80% across 5 consecutive sessions |
| Behavioral Escalation During Routine | 100% of bath attempts | 0 incidents |
| Prompt Level | 2-person assist required | ≤1 verbal prompt per step |

**GENERALIZATION**
Maintain across both parents as routine leaders. Probe for maintained tolerance after 4-week treatment gap.`,

  behavior_targets: `## Behavior Targets

### Target Behavior 1: Physical Aggression

**Operational Definition:** Oliver makes forceful physical contact with another person using an open hand (hitting) or fingernails (scratching). Each discrete contact event is scored as one instance. Accidental physical contact is not scored.

**Frequency & Intensity:** Per caregiver report, physical aggression occurs 3–5 times per day on typical weekdays. Scratching has produced visible marks on Priya Patel's forearms. No incidents have required medical attention. No biting, kicking, or object throwing. Aggression is exclusive to the home setting and directed exclusively toward Priya.

**Antecedents:** Demand presentation is the consistent antecedent — specifically (1) iPad or screen removal instructions; (2) hygiene task initiation (teeth brushing or bathing announcement); (3) meal transition demands; (4) any blocked access to a preferred item. Behavior onset is rapid — physical response occurs within 2–3 seconds of instruction delivery with no observable verbal protest preceding it in the majority of incidents.

**Maintaining Variables:** Negative reinforcement (escape from demand) is the primary hypothesized function. Demand removal or delay following aggression has been the consistent caregiver response across most incidents per parent report. The absence of a functional verbal alternative for escape contributes to the rapid escalation pattern.

### Target Behavior 2: Elopement / Bolting

**Operational Definition:** Oliver moves away from the supervising adult's direct supervision in a community setting without permission, defined as moving more than 10 feet from the adult without pausing in response to verbal cue ("Stop" or "Wait"). Each episode of separation is one instance.

**Frequency & Context:** 5 documented incidents in 6 months in community settings — grocery stores (3x) and active parking lots (2x). Frequency within outings: estimated 2 incidents per community outing when attempted. Not observed at home or school.

**Antecedents:** Open community spaces with exits. Transition between indoor and outdoor settings. Momentary loss of hand contact. Presence of visually interesting targets (moving vehicles, other children). Caregiver distraction.

### Functional Hypothesis

Physical Aggression is hypothesized to be maintained by negative reinforcement (escape from demands). This hypothesis is supported by: (1) consistent demand removal following aggression across multiple reporters (both parents, different settings); (2) exclusive antecedent of demand presentation or blocked preferred access; (3) absence of aggression in the school setting, which features high structure, predictable demands, and consistent 1:1 support — conditions that reduce escape demand; and (4) the speed of escalation (2–3 seconds from instruction to physical response), which is consistent with a history of aggression being efficiently reinforced and verbal alternatives never having been established.

Elopement is hypothesized to serve a mixed function: negative reinforcement (escape from demands or aversive environments) and automatic reinforcement (proprioceptive/movement-seeking). The community-only context is consistent with escape from the unpredictability and demand-richness of community settings. The speed and directionality (running toward visual targets, exits) suggests an automatic movement-seeking component that is also functionally reinforced.

**Proposed Intervention Strategy (Preliminary):**
- FCT as primary replacement behavior for Physical Aggression: teaching "help" and "break" requests before demand removal is ever contingent on aggression
- Antecedent modifications: visual countdown timers before iPad removal, First-Then visual cues before hygiene tasks, demand fading during FCT acquisition
- Wrist-to-wrist proximity management as interim elopement safety protocol for community settings until behavioral treatment gains are established
- Graduated community exposure hierarchy (low-demand, brief, predictable outings) coordinated with a community safety training protocol for both parents
- Parent training: consistent FCT prompt hierarchy, demand follow-through protocol, proximity management, and data recording

All aggressive incidents will be measured using event recording with same-day ABC notation completed by the RBT and caregiver daily log. A minimum of 10 school days of baseline data will be collected before implementing any extinction or DRA components. Elopement will be recorded per-community-outing using frequency recording with location and antecedent documentation.`,

  caregiver_training: `## Caregiver Training Program

### Training Rationale

Caregiver training is a medically necessary component of Oliver's ABA programming. Consistent implementation of behavioral strategies — particularly FCT prompting, demand follow-through, and elopement safety procedures — across home and community settings is required to generalize treatment gains and prevent inadvertent reinforcement of aggression and elopement. Priya Patel is the primary implementer; Raj Patel is the secondary implementer with weekend and evening availability.

Observed baseline data indicate that Premack contingencies and reinforcement delivery are being implemented inconsistently. Priya demonstrated correct Premack use in approximately 40% of probed opportunities and appropriate reinforcement delivery within 3 seconds of the target behavior in approximately 55% of opportunities during the intake observation session. These rates are below the threshold required for reliable home generalization and justify a structured, manualized caregiver training program as part of the ABA authorization.

The most critical immediate training priority is the elopement safety protocol: both parents must demonstrate reliable physical proximity management and FCT prompting before any community-based sessions or family community outings are attempted without two adults present.

### Training Objectives

**Short-Term Objectives (0–3 months):**
- Priya will demonstrate correct Premack (first-then) use with 70% accuracy across 3 consecutive direct observation probes.
- Priya will deliver contingent reinforcement within 3 seconds with 70% accuracy across 3 consecutive sessions.
- Both parents will correctly demonstrate the wrist-to-wrist proximity protocol and FCT prompt hierarchy for elopement prevention in community settings.

**Long-Term Objective (6 months):**
- Both parents will demonstrate 90% accuracy on FCT prompting, Premack delivery, and demand follow-through across 3 independent BCBA observation probes without verbal support.
- Grandparents will receive written Gujarati-translated guides covering the three priority strategies and will demonstrate 80% accuracy in 2 coached practice sessions.

### Training Plan

Training will be conducted through in-session RBT coaching (modeling and feedback during active ABA sessions) and bi-weekly parent sessions with the supervising BCBA. Written protocol guides will be prepared for all priority strategies; Gujarati translations will be commissioned for grandparent materials. Video recording of correct strategy demonstrations during early sessions will be shared with Raj for independent review given his limited weekday availability. Progress toward competency benchmarks will be reviewed monthly and incorporated into the authorization renewal narrative.`,

  crisis_plan: `## Crisis Plan

### Risk History

No history of psychiatric hospitalization, emergency services involvement, or acute crisis events. No suicidal ideation — Oliver does not have the expressive language to communicate such ideation; behavioral indicators will be monitored. No self-injurious behavior requiring medical attention. Law enforcement has not been involved. No formal crisis plan is in place. Family has managed behavioral crises informally.

The primary acute safety concern is elopement risk in community settings. A second concern is the escalating pattern of physical aggression — while currently limited to scratching without injury, the trajectory requires proactive crisis protocol documentation before services begin.

### Warning Signs & Escalation Sequence

Caregiver-identified early warning signs that Oliver is approaching a behavioral escalation:
- Increased frequency of repetitive questioning (same question 3+ times within 5 minutes)
- Body tension — arms pulling toward midline, rigid trunk
- Pulling away from hand-hold in community settings
- Reduced verbal responsiveness — not answering direct questions
- Visual scanning of exits or doors in community settings

**Escalation sequence per caregiver report:** Warning signs → behavioral refusal (pulling away, saying "no") → increased vocalization (crying, repeating "stop") → physical response (hitting, scratching, or bolting) → in community settings, bolting may occur with or without prior warning signs in high-stimulation environments.

**De-escalation strategies that work:** Immediate removal of all demands; proactive offer of preferred item or activity; deep pressure (firm bear hug, firm shoulder squeeze, proprioceptive heavy work); quiet, low-stimulation space with reduced verbal demands; advance visual priming for transitions (reduces repetitive questioning at onset).

**Strategies that worsen escalation:** Maintaining demands during escalation; multiple verbal prompts or repetitive questions in response; physical blocking or restraint; raised voice or urgent tone; unpredictable changes after escalation has begun.

**Return to baseline:** 10–20 minutes following peak escalation. Oliver typically seeks physical affection from Priya 5–15 minutes after returning to baseline. This is a reliable indicator the episode has fully resolved.

### Emergency Contacts & Protocols

- **Primary (Parent):** Priya Patel (mother) — (786) 555-0134
- **Secondary (Parent):** Raj Patel (father) — (786) 555-0135
- **Treating Neurologist:** Dr. Ana Flores (Pediatric Neurology) — (305) 555-0220
- **Community elopement protocol:** If Oliver separates in community, follow calmly without shouting. Use neutral, low-vocal tone. Do not pursue in a way that reinforces running as a chase game. Call 911 if not recovered within 2 minutes or if in or near traffic.

### Clinical Crisis Protocol

RBT-to-BCBA call threshold: any community elopement incident; any physical aggression resulting in injury; any behavioral episode lasting more than 20 consecutive minutes without de-escalation. BCBA must be reachable within 30 minutes. RBT must attempt contact within 5 minutes of qualifying incident.

Physical management: No restraint procedures are authorized under this plan. RBT community sessions require a two-adult proximity protocol until elopement behavior target reaches 0 incidents for 30 consecutive school days. Wrist-to-wrist strap is an authorized interim safety accommodation (caregiver and RBT only, with caregiver consent documented). Any RBT session in a community setting requires BCBA authorization of the specific setting and a written community safety plan before the first session. No community sessions without prior BCBA-led community assessment.

This crisis plan must be reviewed and signed by both primary caregivers and the supervising BCBA before services begin. Review at each 6-month authorization renewal or following any crisis incident.`,
};

// ─── Draft selector ───────────────────────────────────────────────────────────

function getDemoSeedDrafts(clientId) {
  if (clientId === 'c13') return MARCUS_DRAFTS;
  if (clientId === 'c4')  return EMMA_DRAFTS;
  if (clientId === 'c5')  return OLIVER_DRAFTS;
  return null; // non-seed client → use buildLocalDraft instead
}

// ─── Local draft builder ──────────────────────────────────────────────────────
// buildLocalDraft(session) now lives in ./lib/buildLocalDraft.js so both the
// checklist generation path and the review-page scoped regeneration can reuse it.

// ─── AssessmentChecklistPage ──────────────────────────────────────────────────

export default function AssessmentChecklistPage({
  clientId, clients, setClients, currentUser, session, onNavigate, addNotif,
}) {
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingStep,    setLoadingStep]    = useState(0);

  if (!session) return null;

  // ── Checklist analysis ──────────────────────────────────────────────────────

  const rows = SECTION_ORDER.map(key => {
    const sec           = session.sections?.[key];
    const hasDraft      = !!(sec?.draftContent?.trim());
    const hasNotes      = !!(sec?.notes?.trim());
    const hasTranscript = !!(sec?.transcript?.trim());
    const hasConflict   = !!(sec?.hasConflict);
    const isDemographics = key === 'demographics';
    const indicatorCount      = (sec?.indicators ?? []).filter(i => i.count > 0).length;
    const skillGoalCount      = (sec?.skillGoals ?? []).length;
    const behaviorTargetCount = (sec?.behaviorTargets ?? []).length;
    const hasIndicators      = indicatorCount > 0;
    const hasSkillGoals      = skillGoalCount > 0;
    const hasBehaviorTargets = behaviorTargetCount > 0;
    const hasCaregiverData   = key === 'caregiver_training' && !!(
      (sec?.caregiverBaselines?.premack_baseline != null && sec?.caregiverBaselines?.premack_baseline !== '') ||
      (sec?.caregiverBaselines?.reinforcement_baseline != null && sec?.caregiverBaselines?.reinforcement_baseline !== '') ||
      (sec?.trainingFormat?.length > 0) ||
      sec?.trainingBarriers?.trim() ||
      sec?.caregiverStrengths?.trim()
    );
    const hasData = sectionHasData(session, key);
    const isEmpty = sec?.completionState === 'empty';

    return {
      key, title: SECTION_TITLES[key],
      hasData, hasDraft, hasNotes, hasTranscript, hasConflict, isEmpty, isDemographics,
      hasIndicators, indicatorCount, hasSkillGoals, skillGoalCount,
      hasBehaviorTargets, behaviorTargetCount, hasCaregiverData,
    };
  });

  const totalSections   = rows.length;
  const captured        = rows.filter(r => r.hasData || r.hasDraft).length;
  const emptySections   = rows.filter(r => r.isEmpty && !r.hasDraft).length;
  const hasConflicts    = rows.some(r => r.hasConflict);
  const allGenerated    = rows.every(r => r.hasDraft);

  // Sections whose form inputs changed since their draft was generated. Empty
  // unless a draft already exists AND its inputs were edited afterward.
  const changedSections = sectionsWithChanges(session);

  // ── Generate handler ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    // Backstop: never spend AI tokens (or fabricate) when a goal/behavior entry
    // still lacks a real STO. The interview "Ready to Generate" button is already
    // gated on this, but guard here too in case an STO is removed after arriving.
    const stoBlockers = sectionsMissingSTO(session);
    if (stoBlockers.length > 0) {
      const names = stoBlockers.map(b => `${b.sectionLabel} (${b.entryName})`).join(', ');
      addNotif?.({ type: 'error', message: `Add at least one short-term objective (STO) to: ${names}.` });
      return;
    }
    setIsGenerating(true);
    setLoadingStep(0);

    // ── Feature flag: VITE_DEMO_MODE ─────────────────────────────────────────
    // true  (default) → hardcoded demo drafts, zero API cost
    // false           → real Claude generation via /api/generate
    //
    // To go live: set VITE_DEMO_MODE=false + ANTHROPIC_API_KEY in .env.local,
    // then restart the dev server (or redeploy). No other changes needed.
    // ─────────────────────────────────────────────────────────────────────────
    const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false';

    // Fingerprint the current inputs so we can later detect which sections'
    // data changed and only re-run those (change-detection on re-entry).
    const hashes = sectionPromptHashes(session);

    if (isDemoMode) {
      // ── DEMO PATH — simulate realistic loading, then inject drafts
      // Seed clients (c4, c13) → use their rich hardcoded demo drafts
      // All other clients     → build draft locally from their actual session data
      for (let i = 0; i < LOADING_MESSAGES.length; i++) {
        setLoadingMessage(LOADING_MESSAGES[i]);
        setLoadingStep(i + 1);
        await new Promise(r => setTimeout(r, 580));
      }
      const seedDrafts = getDemoSeedDrafts(clientId);
      const DRAFTS = seedDrafts ?? buildLocalDraft(session);
      for (const [key, content] of Object.entries(DRAFTS)) {
        setDraftContent(setClients, clientId, key, content, 'pending', content, hashes[key]);
      }
      await new Promise(r => setTimeout(r, 300));

    } else {
      // ── REAL MODE — call Claude section by section via /api/generate
      const clientName = clients.find(c => c.id === clientId)?.name ?? 'the client';
      try {
        setLoadingMessage('Preparing assessment data…');
        setLoadingStep(1);

        const drafts = await generateDraft(session, {
          clientName,
          onProgress: (sectionKey, sectionTitle, index, total) => {
            setLoadingMessage(`Drafting ${sectionTitle}…`);
            // Map section index onto the progress bar's scale
            setLoadingStep(Math.max(2, Math.round(((index + 1) / (total + 1)) * LOADING_MESSAGES.length)));
          },
        });

        for (const [key, content] of Object.entries(drafts)) {
          setDraftContent(setClients, clientId, key, content, 'pending', content, hashes[key]);
        }

        setLoadingMessage('Finalizing assessment document…');
        setLoadingStep(LOADING_MESSAGES.length);
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error('[handleGenerate]', err);
        setIsGenerating(false);
        addNotif?.({ type: 'error', message: `Draft generation failed: ${err.message}` });
        return;
      }
    }

    setIsGenerating(false);
    onNavigate('review');
  };

  // ── Regenerate only the sections whose inputs changed ───────────────────────
  const handleRegenerateChanged = async () => {
    if (changedSections.length === 0) return;
    setIsGenerating(true);
    setLoadingStep(0);
    setLoadingMessage('Updating changed sections…');
    const clientName = clients.find(c => c.id === clientId)?.name ?? 'the client';
    try {
      await regenerateSections({
        session, clientId, clientName, setClients,
        only: changedSections.map(s => s.key),
        onProgress: (sectionKey, sectionTitle, index, total) => {
          setLoadingMessage(`Updating ${SECTION_TITLES[sectionKey] ?? sectionTitle}…`);
          setLoadingStep(Math.max(1, Math.round(((index + 1) / (total + 1)) * LOADING_MESSAGES.length)));
        },
      });
    } catch (err) {
      console.error('[handleRegenerateChanged]', err);
      setIsGenerating(false);
      addNotif?.({ type: 'error', message: `Section update failed: ${err.message}` });
      return;
    }
    setIsGenerating(false);
    onNavigate('review');
  };

  // ── Per-row subtitle + pill logic ──────────────────────────────────────────

  function rowSubtitle(row) {
    if (row.isDemographics) return 'Pre-filled from client record — ready for assessment.';
    if (row.hasDraft)       return 'Draft ready — awaiting your review.';
    if (row.hasConflict)    return 'Conflict flagged — review before generating.';
    const parts = [];
    if (row.hasTranscript)      parts.push('transcript');
    if (row.hasNotes)           parts.push('notes');
    if (row.hasIndicators)      parts.push(`${row.indicatorCount} indicators`);
    if (row.hasSkillGoals)      parts.push(`${row.skillGoalCount} goal${row.skillGoalCount !== 1 ? 's' : ''}`);
    if (row.hasBehaviorTargets) parts.push(`${row.behaviorTargetCount} behavior${row.behaviorTargetCount !== 1 ? 's' : ''}`);
    if (row.hasCaregiverData)   parts.push('baselines');
    if (parts.length)           return `Ready — ${parts.join(' + ')} captured.`;
    return 'No data captured. Section will be skipped.';
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const completeCount = rows.filter(r => r.hasData || r.isDemographics).length;
  const partialCount  = rows.filter(r => r.hasConflict).length;
  const emptyCount    = rows.filter(r => r.isEmpty && !r.isDemographics).length;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'DM Sans, sans-serif', background: '#FAFAF9' }}>

      {/* Scrollable body — centered */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* ── Page title ──────────────────────────────────────────────────── */}
          <div className="mb-6">
            <h2 className="text-[22px] font-bold text-slate-800 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Ready to Generate
            </h2>
            <p className="text-[13px] text-slate-500 leading-relaxed max-w-lg">
              Review the data collected for each section before the AI drafts the assessment. Tap any row to add or correct information.
            </p>
          </div>

          {/* ── Stats summary card ───────────────────────────────────────────── */}
          <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 mb-3 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500"/>
                {completeCount} complete
              </span>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-400"/>
                {partialCount} partial
              </span>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-400">
                <span className="w-2 h-2 rounded-full bg-stone-300"/>
                {emptyCount} empty
              </span>
            </div>
            <div className="flex-1"/>
            <span className="text-[13px] font-bold text-slate-700 pl-5 border-l border-stone-200">
              <span style={{ color: '#0D9488' }}>{captured}</span>/{totalSections} sections have data
            </span>
          </div>

          {/* ── Info callout ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-stone-200 bg-white px-5 py-3.5 mb-6 flex items-start gap-3">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              Empty sections will be skipped. Partial sections will be drafted with available data and flagged for review. The AI will not invent clinical information.
            </p>
          </div>

          {/* ── Section rows ─────────────────────────────────────────────────── */}
          <div className="space-y-2 mb-6">
            {rows.map((row, i) => {
              const isOk      = (row.hasData || row.isDemographics) && !row.hasConflict;
              const isWarning = row.hasConflict;
              const isEmpty   = !row.hasData && !row.isDemographics && !row.hasDraft;

              return (
                <button
                  key={row.key}
                  onClick={() => !isGenerating && onNavigate('interview', row.key)}
                  disabled={isGenerating}
                  className={`w-full rounded-2xl border bg-white px-4 py-3.5 flex items-center gap-3.5 text-left transition-all duration-150 ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm hover:-translate-y-px active:scale-[0.99]'}`}
                  style={{ borderColor: isWarning ? 'rgba(251,191,36,0.4)' : '#E7E5E4' }}>

                  {/* Number badge */}
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold"
                    style={{ background: '#F1F5F9', color: '#64748B' }}>
                    {i + 1}
                  </span>

                  {/* Status icon */}
                  <span className="flex-shrink-0">
                    {isWarning ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="rgba(251,191,36,0.15)" stroke="#FBBF24" strokeWidth={2}/>
                        <path d="M12 8v4m0 4h.01" stroke="#FBBF24" strokeWidth={2} strokeLinecap="round"/>
                      </svg>
                    ) : isOk ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="rgba(20,184,166,0.12)" stroke="#14B8A6" strokeWidth={2}/>
                        <path d="M8 12l3 3 5-5" stroke="#14B8A6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="#CBD5E1" strokeWidth={2}/>
                      </svg>
                    )}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 leading-tight">{row.title}</p>
                    <p className="text-[11px] mt-0.5 leading-tight"
                      style={{ color: isWarning ? '#B45309' : isEmpty ? '#94A3B8' : '#64748B' }}>
                      {rowSubtitle(row)}
                    </p>
                  </div>

                  {/* Data pills */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {row.hasTranscript && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(20,184,166,0.10)', color: '#0D9488' }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                        </svg>
                        rec
                      </span>
                    )}
                    {row.hasNotes && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: '#F1F5F9', color: '#64748B' }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        notes
                      </span>
                    )}
                    {row.hasSkillGoals && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(99,102,241,0.10)', color: '#4F46E5' }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        {row.skillGoalCount} goal{row.skillGoalCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {row.hasBehaviorTargets && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(245,158,11,0.10)', color: '#B45309' }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        {row.behaviorTargetCount} target{row.behaviorTargetCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {row.hasCaregiverData && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: 'rgba(20,184,166,0.10)', color: '#0D9488' }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                        </svg>
                        data
                      </span>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg className="w-4 h-4 flex-shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              );
            })}
          </div>

          {/* ── Footer disclaimer ────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 mb-6">
            <p className="text-[12px] text-slate-400 leading-relaxed text-center">
              The AI will draft each section using your recordings, notes, and indicators. All output will be editable before you finalise the assessment.
            </p>
          </div>

          {/* ── Generate button ──────────────────────────────────────────────── */}
          {isGenerating ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 space-y-3">
              <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(loadingStep / LOADING_MESSAGES.length) * 100}%`, background: '#14B8A6' }}
                />
              </div>
              <div className="flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: '#14B8A6' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3}/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-[12px] font-medium text-slate-500">{loadingMessage}</p>
              </div>
            </div>
          ) : !allGenerated ? (
            /* First generation — no draft exists yet */
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[14px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#0D9488' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Generate Assessment Draft
            </button>
          ) : (
            /* Draft exists — reviewing/downloading is free; regeneration is only
               offered for sections whose form data actually changed. */
            <div className="space-y-3">
              {changedSections.length > 0 && (
                <div className="rounded-2xl border px-5 py-3.5"
                  style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.30)' }}>
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="#B45309" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <div>
                      <p className="text-[12px] font-bold" style={{ color: '#92400E' }}>
                        {changedSections.length} section{changedSections.length !== 1 ? 's have' : ' has'} updated data
                      </p>
                      <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: '#B45309' }}>
                        {changedSections.map(s => s.title).join(', ')} changed since the draft was generated.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {changedSections.length > 0 && (
                <button
                  onClick={handleRegenerateChanged}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[14px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: '#B45309' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Regenerate {changedSections.length} changed section{changedSections.length !== 1 ? 's' : ''}
                </button>
              )}

              <button
                onClick={() => onNavigate('review')}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[14px] font-bold transition-all hover:opacity-90 active:scale-[0.98] ${changedSections.length > 0 ? 'border border-stone-200 bg-white text-slate-600' : 'text-white'}`}
                style={changedSections.length > 0 ? undefined : { background: '#0D9488' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
                Review &amp; Download
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
