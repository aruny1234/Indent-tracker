import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { DataProvider } from './context/DataContext.jsx';
import { isConfigured } from './firebase.js';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Alerts from './pages/Alerts.jsx';
import Dashboard from './pages/manager/Dashboard.jsx';
import Indents from './pages/manager/Indents.jsx';
import ImportPage from './pages/manager/ImportPage.jsx';
import Users from './pages/manager/Users.jsx';
import Audit from './pages/manager/Audit.jsx';
import MyIndents from './pages/employee/MyIndents.jsx';
import MyPerformance from './pages/employee/MyPerformance.jsx';

export default function App() {
  const { loading, profile } = useAuth();
  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm">
        <h1 className="mb-2 text-xl font-semibold">Firebase is not configured</h1>
        <p className="text-steel">Copy <code>.env.example</code> to <code>.env</code> and fill in your Firebase web app settings, or add them as GitHub repository secrets. See README.md.</p>
      </div>
    );
  }
  if (loading) return <Loading />;
  if (!profile) return <Login />;
  const isManager = profile.role === 'manager';

  return (
    <DataProvider>
      <Layout>
        <Routes>
          {isManager ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/indents" element={<Indents />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/users" element={<Users />} />
              <Route path="/audit" element={<Audit />} />
            </>
          ) : (
            <>
              <Route path="/" element={<MyIndents />} />
              <Route path="/performance" element={<MyPerformance />} />
            </>
          )}
          <Route path="/alerts" element={<Alerts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </DataProvider>
  );
}
