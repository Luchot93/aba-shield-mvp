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

export default function App() {
  const [page,            setPage]           = useState('pipeline');
  const [clients,         setClients]        = useState(SEED_CLIENTS);
  const [staff,           setStaff]          = useState(SEED_STAFF);
  const [notifications,   setNotifications]  = useState([]);
  const [selectedClient,  setSelectedClient] = useState(null);
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
    const type = (arg && typeof arg === 'object') ? (arg.type ?? 'initial') : 'initial';
    const cId  = (arg && typeof arg === 'object') ? arg.clientId : arg;
    const client = clients.find(c => c.id === cId);
    if (!client) return;

    if (type === 'reassessment') {
      // 1. Already swapped in from a previous open
      if (client.assessment_session?.sessionType === 'reassessment' &&
          client.assessment_session?.status !== 'complete') {
        setAssessmentClientId(cId);
        setPage('assessment');
        return;
      }

      // 2. Check archived sessions for an in-progress entry
      const inProgress = (client.reassessment_sessions ?? []).find(s => s.status !== 'complete');

      if (inProgress) {
        setClients(prev => prev.map(c => {
          if (c.id !== cId) return c;
          return {
            ...c,
            _initialAssessment: c.assessment_session,
            assessment_session: inProgress,
          };
        }));
      } else {
        // 3. Create a new reassessment session from the initial assessment + session logs
        const authEnd   = client.auth_expiry_date ?? null;
        const authStart = authEnd
          ? new Date(new Date(authEnd).setMonth(new Date(authEnd).getMonth() - 6))
              .toISOString().slice(0, 10)
          : null;
        const newSession = makeReassessmentSession(
          client,
          client.assessment_session,
          client.service_session_logs ?? [],
          authStart,
          authEnd,
        );
        setClients(prev => prev.map(c => {
          if (c.id !== cId) return c;
          return {
            ...c,
            _initialAssessment: c.assessment_session,
            assessment_session: newSession,
            reassessment_sessions: [...(c.reassessment_sessions ?? []), newSession],
          };
        }));
      }

      setAssessmentClientId(cId);
      setPage('assessment');
      return;
    }

    // Initial assessment — existing behavior
    setClients(prev => prev.map(c => {
      if (c.id !== cId || c.assessment_session != null) return c;
      const bcba = SEED_STAFF().find(s => s.id === c.bcba_id);
      return { ...c, assessment_session: makeAssessmentSession(c.id, c.name, c.bcba_id, bcba?.name ?? 'Unassigned', c) };
    }));
    setAssessmentClientId(cId);
    setPage('assessment');
  }, [clients, setClients]);

  const [currentUser, setCurrentUser] = useState(null);

  // Set landing page only when user transitions from logged-out → logged-in.
  // Using a ref to track the previous value prevents re-firing on re-renders
  // where currentUser already exists (which would incorrectly reset the page
  // after tab inactivity).
  const prevUserRef = useRef(null);
  useEffect(() => {
    if (currentUser && !prevUserRef.current) {
      setPage(currentUser.role === 'admin' ? 'metrics' : 'pipeline');
    }
    prevUserRef.current = currentUser;
  }, [currentUser]);

  const handleClientAdvanced = useCallback(clientId => {
    setRecentlyMovedId(clientId);
    setTimeout(() => setRecentlyMovedId(null), 600);
  }, []);

  const addNotif = useCallback(notif => {
    setNotifications(prev => [notif, ...prev]);
  }, [setNotifications]);

  // Seed notifications on mount based on client auth expiry and staff cert expiry
  useEffect(() => {
    const today = new Date('2026-05-14');
    const seedNotifs = [];

    SEED_CLIENTS().forEach(c => {
      if (!c.auth_expiry_date) return;
      const diff = Math.ceil((new Date(c.auth_expiry_date) - today) / 86400000);
      if (c.reauth_active) {
        // Reauth cycle is actively running — always surface a notification
        const label = diff <= 0
          ? `URGENT — ${c.name} authorization expired ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} ago`
          : diff <= 14
          ? `URGENT — ${c.name} authorization expires in ${diff} day${diff !== 1 ? 's' : ''}`
          : `${c.name} — Reauthorization in progress (expires in ${diff} days)`;
        const level = diff <= 14 ? 'urgent' : 'warning';
        seedNotifs.push(mkNotif(label, c.name, level));
      } else if (diff <= 14 && diff > 0) {
        seedNotifs.push(mkNotif(`URGENT — ${c.name} reauthorization due in ${diff} day${diff !== 1 ? 's' : ''}`, c.name, 'urgent'));
      } else if (diff <= 30 && diff > 0) {
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

      {page === 'pipeline'
        ? <PipelinePage
            clients={clients}
            staff={enrichedStaff}
            setClients={setClients}
            setSelectedClient={c => setSelectedClient(c)}
            currentUser={currentUser}
            addNotif={addNotif}
            onClientAdvanced={handleClientAdvanced}
            recentlyMovedId={recentlyMovedId}
          />
        : <main className="max-w-7xl mx-auto px-6 py-8">
            {page==='clients'     && <ClientsPage clients={clients} staff={enrichedStaff} setClients={setClients} setSelectedClient={c => setProfileClient(c)} currentUser={currentUser}/>}
            {page==='staff'       && <StaffPage staff={staff} setStaff={setStaff} clients={clients} currentUser={currentUser}
                                      onSelectClient={c => setProfileClient(c)}/>}
            {page==='metrics'     && (
              currentUser.role === 'admin'
                ? <MetricsPage clients={clients} staff={staff}/>
                : <div className="flex items-center justify-center h-64 text-sm text-slate-500">Access restricted</div>
            )}
            {page==='assessments' && (
              <AssessmentsPage clients={clients} staff={enrichedStaff} currentUser={currentUser}
                onOpenAssessment={handleOpenAssessment} />
            )}
          </main>
      }

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
              // After reassessment doc is generated: go back to client detail page
              setAssessmentClientId(null);
              setPage('pipeline');
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
                ? { ...c, pipeline_entry: true, stage: 'intake', stage_entered_at: new Date().toISOString() }
                : c
            ));
            setProfileClient(null);
          } : null}
        />
      )}

      {selectedClient && (
        <ClientDetailPage
          clientId={selectedClient.id}
          clients={clients}
          staff={enrichedStaff}
          setClients={setClients}
          onBack={() => setSelectedClient(null)}
          backLabel="Back to pipeline"
          currentUser={currentUser}
          addNotif={addNotif}
          onClientAdvanced={handleClientAdvanced}
          onOpenAssessment={(arg) => {
            setSelectedClient(null);
            handleOpenAssessment(arg); // handleOpenAssessment normalises string or object
          }}
        />
      )}
    </div>
  );
}
