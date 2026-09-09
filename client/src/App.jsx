import React, { useCallback, useEffect, useState } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { api } from './services/api';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import TaskModal from './components/TaskModal';
import ExcelUploadModal from './components/ExcelUploadModal';
import SubmitWorkModal from './components/SubmitWorkModal';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Departments from './pages/Departments';
import Users from './pages/Users';
import Reports from './pages/Reports';

function AuthenticatedApp() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [taskFilters, setTaskFilters] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [submitTask, setSubmitTask] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!isAuthenticated) setActiveTab('dashboard');
  }, [isAuthenticated]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Memuat sesi...</div>;
  }

  if (!isAuthenticated) return <Login />;

  const pageProps = { refreshKey, onRefresh: refresh };
  const page = {
    dashboard: <Dashboard {...pageProps} onNavigate={(tab, filters = {}) => { setTaskFilters(filters); setActiveTab(tab); }} />,
    tasks: (
      <Tasks
        {...pageProps}
        initialFilters={taskFilters}
        onOpenCreateTask={() => setTaskModalOpen(true)}
        onOpenSubmitWork={setSubmitTask}
      />
    ),
    departments: <Departments {...pageProps} />,
    users: <Users {...pageProps} />,
    reports: <Reports {...pageProps} />,
  }[activeTab] || <Dashboard {...pageProps} onNavigate={(tab, filters = {}) => { setTaskFilters(filters); setActiveTab(tab); }} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onMenuToggle={() => setMobileMenuOpen((open) => !open)} />
      <div className="md:flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCreateTask={() => setTaskModalOpen(true)}
          onOpenUploadExcel={() => setUploadModalOpen(true)}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{page}</main>
      </div>
      <TaskModal isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} onSuccess={refresh} />
      <ExcelUploadModal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} onSuccess={refresh} />
      <SubmitWorkModal
        isOpen={Boolean(submitTask)}
        task={submitTask}
        onClose={() => setSubmitTask(null)}
        onSuccess={refresh}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
