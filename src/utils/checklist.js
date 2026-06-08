import { getStageItems } from '../constants/checklist.js';

export function getChecklistStatus(client, staff = []) {
  const items = getStageItems(client.stage);
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
  const val = client.checklist[item.clSec]?.[item.key];
  switch (item.type) {
    case 'checkbox': case 'upload': case 'file_upload': return val === true;
    case 'form_field': if (item.optional) return true; return typeof val === 'string' ? val.trim() !== '' : (val !== '' && val != null);
    case 'assign':     return item.role === 'bcba' ? !!client.bcba_id : !!client.rbt_id;
    case 'bridge':     return !!client.smart_assessment_session_id;
    case 'smart_auto': return !!client.smart_assessment_session_id;
    case 'dated':      return val === true;
    case 'section_label': return true;
    case 'auto': {
      if (item.always)       return true;
      if (item.planDraftHours) {
        const pd = client.checklist?.plan_draft;
        return !!(pd?.hours_97153 || pd?.hours_97155 || pd?.hours_97156);
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
