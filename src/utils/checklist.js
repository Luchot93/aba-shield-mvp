import { STAGE_CL_KEY } from '../constants/stages.js';

export function getChecklistStatus(client) {
  const key = STAGE_CL_KEY[client.stage];
  const cl  = key ? client.checklist[key] : null;
  if (!cl) return null;

  const bools   = Object.entries(cl).filter(([, v]) => typeof v === 'boolean');
  const missing = bools.filter(([, v]) => !v).length;
  if (bools.length === 0) return null;

  // Day-X waiting for auth_assessment and submitted (>7 days since referral)
  if (['auth_assessment','submitted'].includes(client.stage) && missing > 0) {
    const days = Math.floor((Date.now() - new Date(client.referral_date)) / 86400000);
    if (days > 7) return { type:'waiting', days };
  }

  if (missing === 0) return { type:'ready' };
  return { type:'missing', count:missing };
}

export function itemComplete(item, client, staff) {
  const val = client.checklist[item.clSec]?.[item.key];
  switch (item.type) {
    case 'checkbox': case 'upload': return val === true;
    case 'form_field': return typeof val === 'string' ? val.trim() !== '' : (val !== '' && val != null);
    case 'assign':     return item.role === 'bcba' ? !!client.bcba_id : !!client.rbt_id;
    case 'bridge':     return !!client.smart_assessment_session_id;
    case 'smart_auto': return !!client.smart_assessment_session_id;
    case 'dated':      return val === true;
    case 'auto': {
      if (item.always)   return true;
      if (item.bcbaAuto) return !!client.bcba_id;
      if (item.rbtCreds) return !!client.rbt_id;
      if (item.rbtCert)  {
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
