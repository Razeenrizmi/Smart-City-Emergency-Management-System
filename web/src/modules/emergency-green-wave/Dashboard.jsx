import { useState, useEffect, useCallback } from 'react';
import EmergencyList from './EmergencyList';
import EmergencyDetails from './EmergencyDetails';
import {
  getActiveEmergencies,
  getAllEmergencies,
} from '../../services/emergencyService';
import './Dashboard.css';

function Dashboard() {
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [historyEmergencies, setHistoryEmergencies] = useState([]);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [active, history] = await Promise.all([
        getActiveEmergencies(),
        getAllEmergencies(),
      ]);
      setActiveEmergencies(active);
      // Filter history to show only COMPLETED and CANCELLED
      const historyFiltered = history.filter(
        (session) => session.status === 'COMPLETED' || session.status === 'CANCELLED'
      );
      setHistoryEmergencies(historyFiltered);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load emergency data. Please check your connection to the backend.');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchData();
    };
    loadData();
    // Poll active emergencies every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSelectEmergency = (emergency) => {
    setSelectedEmergency(emergency);
  };

  const handleBack = () => {
    setSelectedEmergency(null);
  };

  const handleRefresh = () => {
    fetchData();
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Emergency Green Wave Monitoring</h1>
          <p className="header-description">
            Real-time monitoring of emergency sessions and traffic signal states
          </p>
        </div>
        <div className="header-controls">
          <button 
            className="refresh-button" 
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <span className="last-refresh">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {!selectedEmergency ? (
        <div className="dashboard-content">
          <section className="section">
            <h2>Active Emergencies ({activeEmergencies.length})</h2>
            <EmergencyList
              emergencies={activeEmergencies}
              onSelect={handleSelectEmergency}
              loading={loading}
              emptyMessage="No active emergency sessions"
            />
          </section>

          <section className="section">
            <h2>History ({historyEmergencies.length})</h2>
            <EmergencyList
              emergencies={historyEmergencies}
              onSelect={handleSelectEmergency}
              loading={loading}
              emptyMessage="No completed or cancelled emergency sessions"
            />
          </section>
        </div>
      ) : (
        <div className="dashboard-content">
          <button className="back-button" onClick={handleBack}>
            ← Back to List
          </button>
          <EmergencyDetails
            emergency={selectedEmergency}
            onBack={handleBack}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
