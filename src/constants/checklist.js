export const mkChecklist = () => ({
  intake: {
    referral_form:false, insurance_card:false, cde:false,
    aba_prescription:false, consent_signed:false,
    demographics_confirmed:false,
    referral_source:'', insurance_plan:'', member_id_verified:'', copay_deductible:'',
    preferred_language:'',
    insurance_verified:false, benefits_verified:false,
  },
  auth_assessment: {
    cde_confirmed:false, prescription_confirmed:false, referral_confirmed:false,
    prior_assessments:false, auth_submitted:false, reference_number:'',
    cpt_97151_received:false, bcba_assigned:false,
    submission_date:'', units_requested:'', expected_response_date:'', auth_portal:'',
  },
  assessment: {
    bcba_confirmed:false, caregiver_interview:false, direct_observation:false,
    vineland3:false, vineland3_date:'', basc3:false, basc3_date:'',
    additional_assessments:false, smart_assessment_submitted:false,
    baseline_data:false, behaviors_identified:false,
    final_assessment_report:false,
    observation_date:'', additional_assessments_detail:'',
  },
  plan_draft: {
    medical_necessity:false, skill_targets:false, behavior_goals:false,
    intervention_strategies:false, data_methodology:'',
    baseline_graphs:false, ai_draft_approved:false, treatment_plan_finalized:false,
    hours_97153:'', hours_97155:'', hours_97156:'',
    plan_start_date:'', plan_end_date:'', sessions_per_week:'', session_duration_min:'',
  },
  submitted: {
    plan_submitted:false, cpt_units_requested:false,
    plan_submission_date:'', auth_reference_number:'',
    authorized_97153:'', authorized_97155:'', authorized_97156:'',
    auth_start_date:'', auth_end_date:'',
    approval_uploaded:false,
  },
  denied: {
    denial_reason:'', peer_to_peer_scheduled:false,
    supporting_docs:false, peer_to_peer_completed:false,
    denial_date:'', denial_code:'', appeal_deadline:'', appeal_outcome:'',
  },
  authorized: {
    bcba_matches_auth:false, bcba_credentials_verified:false,
    rbt_assigned:false, rbt_cert_valid:false, rbt_credentials_attached:false,
    schedule_template:'', session_location:'',
    scheduled_hours_week:'', scheduled_97155_week:'', scheduled_97156_week:'',
  },
  staffing: {
    caregiver_availability:false, schedule_coordinated:false,
    first_session_scheduled:false, first_session_completed:false,
    first_session_date:'', first_session_time:'', session_location:'',
    schedule_template:'',
  },
  services_reauth: {
    progress_report:false, updated_graphs:false, vineland3_updated:false,
    basc3_updated:false, reauth_submitted:false,
    reauth_submission_date:'', hours_consumed_97153:'', hours_consumed_97155:'', hours_consumed_97156:'',
  },
});

export const REAUTH_ITEMS = [
  { type:'file_upload', key:'progress_report',          label:'Progress report',                        clSec:'services_reauth', accept:'.pdf,.docx',      docType:'progress_report' },
  { type:'file_upload', key:'updated_graphs',           label:'Updated behavioral graphs',              clSec:'services_reauth', accept:'.pdf,.png,.jpg',  docType:'updated_graphs' },
  { type:'checkbox',    key:'vineland3_updated',        label:'Vineland-3 updated',                     clSec:'services_reauth' },
  { type:'checkbox',    key:'basc3_updated',            label:'BASC-3 updated',                         clSec:'services_reauth' },
  { type:'checkbox',    key:'reauth_submitted',         label:'Reauth submitted',                       clSec:'services_reauth' },
  { type:'form_field',  key:'reauth_submission_date',   label:'Reauth submission date',                 clSec:'services_reauth', fieldType:'date',   optional:true },
  { type:'form_field',  key:'hours_consumed_97153',     label:'97153 hours used this auth period',      clSec:'services_reauth', fieldType:'number', optional:true },
  { type:'form_field',  key:'hours_consumed_97155',     label:'97155 hours used this auth period',      clSec:'services_reauth', fieldType:'number', optional:true },
  { type:'form_field',  key:'hours_consumed_97156',     label:'97156 hours used this auth period',      clSec:'services_reauth', fieldType:'number', optional:true },
];

export function getStageItems(stage) {
  switch (stage) {
    case 'intake': return [
      { type:'file_upload', key:'referral_form',    label:'Referral request form',                     clSec:'intake', accept:'.pdf,.docx,.jpg,.png', docType:'referral_form'    },
      { type:'file_upload', key:'insurance_card',   label:'Insurance card',                            clSec:'intake', accept:'.pdf,.docx,.jpg,.png', docType:'insurance_card'   },
      { type:'file_upload', key:'cde',              label:'Comprehensive Diagnostic Evaluation (CDE)', clSec:'intake', accept:'.pdf,.docx,.jpg,.png', docType:'cde'              },
      { type:'file_upload', key:'aba_prescription', label:'ABA prescription / script',                clSec:'intake', accept:'.pdf,.docx,.jpg,.png', docType:'aba_prescription' },
      { type:'file_upload', key:'consent_signed',   label:'Intake consent packet signed',             clSec:'intake', accept:'.pdf,.docx',           docType:'consent'          },
      { type:'auto',        key:'demographics',     label:'Client demographics',                       clSec:'intake', always:true },
      { type:'form_field',  key:'referral_source',    label:'Referral source',            clSec:'intake', fieldType:'text', optional:true, placeholder:'e.g. Dr. Smith, school district, parent referral', clientFields:['referring_provider','referring_provider_phone'], clientFieldSep:' · '     },
      { type:'form_field',  key:'insurance_plan',     label:'Insurance plan name',        clSec:'intake', fieldType:'text', optional:true, placeholder:'e.g. Aetna Better Health FL',                       clientFields:['health_plan_name']                                                   },
      { type:'form_field',  key:'member_id_verified', label:'Member ID / Group #',        clSec:'intake', fieldType:'text', optional:true, placeholder:'MBR-0000000',                                       clientFields:['member_id','group_number'],                clientFieldSep:' / '       },
      { type:'form_field',  key:'copay_deductible',   label:'Copay / deductible details', clSec:'intake', fieldType:'text', optional:true, placeholder:'$0 copay, $500 deductible remaining'                                                                                                    },
      { type:'form_field',  key:'preferred_language', label:'Preferred language',         clSec:'intake', fieldType:'text', optional:true, placeholder:'e.g. English, Spanish',                             clientFields:['preferred_language']                                                 },
      { type:'checkbox',    key:'insurance_verified', label:'Insurance information verified',  clSec:'intake' },
      { type:'checkbox',    key:'benefits_verified',  label:'Benefits verification completed', clSec:'intake' },
    ];
    case 'auth_assessment': return [
      { type:'auto',       key:'cde_confirmed',          label:'CDE confirmed',                          clSec:'auth_assessment', intakeKey:'cde' },
      { type:'auto',       key:'prescription_confirmed', label:'ABA prescription confirmed',             clSec:'auth_assessment', intakeKey:'aba_prescription' },
      { type:'auto',       key:'referral_confirmed',     label:'Referral form confirmed',                clSec:'auth_assessment', intakeKey:'referral_form' },
      { type:'file_upload',key:'prior_assessments',      label:'Prior assessments attached',             clSec:'auth_assessment', accept:'.pdf,.docx', docType:'prior_assessments' },
      { type:'checkbox',   key:'auth_submitted',         label:'Authorization submitted to insurer',     clSec:'auth_assessment' },
      { type:'section_label', key:'_submission_header',  label:'Submission Details' },
      { type:'form_field', key:'submission_date',        label:'Submission date',                        clSec:'auth_assessment', fieldType:'date',   optional:true },
      { type:'form_field', key:'units_requested',        label:'CPT 97151 units requested',              clSec:'auth_assessment', fieldType:'number', optional:true, placeholder:'e.g. 16' },
      { type:'form_field', key:'expected_response_date', label:'Expected response date',                 clSec:'auth_assessment', fieldType:'date',   optional:true },
      { type:'form_field', key:'auth_portal',            label:'Submission method / portal',             clSec:'auth_assessment', fieldType:'text',   optional:true, placeholder:'e.g. Availity, fax, phone' },
      { type:'form_field', key:'reference_number',       label:'Submission reference number',            clSec:'auth_assessment', fieldType:'text',   optional:true },
      { type:'checkbox',   key:'cpt_97151_received',     label:'CPT 97151 authorization received',       clSec:'auth_assessment' },
      { type:'assign',     key:'bcba_assigned',          label:'BCBA assigned to case',                  clSec:'auth_assessment', role:'bcba' },
    ];
    case 'assessment': return [
      { type:'auto',       key:'bcba_confirmed',               label:'BCBA assigned and confirmed',              clSec:'assessment', bcbaAuto:true },
      { type:'bridge',     key:'smart_assessment_submitted',   label:'Smart Assessment',                         clSec:'assessment' },
      { type:'auto',       key:'caregiver_interview',          label:'Caregiver interview completed',            clSec:'assessment', sessionKey:'caregiver_section' },
      { type:'auto',       key:'direct_observation',           label:'Direct observation completed',             clSec:'assessment', sessionKey:'behaviors_section' },
      { type:'form_field', key:'observation_date',             label:'Observation session date',                 clSec:'assessment', fieldType:'date', optional:true },
      { type:'dated',      key:'vineland3',                    label:'Vineland-3 administered within 12 months', clSec:'assessment', dateKey:'vineland3_date' },
      { type:'dated',      key:'basc3',                        label:'BASC-3 administered within 12 months',     clSec:'assessment', dateKey:'basc3_date' },
      { type:'checkbox',   key:'additional_assessments',       label:'Additional assessments completed',         clSec:'assessment' },
      { type:'form_field', key:'additional_assessments_detail',label:'Additional tools used',                    clSec:'assessment', fieldType:'text', optional:true, placeholder:'e.g. ABLLS-R, AFLS, VB-MAPP' },
      { type:'auto',       key:'behaviors_identified',         label:'Behaviors identified',                     clSec:'assessment', sessionKey:'behaviors_any' },
      { type:'auto',       key:'baseline_data',                label:'Baseline behavioral data recorded',        clSec:'assessment', sessionKey:'behaviors_baseline' },
      { type:'file_upload',key:'final_assessment_report',      label:'Final assessment report uploaded',         clSec:'assessment', accept:'.docx,.pdf', docType:'final_assessment' },
    ];
    case 'plan_draft': return [
      { type:'smart_auto', key:'medical_necessity',       label:'Medical necessity statement',            clSec:'plan_draft' },
      { type:'smart_auto', key:'skill_targets',           label:'Skill-acquisition targets',              clSec:'plan_draft' },
      { type:'smart_auto', key:'behavior_goals',          label:'Behavior-reduction goals',               clSec:'plan_draft' },
      { type:'smart_auto', key:'intervention_strategies', label:'Intervention strategies',                clSec:'plan_draft' },
      { type:'form_field', key:'hours_97153',          label:'CPT 97153 — Direct therapy hours/mo',     clSec:'plan_draft', fieldType:'number', optional:true, placeholder:'e.g. 80' },
      { type:'form_field', key:'hours_97155',          label:'CPT 97155 — BCBA supervision hours/mo',   clSec:'plan_draft', fieldType:'number', optional:true, placeholder:'e.g. 12' },
      { type:'form_field', key:'hours_97156',          label:'CPT 97156 — Caregiver training hours/mo', clSec:'plan_draft', fieldType:'number', optional:true, placeholder:'e.g. 8', sessionField:'caregiver_training', sessionTransform:'trainingFreqToHours' },
      { type:'form_field', key:'data_methodology',     label:'Data-collection methodology',             clSec:'plan_draft', fieldType:'text',   optional:true },
      { type:'form_field', key:'plan_start_date',      label:'Plan period start date',                  clSec:'plan_draft', fieldType:'date',   optional:true, suggestPeriod:true, suggestEndKey:'plan_end_date' },
      { type:'form_field', key:'plan_end_date',        label:'Plan period end date',                    clSec:'plan_draft', fieldType:'date',   optional:true },
      { type:'form_field', key:'sessions_per_week',    label:'Sessions per week',                       clSec:'plan_draft', fieldType:'number', optional:true, placeholder:'e.g. 10' },
      { type:'form_field', key:'session_duration_min', label:'Session duration (minutes)',               clSec:'plan_draft', fieldType:'number', optional:true, placeholder:'e.g. 120' },
      { type:'smart_auto', key:'baseline_graphs',         label:'Baseline graphs',                        clSec:'plan_draft' },
      { type:'checkbox',   key:'ai_draft_approved',       label:'AI draft reviewed and approved by BCBA', clSec:'plan_draft', mandatory:true },
      { type:'file_upload',key:'treatment_plan_finalized',label:'Signed treatment plan uploaded',          clSec:'plan_draft', accept:'.pdf,.docx', docType:'treatment_plan' },
    ];
    case 'submitted': return [
      { type:'checkbox',   key:'plan_submitted',         label:'Treatment plan submitted',              clSec:'submitted' },
      { type:'form_field', key:'plan_submission_date',   label:'Plan submission date',                  clSec:'submitted', fieldType:'date',   optional:true },
      { type:'auto',       key:'cpt_units_requested',    label:'CPT units included in submission',      clSec:'submitted', planDraftHours:true },
      { type:'section_label', key:'_auth_received',      label:'Authorization Received' },
      { type:'file_upload',key:'approval_uploaded',      label:'Authorization approval document',       clSec:'submitted', accept:'.pdf,.docx,.jpg', docType:'auth_approval' },
      { type:'form_field', key:'auth_reference_number',  label:'Authorization reference number',        clSec:'submitted', fieldType:'text',   optional:true, placeholder:'AUTH-0000000' },
      { type:'form_field', key:'authorized_97153',       label:'Authorized 97153 — Direct hours',       clSec:'submitted', fieldType:'number', optional:true, placeholder:'hrs/month', planDraftKey:'hours_97153' },
      { type:'form_field', key:'authorized_97155',       label:'Authorized 97155 — BCBA hours',         clSec:'submitted', fieldType:'number', optional:true, placeholder:'hrs/month', planDraftKey:'hours_97155' },
      { type:'form_field', key:'authorized_97156',       label:'Authorized 97156 — Caregiver hours',    clSec:'submitted', fieldType:'number', optional:true, placeholder:'hrs/month', planDraftKey:'hours_97156' },
      { type:'form_field', key:'auth_start_date',        label:'Authorization period start',            clSec:'submitted', fieldType:'date',   optional:true, suggestPeriod:true, suggestEndKey:'auth_end_date' },
      { type:'form_field', key:'auth_end_date',          label:'Authorization period end',              clSec:'submitted', fieldType:'date',   optional:true },
    ];
    case 'denied': return [
      { type:'form_field', key:'denial_date',             label:'Denial received date',                         clSec:'denied', fieldType:'date', optional:true },
      { type:'form_field', key:'denial_code',             label:'Denial code',                                  clSec:'denied', fieldType:'text', optional:true, placeholder:'e.g. AUTH-051, CO-97' },
      { type:'form_field', key:'appeal_deadline',         label:'Appeal deadline',                              clSec:'denied', fieldType:'date', optional:true, suggestFromField:'denial_date', suggestOffsetDays:30 },
      { type:'form_field', key:'denial_reason',           label:'Denial reason logged',                         clSec:'denied', fieldType:'text', optional:true, clientField:'denial_reason' },
      { type:'checkbox',   key:'peer_to_peer_scheduled',  label:'Peer-to-peer scheduled within 2 days',         clSec:'denied', note:'Call: 1-844-477-8313 Ext. 6032912' },
      { type:'file_upload',key:'supporting_docs',         label:'Supporting documentation',                     clSec:'denied', accept:'.pdf,.docx', docType:'appeal_docs' },
      { type:'checkbox',   key:'peer_to_peer_completed',  label:'Peer-to-peer completed or appeal submitted',   clSec:'denied' },
      { type:'form_field', key:'appeal_outcome',          label:'Appeal outcome',                               clSec:'denied', fieldType:'text', optional:true, placeholder:'Approved / Upheld / Pending' },
    ];
    case 'authorized': return [
      { type:'checkbox',   key:'bcba_matches_auth',        label:'BCBA matches insurance authorization', clSec:'authorized' },
      { type:'checkbox',   key:'bcba_credentials_verified',label:'BCBA credentials verified',            clSec:'authorized' },
      { type:'assign',     key:'rbt_assigned',             label:'RBT assigned',                         clSec:'authorized', role:'rbt' },
      { type:'auto',       key:'rbt_cert_valid',           label:'RBT certification valid',              clSec:'authorized', rbtCert:true },
      { type:'auto',       key:'rbt_credentials_attached', label:'RBT credentials attached',             clSec:'authorized', rbtCreds:true },
      { type:'form_field', key:'schedule_template',        label:'Weekly session schedule',              clSec:'authorized', fieldType:'text',   optional:true, placeholder:'e.g. Mon/Wed/Fri 9–1pm, Tue/Thu 10–12pm', scheduleHint:true },
      { type:'section_label', key:'_sched_hours_header', label:'Scheduled hours per week' },
      { type:'form_field', key:'scheduled_hours_week',  label:'97153 — Direct therapy h/wk',      clSec:'authorized', fieldType:'number', optional:true, placeholder:'e.g. 19', authorizedHoursWeek:'97153' },
      { type:'form_field', key:'scheduled_97155_week',  label:'97155 — BCBA supervision h/wk',    clSec:'authorized', fieldType:'number', optional:true, placeholder:'e.g. 3',  authorizedHoursWeek:'97155' },
      { type:'form_field', key:'scheduled_97156_week',  label:'97156 — Caregiver training h/wk',  clSec:'authorized', fieldType:'number', optional:true, placeholder:'e.g. 2',  authorizedHoursWeek:'97156' },
      { type:'form_field', key:'session_location',        label:'Session location',                     clSec:'authorized', fieldType:'text',   optional:true, placeholder:"Client's home / Clinic / School" },
    ];
    case 'staffing': return [
      { type:'checkbox',   key:'caregiver_availability',  label:'Caregiver availability confirmed', clSec:'staffing' },
      { type:'checkbox',   key:'schedule_coordinated',    label:'Staff schedule coordinated',       clSec:'staffing' },
      { type:'form_field', key:'first_session_date',      label:'First session date',               clSec:'staffing', fieldType:'date' },
      { type:'form_field', key:'first_session_time',      label:'First session time',               clSec:'staffing', fieldType:'time',   optional:true },
      { type:'form_field', key:'session_location',        label:'Session location',                 clSec:'staffing', fieldType:'text',   optional:true, placeholder:"Client's home / Clinic / School", authorizedKey:'session_location' },
      { type:'checkbox',   key:'first_session_completed', label:'First session completed',          clSec:'staffing' },
    ];
    default: return [];
  }
}
