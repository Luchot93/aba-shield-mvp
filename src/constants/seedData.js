import { mkChecklist } from './checklist.js';

export const SEED_CLIENTS = () => [
  { id:'c1',  name:'Liam Rodriguez',  dob:'2018-03-15', phone:'(786) 555-0121', address:'1432 SW 8th St, Miami, FL 33135',          insurer_name:'Aetna',        member_id:'AET-884421', group_number:'G-44210', referring_provider:'Dr. Maria Santos',  source:'imported',    referral_date:'2026-04-10', stage:'intake',          denial_reason:null,                         bcba_id:null, rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c2',  name:'Sophia Kim',      dob:'2019-07-22', phone:'(305) 555-0198', address:'7821 N Kendall Dr, Miami, FL 33156',        insurer_name:'UnitedHealth', member_id:'UHC-229934', group_number:'G-77811', referring_provider:'Dr. John Park',      source:'crm_created', referral_date:'2026-04-15', stage:'intake',          denial_reason:null,                         bcba_id:null, rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c3',  name:'Noah Carter',     dob:'2017-11-08', phone:'(954) 555-0143', address:'3201 Coral Way, Coral Gables, FL 33134',   insurer_name:'Florida Blue', member_id:'FLB-558871', group_number:'G-12390', referring_provider:'Dr. Elaine Torres',  source:'imported',    referral_date:'2026-03-28', stage:'auth_assessment', denial_reason:null,                         bcba_id:null, rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c4',  name:'Emma Thompson',   dob:'2020-01-30', phone:'(561) 555-0167', address:'9400 Glades Rd, Boca Raton, FL 33434',     insurer_name:'Humana',       member_id:'HUM-334490', group_number:'G-98712', referring_provider:'Dr. Robert Chen',    source:'crm_created', referral_date:'2026-04-02', stage:'assessment',      denial_reason:null,                         bcba_id:'s1', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c5',  name:'Oliver Patel',    dob:'2018-06-12', phone:'(786) 555-0134', address:'2100 Biscayne Blvd, Miami, FL 33137',      insurer_name:'Cigna',        member_id:'CIG-778823', group_number:'G-55023', referring_provider:'Dr. Ana Flores',     source:'imported',    referral_date:'2026-03-15', stage:'plan_draft',      denial_reason:null,                         bcba_id:'s1', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c6',  name:'Ava Nguyen',      dob:'2019-09-05', phone:'(305) 555-0189', address:'5540 NW 7th Ave, Miami, FL 33127',         insurer_name:'Aetna',        member_id:'AET-991102', group_number:'G-44210', referring_provider:'Dr. Luis Mendez',    source:'crm_created', referral_date:'2026-02-28', stage:'submitted',       denial_reason:null,                         bcba_id:'s2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c7',  name:'Ethan Williams',  dob:'2017-04-18', phone:'(954) 555-0156', address:'800 E Broward Blvd, Ft. Lauderdale, FL',   insurer_name:'Florida Blue', member_id:'FLB-447721', group_number:'G-12390', referring_provider:'Dr. Sarah Johnson',  source:'imported',    referral_date:'2026-02-10', stage:'denied',          denial_reason:'Medical necessity not established', bcba_id:'s2', rbt_id:null, auth_expiry_date:null,        reauth_active:false },
  { id:'c8',  name:'Isabella Moore',  dob:'2018-12-25', phone:'(786) 555-0177', address:'6100 SW 57th Ave, South Miami, FL 33143',  insurer_name:'UnitedHealth', member_id:'UHC-883312', group_number:'G-77811', referring_provider:'Dr. Mark Davis',     source:'crm_created', referral_date:'2026-01-20', stage:'authorized',      denial_reason:null,                         bcba_id:'s3', rbt_id:null, auth_expiry_date:'2026-12-31', reauth_active:false },
  { id:'c9',  name:'Mason Garcia',    dob:'2019-03-14', phone:'(305) 555-0145', address:'11200 SW 8th St, Miami, FL 33174',         insurer_name:'Humana',       member_id:'HUM-229908', group_number:'G-98712', referring_provider:'Dr. Patricia Lee',   source:'imported',    referral_date:'2026-01-05', stage:'staffing',        denial_reason:null,                         bcba_id:'s3', rbt_id:'s5', auth_expiry_date:'2026-12-15', reauth_active:false },
  { id:'c10', name:'Charlotte Davis', dob:'2018-08-22', phone:'(561) 555-0122', address:'3400 PGA Blvd, Palm Beach Gardens, FL',    insurer_name:'Cigna',        member_id:'CIG-556634', group_number:'G-55023', referring_provider:'Dr. James Wilson',   source:'crm_created', referral_date:'2025-11-12', stage:'services',        denial_reason:null,                         bcba_id:'s4', rbt_id:'s6', auth_expiry_date:'2026-05-27', reauth_active:true  },
  { id:'c11', name:'James Martinez',  dob:'2017-05-30', phone:'(786) 555-0190', address:'1800 Coral Way, Miami, FL 33145',          insurer_name:'Aetna',        member_id:'AET-664433', group_number:'G-44210', referring_provider:'Dr. Angela Rivera',  source:'imported',    referral_date:'2025-10-08', stage:'services',        denial_reason:null,                         bcba_id:'s1', rbt_id:'s7', auth_expiry_date:'2026-05-20', reauth_active:true  },
  { id:'c12', name:'Amelia Wilson',   dob:'2020-02-14', phone:'(954) 555-0133', address:'2800 Hollywood Blvd, Hollywood, FL 33020', insurer_name:'Florida Blue', member_id:'FLB-112298', group_number:'G-12390', referring_provider:'Dr. Kevin Brown',    source:'crm_created', referral_date:'2026-03-01', stage:'auth_assessment', denial_reason:null,                         bcba_id:null, rbt_id:null, auth_expiry_date:null,        reauth_active:false },
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
    c9: [
      { id:'n9b', text:'RBT confirmed availability for 3x/week sessions starting next Monday. Parent agreed to morning slot.', author:'Tanya Reyes', timestamp:'2026-05-18T09:15:00Z' },
      { id:'n9a', text:'Called caregiver, left voicemail re: schedule change for upcoming assessment week.', author:'Dr. Priya Sharma', timestamp:'2026-05-15T14:32:00Z' },
    ],
    c10: [
      { id:'n10b', text:'Reauth paperwork submitted to Cigna. Expect decision within 10 business days per rep.', author:'Jordan Ellis', timestamp:'2026-05-19T11:05:00Z' },
      { id:'n10a', text:'Family reported positive progress with self-regulation goals this month. Updated behavior plan accordingly.', author:'Jordan Ellis', timestamp:'2026-05-12T16:45:00Z' },
    ],
    c11: [
      { id:'n11a', text:'Discussed session frequency reduction with caregiver — agreed to move from 5x to 4x/week pending reauth approval.', author:'Dr. Rachel Kim', timestamp:'2026-05-17T10:20:00Z' },
    ],
  };

  return { ...c, pipeline_entry:true, smart_assessment_session_id:null, checklist:cl, documents:[], activity_log:[], case_notes: SEED_NOTES[c.id] || [] };
});

export const SEED_STAFF = () => [
  { id:'s1',  name:'Dr. Rachel Kim',   initials:'RK', email:'r.kim@abashield.com',    phone:'(555) 201-0034', role:'bcba', cert_number:'BCBA-112233', cert_expiry:'2027-06-30', status:'active'  },
  { id:'s2',  name:'Marcus Webb',      initials:'MW', email:'m.webb@abashield.com',   phone:'(555) 304-0187', role:'bcba', cert_number:'BCBA-445566', cert_expiry:'2026-11-15', status:'active'  },
  { id:'s3',  name:'Dr. Priya Sharma', initials:'PS', email:'p.sharma@abashield.com', phone:'(555) 407-0256', role:'bcba', cert_number:'BCBA-778899', cert_expiry:'2027-03-31', status:'active'  },
  { id:'s4',  name:'Jordan Ellis',     initials:'JE', email:'j.ellis@abashield.com',  phone:'(555) 512-0093', role:'bcba', cert_number:'BCBA-334455', cert_expiry:'2026-06-20', status:'active'  },
  { id:'s5',  name:'Tanya Reyes',      initials:'TR', email:'t.reyes@abashield.com',  phone:'(555) 618-0342', role:'rbt',  cert_number:'RBT-881122',  cert_expiry:'2026-12-31', status:'active'  },
  { id:'s6',  name:'Devon Clark',      initials:'DC', email:'d.clark@abashield.com',  phone:'(555) 720-0165', role:'rbt',  cert_number:'RBT-334455',  cert_expiry:'2026-10-15', status:'active'  },
  { id:'s7',  name:'Aaliyah Foster',   initials:'AF', email:'a.foster@abashield.com', phone:'(555) 823-0471', role:'rbt',  cert_number:'RBT-667788',  cert_expiry:'2027-01-28', status:'active'  },
  { id:'s8',  name:'Carlos Mendez',    initials:'CM', email:'c.mendez@abashield.com', phone:'(555) 916-0088', role:'rbt',  cert_number:'RBT-990011',  cert_expiry:'2026-08-10', status:'active'  },
  { id:'s9',  name:'Yuki Tanaka',      initials:'YT', email:'y.tanaka@abashield.com', phone:'(555) 103-0529', role:'rbt',  cert_number:'RBT-223344',  cert_expiry:'2027-04-22', status:'pending' },
  { id:'s10', name:'Brianna Stone',    initials:'BS', email:'b.stone@abashield.com',  phone:'(555) 205-0617', role:'rbt',  cert_number:'RBT-556677',  cert_expiry:'2026-07-05', status:'pending' },
];
