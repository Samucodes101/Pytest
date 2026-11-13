import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useBrandingStore } from '@/hooks/useBranding';
import { apiClient } from '@/api/client';
import { Sidebar, Header } from '@/components/layout/Navigation';

// Pages (lazy-loaded for code-splitting)
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ExamsPage = lazy(() => import('@/pages/ExamsPage'));
const ExamCreatePage = lazy(() => import('@/pages/ExamCreatePage'));
const ExamEditPage = lazy(() => import('@/pages/ExamEditPage'));
const ExamDetailPage = lazy(() => import('@/pages/ExamDetailPage'));
const ExamTakePage = lazy(() => import('@/pages/ExamTakePage'));
const ResultsPage = lazy(() => import('@/pages/ResultsPage'));
const ResultDetailPage = lazy(() => import('@/pages/ResultDetailPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const StudentsPage = lazy(() => import('@/pages/StudentsPage'));
const StudentDetailPage = lazy(() => import('@/pages/StudentDetailPage'));
const AdminsPage = lazy(() => import('@/pages/AdminsPage'));
const AuditPage = lazy(() => import('@/pages/AuditPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ADMINS = ['admin', 'superadmin'];
const SUPER = ['superadmin'];

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles }) => {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppLayout: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  return (
    <div className="flex min-h-screen bg-light">
      <Sidebar />
      <div className="flex-1 min-w-0 lg:ml-64 print-full">
        <Header title={title} />
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
};

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary" />
  </div>
);

/** [path, title, page, allowed roles] — every entry renders inside the app shell. */
const SHELL_ROUTES: [string, string, React.ReactNode, string[]?][] = [
  ['/dashboard', 'Dashboard', <DashboardPage />],
  ['/exams', 'Exams', <ExamsPage />],
  ['/exams/:id', 'Exam Details', <ExamDetailPage />],
  ['/admin/create-exam', 'Create Exam', <ExamCreatePage />, ADMINS],
  ['/admin/edit-exam/:id', 'Edit Exam', <ExamEditPage />, ADMINS],
  ['/results', 'Results', <ResultsPage />],
  ['/results/:id', 'Result Details', <ResultDetailPage />],
  ['/analytics', 'Analytics', <AnalyticsPage />, ADMINS],
  ['/students', 'Candidates', <StudentsPage />, ADMINS],
  ['/students/:id', 'Candidate Profile', <StudentDetailPage />, ADMINS],
  ['/admins', 'Admins', <AdminsPage />, SUPER],
  ['/audit', 'Audit Trail', <AuditPage />, SUPER],
  ['/settings', 'Branding & Settings', <SettingsPage />, SUPER],
  ['/profile', 'My Profile', <ProfilePage />],
];

function App() {
  const { loadFromStorage, token, setUser } = useAuthStore();
  const loadBranding = useBrandingStore((s) => s.load);

  useEffect(() => {
    loadFromStorage();
    loadBranding();
  }, [loadFromStorage, loadBranding]);

  // Refresh the cached profile so role or department changes show up without re-login.
  useEffect(() => {
    if (token) apiClient.getMe().then(setUser).catch(() => undefined);
  }, [token, setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {SHELL_ROUTES.map(([path, title, page, roles]) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute requiredRoles={roles}>
                    <AppLayout title={title}>{page}</AppLayout>
                  </ProtectedRoute>
                }
              />
            ))}

            {/* The exam room is deliberately distraction-free: no sidebar or header. */}
            <Route
              path="/exams/:examId/take/:assignmentId"
              element={
                <ProtectedRoute requiredRoles={['student']}>
                  <ExamTakePage />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
