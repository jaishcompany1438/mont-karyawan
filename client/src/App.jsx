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
import CrossRequests from './pages/CrossRequests';
import PatrolDashboard from './pages/PatrolDashboard';
import { canAccessTab, getTabFromHash, isKnownTab, resolveAccessibleTab } from './utils/access';

const tabHash = (tab) => `#/${tab}`;

function AuthenticatedApp() {
  const { isAuthenticated, loading, user } = useAuth();
  const [requestedTab, setRequestedTab] = useState(() => getTabFromHash(window.location.hash));
  const [accessDenied, setAccessDenied] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [submitTask, setSubmitTask] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  // Halaman tidak pernah dirender untuk peran yang tidak berhak, termasuk saat membuka URL langsung.
  const activeTab = resolveAccessibleTab(requestedTab, user);

  const setActiveTab = useCallback((tab) => {
    setRequestedTab(tab);
    if (window.location.hash !== tabHash(tab)) window.location.hash = tabHash(tab);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setRequestedTab(getTabFromHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setRequestedTab('dashboard');
      window.history.replaceState(null, '', tabHash('dashboard'));
      return;
    }
    if (loading) return;
    if (!canAccessTab(requestedTab, user)) {
      if (isKnownTab(requestedTab)) setAccessDenied('Anda tidak memiliki akses ke halaman tersebut.');
      setRequestedTab(activeTab);
    }
    if (window.location.hash !== tabHash(activeTab)) {
      window.history.replaceState(null, '', tabHash(activeTab));
    }
  }, [isAuthenticated, loading, requestedTab, activeTab, user]);

  useEffect(() => {
    if (!accessDenied) return undefined;
    const timer = window.setTimeout(() => setAccessDenied(''), 4000);
    return () => window.clearTimeout(timer);
  }, [accessDenied]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Memuat sesi...</div>;
  }

  if (!isAuthenticated) return <Login />;

  const pageProps = { refreshKey, onRefresh: refresh };
  const page = {
    dashboard: (
      <Dashboard
        {...pageProps}
        onOpenCreateTask={() => setTaskModalOpen(true)}
        onOpenSubmitWork={setSubmitTask}
      />
    ),
    tasks: (
      <Tasks
        {...pageProps}
        onOpenCreateTask={() => setTaskModalOpen(true)}
        onOpenEditTask={(task) => { setEditTask(task); setTaskModalOpen(true); }}
        onOpenSubmitWork={setSubmitTask}
      />
    ),
    'cross-requests': <CrossRequests {...pageProps} />,
    departments: <Departments {...pageProps} />,
    users: <Users {...pageProps} />,
    reports: <Reports {...pageProps} />,
    patrol: <PatrolDashboard {...pageProps} />,
  }[activeTab];

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8fbff_0%,#eff6ff_58%,#ecfdf5_100%)]">
      <Navbar onMenuToggle={() => setMobileMenuOpen((open) => !open)} />
      <div className="md:flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCreateTask={() => setTaskModalOpen(true)}
          onOpenUploadExcel={() => setUploadModalOpen(true)}
          onOpenCrossDept={() => setActiveTab('cross-requests')}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{page}</main>
      </div>
      {accessDenied && (
        <div role="alert" className="fixed right-4 top-4 z-[70] max-w-sm rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-xl">
          {accessDenied}
        </div>
      )}
      <TaskModal isOpen={taskModalOpen} initialTask={editTask} onClose={() => { setTaskModalOpen(false); setEditTask(null); }} onSuccess={refresh} />
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
