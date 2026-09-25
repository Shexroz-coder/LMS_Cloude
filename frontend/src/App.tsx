import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useAuthStore } from './store/auth.store';
import { Role } from './types';

// Layoutlar + Login — eager (ilovaning asosiy qobig'i, tez ochilishi kerak)
import AdminLayout from './components/layout/AdminLayout';
import TeacherLayout from './components/layout/TeacherLayout';
import StudentLayout from './components/layout/StudentLayout';
import ParentLayout from './components/layout/ParentLayout';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';

// Sahifalar — lazy (route-level code-splitting: boshlang'ich bundle kichrayadi,
// har bir sahifa faqat kerak bo'lganda yuklanadi)
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage'));
const StudentDetailPage = lazy(() => import('./pages/admin/StudentDetailPage'));
const TeachersPage = lazy(() => import('./pages/admin/TeachersPage'));
const GroupsPage = lazy(() => import('./pages/admin/GroupsPage'));
const SchedulePage = lazy(() => import('./pages/admin/SchedulePage'));
const PaymentsPage = lazy(() => import('./pages/admin/PaymentsPage'));
const FinancePage = lazy(() => import('./pages/admin/FinancePage'));
const SalariesPage = lazy(() => import('./pages/admin/SalariesPage'));
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsPage'));
const CoursesPage = lazy(() => import('./pages/admin/CoursesPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const AttendanceExportPage = lazy(() => import('./pages/admin/AttendanceExportPage'));
const AdminCoinsPage = lazy(() => import('./pages/admin/AdminCoinsPage'));
const HolidaysPage = lazy(() => import('./pages/admin/HolidaysPage'));
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage'));
const AdminDebtorsPage = lazy(() => import('./pages/admin/AdminDebtorsPage'));
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage'));
const BranchesPage = lazy(() => import('./pages/admin/BranchesPage'));
const BranchDetailPage = lazy(() => import('./pages/admin/BranchDetailPage'));
const InventoryPage = lazy(() => import('./pages/admin/InventoryPage'));
const ArchivesPage = lazy(() => import('./pages/admin/ArchivesPage'));
const PermissionsPage = lazy(() => import('./pages/admin/PermissionsPage'));

const FounderDashboard = lazy(() => import('./pages/founder/FounderDashboard'));
const FounderFinance = lazy(() => import('./pages/founder/FounderFinance'));
const FounderPayments = lazy(() => import('./pages/founder/FounderPayments'));

const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TeacherGroupsPage = lazy(() => import('./pages/teacher/TeacherGroupsPage'));
const AttendancePage = lazy(() => import('./pages/teacher/AttendancePage'));
const CoinsPage = lazy(() => import('./pages/teacher/CoinsPage'));
const TeacherSchedulePage = lazy(() => import('./pages/teacher/TeacherSchedulePage'));

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentSchedulePage = lazy(() => import('./pages/student/StudentSchedulePage'));
const StudentCoinsPage = lazy(() => import('./pages/student/StudentCoinsPage'));
const StudentPaymentsPage = lazy(() => import('./pages/student/StudentPaymentsPage'));

const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard'));
const ParentPaymentsPage = lazy(() => import('./pages/parent/ParentPaymentsPage'));

const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/shared/ProfilePage'));
const StudentCalendarPage = lazy(() => import('./pages/student/StudentCalendarPage'));

// Filial mas'uli (menejer) — TEACHER roli, lekin managedBranchId biriktirilgan.
// Bunday foydalanuvchi to'liq admin paneliga (o'z filiali doirasida) kiradi.
const isBranchManager = (user: { role: Role; managedBranchId?: number | null } | null) =>
  !!user && user.role === 'TEACHER' && !!user.managedBranchId;

// ── Route himoyasi ──────────────────────────────────
const PrivateRoute = ({
  children,
  allowedRoles,
}: {
  children: JSX.Element;
  allowedRoles?: Role[];
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Filial mas'uli admin paneliga kira oladi
    if (allowedRoles.includes('ADMIN') && isBranchManager(user)) return children;
    return <Navigate to="/" replace />;
  }
  return children;
};

// ── Rolga qarab bosh sahifaga yo'naltirish ──────────
const RootRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Filial mas'uli — to'liq admin panel
  if (isBranchManager(user)) return <Navigate to="/admin" replace />;

  switch (user?.role) {
    case 'ADMIN': return <Navigate to="/admin" replace />;
    case 'FOUNDER': return <Navigate to="/founder" replace />;
    case 'TEACHER': return <Navigate to="/teacher" replace />;
    case 'STUDENT': return <Navigate to="/student" replace />;
    case 'PARENT': return <Navigate to="/parent" replace />;
    default: return <Navigate to="/login" replace />;
  }
};

// Lazy sahifalar yuklanayotganda ko'rsatiladigan yengil fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[40vh]">
    <div className="w-8 h-8 rounded-full border-2 border-neon-cyan/40 border-t-neon-cyan animate-spin" />
  </div>
);

// ── Asosiy App ──────────────────────────────────────
const App = () => {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* ── Admin ── */}
      <Route path="/admin" element={
        <PrivateRoute allowedRoles={['ADMIN']}>
          <AdminLayout />
        </PrivateRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="salaries" element={<SalariesPage />} />
        <Route path="coins" element={<AdminCoinsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="attendance" element={<AdminAttendancePage />} />
        <Route path="attendance-export" element={<AttendanceExportPage />} />
        <Route path="debtors" element={<AdminDebtorsPage />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="branches/:id" element={<BranchDetailPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="archives" element={<ArchivesPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* ── Founder (Ta'sischi) ── */}
      <Route path="/founder" element={
        <PrivateRoute allowedRoles={['FOUNDER']}>
          <AppLayout showAI={false} />
        </PrivateRoute>
      }>
        <Route index element={<FounderDashboard />} />
        <Route path="finance" element={<FounderFinance />} />
        <Route path="payments" element={<FounderPayments />} />
        <Route path="archives" element={<ArchivesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* ── Teacher ── */}
      <Route path="/teacher" element={
        <PrivateRoute allowedRoles={['TEACHER']}>
          <TeacherLayout />
        </PrivateRoute>
      }>
        <Route index element={<TeacherDashboard />} />
        <Route path="schedule" element={<TeacherSchedulePage />} />
        <Route path="groups" element={<TeacherGroupsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="coins" element={<CoinsPage />} />
        {/* Filial mas'uli (menejer) sahifalari — backend ruxsat/branch bo'yicha cheklaydi */}
        <Route path="branch/:id" element={<BranchDetailPage />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="manage-groups" element={<GroupsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* ── Student ── */}
      <Route path="/student" element={
        <PrivateRoute allowedRoles={['STUDENT']}>
          <StudentLayout />
        </PrivateRoute>
      }>
        <Route index element={<StudentDashboard />} />
        <Route path="schedule" element={<StudentSchedulePage />} />
        <Route path="calendar" element={<StudentCalendarPage />} />
        <Route path="coins" element={<StudentCoinsPage />} />
        <Route path="payments" element={<StudentPaymentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* ── Parent ── */}
      <Route path="/parent" element={
        <PrivateRoute allowedRoles={['PARENT']}>
          <ParentLayout />
        </PrivateRoute>
      }>
        <Route index element={<ParentDashboard />} />
        <Route path="payments" element={<ParentPaymentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
};

export default App;
