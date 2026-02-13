import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import { Spinner } from '@phosphor-icons/react';

import { Dashboard } from './pages/Dashboard';
import { ProjectCalendar } from './pages/ProjectCalendar';
import { DailyLog } from './pages/DailyLog';

import { ProjectChecklist } from './pages/ProjectChecklist';
import { ProjectFinancial } from './pages/ProjectFinancial';
import { ProjectCompanies } from './pages/ProjectCompanies';
import { ProjectBenchmarks } from './pages/ProjectBenchmarks';
import { TeamManagement } from './pages/TeamManagement';

import { ErrorBoundary } from './components/shared/ErrorBoundary';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-yellow-600"><Spinner className="animate-spin" size={32} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="team" element={<TeamManagement />} />
              <Route path="project/:id">
                <Route index element={<Navigate to="calendar" replace />} />
                <Route path="calendar" element={<ProjectCalendar />} />
                <Route path="daily/:date" element={<DailyLog />} />
                <Route path="checklist" element={<ProjectChecklist />} />
                <Route path="financial" element={<ProjectFinancial />} />
                <Route path="companies" element={<ProjectCompanies />} />
                <Route path="benchmarks" element={<ProjectBenchmarks />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
