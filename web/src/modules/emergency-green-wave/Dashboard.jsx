import { useCallback, useEffect, useMemo, useState } from 'react';
import EmergencyList from './EmergencyList';
import EmergencyDetails from './EmergencyDetails';
import StatusBadge from './StatusBadge';
import {
  getActiveEmergencies,
  getAiReport,
  getAiWorkflow,
  getAllEmergencies,
  getAllRoutes,
} from '../../services/emergencyService';
import './Dashboard.css';

const HISTORY_LIMIT = 5;

function routeNameFor(emergency, routes) {
  return routes.find((route) => route.routeId === emergency.selectedRouteId)?.routeName || 'No route';
}

function Dashboard() {
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [allEmergencies, setAllEmergencies] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [workflows, setWorkflows] = useState({});
  const [reports, setReports] = useState({});
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [active, all, routeData] = await Promise.all([
        getActiveEmergencies(),
        getAllEmergencies(),
        getAllRoutes(),
      ]);
      const activeWorkflowEntries = await Promise.all(active.map(async (emergency) => [
        emergency.sessionId,
        await getAiWorkflow(emergency.sessionId),
      ]));
      setActiveEmergencies(active);
      setAllEmergencies(all);
      setRoutes(routeData);
      setWorkflows(Object.fromEntries(activeWorkflowEntries.filter(([, workflow]) => workflow)));
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load emergency data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(fetchData, 0);
    const interval = setInterval(fetchData, 10000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [fetchData]);

  const historyEmergencies = useMemo(
    () => allEmergencies
      .filter((session) => session.status === 'COMPLETED' || session.status === 'CANCELLED')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [allEmergencies]
  );

  const alerts = useMemo(() => activeEmergencies.flatMap((emergency) => {
    const workflow = workflows[emergency.sessionId];
    if (!workflow) return [];
    if (workflow.approvalStatus === 'PENDING_APPROVAL') {
      return [{ id: `${emergency.sessionId}-approval`, level: 'pending', text: 'AI proposal awaiting human approval', emergency }];
    }
    if (workflow.approvalStatus === 'REJECTED') {
      return [{ id: `${emergency.sessionId}-rejected`, level: 'error', text: 'AI proposal rejected', emergency }];
    }
    if (workflow.errorSummary) {
      return [{ id: `${emergency.sessionId}-error`, level: 'error', text: workflow.errorSummary, emergency }];
    }
    if (workflow.signalExecutionPerformed) {
      return [{ id: `${emergency.sessionId}-active`, level: 'active', text: 'Green Wave execution recorded', emergency }];
    }
    return [];
  }), [activeEmergencies, workflows]);

  const openEmergency = (emergency) => {
    setSelectedEmergency(emergency);
    setView('dashboard');
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const reportEntries = await Promise.all(allEmergencies.map(async (emergency) => {
        try {
          return [emergency.sessionId, await getAiReport(emergency.sessionId)];
        } catch {
          return [emergency.sessionId, null];
        }
      }));
      setReports(Object.fromEntries(reportEntries.filter(([, report]) => report?.workflow)));
      setView('reports');
    } catch (err) {
      setError(err.message || 'Failed to load AI reports.');
    } finally {
      setLoading(false);
    }
  };

  const recentHistory = historyEmergencies.slice(0, HISTORY_LIMIT);

  if (selectedEmergency) {
    return (
      <div className="dashboard">
        <button className="back-button" type="button" onClick={() => setSelectedEmergency(null)}>← Back to Emergencies</button>
        <EmergencyDetails emergency={selectedEmergency} onBack={() => setSelectedEmergency(null)} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <p className="eyebrow">Traffic control operations</p>
          <h1>Emergency Green Wave</h1>
          <p className="header-description">Real-time emergency and traffic signal monitoring</p>
        </div>
        <div className="header-controls">
          <button className="secondary-button" type="button" onClick={loadReports}>AI Reports</button>
          <button className="secondary-button notification-button" type="button" onClick={() => setView('alerts')}>AI Alerts {alerts.length > 0 && <span className="notification-count">{alerts.length}</span>}</button>
          <button className="refresh-button" type="button" onClick={fetchData} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          <span className="last-refresh">Updated {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </header>

      {error && <div className="error-banner" role="alert"><span className="error-icon">!</span>{error}</div>}

      {view === 'alerts' && (
        <section className="section dashboard-view">
          <div className="section-heading"><div><p className="eyebrow">Attention required</p><h2>AI Alerts</h2></div><button className="text-button" type="button" onClick={() => setView('dashboard')}>Back to dashboard</button></div>
          {alerts.length === 0 ? <div className="empty-state">No active AI alerts.</div> : <div className="alert-list">{alerts.map((alert) => <button className={`alert-item alert-${alert.level}`} type="button" key={alert.id} onClick={() => openEmergency(alert.emergency)}><StatusBadge value={alert.level} /><span>{alert.text}</span><strong>View emergency</strong></button>)}</div>}
        </section>
      )}

      {view === 'reports' && (
        <section className="section dashboard-view">
          <div className="section-heading"><div><p className="eyebrow">Persisted workflow outcomes</p><h2>AI Decision Reports</h2></div><button className="text-button" type="button" onClick={() => setView('dashboard')}>Back to dashboard</button></div>
          {loading ? <div className="loading-state">Loading reports...</div> : Object.keys(reports).length === 0 ? <div className="empty-state">No persisted AI reports are available.</div> : <div className="report-list">{Object.values(reports).map((report) => <button className="report-row" type="button" key={report.emergency.sessionId} onClick={() => openEmergency(report.emergency)}><span>{report.emergency.vehicleType}</span><span>{routeNameFor(report.emergency, routes)}</span><StatusBadge value={report.workflow?.approvalStatus} /><StatusBadge value={report.greenWave?.status} /><strong>View report</strong></button>)}</div>}
        </section>
      )}

      {view === 'dashboard' && (
        <div className="dashboard-content">
          <section className="section active-section">
            <div className="section-heading"><div><p className="eyebrow">Live operations</p><h2>Active Emergencies <span className="count-badge">{activeEmergencies.length}</span></h2></div></div>
            <EmergencyList emergencies={activeEmergencies} onSelect={openEmergency} loading={loading} routes={routes} workflows={workflows} emptyMessage="No active emergency sessions." />
          </section>
          <section className="section">
            <div className="section-heading"><div><p className="eyebrow">Completed operations</p><h2>Recent History</h2></div><button className="text-button" type="button" onClick={() => setView('history')}>View All History</button></div>
            <EmergencyList emergencies={recentHistory} onSelect={openEmergency} loading={loading} routes={routes} compact emptyMessage="No completed or cancelled emergency sessions." />
          </section>
        </div>
      )}

      {view === 'history' && (
        <section className="section dashboard-view">
          <div className="section-heading"><div><p className="eyebrow">Audit history</p><h2>All Emergency History</h2></div><button className="text-button" type="button" onClick={() => setView('dashboard')}>Back to dashboard</button></div>
          <EmergencyList emergencies={historyEmergencies} onSelect={openEmergency} loading={loading} routes={routes} compact emptyMessage="No emergency history." />
        </section>
      )}
    </div>
  );
}

export default Dashboard;
