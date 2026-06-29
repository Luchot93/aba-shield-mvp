import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SEED_CLIENTS, SEED_STAFF, makeAssessmentSession, makeReassessmentSession } from './constants/seedData.js';
import { mkNotif } from './utils/notifications.js';
import FontLoader from './components/FontLoader.jsx';
import NavBar from './components/NavBar.jsx';
import PipelinePage from './features/pipeline/PipelinePage.jsx';
import ClientsPage from './features/clients/ClientsPage.jsx';
import StaffPage from './features/staff/StaffPage.jsx';
import ClientDetailPage from './features/detail/ClientDetailPage.jsx';
import MetricsPage from './features/metrics/MetricsPage.jsx';
import AssessmentsPage from './features/assessment/AssessmentsPage.jsx';
import AssessmentFeature from './features/assessment/AssessmentFeature.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoginPage from './auth/LoginPage.jsx';
import SetPasswordPage from './auth/SetPasswordPage.jsx';
import ClientProfilePanel from './features/clients/components/ClientProfilePanel.jsx';
import { FLAGS } from './constants/featureFlags.js';

export default function App() {
  const [page,            setPage]           = useState('clients');
  const [clients,         setClients]        = useState(SEED_CLIENTS);
  const [staff,           setStaff]          = useState(SEED_STAFF);
  const [notifications,   setNotifications]  = useState([]);
  const [selectedClient,         setSelectedClient]        = useState(null);
  const [selectedClientInitTab,  setSelectedClientInitTab] = useState(null);
  const [recentlyMovedId, setRecentlyMovedId]= useState(null);
  const [assessmentClientId, setAssessmentClientId] = useState(null);
  const [profileClient,      setProfileClient]     = useState(null);

  // ── Assessment navigation ──────────────────────────────────────────────────
  //
  // handleOpenAssessment({ type, clientId })
  //
  // type === 'initial'      — existing path: create session if needed, open AssessmentFeature
  // type === 'reassessment' — swap the active reassessment session into client.assessment_session
  //                           so all existing patchSession calls work without changes.
  //                           On close/complete, AssessmentFeature un-swaps it back.
  //
  // Reassessment session priority:
  //   1. client.assessment_session already has sessionType==='reassessment' → just navigate
  //   2. client.reassessment_sessions has a non-complete entry → swap it in
  //   3. None found → call makeReassessmentSession, swap it in

  const handleOpenAssessment = useCallback((arg) => {
    const cId  = (arg && typeof arg === 'object') ? arg.clientId : arg;
    const client = clients.find(c => c.id === cId);
    if (!client) return;

    // Initial assessment only
    setClients(prev => prev.map(c => {
      if (c.id !== cId || c.assessment_session != null) return c;
      const bcba = SEED_STAFF().find(s => s.id === c.bcba_id);
      return { ...c, assessment_session: makeAssessmentSession(c.id, c.name, c.bcba_id, bcba?.name ?? 'Unassigned', c) };
    }));
    setAssessmentClientId(cId);
    setPage('assessment');
  }, [clients, setClients]);

  const [currentUser, setCurrentUser] = useState(null);

  const handleClientAdvanced = useCallback(clientId => {
    setRecentlyMovedId(clientId);
    setTimeout(() => setRecentlyMovedId(null), 600);
  }, []);

  const addNotif = useCallback(notif => {
    setNotifications(prev => [notif, ...prev]);
  }, [setNotifications]);

  // Seed notifications on mount based on client auth expiry and staff cert expiry
  useEffect(() => {
    if (!FLAGS.PIPELINE) return;
    const today = new Date('2026-05-14');
    const seedNotifs = [];

    SEED_CLIENTS().forEach(c => {
      if (!c.auth_expiry_date) return;
      const diff = Math.ceil((new Date(c.auth_expiry_date) - today) / 86400000);
      if (diff <= 0) {
        seedNotifs.push(mkNotif(`URGENT — ${c.name} authorization expired ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} ago`, c.name, 'urgent'));
      } else if (diff <= 14) {
        seedNotifs.push(mkNotif(`URGENT — ${c.name} reauthorization due in ${diff} day${diff !== 1 ? 's' : ''}`, c.name, 'urgent'));
      } else if (diff <= 30) {
        seedNotifs.push(mkNotif(`${c.name} — Reauthorization due in ${diff} days`, c.name, 'warning'));
      }
    });

    SEED_STAFF().forEach(s => {
      if (!s.cert_expiry) return;
      const diff = Math.ceil((new Date(s.cert_expiry) - today) / 86400000);
      if (diff > 0 && diff <= 60) {
        seedNotifs.push(mkNotif(`${s.name} certification expiring soon`, '', 'warning'));
      }
    });

    if (seedNotifs.length > 0) {
      setNotifications(seedNotifs);
    }
  }, []);

  // Auto-create assessment sessions for assessment-stage clients that don't have one yet
  useEffect(() => {
    setClients(prev => prev.map(c => {
      if (c.stage === 'assessment' && c.assessment_session == null) {
        const bcba = SEED_STAFF().find(s => s.id === c.bcba_id);
        return { ...c, assessment_session: makeAssessmentSession(c.id, c.name, c.bcba_id, bcba?.name ?? 'Unassigned', c) };
      }
      return c;
    }));
  }, []);

  const enrichedStaff = staff.map(s => ({
    ...s,
    active_case_count: clients.filter(c => c.bcba_id===s.id || c.rbt_id===s.id).length,
  }));

  if (!currentUser) {
    const isInvite = new URLSearchParams(window.location.search).get('invite') === 'true';
    return (
      <>
        <FontLoader/>
        {isInvite
          ? <SetPasswordPage
              invitedEmail="sara@abashield.com"
              onSetPassword={() => {
                // Clear the query param and log the invited user in to Pipeline
                window.history.replaceState({}, '', window.location.pathname);
                setCurrentUser({ id:'u3', name:'Dr. Sara Kim', email:'sara@abashield.com', role:'bcaba' });
              }}
            />
          : <LoginPage onLogin={setCurrentUser}/>
        }
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ background:'#F8F7F4', fontFamily:'DM Sans, sans-serif' }}>
      <FontLoader/>
      <NavBar page={page} setPage={setPage} notifications={notifications} setNotifications={setNotifications} currentUser={currentUser} setCurrentUser={setCurrentUser}/>

      {FLAGS.PIPELINE && page === 'pipeline' && (
        <PipelinePage
          clients={clients}
          staff={enrichedStaff}
          setClients={setClients}
          setSelectedClient={c => setSelectedClient(c)}
          currentUser={currentUser}
          addNotif={addNotif}
          onClientAdvanced={handleClientAdvanced}
          recentlyMovedId={recentlyMovedId}
        />
      )}

      {page !== 'pipeline' && (
        <main className="max-w-7xl mx-auto px-6 py-8">
          {page==='clients'     && <ClientsPage clients={clients} staff={enrichedStaff} setClients={setClients} setSelectedClient={c => setProfileClient(c)} currentUser={currentUser}/>}
          {FLAGS.STAFF && page==='staff' && <StaffPage staff={staff} setStaff={setStaff} clients={clients} currentUser={currentUser}
                                    onSelectClient={c => setProfileClient(c)}/>}
          {FLAGS.METRICS && page==='metrics' && (
            currentUser.role === 'admin'
              ? <MetricsPage clients={clients} staff={staff}/>
              : <div className="flex items-center justify-center h-64 text-sm text-slate-500">Access restricted</div>
          )}
          {page==='assessments' && (
            <AssessmentsPage clients={clients} staff={enrichedStaff} currentUser={currentUser}
              onOpenAssessment={handleOpenAssessment} />
          )}
        </main>
      )}

      {page === 'assessment' && assessmentClientId && (
        <ErrorBoundary label="Assessment">
          <AssessmentFeature
            clientId={assessmentClientId}
            clients={clients}
            staff={enrichedStaff}
            setClients={setClients}
            currentUser={currentUser}
            addNotif={addNotif}
            onBack={() => { setPage('assessments'); setAssessmentClientId(null); }}
            onReassessmentComplete={(clientId) => {
              // After reassessment doc is generated: go back to client detail page, Reassessment tab
              setAssessmentClientId(null);
              setPage('pipeline');
              setSelectedClientInitTab('reassessment');
              setSelectedClient(clients.find(c => c.id === clientId) ?? null);
            }}
          />
        </ErrorBoundary>
      )}

      {profileClient && (
        <ClientProfilePanel
          client={clients.find(c => c.id === profileClient.id) ?? profileClient}
          staff={enrichedStaff}
          onClose={() => setProfileClient(null)}
          onOpenPipeline={profileClient.pipeline_entry ? () => {
            setProfileClient(null);
            setSelectedClient(profileClient);
          } : null}
          onAddToPipeline={!profileClient.pipeline_entry ? () => {
            setClients(prev => prev.map(c =>
              c.id === profileClient.id
                ? {
                    stage: null, stage_entered_at: null, auth_expiry_date: null,
                    reauth_cycle: 0, pipeline_entry: false, bcba_id: null, rbt_id: null,
                    service_session_logs: [], reassessment_sessions: [],
                    caregiver_training_session_logs: [],
                    ...c,
                    pipeline_entry: true,
                    stage: 'intake',
                    stage_entered_at: new Date().toISOString(),
                  }
                : c
            ));
            setProfileClient(null);
          } : null}
        />
      )}

      {FLAGS.PIPELINE && selectedClient && (
        <ClientDetailPage
          clientId={selectedClient.id}
          clients={clients}
          staff={enrichedStaff}
          setClients={setClients}
          onBack={() => { setSelectedClient(null); setSelectedClientInitTab(null); }}
          backLabel="Back to pipeline"
          currentUser={currentUser}
          addNotif={addNotif}
          onClientAdvanced={handleClientAdvanced}
          initialServicesTab={selectedClientInitTab}
          onOpenAssessment={(arg) => {
            setSelectedClient(null);
            setSelectedClientInitTab(null);
            handleOpenAssessment(arg); // handleOpenAssessment normalises string or object
          }}
        />
      )}
    </div>
  );
}
