import { useState } from 'react';
import {
  Activity,
  Map as MapIcon,
  AlertTriangle,
  CheckCircle,
  Bot,
  Sparkles,
  Users,
  ClipboardList,
  LogOut,
} from 'lucide-react';
import AiRiskPanel from './AiRiskPanel';
import AiCopilotDrawer from './AiCopilotDrawer';
import { C } from '../theme';
import { titleCase } from '../workflow';

const OFFICER_NAV = [
  { id: 'map', label: 'Live Hazard Map', icon: MapIcon },
  { id: 'approvals', label: 'Pending Approvals', icon: AlertTriangle },
  { id: 'workers', label: 'Municipal Workers', icon: Users },
];

const WORKER_NAV = [
  { id: 'mywork', label: 'My Assigned Work', icon: ClipboardList },
];

const VIEW_TITLES = {
  map: 'Live Hazard Map',
  approvals: 'Pending Approvals',
  workers: 'Municipal Workers',
  mywork: 'My Assigned Work',
};

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      borderRadius: '12px',
      cursor: 'pointer',
      border: 'none',
      width: '100%',
      textAlign: 'left',
      font: 'inherit',
      backgroundColor: active ? 'rgba(66, 153, 225, 0.15)' : 'transparent',
      color: active ? '#4299E1' : '#A0AEC0',
      transition: 'all 0.2s',
    }}
  >
    <Icon size={20} />
    <span style={{ fontWeight: active ? '600' : '500' }}>{label}</span>
  </button>
);

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div
    style={{
      backgroundColor: C.surface,
      borderRadius: '16px',
      padding: '20px',
      border: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}
  >
    <div style={{ backgroundColor: `${color}20`, padding: '12px', borderRadius: '12px', color }}>
      <Icon size={24} />
    </div>
    <div>
      <div style={{ color: C.textDim, fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>{title}</div>
      <div style={{ color: '#fff', fontSize: '24px', fontWeight: '700' }}>{value}</div>
    </div>
  </div>
);

const DashboardLayout = ({ children, hazards = [], user, activeView, onNavigate, onLogout }) => {
  const [copilotOpen, setCopilotOpen] = useState(false);

  const isWorker = user?.role === 'MUNICIPAL_WORKER';
  const navItems = isWorker ? WORKER_NAV : OFFICER_NAV;

  const totalReports = hazards.length;
  const severeReports = hazards.filter((h) => h.severityScore >= 4).length;
  const verifiedReports = hazards.filter((h) => h.isVerified).length;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: C.bg, color: '#fff' }}>
      {/* Sidebar */}
      <div style={{ width: '280px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)', padding: '8px', borderRadius: '10px' }}>
            <Activity size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>SRMS</h1>
            <div style={{ fontSize: '12px', color: C.textDim }}>
              {isWorker ? 'Field Worker Portal' : 'Smart City Dashboard'}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
          {navItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeView === item.id}
              onClick={() => onNavigate?.(item.id)}
            />
          ))}

          {/* AI Copilot sidebar entry — officer only */}
          {!isWorker && (
            <div
              id="sidebar-ai-copilot-btn"
              onClick={() => setCopilotOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                cursor: 'pointer',
                background: copilotOpen
                  ? 'linear-gradient(135deg, rgba(102,126,234,0.25), rgba(118,75,162,0.15))'
                  : 'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.05))',
                border: '1px solid rgba(102,126,234,0.3)',
                color: '#A78BFA',
                transition: 'all 0.2s',
                marginTop: '8px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102,126,234,0.2), rgba(118,75,162,0.12))'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = copilotOpen ? 'linear-gradient(135deg, rgba(102,126,234,0.25), rgba(118,75,162,0.15))' : 'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.05))'; }}
            >
              <Bot size={20} />
              <span style={{ fontWeight: '600' }}>AI Copilot</span>
              <Sparkles size={14} color="#ECC94B" style={{ marginLeft: 'auto' }} />
            </div>
          )}
        </div>

        <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {(user?.fullName || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName || 'User'}
              </div>
              <div style={{ fontSize: '12px', color: C.textDim }}>{titleCase(user?.role) || 'City Management'}</div>
            </div>
            <button
              type="button"
              id="logout-btn"
              onClick={onLogout}
              title="Sign out"
              style={{
                background: 'transparent',
                border: 'none',
                color: C.textDim,
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                borderRadius: '8px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.red; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header */}
        <div style={{ padding: '20px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{VIEW_TITLES[activeView] || 'Dashboard'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!isWorker && (
              <button
                id="header-ai-copilot-btn"
                onClick={() => setCopilotOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #667EEA, #764BA2)',
                  border: 'none',
                  borderRadius: '20px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Bot size={16} />
                AI Copilot
              </button>
            )}

            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: C.green, backgroundColor: '#48BB7815', padding: '6px 12px', borderRadius: '20px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: C.green }} />
              System Online
            </span>
          </div>
        </div>

        {/* AI Risk Panel (RDI Banner) — officer only */}
        {!isWorker && <AiRiskPanel />}

        {/* Dashboard Area */}
        <div style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          {!isWorker && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              <StatCard title="Total Reports" value={totalReports} icon={Activity} color="#4299E1" />
              <StatCard title="Severe Hazards" value={severeReports} icon={AlertTriangle} color="#E53E3E" />
              <StatCard title="AI Verified" value={verifiedReports} icon={CheckCircle} color="#48BB78" />
            </div>
          )}

          <div style={{ flex: 1, minHeight: activeView === 'map' ? '500px' : undefined }}>{children}</div>
        </div>
      </div>

      {/* AI Copilot Drawer — officer only */}
      {!isWorker && <AiCopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />}
    </div>
  );
};

export default DashboardLayout;
