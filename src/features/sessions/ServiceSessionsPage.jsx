import React, { useState, useEffect, useMemo } from 'react';
import { isAdmin, isBCBAGroup, isRBT } from '../../utils/permissions.js';
import { mkNotif } from '../../utils/notifications.js';
import {
  getBehaviorSessionLogsByClientIds,
  getSkillSessionLogsByClientIds,
  getCaregiverTrainingSessionLogsByClientIds,
  addBehaviorSessionLog,
  addSkillSessionLog,
  addCaregiverTrainingSessionLog,
} from '../../lib/db.js';
import BehaviorSessionLogPanel   from './components/BehaviorSessionLogPanel.jsx';
import SkillSessionLogPanel      from './components/SkillSessionLogPanel.jsx';
import CaregiverTrainingLogPanel from './components/CaregiverTrainingLogPanel.jsx';
import BehaviorSessionModal      from './components/BehaviorSessionModal.jsx';
import SkillSessionModal         from './components/SkillSessionModal.jsx';
import CaregiverTrainingLogModal from './components/CaregiverTrainingLogModal.jsx';

export default function ServiceSessionsPage({ clients, currentUser, addNotif }) {
  // Role-scoped: only clients in the Services stage, filtered to the ones
  // this user is actually assigned to (admins see all of them).
  const scopedClients = useMemo(() => {
    const servicesClients = clients.filter(c => c.stage === 'services');
    if (isAdmin(currentUser.role))     return servicesClients;
    if (isBCBAGroup(currentUser.role)) return servicesClients.filter(c => c.bcba_id === currentUser.id);
    if (isRBT(currentUser.role))       return servicesClients.filter(c => c.rbt_id === currentUser.id);
    return [];
  }, [clients, currentUser.id, currentUser.role]);

  const [selectedClientId, setSelectedClientId] = useState(null);

  const [behaviorLogs,  setBehaviorLogs]  = useState([]);
  const [skillLogs,     setSkillLogs]     = useState([]);
  const [caregiverLogs, setCaregiverLogs] = useState([]);
  const [logsLoading,   setLogsLoading]   = useState(false);

  const [behaviorModalOpen,  setBehaviorModalOpen]  = useState(false);
  const [skillModalOpen,     setSkillModalOpen]     = useState(false);
  const [caregiverModalOpen, setCaregiverModalOpen] = useState(false);

  const selectedClient = scopedClients.find(c => c.id === selectedClientId) ?? null;

  // Fetch logs for the selected client only, on demand — not for the whole
  // scoped list up front.
  useEffect(() => {
    if (!selectedClientId) return;
    setLogsLoading(true);
    Promise.all([
      getBehaviorSessionLogsByClientIds([selectedClientId]),
      getSkillSessionLogsByClientIds([selectedClientId]),
      getCaregiverTrainingSessionLogsByClientIds([selectedClientId]),
    ])
      .then(([behavior, skill, caregiver]) => {
        setBehaviorLogs(behavior);
        setSkillLogs(skill);
        setCaregiverLogs(caregiver);
      })
      .catch(err => {
        console.error('Failed to load session logs:', err);
        addNotif?.(mkNotif('Failed to load session logs — please try again.', selectedClient?.name, 'urgent'));
      })
      .finally(() => setLogsLoading(false));
  }, [selectedClientId]);

  // The log panels/modals were built against client.service_session_logs /
  // client.caregiver_training_session_logs in local state — this shape
  // adapter lets them run unmodified against real DB rows.
  const augmentedClient = selectedClient ? {
    ...selectedClient,
    service_session_logs: [...behaviorLogs, ...skillLogs],
    caregiver_training_session_logs: caregiverLogs,
  } : null;

  const selectedCycle = selectedClient?.reauth_cycle ?? 0;

  const handleSaveBehaviorLog = async newLog => {
    try {
      const saved = await addBehaviorSessionLog(selectedClientId, {
        sessionDate:   newLog.sessionDate,
        sessionNumber: newLog.sessionNumber,
        reauthCycle:   newLog.reauth_cycle,
        entries:       newLog.behaviorEntries,
        notes:         newLog.notes,
      });
      setBehaviorLogs(prev => [...prev, saved]);
      setBehaviorModalOpen(false);
    } catch (err) {
      console.error('Failed to save behavior session log:', err);
      addNotif?.(mkNotif('Failed to save session log — please try again.', selectedClient?.name, 'urgent'));
    }
  };

  const handleSaveSkillLog = async newLog => {
    try {
      const saved = await addSkillSessionLog(selectedClientId, {
        sessionDate:   newLog.sessionDate,
        sessionNumber: newLog.sessionNumber,
        reauthCycle:   newLog.reauth_cycle,
        entries:       newLog.skillEntries,
        notes:         newLog.notes,
      });
      setSkillLogs(prev => [...prev, saved]);
      setSkillModalOpen(false);
    } catch (err) {
      console.error('Failed to save skill session log:', err);
      addNotif?.(mkNotif('Failed to save session log — please try again.', selectedClient?.name, 'urgent'));
    }
  };

  const handleSaveCaregiverLog = async newLog => {
    try {
      const saved = await addCaregiverTrainingSessionLog(selectedClientId, {
        sessionDate:   newLog.sessionDate,
        sessionNumber: newLog.sessionNumber,
        reauthCycle:   newLog.reauth_cycle,
        entries:       newLog.trainingEntries,
        notes:         newLog.notes,
      });
      setCaregiverLogs(prev => [...prev, saved]);
      setCaregiverModalOpen(false);
    } catch (err) {
      console.error('Failed to save caregiver training log:', err);
      addNotif?.(mkNotif('Failed to save session log — please try again.', selectedClient?.name, 'urgent'));
    }
  };

  return (
    <div className="flex gap-4" data-testid="service-sessions-page">
      {/* ── Client picker ── */}
      <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-stone-200 overflow-hidden self-start">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            Service Sessions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {scopedClients.length} client{scopedClients.length !== 1 ? 's' : ''} in services
          </p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {scopedClients.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No clients assigned.</p>
          )}
          {scopedClients.map(c => (
            <button
              key={c.id}
              data-testid={`service-sessions-client-${c.id}`}
              onClick={() => setSelectedClientId(c.id)}
              className={`w-full text-left px-4 py-2.5 border-b border-stone-50 last:border-b-0 transition-colors ${
                c.id === selectedClientId ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span className="text-sm font-medium block truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Selected client's sessions ── */}
      <div className="flex-1 min-w-0">
        {!selectedClient && (
          <div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-sm text-slate-400">
            Select a client to view or log sessions.
          </div>
        )}

        {selectedClient && logsLoading && (
          <div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-sm text-slate-400">
            Loading sessions…
          </div>
        )}

        {selectedClient && !logsLoading && (
          <div className="space-y-3">
            <BehaviorSessionLogPanel
              client={augmentedClient}
              onLogSession={() => setBehaviorModalOpen(true)}
              selectedCycle={selectedCycle}
            />
            <SkillSessionLogPanel
              client={augmentedClient}
              onLogSession={() => setSkillModalOpen(true)}
              selectedCycle={selectedCycle}
            />
            <CaregiverTrainingLogPanel
              client={augmentedClient}
              onLogSession={() => setCaregiverModalOpen(true)}
              selectedCycle={selectedCycle}
            />
          </div>
        )}
      </div>

      {/* ── session log modals ── */}
      {behaviorModalOpen && (
        <BehaviorSessionModal
          client={augmentedClient}
          currentUser={currentUser}
          onSave={handleSaveBehaviorLog}
          onClose={() => setBehaviorModalOpen(false)}
        />
      )}
      {skillModalOpen && (
        <SkillSessionModal
          client={augmentedClient}
          currentUser={currentUser}
          onSave={handleSaveSkillLog}
          onClose={() => setSkillModalOpen(false)}
        />
      )}
      {caregiverModalOpen && (
        <CaregiverTrainingLogModal
          client={augmentedClient}
          currentUser={currentUser}
          onSave={handleSaveCaregiverLog}
          onClose={() => setCaregiverModalOpen(false)}
        />
      )}
    </div>
  );
}
