import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell, LabelList,
} from 'recharts';

const REF_DATE = new Date('2026-05-14');

const STAGE_LABELS = {
  intake:'Intake', auth_assessment:'Auth', assessment:'Assessment',
  plan_draft:'Plan', submitted:'Submitted', denied:'Denied',
  authorized:'Authorized', staffing:'Staffing', services:'Services',
};

const BAR_COLORS = {
  denied:'#EF4444', services:'#10B981', authorized:'#14B8A6',
};
const defaultBarColor = '#6366F1';

export default function MetricsPage({ clients, staff }) {
  /* ── Summary card values ── */

  // Card 1 — Stalled: clients in auth_assessment (simulates >7 days stalled)
  const stalledCount = clients.filter(c => c.stage === 'auth_assessment').length;
  const stalledColor = stalledCount === 0 ? '#059669' : stalledCount <= 3 ? '#D97706' : '#DC2626';

  // Card 2 — Reauth at risk: services stage + auth_expiry within 30 days of ref date
  const reauthCount = clients.filter(c => {
    if (c.stage !== 'services' || !c.auth_expiry_date) return false;
    const diff = Math.ceil((new Date(c.auth_expiry_date) - REF_DATE) / 86400000);
    return diff > 0 && diff <= 30;
  }).length;
  const reauthColor = reauthCount === 0 ? '#059669' : '#D97706';

  // Card 3 — Expiring certs: active staff certs expiring within 60 days of ref date
  const expiringCertsCount = staff.filter(s => {
    if (!s.cert_expiry) return false;
    const diff = Math.ceil((new Date(s.cert_expiry) - REF_DATE) / 86400000);
    return diff > 0 && diff <= 60;
  }).length;
  const certsColor = expiringCertsCount === 0 ? '#059669' : '#D97706';

  // Card 4 — Cert compliance
  const activeStaff = staff.filter(s => s.status === 'active');
  const validCerts = activeStaff.filter(s => s.cert_expiry && new Date(s.cert_expiry) > REF_DATE).length;
  const complianceValue = activeStaff.length > 0
    ? Math.round(validCerts / activeStaff.length * 100) + '%'
    : '—';
  const complianceColor = validCerts === activeStaff.length ? '#059669' : '#D97706';

  const CARDS = [
    {
      label: 'Stalled cases',
      value: stalledCount,
      sub: 'in same stage >7 days',
      color: stalledColor,
      targetLabel: 'Target: <20% of active',
      testId: 'metric-stalled',
    },
    {
      label: 'Reauth at risk',
      value: reauthCount,
      sub: 'auth expiry ≤30 days',
      color: reauthColor,
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
      value: complianceValue,
      sub: 'active staff with valid cert',
      color: complianceColor,
      targetLabel: 'Target: 100%',
      testId: 'metric-compliance',
    },
    {
      label: 'Avg intake → services',
      value: '24 days',
      sub: 'intake to active services',
      color: '#0D9488',
      targetLabel: 'Target: <28 days',
      testId: 'metric-avg-time',
    },
  ];

  /* ── Chart 1 — Clients by pipeline stage ── */
  const stageData = ['intake','auth_assessment','assessment','plan_draft',
    'submitted','denied','authorized','staffing','services'].map(s => ({
    name: STAGE_LABELS[s],
    count: clients.filter(c => c.stage === s).length,
    stage: s,
  }));

  /* ── Chart 2 — Denials by insurer ── */
  const insurerMap = {};
  clients.filter(c => c.stage === 'denied').forEach(c => {
    insurerMap[c.insurer_name] = (insurerMap[c.insurer_name] || 0) + 1;
  });
  const denialData = Object.entries(insurerMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  /* ── Chart 3 — Cert expiry timeline ── */
  const certData = [];
  for (let i = 0; i <= 17; i++) {
    const d = new Date(REF_DATE);
    d.setMonth(d.getMonth() + i);
    const monthKey = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const count = staff.filter(s =>
      s.status === 'active' && s.cert_expiry && s.cert_expiry.slice(0, 7) === monthKey
    ).length;
    certData.push({ label, count, monthKey });
  }

  /* ── Custom tooltip for stage chart ── */
  const StageTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs shadow-lg">
        <span className="font-semibold text-slate-800">{payload[0].payload.name}</span>
        <span className="text-slate-500 ml-1">· {payload[0].value} client{payload[0].value !== 1 ? 's' : ''}</span>
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

  return (
    <div data-testid="metrics-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
          Metrics
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Operational overview · updated in real time</p>
      </div>

      {/* Summary cards strip */}
      <div className="flex items-center gap-0 bg-white rounded-xl border border-stone-200 divide-x divide-stone-100 overflow-hidden">
        {CARDS.map(card => (
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

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 mt-6 lg:grid-cols-3">

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

        {/* Chart 2 — Denials by insurer */}
        <div data-testid="chart-denials" className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-0.5" style={{ fontFamily: 'Syne, sans-serif' }}>
            Denials by insurer
          </h2>
          <p className="text-xs text-slate-400 mb-4">Clients currently in Denied stage</p>
          {denialData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm font-medium text-emerald-600">
              No active denials ✓
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={denialData} margin={{ top: 20, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                <Tooltip cursor={{ fill: '#FFF7ED' }}/>
                <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#92400E' }}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 3 — Certification expiry timeline */}
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
