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

      // Always regenerate from the latest session logs so newly-logged sessions
      // (flagged behaviors, skill entries) appear. Merge back any BCBA edits already made.
      const authEnd   = client.auth_expiry_date ?? null;
      const authStart = authEnd
        ? new Date(new Date(authEnd).setMonth(new Date(authEnd).getMonth() - 6))
            .toISOString().slice(0, 10)
        : null;
      const freshSession = makeReassessmentSession(
        client,
        client._initialAssessment ?? client.assessment_session,
        client.service_session_logs ?? [],
        authStart,
        authEnd,
      );

      // If there's an in-progress session, preserve BCBA edits by merging them in
      if (inProgress) {
        const bcbaNewBehaviorEdits = Object.fromEntries(
          (inProgress.newBehaviorSummary ?? []).map(item => [item.behaviorName, item]),
        );
        const bcbaOrigBehaviorEdits = Object.fromEntries(
          (inProgress.originalBehaviorSummary ?? []).map(item => [item.behaviorId ?? item.behaviorName, item]),
        );
        const bcbaNewSkillEdits = Object.fromEntries(
          (inProgress.newSkillSummary ?? []).map(item => [item.skillName, item]),
        );
        const bcbaOrigSkillEdits = Object.fromEntries(
          (inProgress.originalSkillSummary ?? []).map(item => [item.skillId ?? item.skillName, item]),
        );

        freshSession.newBehaviorSummary = (freshSession.newBehaviorSummary ?? []).map(item => {
          const saved = bcbaNewBehaviorEdits[item.behaviorName];
          if (!saved) return item;
          return {
            ...item,
            bcbaDefinitionFinal:      saved.bcbaDefinitionFinal ?? item.bcbaDefinitionFinal,
            function:                 saved.function ?? item.function,
            includedInPlan:           saved.includedInPlan,
            monitorOnly:              saved.monitorOnly ?? item.monitorOnly,
            stoStructure:             saved.stoStructure ?? item.stoStructure,
            masteryCriteriaFrequency: saved.masteryCriteriaFrequency ?? item.masteryCriteriaFrequency,
            masteryCriteriaWeeks:     saved.masteryCriteriaWeeks ?? item.masteryCriteriaWeeks,
            bcbaLtoText:              saved.bcbaLtoText ?? item.bcbaLtoText,
          };
        });

        freshSession.originalBehaviorSummary = (freshSession.originalBehaviorSummary ?? []).map(item => {
          const saved = bcbaOrigBehaviorEdits[item.behaviorId ?? item.behaviorName];
          if (!saved) return item;
          return {
            ...item,
            averageFrequency: saved.averageFrequency ?? item.averageFrequency,
            stoStatus:        saved.stoStatus ?? item.stoStatus,
            // sessionDerivedStoStatus always comes from live session logs — never merge saved BCBA value.
            // The Mastered/Active partition in AssessmentInterviewPage reads this field.
            sessionDerivedStoStatus: item.sessionDerivedStoStatus,
          };
        });

        freshSession.newSkillSummary = (freshSession.newSkillSummary ?? []).map(item => {
          const saved = bcbaNewSkillEdits[item.skillName];
          if (!saved) return item;
          return {
            ...item,
            bcbaGoalName:          saved.bcbaGoalName ?? item.bcbaGoalName,
            bcbaDefinition:        saved.bcbaDefinition ?? item.bcbaDefinition,
            bcbaDomain:            saved.bcbaDomain ?? item.bcbaDomain,
            includedInPlan:         saved.includedInPlan,
            monitorOnly:            saved.monitorOnly ?? item.monitorOnly,
            stoSteps:               saved.stoSteps ?? item.stoSteps,
            masteryCriteriaPercent: saved.masteryCriteriaPercent ?? item.masteryCriteriaPercent,
            masteryCriteriaWeeks:   saved.masteryCriteriaWeeks ?? item.masteryCriteriaWeeks,
            bcbaLtoText:            saved.bcbaLtoText ?? item.bcbaLtoText,
            baselinePercent:        saved.baselinePercent ?? item.baselinePercent,
          };
        });

        freshSession.originalSkillSummary = (freshSession.originalSkillSummary ?? []).map(item => {
          const saved = bcbaOrigSkillEdits[item.skillId ?? item.skillName];
          if (!saved) return item;
          return {
            ...item,
            currentPercent: saved.currentPercent ?? item.currentPercent,
            status:         saved.status ?? item.status,
            // sessionDerivedStatus always comes from live session logs — never merge saved BCBA value.
            sessionDerivedStatus: item.sessionDerivedStatus,
          };
        });

        // Merge newCaregiverSummary BCBA edits
        const bcbaCgEdits = Object.fromEntries(
          (inProgress.newCaregiverSummary ?? []).map(item => [item.goalName, item]),
        );
        freshSession.newCaregiverSummary = (freshSession.newCaregiverSummary ?? []).map(item => {
          const saved = bcbaCgEdits[item.goalName];
          if (!saved) return item;
          return {
            ...item,
            includedInPlan:         saved.includedInPlan,
            monitorOnly:            saved.monitorOnly ?? item.monitorOnly,
            baselinePercent:        saved.baselinePercent ?? item.baselinePercent,
            stoSteps:               saved.stoSteps ?? item.stoSteps,
            masteryCriteriaPercent: saved.masteryCriteriaPercent ?? item.masteryCriteriaPercent,
            masteryCriteriaWeeks:   saved.masteryCriteriaWeeks ?? item.masteryCriteriaWeeks,
            bcbaLtoText:            saved.bcbaLtoText ?? item.bcbaLtoText,
          };
        });

        // Merge caregiverTrainingSummary BCBA edits (averageSessionPercent per goal)
        const bcbaCtEdits = Object.fromEntries(
          (inProgress.caregiverTrainingSummary ?? []).map(item => [item.goalName, item]),
        );
        freshSession.caregiverTrainingSummary = (freshSession.caregiverTrainingSummary ?? []).map(item => {
          const saved = bcbaCtEdits[item.goalName];
          if (!saved) return item;
          return {
            ...item,
            averageSessionPercent: saved.averageSessionPercent ?? item.averageSessionPercent,
          };
        });

        // Preserve session-level fields (BCBA-reviewed AI sections, status, etc.)
        freshSession.id     = inProgress.id;
        freshSession.status = inProgress.status;
        freshSession.sectionApprovalStatus = inProgress.sectionApprovalStatus ?? freshSession.sectionApprovalStatus;

        // Restore BCBA-typed content that makeReassessmentSession can't regenerate:
        // progress narrative and section notes/structured fields (medical_necessity, etc.)
        freshSession.progressNarrativeText = inProgress.progressNarrativeText || freshSession.progressNarrativeText;
        freshSession.cptHours = inProgress.cptHours ?? freshSession.cptHours;

        for (const [key, storedSec] of Object.entries(inProgress.sections ?? {})) {
          if (!freshSession.sections[key]) continue;
          const hasNotes = storedSec.notes?.trim();
          const hasTranscript = storedSec.transcript;
          if (hasNotes || hasTranscript) {
            freshSession.sections[key] = {
              ...freshSession.sections[key],
              notes:          storedSec.notes ?? freshSession.sections[key].notes,
              transcript:     storedSec.transcript ?? freshSession.sections[key].transcript,
              completionState: storedSec.completionState !== 'empty'
                ? storedSec.completionState
                : freshSession.sections[key].completionState,
            };
          }
        }

        // Restore medical_necessity structured fields (diagnoses, meds, hours, setting, etc.)
        if (inProgress.sections?.medical_necessity) {
          const s = inProgress.sections.medical_necessity;
          const f = freshSession.sections.medical_necessity;
          freshSession.sections.medical_necessity = {
            ...f,
            coOccurringDiagnoses:    s.coOccurringDiagnoses    ?? f.coOccurringDiagnoses,
            medications:             s.medications             ?? f.medications,
            hasPriorABA:             s.hasPriorABA             ?? f.hasPriorABA,
            priorABAHistory:         s.priorABAHistory         ?? f.priorABAHistory,
            recommendedHoursPerWeek: s.recommendedHoursPerWeek ?? f.recommendedHoursPerWeek,
            recommendedSetting:      s.recommendedSetting      ?? f.recommendedSetting,
            completionState:         s.completionState !== 'empty' ? s.completionState : f.completionState,
          };
        }

        // Recompute sectionsWithData after merges
        freshSession.sectionsWithData = Object.values(freshSession.sections)
          .filter(s => s.completionState !== 'empty').length;
      }

      setClients(prev => prev.map(c => {
        if (c.id !== cId) return c;
        const existingSessions = (c.reassessment_sessions ?? []).filter(s => s.id !== freshSession.id);
        return {
          ...c,
          _initialAssessment: c._initialAssessment ?? c.assessment_session,
          assessment_session: freshSession,
          reassessment_sessions: [...existingSessions, freshSession],
        };
      }));

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
