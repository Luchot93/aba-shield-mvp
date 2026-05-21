import React, { useState, useEffect, useCallback } from 'react';
import { SEED_CLIENTS, SEED_STAFF } from './constants/seedData.js';
import { mkNotif } from './utils/notifications.js';
import FontLoader from './components/FontLoader.jsx';
import NavBar from './components/NavBar.jsx';
import PipelinePage from './features/pipeline/PipelinePage.jsx';
import ClientsPage from './features/clients/ClientsPage.jsx';
import StaffPage from './features/staff/StaffPage.jsx';
import ClientDetailPage from './features/detail/ClientDetailPage.jsx';
import MetricsPage from './features/metrics/MetricsPage.jsx';
import LoginPage from './auth/LoginPage.jsx';
import SetPasswordPage from './auth/SetPasswordPage.jsx';

export default function App() {
  const [page,            setPage]           = useState('pipeline');
  const [clients,         setClients]        = useState(SEED_CLIENTS);
  const [staff,           setStaff]          = useState(SEED_STAFF);
  const [notifications,   setNotifications]  = useState([]);
  const [selectedClient,  setSelectedClient] = useState(null);
  const [detailFromPage,  setDetailFromPage] = useState('pipeline');
  const [recentlyMovedId, setRecentlyMovedId]= useState(null);

  const [currentUser, setCurrentUser] = useState(null);

  // Set landing page based on role when user logs in or switches role
  useEffect(() => {
    if (currentUser) {
      setPage(currentUser.role === 'admin' ? 'metrics' : 'pipeline');
    }
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
      if (diff <= 14 && diff > 0) {
        seedNotifs.push(mkNotif(`URGENT — ${c.name} reauthorization due in 14 days`, c.name, 'urgent'));
      } else if (diff <= 30 && diff > 0) {
        seedNotifs.push(mkNotif(`${c.name} — Reauthorization due in 30 days`, c.name, 'warning'));
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
            setSelectedClient={c => { setDetailFromPage('pipeline'); setSelectedClient(c); }}
            currentUser={currentUser}
            addNotif={addNotif}
            onClientAdvanced={handleClientAdvanced}
            recentlyMovedId={recentlyMovedId}
          />
        : <main className="max-w-7xl mx-auto px-6 py-8">
            {page==='clients' && <ClientsPage clients={clients} staff={enrichedStaff} setClients={setClients} setSelectedClient={c => { setDetailFromPage('clients'); setSelectedClient(c); }} currentUser={currentUser}/>}
            {page==='staff'   && <StaffPage staff={staff} setStaff={setStaff} clients={clients} currentUser={currentUser}
                                  onSelectClient={c => { setDetailFromPage('staff'); setSelectedClient(c); }}/>}
            {page==='metrics' && (
              currentUser.role === 'admin'
                ? <MetricsPage clients={clients} staff={staff}/>
                : <div className="flex items-center justify-center h-64 text-sm text-slate-500">Access restricted</div>
            )}
          </main>
      }

      {selectedClient && (
        <ClientDetailPage
          clientId={selectedClient.id}
          clients={clients}
          staff={enrichedStaff}
          setClients={setClients}
          onBack={() => { setSelectedClient(null); if (detailFromPage === 'staff') setPage('staff'); }}
          backLabel={detailFromPage === 'staff' ? 'Back to staff' : detailFromPage === 'clients' ? 'Back to clients' : 'Back to pipeline'}
          currentUser={currentUser}
          addNotif={addNotif}
          onClientAdvanced={handleClientAdvanced}
        />
      )}
    </div>
  );
}
