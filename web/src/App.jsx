import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { TestJunctionProvider } from './context/TestJunctionContext';
import JunctionControlPanel from './pages/JunctionControlPanel';
import SignalTestSimulator from './pages/SignalTestSimulator';
import FaultReports from './pages/FaultReports';

function App() {
  return (
    <TestJunctionProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/junctions" replace />} />
          <Route path="junctions" element={<JunctionControlPanel />} />
          <Route path="signal-test" element={<SignalTestSimulator />} />
          <Route path="reports" element={<FaultReports />} />
          <Route path="*" element={<Navigate to="/junctions" replace />} />
        </Route>
      </Routes>
    </TestJunctionProvider>
  );
}

export default App;
