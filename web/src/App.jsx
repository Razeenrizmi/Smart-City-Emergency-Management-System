import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from './services/appClient';
import { getSession, clearSession } from './services/auth';
import DashboardLayout from './components/DashboardLayout';
import HazardMap from './components/HazardMap';
import LoginPage from './components/LoginPage';
import AssignWorkerModal from './components/AssignWorkerModal';
import PendingApprovalsView from './pages/PendingApprovalsView';
import MunicipalWorkersView from './pages/MunicipalWorkersView';
import MyWorkView from './pages/MyWorkView';
import { C } from './theme';
import './index.css';

const Toast = ({ message, tone }) => (
  <div
    style={{
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      zIndex: 3000,
      maxWidth: '360px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 16px',
      borderRadius: '12px',
      background: C.surface,
      border: `1px solid ${tone === 'error' ? C.red : C.green}66`,
      color: C.text,
      fontSize: '13px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
      animation: 'fadeInUp 0.3s ease',
    }}
  >
    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tone === 'error' ? C.red : C.green, flexShrink: 0 }} />
    {message}
  </div>
);

const Centered = ({ children }) => (
  <div style={{ display: 'flex', height: '100vh', backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
    {children}
  </div>
);

const defaultViewFor = (session) => (session?.user?.role === 'MUNICIPAL_WORKER' ? 'mywork' : 'map');

function App() {
  const [session, setSessionState] = useState(() => getSession());
  const [view, setView] = useState(() => defaultViewFor(getSession()));
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignHazard, setAssignHazard] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const isWorker = session?.user?.role === 'MUNICIPAL_WORKER';

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const refreshHazards = useCallback(async () => {
    try {
      const response = await apiClient.get('/hazards/all');
      if (response.data?.success) {
        setHazards(response.data.data);
        setError(null);
      } else {
        setError('Failed to load hazard data.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error connecting to the backend API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Workers don't use the hazard map, so skip the polling entirely for them.
    if (!session || isWorker) return undefined;

    (async () => { await refreshHazards(); })();
    const interval = setInterval(refreshHazards, 30000);
    return () => clearInterval(interval);
  }, [session, isWorker, refreshHazards]);

  const handleLogin = (newSession) => {
    setSessionState(newSession);
    setView(defaultViewFor(newSession));
  };

  const handleLogout = () => {
    clearSession();
    setSessionState(null);
    setHazards([]);
  };

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (!isWorker && loading && hazards.length === 0) {
    return (
      <Centered>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="spinner" />
          <p>Loading Smart City Data...</p>
        </div>
      </Centered>
    );
  }

  if (!isWorker && error && hazards.length === 0) {
    return (
      <Centered>
        <div style={{ backgroundColor: C.surface, padding: '32px', borderRadius: '16px', border: `1px solid ${C.red}`, maxWidth: '400px', textAlign: 'center' }}>
          <h3 style={{ color: C.red, marginBottom: '16px' }}>Connection Error</h3>
          <p style={{ color: C.textDim }}>{error}</p>
          <button
            onClick={refreshHazards}
            style={{ marginTop: '24px', padding: '10px 20px', backgroundColor: C.blue, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
          >
            Retry Connection
          </button>
        </div>
      </Centered>
    );
  }

  return (
    <>
      <DashboardLayout
        hazards={hazards}
        user={session.user}
        activeView={view}
        onNavigate={setView}
        onLogout={handleLogout}
      >
        {isWorker ? (
          <MyWorkView />
        ) : (
          <>
            {view === 'map' && <HazardMap hazards={hazards} onAssign={setAssignHazard} />}
            {view === 'approvals' && <PendingApprovalsView onChanged={refreshHazards} />}
            {view === 'workers' && <MunicipalWorkersView />}
          </>
        )}
      </DashboardLayout>

      {!isWorker && assignHazard && (
        <AssignWorkerModal
          hazard={assignHazard}
          onClose={() => setAssignHazard(null)}
          onCreated={() => notify('Dispatch request created — confirm it in Pending Approvals.')}
        />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </>
  );
}

export default App;
