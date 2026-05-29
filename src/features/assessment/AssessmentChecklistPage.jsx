import React, { useState } from 'react';
import { SECTION_ORDER, SECTION_TITLES } from './sectionConfig.js';
import { setDraftContent } from './assessmentStore.js';

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

**Assessment Date:** May 22, 2026 | **Assessment Type:** Initial Comprehensive | **BCBA:** [BCBA to complete: clinician name and credentials]`,

  presenting_concerns: `## Presenting Concerns

### Primary Concerns Identified by Caregiver

The Rivera family identified three primary concerns prompting this referral. First and most urgent, Marcus has displayed a significant increase in physical aggression toward family members — primarily his mother and younger sibling — over the past six months. Incidents occur daily and include hitting with an open hand, throwing objects, and on two occasions biting his mother's arm hard enough to leave marks. The family reports that the escalation coincided with a school schedule change in October 2025 when Marcus's paraprofessional aide was reassigned.

Second, the family reports near-complete refusal of previously mastered self-care routines, particularly bathing. Marcus, who was independently bathing by age 7, now requires 45–60 minutes of caregiver prompting and frequently meltdowns at the bathroom door, sometimes resulting in aggression. This regression was not preceded by any identified medical event.

Third, caregiver reports marked anxiety in non-routine situations. Family has avoided restaurants, grocery stores, and extended family gatherings for approximately four months due to Marcus's distress response to unpredictable environments. This has significantly impacted family quality of life.

### School & Community

School reports corroborate aggression, noting 3 documented incidents of hitting peers in the past two months. Marcus has received in-school suspension on one occasion. The IEP team has recommended increasing paraprofessional support but this has not yet been implemented pending this ABA evaluation. Community avoidance is family-reported; school behavior appears to be improving with structured routine and predictability.

### Clinical Impression

[BCBA to complete: functional hypothesis for aggression based on interview data — consider escape/demand avoidance and attention functions given onset following aide reassignment]

[BCBA to complete: note whether regression in self-care warrants medical consult to rule out sensory processing changes or co-occurring medical issues]

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

[BCBA to complete: prioritize dressing targets (buttons/snaps, shoelaces) as functional adaptive skills; coordinate with OT on feeding protocol; note clothing sensitivities as setting event for morning behavioral escalation]`,

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

[BCBA to complete: identify morning routine steps for discrete trial support; assess community reintegration targets; document LEGO/screen time as high-preference reinforcers; coordinate with family on chore rotation as skill-building target]`,

  safety: `## Safety Concerns

### Elopement & Wandering

No history of elopement or wandering reported. Marcus has never left a safe area without caregiver permission. Family does not report any concerns about this domain. No safety measures specific to elopement are in place. Marcus demonstrates appropriate response to "stop" commands in outdoor settings per caregiver report. Water safety: family has an above-ground pool in the backyard; Marcus can swim with supervision but does not swim independently, and pool area has a locking gate which remains latched. No incidents of unsupervised pool access reported.

### Self-Injurious Behavior

Marcus engages in head-directed hitting (hand to head/face, self-administered) during escalated behavioral episodes. This behavior occurs approximately 3–5 times per week during severe escalation and has not resulted in injury requiring medical attention. Duration of SIB episodes is typically brief (under 30 seconds), and the behavior appears to be part of a broader escalation sequence rather than a primary presenting behavior. No head-banging against surfaces reported.

### Aggression & Property Destruction

Physical aggression toward others is the primary safety concern (see Presenting Concerns). Topography includes open-hand hitting, object throwing (typically lightweight objects within reach), and biting. His mother is the most frequent target, followed by his younger sibling. Peers at school have been targeted on two documented occasions. There has been no property destruction resulting in significant damage; Marcus occasionally sweeps items off surfaces during escalation but does not engage in sustained property destruction.

No law enforcement involvement. No injuries to others requiring medical attention, though his mother reports bruising from the biting incidents.

### Clinical Safety Assessment

[BCBA to complete: document current aggression risk level — recommend rating as MODERATE given daily frequency, topography including biting, and impact on family safety and sibling]

[BCBA to complete: confirm no mandated reporting triggers from today's interview; document in session notes]

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

[BCBA to complete: coordinate with Ms. Cruz on shared pragmatics targets; note FCT mands for help-seeking and break-requesting as highest-priority ABA communication goals; identify verbal behavior targets to embed across session activities]`,

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

[BCBA to complete: assess clinical significance of stigmatizing self-stim; determine whether reduction programming is indicated or whether environmental modification and peer education are the appropriate first-line response; document OT sensory plan coordination]`,

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

[BCBA to complete: document specific ICD-10 deficits and excesses mapping to Florida Blue/Medicaid medical necessity criteria; articulate ABA as appropriate level of care given diagnosis, functional impact, and prior partial response to ABA; specify recommended hours (recommend 20–25 hrs/week given severity); note that prior ABA services were beneficial per caregiver report and that regression occurred after discontinuation]

[BCBA to complete: document expected treatment targets and measurable outcomes for 6-month authorization period; identify barriers including transportation and language access needs for Spanish-speaking extended family]`,

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

[BCBA to complete: formalize the functional hypothesis for aggression based on interview data; note whether indirect FBA (FAST/MAS) should be completed prior to BIP development or whether sufficient information exists from interview; specify reinforcement contingencies to address in BIP]

**Proposed Intervention Strategy (Preliminary):**
- FCT to replace aggression with appropriate help-seeking and break-requesting
- Antecedent modifications: visual transition warnings (5-minute, 2-minute, 1-minute), demand fading for grooming tasks, structured sibling boundary protocols
- Planned ignoring for minor aggression with immediate redirection to alternative behavior
- Parent training: caregiver consistency in demand presentation and not removing demands following aggression

[BCBA to complete: specify measurement system — recommend event recording for all aggressive incidents with ABC notation; establish baseline data collection before BIP implementation]`,

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

- **Primary emergency contact:** Daniela Rivera (mother) — (305) 555-XXXX [BCBA to complete: confirm current contact number]
- **Secondary:** Javier Rivera (father) — [BCBA to complete: confirm current contact number]
- **Treating physician:** Dr. Adriana Costa — (305) 555-XXXX [BCBA to complete: confirm clinic number]
- **Family protocol for emergency services:** Family will call 911 if Marcus or another person is in immediate danger of injury they cannot manage. They have been counseled to inform dispatch that Marcus has autism and to request a CIT (Crisis Intervention Team) officer if available in their jurisdiction.

### Clinical Crisis Protocol

[BCBA to complete: document the specific internal crisis protocol including: RBT-to-BCBA call threshold (recommend: any bite, any injury to another person, any episode lasting >20 minutes); physical management procedures authorized (recommend: no physical management — redirection only, removal of at-risk individuals, space creation); document crisis plan acknowledgment signature requirement prior to service start]

[BCBA to complete: confirm whether psychiatric consultation is warranted before services begin — given current aggression frequency and biting, recommend consulting with Dr. Costa regarding whether medication evaluation for anxiety/aggression is appropriate concurrently with ABA initiation]`,
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

[BCBA to complete: prioritize toilet training protocol (initiation fading, pants management); coordinate with OT on feeding protocol and sensory integration for grooming tolerance; note tactile sensitivities as daily antecedent to behavioral escalation]`,

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

[BCBA to complete: document specific visual support formats that are effective; add elopement safety protocol as immediate priority; identify highest-value reinforcers beyond screen time to expand reinforcer menu]`,

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

[BCBA to complete: complete functional behavior assessment for SIB and aggression; document emergency safety protocol for elopement; evaluate for sensory regulation supports that may reduce SIB frequency; confirm mandated reporting review completed]`,

  communication: `## Communication

### Expressive Language

Emma's expressive communication is significantly below age expectations. She uses approximately 8–10 single words inconsistently: "no," "mama," "more," "up," "out," "eat," "bye," "mine," and two approximations for preferred food items. Word use is not reliable across contexts — words observed in one setting are frequently not reproduced in another. No spontaneous two-word combinations have been observed by caregivers or school staff.

Emma communicates primarily through physical means: hand-leading to desired items or locations, reaching toward preferred objects, and proximity to caregivers. She uses pointing to indicate refusal (pointing away) more reliably than to request.

### Receptive Language

Emma follows familiar single-step instructions in structured settings with visual support (e.g., "sit down" paired with visual schedule step) with approximately 70% accuracy. Novel single-step instructions without visual support are followed approximately 30% of the time. She does not follow two-step instructions consistently. She identifies approximately 15–20 familiar objects by pointing to them when named, primarily food items and classroom objects from her school routine.

### Augmentative & Alternative Communication

Emma currently uses a 12-symbol PECS binder (Phase I–II) at school. Home implementation of PECS has been inconsistent — parents report the binder is used at meals approximately 50% of the time. An AAC device evaluation was recommended by the school SLP in January 2026 and has not yet been completed; this assessment is being used to support that recommendation.

### Clinical Notes

[BCBA to complete: coordinate with SLP Ms. Rivera on FCT implementation using PECS; prioritize mand training for food and break requests as highest-frequency needs; document communication book contents and add "help," "break," and "I want" core vocabulary as immediate targets; support family in AAC device trial]`,

  self_stimulatory: `## Self-Stimulatory Behavior

### Observed Stereotypies

Emma engages in several repetitive behaviors that appear to serve a sensory function. Primary stereotypies include hand-flapping (bilateral, observed during transitions and periods of heightened emotion — both excitement and distress), toe-walking (consistent, all day without shoes, approximately 50% with shoes), and visual tracking of moving objects (spinning coins, ceiling fans, tablet loading icons — can engage for 5–10 minutes without interruption).

Secondary stereotypies include rubbing the back of her left hand against her face (most frequent during screen time and during quiet activities), and vocalizing with a high-pitched tonal pattern during play with cause-and-effect toys. This vocalization does not appear to serve a communicative function; it occurs in the absence of social audience and continues when social attention is withdrawn.

### Impact on Daily Functioning

Stereotypy does not appear to be significantly impairing across most settings, with the exception of visual tracking of spinning objects — this behavior can crowd out instructional engagement for extended periods and is noted by school staff as a barrier to participation during group activities.

Toe-walking has been flagged by the pediatric orthopedist as requiring monitoring; no intervention recommended at this time.

### Clinical Notes

[BCBA to complete: determine whether response interruption/redirection is appropriate for visual stereotypy during instructional periods; do not target sensory-regulatory stereotypies (hand-flapping, vocalizing) for reduction without functional behavior assessment; document baseline rates]`,

  medical_necessity: `## Medical Necessity

### Diagnosis and Functional Impact

Emma Thompson carries a diagnosis of Autism Spectrum Disorder, Level 3 (DSM-5, F84.0), confirmed by Dr. Sarah Patel, Psy.D., on October 8, 2023. This diagnosis is defined by requiring very substantial support in both social communication and restricted, repetitive behaviors. Emma's clinical presentation is consistent with a Level 3 classification: she has minimal verbal communication, significant difficulties with daily living skills, and engages in self-injurious behavior that poses an ongoing safety risk.

The clinical findings documented in this assessment support the medical necessity for Applied Behavior Analysis services at a comprehensive intensity level. Emma's deficits in communication (expressive language at approximately 18-month developmental level), self-care skills (toileting, dressing, grooming requiring substantial adult support), and adaptive behavior (Vineland-3 estimated composite in the 40–50 standard score range based on parent interview) indicate functional limitations that ABA services are designed to address through evidence-based behavioral intervention.

### Safety Considerations

Daily self-injurious behavior (head banging, 4–8 episodes/day), elopement risk with documented incidents at school and home, and aggression toward caregivers (2–3 incidents/day) represent active safety concerns requiring immediate intervention. The absence of reliable receptive safety responses ("stop," "wait") and the presence of traffic-oblivious elopement elevate the clinical urgency of this case.

### Justification for Service Hours

Based on the severity of Emma's presenting profile, recommendation is for 30–35 hours per week of ABA services inclusive of direct therapy and supervision. This level of intensity is consistent with published research recommendations for children with Level 3 ASD profiles, limited communication, and active self-injurious behavior. Services will be provided across home and school settings to promote generalization.

### Clinical Notes

[BCBA to complete: complete standardized adaptive behavior assessment (Vineland-3 or ABAS-3) to document functional deficit baseline; obtain diagnostic records from Dr. Patel; confirm insurance authorization requirements for recommended service hours]`,

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

[BCBA to complete: complete preference assessment to identify current high-preference reinforcers; coordinate with SLP on AAC device selection and vocabulary programming; establish baseline data for all skill targets prior to programming; write complete skill acquisition programs with task analyses, prompting hierarchies, and data collection procedures]`,

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

[BCBA to complete: complete functional behavior assessment — at minimum an indirect assessment and direct observation; functional analysis is recommended given the safety risk of SIB; obtain school direct observation data prior to programming; establish RBT and caregiver safety protocols before beginning extinction-based procedures]`,

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

[BCBA to complete: insert emergency contact hierarchy — parent primary, parent secondary, BCBA, agency emergency line]

### Plan Review

This crisis plan should be reviewed with all team members (RBTs, parents, school staff) prior to initiating ABA services and at each authorization renewal. Update if new behaviors emerge or intensity of existing behaviors changes significantly.`,
};

// ─── Draft selector ───────────────────────────────────────────────────────────

function getDrafts(clientId) {
  if (clientId === 'c13') return MARCUS_DRAFTS;
  if (clientId === 'c4')  return EMMA_DRAFTS;
  // Generic fallback: use Emma drafts substituting nothing (still better than Marcus-specific)
  return EMMA_DRAFTS;
}

// ─── AssessmentChecklistPage ──────────────────────────────────────────────────

export default function AssessmentChecklistPage({
  clientId, clients, setClients, currentUser, session, onNavigate,
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
    const indicatorCount = (sec?.indicators ?? []).filter(i => i.count > 0).length;
    const skillGoalCount = (sec?.skillGoals ?? []).length;
    const hasIndicators  = indicatorCount > 0;
    const hasSkillGoals  = skillGoalCount > 0;
    const hasData        = hasNotes || hasTranscript || hasIndicators || hasSkillGoals;
    const isEmpty        = sec?.completionState === 'empty';

    return {
      key, title: SECTION_TITLES[key],
      hasData, hasDraft, hasNotes, hasTranscript, hasConflict, isEmpty, isDemographics,
      hasIndicators, indicatorCount, hasSkillGoals, skillGoalCount,
    };
  });

  const totalSections   = rows.length;
  const captured        = rows.filter(r => r.hasData || r.hasDraft).length;
  const emptySections   = rows.filter(r => r.isEmpty && !r.hasDraft).length;
  const hasConflicts    = rows.some(r => r.hasConflict);
  const allGenerated    = rows.every(r => r.hasDraft);

  // ── Generate handler ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    setLoadingStep(0);

    for (let i = 0; i < LOADING_MESSAGES.length; i++) {
      setLoadingMessage(LOADING_MESSAGES[i]);
      setLoadingStep(i + 1);
      await new Promise(r => setTimeout(r, 580));
    }

    // Populate all sections with client-specific demo drafts
    const DRAFTS = getDrafts(clientId);
    for (const [key, content] of Object.entries(DRAFTS)) {
      setDraftContent(setClients, clientId, key, content, 'pending', content);
    }

    await new Promise(r => setTimeout(r, 300));
    setIsGenerating(false);
    onNavigate('review');
  };

  // ── Per-row subtitle + pill logic ──────────────────────────────────────────

  function rowSubtitle(row) {
    if (row.isDemographics) return 'Pre-filled from client record — ready for assessment.';
    if (row.hasDraft)       return 'Draft ready — awaiting your review.';
    if (row.hasConflict)    return 'Conflict flagged — review before generating.';
    const parts = [];
    if (row.hasTranscript) parts.push('transcript');
    if (row.hasNotes)      parts.push('notes');
    if (row.hasIndicators) parts.push(`${row.indicatorCount} indicators`);
    if (row.hasSkillGoals) parts.push(`${row.skillGoalCount} skill goals`);
    if (parts.length)      return `Ready — ${parts.join(' + ')} captured.`;
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
                  onClick={() => onNavigate('interview', row.key)}
                  className="w-full rounded-2xl border bg-white px-4 py-3.5 flex items-center gap-3.5 text-left hover:shadow-sm hover:-translate-y-px active:scale-[0.99] transition-all duration-150"
                  style={{ borderColor: isWarning ? 'rgba(251,191,36,0.4)' : isEmpty ? '#E7E5E4' : '#E7E5E4' }}>

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
          ) : (
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[14px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#0D9488' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              {allGenerated ? 'Regenerate Assessment Draft' : 'Generate Assessment Draft'}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
