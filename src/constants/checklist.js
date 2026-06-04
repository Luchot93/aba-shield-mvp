export const mkChecklist = () => ({
  intake: {
    referral_form:false, insurance_card:false, cde:false,
    aba_prescription:false, demographics_confirmed:false,
    insurance_verified:false, benefits_verified:false,
  },
  auth_assessment: {
    cde_confirmed:false, prescription_confirmed:false, referral_confirmed:false,
    prior_assessments:false, auth_submitted:false, reference_number:'',
    cpt_97151_received:false, bcba_assigned:false,
  },
  assessment: {
    bcba_confirmed:false, caregiver_interview:false, direct_observation:false,
    vineland3:false, vineland3_date:'', basc3:false, basc3_date:'',
    additional_assessments:false, smart_assessment_submitted:false,
    baseline_data:false, behaviors_identified:false,
    final_assessment_report:false,
  },
  plan_draft: {
    medical_necessity:false, skill_targets:false, behavior_goals:false,
    intervention_strategies:false, supervision_hours:'', data_methodology:'',
    baseline_graphs:false, ai_draft_approved:false, treatment_plan_finalized:false,
  },
  submitted: {
    plan_submitted:false, cpt_units_requested:false, approval_uploaded:false,
    authorized_hours:'', no_denial_pending:false,
  },
  denied: {
    denial_reason:'', peer_to_peer_scheduled:false,
    supporting_docs:false, peer_to_peer_completed:false,
  },
  authorized: {
    bcba_matches_auth:false, bcba_credentials_verified:false,
    rbt_assigned:false, rbt_cert_valid:false, rbt_credentials_attached:false,
  },
  staffing: {
    caregiver_availability:false, schedule_coordinated:false,
    first_session_scheduled:false, first_session_completed:false,
  },
  services_reauth: {
    progress_report:false, updated_graphs:false, vineland3_updated:false,
    basc3_updated:false, reauth_submitted:false,
  },
});

export const REAUTH_ITEMS = [
  { type:'checkbox', key:'progress_report',   label:'Progress report written',    clSec:'services_reauth' },
  { type:'checkbox', key:'updated_graphs',    label:'Updated graphs attached',     clSec:'services_reauth' },
  { type:'checkbox', key:'vineland3_updated', label:'Vineland-3 updated',          clSec:'services_reauth' },
  { type:'checkbox', key:'basc3_updated',     label:'BASC-3 updated',              clSec:'services_reauth' },
  { type:'checkbox', key:'reauth_submitted',  label:'Reauth submitted',            clSec:'services_reauth' },
];

export function getStageItems(stage) {
  switch (stage) {
    case 'intake': return [
      { type:'upload',   key:'referral_form',      label:'Referral request form',                    clSec:'intake' },
      { type:'upload',   key:'insurance_card',     label:'Insurance card',                           clSec:'intake' },
      { type:'upload',   key:'cde',                label:'Comprehensive Diagnostic Evaluation (CDE)',clSec:'intake' },
      { type:'upload',   key:'aba_prescription',   label:'ABA prescription / script',               clSec:'intake' },
      { type:'auto',     key:'demographics',       label:'Client demographics',                      clSec:'intake', always:true },
      { type:'checkbox', key:'insurance_verified', label:'Insurance information verified',           clSec:'intake' },
      { type:'checkbox', key:'benefits_verified',  label:'Benefits verification completed',          clSec:'intake' },
    ];
    case 'auth_assessment': return [
      { type:'checkbox',   key:'cde_confirmed',         label:'CDE confirmed',                           clSec:'auth_assessment' },
      { type:'checkbox',   key:'prescription_confirmed', label:'ABA prescription confirmed',             clSec:'auth_assessment' },
      { type:'checkbox',   key:'referral_confirmed',    label:'Referral form confirmed',                 clSec:'auth_assessment' },
      { type:'upload',     key:'prior_assessments',     label:'Prior assessments attached',              clSec:'auth_assessment' },
      { type:'checkbox',   key:'auth_submitted',        label:'Authorization submitted to insurer',      clSec:'auth_assessment' },
      { type:'form_field', key:'reference_number',      label:'Submission reference number',             clSec:'auth_assessment', fieldType:'text' },
      { type:'checkbox',   key:'cpt_97151_received',    label:'CPT 97151 authorization received',        clSec:'auth_assessment' },
      { type:'assign',     key:'bcba_assigned',         label:'BCBA assigned to case',                   clSec:'auth_assessment', role:'bcba' },
    ];
    case 'assessment': return [
      { type:'auto',     key:'bcba_confirmed',          label:'BCBA assigned and confirmed',              clSec:'assessment', bcbaAuto:true },
      { type:'checkbox', key:'caregiver_interview',     label:'Caregiver interview completed',            clSec:'assessment' },
      { type:'checkbox', key:'direct_observation',      label:'Direct observation completed',             clSec:'assessment' },
      { type:'dated',    key:'vineland3',               label:'Vineland-3 administered within 12 months', clSec:'assessment', dateKey:'vineland3_date' },
      { type:'dated',    key:'basc3',                   label:'BASC-3 administered within 12 months',    clSec:'assessment', dateKey:'basc3_date' },
      { type:'checkbox', key:'additional_assessments',  label:'Additional assessments completed',         clSec:'assessment' },
      { type:'bridge',   key:'smart_assessment_submitted', label:'Smart Assessment Form submitted',       clSec:'assessment' },
      { type:'checkbox',     key:'baseline_data',              label:'Baseline behavioral data recorded',       clSec:'assessment' },
      { type:'checkbox',     key:'behaviors_identified',       label:'Behaviors identified',                    clSec:'assessment' },
      { type:'file_upload',  key:'final_assessment_report',    label:'Final assessment report uploaded',         clSec:'assessment', accept:'.docx,.pdf', docType:'final_assessment' },
    ];
    case 'plan_draft': return [
      { type:'smart_auto', key:'medical_necessity',       label:'Medical necessity statement',            clSec:'plan_draft' },
      { type:'smart_auto', key:'skill_targets',           label:'Skill-acquisition targets',              clSec:'plan_draft' },
      { type:'smart_auto', key:'behavior_goals',          label:'Behavior-reduction goals',               clSec:'plan_draft' },
      { type:'smart_auto', key:'intervention_strategies', label:'Intervention strategies',                clSec:'plan_draft' },
      { type:'form_field', key:'supervision_hours',       label:'Supervision & caregiver training hours', clSec:'plan_draft', fieldType:'number' },
      { type:'form_field', key:'data_methodology',        label:'Data-collection methodology',            clSec:'plan_draft', fieldType:'text' },
      { type:'smart_auto', key:'baseline_graphs',         label:'Baseline graphs',                        clSec:'plan_draft' },
      { type:'checkbox',   key:'ai_draft_approved',       label:'AI draft reviewed and approved by BCBA', clSec:'plan_draft', mandatory:true },
      { type:'checkbox',   key:'treatment_plan_finalized',label:'Treatment plan finalized',               clSec:'plan_draft' },
    ];
    case 'submitted': return [
      { type:'checkbox',   key:'plan_submitted',      label:'Treatment plan submitted',              clSec:'submitted' },
      { type:'checkbox',   key:'cpt_units_requested', label:'CPT units requested 97153/97155/97156', clSec:'submitted' },
      { type:'upload',     key:'approval_uploaded',   label:'Authorization approval document',       clSec:'submitted' },
      { type:'form_field', key:'authorized_hours',    label:'Authorized hours loaded',               clSec:'submitted', fieldType:'number' },
      { type:'checkbox',   key:'no_denial_pending',   label:'No active denial pending',              clSec:'submitted' },
    ];
    case 'denied': return [
      { type:'form_field', key:'denial_reason',           label:'Denial reason logged',                         clSec:'denied', fieldType:'text' },
      { type:'checkbox',   key:'peer_to_peer_scheduled',  label:'Peer-to-peer scheduled within 2 days',         clSec:'denied', note:'Call: 1-844-477-8313 Ext. 6032912' },
      { type:'upload',     key:'supporting_docs',         label:'Supporting documentation prepared',            clSec:'denied' },
      { type:'checkbox',   key:'peer_to_peer_completed',  label:'Peer-to-peer completed or appeal submitted',   clSec:'denied' },
    ];
    case 'authorized': return [
      { type:'checkbox', key:'bcba_matches_auth',        label:'BCBA matches insurance authorization', clSec:'authorized' },
      { type:'checkbox', key:'bcba_credentials_verified',label:'BCBA credentials verified',            clSec:'authorized' },
      { type:'assign',   key:'rbt_assigned',             label:'RBT assigned',                         clSec:'authorized', role:'rbt' },
      { type:'auto',     key:'rbt_cert_valid',           label:'RBT certification valid',              clSec:'authorized', rbtCert:true },
      { type:'auto',     key:'rbt_credentials_attached', label:'RBT credentials attached',             clSec:'authorized', rbtCreds:true },
    ];
    case 'staffing': return [
      { type:'checkbox', key:'caregiver_availability',  label:'Caregiver availability confirmed', clSec:'staffing' },
      { type:'checkbox', key:'schedule_coordinated',    label:'Staff schedule coordinated',       clSec:'staffing' },
      { type:'checkbox', key:'first_session_scheduled', label:'First session scheduled',          clSec:'staffing' },
      { type:'checkbox', key:'first_session_completed', label:'First session completed',          clSec:'staffing' },
    ];
    default: return [];
  }
}
