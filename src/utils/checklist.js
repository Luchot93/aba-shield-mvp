import { getStageItems } from '../constants/checklist.js';
import {
  hasMedicalNecessityContent,
  hasSkillTargetsContent,
  hasBehaviorGoalsContent,
  hasInterventionStrategiesContent,
  hasCaregiverTrainingContent,
  sessionHasGraphableContent,
} from '../features/detail/lib/planDraftContentChecks.js';

// Returns 'empty' | 'future' | 'stale' | 'current' for a date string, relative to now.
// 'stale' = more than 12 months in the past. Used by both completion logic and the UI.
export function getRecentDateStatus(dateStr) {
  if (!dateStr) return 'empty';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'empty';
  const now = Date.now();
  if (d.getTime() > now) return 'future';
  const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
  if (now - d.getTime() > twelveMonthsMs) return 'stale';
  return 'current';
}

export function getChecklistStatus(client, staff = []) {
  const items = getStageItems(client.stage, client);
  if (!items.length) return null;

  const missing = items.filter(item => !itemComplete(item, client, staff)).length;

  // Days in current stage — use stage_entered_at (stamped on each advance),
  // fall back to referral_date for legacy / seed clients that pre-date this field.
  const enteredAt = client.stage_entered_at ?? client.referral_date;
  const days = enteredAt
    ? Math.floor((Date.now() - new Date(enteredAt).getTime()) / 86_400_000)
    : 0;

  if (missing === 0) return { type: 'ready', days };

  // Promote to "waiting" when blocked for a full week or longer in any stage
  if (days >= 7) return { type: 'waiting', days, count: missing };

  return { type: 'missing', count: missing, days };
}

export function itemComplete(item, client, staff) {
  const val = item.clientField ? client[item.clientField] : client.checklist[item.clSec]?.[item.key];
  if (item.naSkippable && client.checklist[item.clSec]?.[`${item.key}_na`] === true) return true;
  switch (item.type) {
    case 'checkbox':
      if (item.optional) return true;
      if (item.key === 'auth_submitted') {
        const sec = client.checklist?.auth_assessment ?? {};
        return val === true
          && sec.roi_confirmed === true
          && !!client.cpt97151_reference_number?.trim()
          && !!client.cpt97151_submission_date;
      }
      if (item.key === 'cpt_97151_received') {
        const sec = client.checklist?.auth_assessment ?? {};
        return val === true && sec.cpt97151_approval_doc === true;
      }
      return val === true;
    case 'upload':
      if (item.optional) return true;
      return val === true;
    case 'file_upload':
      if (item.optional) return true;
      if (val === true) return true;
      if (item.orClientField) return client[item.orClientField] === true;
      return false;
    case 'select':
      if (item.completeValues) return item.completeValues.includes(val);
      return val === item.completeValue;
    case 'form_field': {
      if (item.optional) return true;
      const filled = typeof val === 'string' ? val.trim() !== '' : (val !== '' && val != null);
      if (!filled) return false;
      if (item.afterField) {
        const otherVal = item.clientField ? client[item.afterField] : client.checklist[item.clSec]?.[item.afterField];
        if (!otherVal) return false;
        return new Date(val) > new Date(otherVal);
      }
      return true;
    }
    case 'assign':     return item.role === 'bcba' ? !!client.bcba_id : !!client.rbt_id;
    case 'bridge':     return !!client.smart_assessment_session_id;
    case 'smart_auto': {
      const session = client.assessment_session;
      if (!session) return false;
      switch (item.key) {
        case 'medical_necessity':       return hasMedicalNecessityContent(session.sections?.medical_necessity);
        case 'skill_targets':           return hasSkillTargetsContent(session);
        case 'behavior_goals':          return hasBehaviorGoalsContent(session);
        case 'intervention_strategies': return hasInterventionStrategiesContent(session);
        case 'caregiver_training':      return hasCaregiverTrainingContent(session.sections?.caregiver_training);
        case 'baseline_graphs':         return sessionHasGraphableContent(session);
        default: return false;
      }
    }
    case 'dated': {
      if (val !== true) return false;
      const dateVal = client.checklist[item.clSec]?.[item.dateKey];
      return getRecentDateStatus(dateVal) === 'current';
    }
    case 'section_label': return true;
    case 'auto': {
      if (item.always)       return true;
      if (item.diagnosisGate) {
        return !client.diagnosis_pending || (!!client.diagnosis?.trim() && !!client.icd10?.trim());
      }
      if (item.planDraftHours) {
        return !!(client.hours_97153 || client.hours_97155 || client.hours_97156);
      }
      if (item.intakeKey) return !!client.checklist?.intake?.[item.intakeKey];
      if (item.sessionKey) {
        const session = client.assessment_session;
        if (!session) return false;
        const bt = session.sections?.behavior_targets;
        switch (item.sessionKey) {
          case 'caregiver_section':   return session.sections?.caregiver_training?.completionState !== 'empty';
          case 'behaviors_section':   return bt?.completionState !== 'empty';
          case 'behaviors_any':       return (bt?.behaviorTargets?.length ?? 0) > 0;
          case 'behaviors_baseline':  return bt?.behaviorTargets?.some(b => b.baselineFrequency) ?? false;
          default: return false;
        }
      }
      if (item.bcbaAuto)  return !!client.bcba_id;
      if (item.rbtCreds)  {
        const r = staff.find(s => s.id === client.rbt_id);
        return !!r && !!(r.cert_number);
      }
      if (item.rbtCert)   {
        const r = staff.find(s => s.id === client.rbt_id);
        return !!r && new Date(r.cert_expiry) > new Date();
      }
      return false;
    }
    default: return false;
  }
}

export function itemBlocks(item, client, staff) {
  if (item.mandatory && !itemComplete(item, client, staff)) return true;
  if (item.type === 'auto' && item.rbtCert) {
    const r = staff.find(s => s.id === client.rbt_id);
    return !!r && new Date(r.cert_expiry) <= new Date();
  }
  return false;
}
