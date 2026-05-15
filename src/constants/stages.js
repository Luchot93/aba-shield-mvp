export const STAGES = [
  'intake','auth_assessment','assessment','plan_draft',
  'submitted','denied','authorized','staffing','services',
];

// Stage pill metadata (used by StagePill and other places)
export const SM = {
  intake:          { label:'Intake',          bg:'#F1F5F9', dot:'#94A3B8',  pill:'bg-slate-100 text-slate-600 border-slate-200'     },
  auth_assessment: { label:'Auth Assessment', bg:'#F5F3FF', dot:'#8B5CF6',  pill:'bg-violet-50 text-violet-700 border-violet-200'    },
  assessment:      { label:'Assessment',      bg:'#EFF6FF', dot:'#3B82F6',  pill:'bg-blue-50 text-blue-700 border-blue-200'          },
  plan_draft:      { label:'Plan Draft',      bg:'#F0F9FF', dot:'#0EA5E9',  pill:'bg-sky-50 text-sky-700 border-sky-200'             },
  submitted:       { label:'Submitted',       bg:'#FFFBEB', dot:'#F59E0B',  pill:'bg-amber-50 text-amber-700 border-amber-200'       },
  denied:          { label:'Denied',          bg:'#FEF2F2', dot:'#EF4444',  pill:'bg-red-50 text-red-700 border-red-200'             },
  authorized:      { label:'Authorized',      bg:'#F0FDFA', dot:'#14B8A6',  pill:'bg-teal-50 text-teal-700 border-teal-200'          },
  staffing:        { label:'Staffing',        bg:'#FFF7ED', dot:'#F97316',  pill:'bg-orange-50 text-orange-700 border-orange-200'    },
  services:        { label:'In Services',     bg:'#F0FDF4', dot:'#22C55E',  pill:'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// Kanban column header appearance per spec
export const KM = {
  intake:          { label:'Intake',      hdr:'bg-purple-100 text-purple-800', colBg:'bg-purple-50/40' },
  auth_assessment: { label:'Auth 97151',  hdr:'bg-amber-100 text-amber-800',   colBg:'bg-amber-50/40'  },
  assessment:      { label:'Assessment',  hdr:'bg-blue-100 text-blue-800',     colBg:'bg-blue-50/40'   },
  plan_draft:      { label:'Plan Draft',  hdr:'bg-blue-100 text-blue-800',     colBg:'bg-blue-50/40'   },
  submitted:       { label:'Submitted',   hdr:'bg-amber-100 text-amber-800',   colBg:'bg-amber-50/40'  },
  denied:          { label:'Denied',      hdr:'bg-red-100 text-red-800',       colBg:'bg-red-50/30'    },
  authorized:      { label:'Authorized',  hdr:'bg-green-100 text-green-800',   colBg:'bg-green-50/40'  },
  staffing:        { label:'Staffing',    hdr:'bg-green-100 text-green-800',   colBg:'bg-green-50/40'  },
  services:        { label:'Services',    hdr:'bg-teal-100 text-teal-800',     colBg:'bg-teal-50/40'   },
};

// Which checklist section to evaluate per stage
export const STAGE_CL_KEY = {
  intake:'intake', auth_assessment:'auth_assessment', assessment:'assessment',
  plan_draft:'plan_draft', submitted:'submitted', denied:'denied',
  authorized:'authorized', staffing:'staffing', services:'services_reauth',
};

export const NEXT_STAGE = {
  intake:'auth_assessment', auth_assessment:'assessment', assessment:'plan_draft',
  plan_draft:'submitted', submitted:'authorized', authorized:'staffing', staffing:'services',
};
