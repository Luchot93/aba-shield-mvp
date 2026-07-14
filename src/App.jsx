import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SEED_STAFF, makeAssessmentSession, makeReassessmentSession, makeInitialSections, buildClientProfile } from './constants/seedData.js';
import { mkNotif } from './utils/notifications.js';
import { supabase } from './lib/supabase.js';
import { getClients, createClient, getAssessmentSession, createAssessmentSession, getAssessmentSessionsByBcba, getProfile } from './lib/db.js';
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
  const [clients,         setClients]        = useState([]);
  const [clientsLoading,  setClientsLoading] = useState(false);
  const [staff,           setStaff]          = useState(SEED_STAFF);
  const [notifications,   setNotifications]  = useState([]);
  const [selectedClient,         setSelectedClient]        = useState(null);
  const [selectedClientInitTab,  setSelectedClientInitTab] = useState(null);
  const [recentlyMovedId, setRecentlyMovedId]= useState(null);
  const [assessmentClientId, setAssessmentClientId] = useState(null);
  const [profileClient,      setProfileClient]     = useState(null);
  const [openingAssessmentId, setOpeningAssessmentId] = useState(null);

  const [currentUser,  setCurrentUser]  = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);

  useEffect(() => {
    // Role is authoritative from the profiles table, never user_metadata.
    // If the profile can't be read we fail closed: sign out, never assume 'admin'.
    async function resolveUser(user) {
      try {
        const profile = await getProfile(user.id);
        setCurrentUser({ id: user.id, email: user.email, name: profile.full_name ?? user.email, role: profile.role });
      } catch (err) {
        console.error('Profile fetch failed — signing out (fail-closed):', err);
        await supabase.auth.signOut();
        setCurrentUser(null);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      if (user) return resolveUser(user);
    }).finally(() => setAuthLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        resolveUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setClientsLoading(true);
    Promise.all([
      getClients(currentUser.id),
      getAssessmentSessionsByBcba(currentUser.id),
    ])
      .then(([rows, sessions]) => {
        const sessionByClientId = new Map(sessions.map(s => [s.clientId, s]));
        setClients(rows.map(c => ({ ...c, assessment_session: sessionByClientId.get(c.id) ?? null })));
      })
      .catch(err => console.error('Failed to load clients:', err))
      .finally(() => setClientsLoading(false));
  }, [currentUser?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const handleClientAdvanced = useCallback(clientId => {
    setRecentlyMovedId(clientId);
    setTimeout(() => setRecentlyMovedId(null), 600);
  }, []);

  const addNotif = useCallback(notif => {
    setNotifications(prev => [notif, ...prev]);
  }, [setNotifications]);

  // Fetch the client's Supabase assessment_session, creating one if it doesn't
  // exist yet (bcba_id must be currentUser.id — RLS requires bcba_id = auth.uid()).
  const handleOpenAssessment = useCallback(async (arg) => {
    const cId = (arg && typeof arg === 'object') ? arg.clientId : arg;
    const client = clients.find(c => c.id === cId);
    if (!client || openingAssessmentId) return;

    setOpeningAssessmentId(cId);
    try {
      let dbSession = await getAssessmentSession(cId);
      if (!dbSession) {
        const initialSections = makeInitialSections();
        dbSession = await createAssessmentSession(cId, currentUser.id, {
          sections: {
            ...initialSections,
            // Demographics is pre-filled from the client record at creation time —
            // BCBA verifies/edits rather than starting from blank, so it always
            // counts toward capture progress (matches Ready to Generate screen,
            // which treats Demographics as always ready).
            demographics: { ...initialSections.demographics, completionState: 'complete' },
          },
          status: 'not_started',
          sectionsWithData: 0,
          sectionsApproved: 0,
          clientProfile: buildClientProfile(client),
          clientName: client.name,
          bcbaName: currentUser.name,
          consentGranted: false,
        });
      }
      const localSession = { ...dbSession, consentGrantedAt: dbSession.consentGrantedAt ?? null };
      setClients(prev => prev.map(c => c.id === cId ? { ...c, assessment_session: localSession } : c));
      setAssessmentClientId(cId);
      setPage('assessment');
    } catch (err) {
      console.error('Failed to open assessment:', err);
      addNotif?.({ type: 'error', message: 'Could not open assessment. Please try again.' });
    } finally {
      setOpeningAssessmentId(null);
    }
  }, [clients, currentUser, openingAssessmentId, setClients, addNotif]);

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1220' }}>
        <FontLoader/>
        <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: '#0D9488' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

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
          : <LoginPage/>
        }
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ background:'#F8F7F4', fontFamily:'DM Sans, sans-serif' }}>
      <FontLoader/>
      <NavBar page={page} setPage={setPage} notifications={notifications} setNotifications={setNotifications} currentUser={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout}/>

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
          {page==='clients'     && <ClientsPage clients={clients} staff={enrichedStaff} setClients={setClients} setSelectedClient={c => setProfileClient(c)} currentUser={currentUser} clientsLoading={clientsLoading}/>}
          {FLAGS.STAFF && page==='staff' && <StaffPage staff={staff} setStaff={setStaff} clients={clients} currentUser={currentUser}
                                    onSelectClient={c => setProfileClient(c)}/>}
          {FLAGS.METRICS && page==='metrics' && (
            currentUser.role === 'admin'
              ? <MetricsPage clients={clients} staff={staff}/>
              : <div className="flex items-center justify-center h-64 text-sm text-slate-500">Access restricted</div>
          )}
          {page==='assessments' && (
            <AssessmentsPage clients={clients} staff={enrichedStaff} currentUser={currentUser}
              onOpenAssessment={handleOpenAssessment} assessmentOpeningId={openingAssessmentId} />
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
