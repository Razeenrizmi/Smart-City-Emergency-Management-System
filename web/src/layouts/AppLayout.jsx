import { NavLink, Outlet } from 'react-router-dom';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <span className="app-shell__brand">SRMS — Smart Road Management</span>
        <nav className="app-shell__nav">
          <NavLink to="/junctions" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Junctions
          </NavLink>
          <NavLink to="/signal-test" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Signal Test Simulator
          </NavLink>
        </nav>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
