import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell, LabelList,
} from 'recharts';

// Always relative to today — never a hardcoded date
const TODAY = new Date();

const STAGE_LABELS = {
  intake:'Intake', auth_assessment:'Auth', assessment:'Assessment',
  plan_draft:'Plan', submitted:'Submitted', denied:'Denied',
  authorized:'Authorized', staffing:'Staffing', services:'Services',
};

// Per-stage stall threshold in days — how long before a client is considered stuck
const STALL_THRESHOLDS = {
  intake: 7, auth_assessment: 14, assessment: 21,
  plan_draft: 14, submitted: 21, authorized: 14, staffing: 7,
};

const BAR_COLORS = {
  denied:'#EF4444', services:'#10B981', authorized:'#14B8A6',
};
const defaultBarColor = '#6366F1';

export default function MetricsPage({ clients, staff }) {

  /* ── Shared helpers ── */
  const daysAgo  = d => d ? Math.floor((TODAY - new Date(d)) / 86_400_000) : 0;
  const daysUntil = d => d ? Math.ceil((new Date(d) - TODAY) / 86_400_000) : Infinity;

  /* ════════════════════════════════════════
     ROW 1 — Primary summary cards
  ════════════════════════════════════════ */

  // Card 1 — Stalled: clients past per-stage threshold (uses stage_entered_at)
  const stalledClients = clients.filter(c => {
    const threshold = STALL_THRESHOLDS[c.stage];
    if (!threshold) return false;
    const entered = c.stage_entered_at ?? c.referral_date;
    return daysAgo(entered) >= threshold;
  });
  const stalledCount = stalledClients.length;
  const activeCount  = clients.filter(c => c.stage !== 'denied').length;
  const stalledPct   = activeCount > 0 ? Math.round(stalledCount / activeCount * 100) : 0;
  const stalledColor = stalledCount === 0 ? '#059669' : stalledPct <= 20 ? '#D97706' : '#DC2626';

  // Card 2 — Reauth at risk: services + auth_expiry within 30 days
  const reauthRiskCount = clients.filter(c => {
    if (c.stage !== 'services' || !c.auth_expiry_date) return false;
    const d = daysUntil(c.auth_expiry_date);
    return d > 0 && d <= 30;
  }).length;
  const reauthRiskColor = reauthRiskCount === 0 ? '#059669' : '#D97706';

  // Card 3 — Expiring certs (60 days)
  const expiringCertsCount = staff.filter(s => {
    if (!s.cert_expiry) return false;
    const d = daysUntil(s.cert_expiry);
    return d > 0 && d <= 60;
  }).length;
  const certsColor = expiringCertsCount === 0 ? '#059669' : '#D97706';

  // Card 4 — Cert compliance (active staff only)
  const activeStaff   = staff.filter(s => s.status === 'active');
  const validCerts    = activeStaff.filter(s => s.cert_expiry && daysUntil(s.cert_expiry) > 0).length;
  const complianceVal = activeStaff.length > 0
    ? Math.round(validCerts / activeStaff.length * 100) + '%'
    : '—';
  const complianceColor = validCerts === activeStaff.length ? '#059669' : '#D97706';

  // Card 5 — Avg intake → services (computed from real data)
  const svcClients = clients.filter(c =>
    c.stage === 'services' && c.referral_date && c.stage_entered_at
  );
  const avgDays = svcClients.length > 0
    ? Math.round(svcClients.reduce((sum, c) =>
        sum + Math.floor((new Date(c.stage_entered_at) - new Date(c.referral_date)) / 86_400_000), 0
      ) / svcClients.length)
    : null;
  const avgTimeColor = avgDays == null ? '#6B7280'
    : avgDays <= 28 ? '#059669'
    : avgDays <= 42 ? '#D97706'
    : '#DC2626';

  // Card 6 — Caregiver training documented
  const assessmentClients = clients.filter(c => c.stage === 'assessment');
  const caregiverDocCount = assessmentClients.filter(c =>
    c.assessment_session?.sections?.caregiver_training?.approvalState === 'approved'
  ).length;
  const caregiverColor = assessmentClients.length === 0 ? '#6B7280'
    : caregiverDocCount === assessmentClients.length ? '#059669'
    : caregiverDocCount > 0 ? '#D97706'
    : '#DC2626';

  const CARDS_ROW1 = [
    {
      label: 'Stalled cases',
      value: stalledCount,
      sub: 'past per-stage time threshold',
      color: stalledColor,
      targetLabel: stalledPct > 0 ? `${stalledPct}% of active clients` : 'Target: <20% of active',
      testId: 'metric-stalled',
    },
    {
      label: 'Reauth at risk',
      value: reauthRiskCount,
      sub: 'auth expiry ≤30 days',
      color: reauthRiskColor,
      targetLabel: 'Target: 0 missed',
      testId: 'metric-reauth',
    },
    {
      label: 'Expiring certs',
      value: expiringCertsCount,
      sub: 'staff certs expiring ≤60 days',
      color: certsColor,
      targetLabel: 'Target: 0 expired',
      testId: 'metric-certs',
    },
    {
      label: 'Cert compliance',
      value: complianceVal,
      sub: 'active staff with valid cert',
      color: complianceColor,
      targetLabel: 'Target: 100%',
      testId: 'metric-compliance',
    },
    {
      label: 'Avg intake → services',
      value: avgDays != null ? `${avgDays}d` : '—',
      sub: svcClients.length > 0
        ? `across ${svcClients.length} active service client${svcClients.length !== 1 ? 's' : ''}`
        : 'no clients in services yet',
      color: avgTimeColor,
      targetLabel: 'Target: <28 days',
      testId: 'metric-avg-time',
    },
    {
      label: 'Caregiver training',
      value: assessmentClients.length > 0
        ? `${caregiverDocCount} / ${assessmentClients.length}`
        : '—',
      sub: 'assessment clients documented',
      color: caregiverColor,
      targetLabel: 'Target: 100% before submission',
      testId: 'metric-caregiver-training',
    },
  ];

  /* ════════════════════════════════════════
     ROW 2 — Operational alert cards
  ════════════════════════════════════════ */

  // Reauth in progress
  const reauthActiveCount = clients.filter(c =>
    c.stage === 'services' && c.reauth_active === true
  ).length;
  const reauthActiveColor = reauthActiveCount > 0 ? '#D97706' : '#6B7280';

  // Missing BCBA — stages where BCBA assignment is expected
  const bcbaRequiredStages = ['auth_assessment','assessment','plan_draft','submitted','authorized','staffing','services'];
  const missingBcbaCount   = clients.filter(c => bcbaRequiredStages.includes(c.stage) && !c.bcba_id).length;
  const missingBcbaColor   = missingBcbaCount === 0 ? '#059669' : '#DC2626';

  // Missing RBT — staffing and services only
  const missingRbtCount = clients.filter(c =>
    ['staffing','services'].includes(c.stage) && !c.rbt_id
  ).length;
  const missingRbtColor = missingRbtCount === 0 ? '#059669' : '#DC2626';

  // Denial rate — using denial_count field (historical, includes resolved appeals)
  const submissionStages = ['submitted','denied','authorized','staffing','services'];
  const totalSubmissions  = clients.filter(c => submissionStages.includes(c.stage)).length;
  const deniedClients     = clients.filter(c => (c.denial_count ?? 0) > 0).length;
  const denialRatePct     = totalSubmissions > 0
    ? Math.round(deniedClients / totalSubmissions * 100)
    : 0;
  const denialRateColor   = denialRatePct === 0 ? '#059669'
    : denialRatePct <= 15 ? '#D97706'
    : '#DC2626';

  const CARDS_ROW2 = [
    {
      label: 'Reauth in progress',
      value: reauthActiveCount,
      sub: 'services clients in active reauth',
      color: reauthActiveColor,
      targetLabel: 'Track: complete before expiry',
      testId: 'metric-reauth-active',
    },
    {
      label: 'Missing BCBA',
      value: missingBcbaCount,
      sub: 'pipeline clients unassigned',
      color: missingBcbaColor,
      targetLabel: 'Target: 0 unassigned',
      testId: 'metric-missing-bcba',
    },
    {
      label: 'Missing RBT',
      value: missingRbtCount,
      sub: 'staffing / services unassigned',
      color: missingRbtColor,
      targetLabel: 'Target: 0 unassigned',
      testId: 'metric-missing-rbt',
    },
    {
      label: 'Denial rate',
      value: totalSubmissions > 0 ? `${denialRatePct}%` : '—',
      sub: `${deniedClients} of ${totalSubmissions} submitted clients`,
      color: denialRateColor,
      targetLabel: 'Target: <10%',
      testId: 'metric-denial-rate',
    },
  ];

  /* ════════════════════════════════════════
     CHARTS
  ════════════════════════════════════════ */

  // Chart 1 — Clients by pipeline stage
  const stageData = ['intake','auth_assessment','assessment','plan_draft',
    'submitted','denied','authorized','staffing','services'].map(s => ({
    name: STAGE_LABELS[s],
    count: clients.filter(c => c.stage === s).length,
    stage: s,
  }));

  // Chart 2 — Stuck cases by stage
  const stuckData = Object.entries(STALL_THRESHOLDS).map(([stage, threshold]) => ({
    name: STAGE_LABELS[stage],
    stuck: clients.filter(c => {
      if (c.stage !== stage) return false;
      const entered = c.stage_entered_at ?? c.referral_date;
      return daysAgo(entered) >= threshold;
    }).length,
    threshold,
    stage,
  }));

  // Chart 3 — Denials by insurer (cumulative via denial_count)
  const insurerMap = {};
  clients.filter(c => (c.denial_count ?? 0) > 0).forEach(c => {
    insurerMap[c.insurer_name] = (insurerMap[c.insurer_name] || 0) + (c.denial_count ?? 1);
  });
  const denialData = Object.entries(insurerMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Chart 4 — Cert expiry timeline (18-month rolling from today)
  const certData = [];
  for (let i = 0; i <= 17; i++) {
    const d = new Date(TODAY);
    d.setMonth(d.getMonth() + i);
    const monthKey = d.toISOString().slice(0, 7);
    const label    = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const count    = staff.filter(s =>
      s.status === 'active' && s.cert_expiry && s.cert_expiry.slice(0, 7) === monthKey
    ).length;
    certData.push({ label, count, monthKey });
  }

  /* ── Tooltips ── */
  const StageTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs shadow-lg">
        <span className="font-semibold text-slate-800">{payload[0].payload.name}</span>
        <span className="text-slate-500 ml-1">· {payload[0].value} client{payload[0].value !== 1 ? 's' : ''}</span>
      </div>
    );
  };

  const StuckTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, stuck, threshold } = payload[0].payload;
    return (
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs shadow-lg">
        <span className="font-semibold text-slate-800">{name}</span>
        <span className="text-slate-500 ml-1">· {stuck} stuck (&gt;{threshold}d)</span>
      </div>
    );
  };

  const CertTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs shadow-lg">
        <span className="font-semibold text-slate-800">{payload[0].payload.label}</span>
        <span className="text-slate-500 ml-1">· {payload[0].value} expiration{payload[0].value !== 1 ? 's' : ''}</span>
      </div>
    );
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div data-testid="metrics-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
          Metrics
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Operational overview · updated in real time</p>
      </div>

      {/* Row 1 — Primary summary cards */}
      <div className="flex items-stretch gap-0 bg-white rounded-xl border border-stone-200 divide-x divide-stone-100 overflow-hidden">
        {CARDS_ROW1.map(card => (
          <div key={card.testId} data-testid={card.testId}
            className="flex-1 flex items-center justify-center gap-3 px-5 py-3.5">
            <span className="text-2xl font-bold leading-none flex-shrink-0"
              style={{ color: card.color, fontFamily: 'Syne, sans-serif' }}>
              {card.value}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700 leading-tight">{card.label}</div>
              <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{card.sub}</div>
              <div className="text-[10px] leading-tight mt-0.5" style={{ color: card.color }}>{card.targetLabel}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2 — Operational alert cards */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-5 mb-2">Operational Alerts</p>
      <div className="flex items-stretch gap-0 bg-white rounded-xl border border-stone-200 divide-x divide-stone-100 overflow-hidden">
        {CARDS_ROW2.map(card => (
          <div key={card.testId} data-testid={card.testId}
            className="flex-1 flex items-center justify-center gap-3 px-5 py-3.5">
            <span className="text-2xl font-bold leading-none flex-shrink-0"
              style={{ color: card.color, fontFamily: 'Syne, sans-serif' }}>
              {card.value}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700 leading-tight">{card.label}</div>
              <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{card.sub}</div>
              <div className="text-[10px] leading-tight mt-0.5" style={{ color: card.color }}>{card.targetLabel}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts — 2×2 grid */}
      <div className="grid grid-cols-2 gap-5 mt-6">

        {/* Chart 1 — Clients by pipeline stage */}
        <div data-testid="chart-by-stage" className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-0.5" style={{ fontFamily: 'Syne, sans-serif' }}>
            Clients by pipeline stage
          </h2>
          <p className="text-xs text-slate-400 mb-4">Current distribution across all 9 stages</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageData} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
              <Tooltip content={<StageTooltip/>} cursor={{ fill: '#F8F7F4' }}/>
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stageData.map(entry => (
                  <Cell key={entry.stage} fill={BAR_COLORS[entry.stage] || defaultBarColor}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2 — Stuck cases by stage */}
        <div data-testid="chart-stuck" className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-0.5" style={{ fontFamily: 'Syne, sans-serif' }}>
            Stuck cases by stage
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Clients past threshold · Intake 7d · Auth 14d · Assessment 21d · Plan 14d · Submitted 21d
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stuckData} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
              <Tooltip content={<StuckTooltip/>} cursor={{ fill: '#FFF7ED' }}/>
              <Bar dataKey="stuck" radius={[4, 4, 0, 0]}>
                {stuckData.map(entry => (
                  <Cell key={entry.stage} fill={entry.stuck > 0 ? '#F97316' : '#E2E8F0'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3 — Denials by insurer (cumulative) */}
        <div data-testid="chart-denials" className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-0.5" style={{ fontFamily: 'Syne, sans-serif' }}>
            Denials by insurer
          </h2>
          <p className="text-xs text-slate-400 mb-4">Cumulative denials across all clients (including resolved appeals)</p>
          {denialData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm font-medium text-emerald-600">
              No denials on record ✓
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={denialData} margin={{ top: 20, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                <Tooltip cursor={{ fill: '#FEF2F2' }}/>
                <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#991B1B' }}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 4 — Certification expiry timeline */}
        <div data-testid="chart-cert-timeline" className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-0.5" style={{ fontFamily: 'Syne, sans-serif' }}>
            Certification expiry timeline
          </h2>
          <p className="text-xs text-slate-400 mb-4">Active staff cert expirations over the next 18 months</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={certData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2}/>
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
              <Tooltip content={<CertTooltip/>} cursor={{ stroke: '#E2E8F0' }}/>
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0D9488"
                strokeWidth={2}
                dot={{ fill: '#0D9488', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#0D9488' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
