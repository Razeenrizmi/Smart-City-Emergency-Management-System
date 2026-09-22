import React, { useState, useEffect } from 'react';
import apiClient from './services/appClient';
import DashboardLayout from './components/DashboardLayout';
import HazardMap from './components/HazardMap';
import './index.css';

function App() {
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHazards = async () => {
      try {
        // Fetch hazards from ASP.NET API
        const response = await apiClient.get('/hazards/all');
        if (response.data && response.data.success) {
          setHazards(response.data.data);
        } else {
          setError('Failed to load hazard data.');
        }
      } catch (err) {
        setError(err.message || 'Error connecting to the backend API.');
      } finally {
        setLoading(false);
      }
    };

    fetchHazards();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHazards, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && hazards.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0D1117', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="spinner"></div>
          <p>Loading Smart City Data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0D1117', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ backgroundColor: '#161B22', padding: '32px', borderRadius: '16px', border: '1px solid #E53E3E', maxWidth: '400px', textAlign: 'center' }}>
          <h3 style={{ color: '#E53E3E', marginBottom: '16px' }}>Connection Error</h3>
          <p style={{ color: '#A0AEC0' }}>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '24px', padding: '10px 20px', backgroundColor: '#4299E1', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout hazards={hazards}>
      <HazardMap hazards={hazards} />
    </DashboardLayout>
  );
}

export default App;
