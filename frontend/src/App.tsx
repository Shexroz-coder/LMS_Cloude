import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { Role } from './types';

// Pages — Auth
import LoginPage from './pages/auth/LoginPage';

// Pages — Admin
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentsPage from './pages/admin/StudentsPage';
import TeachersPage from './pages/admin/TeachersPage';
import GroupsPage from './pages/admin/GroupsPage';
import SchedulePage from './pages/admin/SchedulePage';
import PaymentsPage from './pages/admin/PaymentsPage';
import FinancePage from './pages/admin/FinancePage';
import SalariesPage from './pages/admin/SalariesPage';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';
import CoursesPage from './pages/admin/CoursesPage';
import ReportsPage from './pages/admin/ReportsPage';
import AdminCoinsPage from './pages/admin/AdminCoinsPage';

// Pages — Teacher
import TeacherLayout from './components/layout/TeacherLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherGroupsPage from './pages/teacher/TeacherGroupsPage';
import AttendancePage from './pages/teacher/AttendancePage';
import GradesPage from './pages/teacher/GradesPage';
import CoinsPage from './pages/teacher/CoinsPage';
import TeacherSchedulePage from './pages/teacher/TeacherSchedulePage';

// Pages — Student
import StudentLayout from './components/layout/StudentLayout';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentSchedulePage from './pages/student/StudentSchedulePage';
import StudentGradesPage from './pages/student/StudentGradesPage';
import StudentCoinsPage from './pages/student/StudentCoinsPage';
import StudentPaymentsPage from './pages/student/StudentPaymentsPage';

// Pages — Parent
import ParentLayout from './components/layout/ParentLayout';
import ParentDashboard from './pages/parent/ParentDashboard';
import ParentPaymentsPage from './pages/parent/ParentPaymentsPage';

// Shared
import ChatPage from './pages/shared/ChatPage';
import NotificationsPage from './pages/shared/NotificationsPage';
import ProfilePage from './pages/shared/ProfilePage';

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
    return <Navigate to="/" replace />;
  }
  return children;
};

// ── Rolga qarab bosh sahifaga yo'naltirish ──────────
const RootRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  switch (user?.role) {
    case 'ADMIN':    return <Navigate to="/admin" replace />;
    case 'TEACHER':  return <Navigate to="/teacher" replace />;
    case 'STUDENT':  return <Navigate to="/student" replace />;
    case 'PARENT':   return <Navigate to="/parent" replace />;
    default:         return <Navigate to="/login" replace />;
  }
};

// ── Asosiy App ──────────────────────────────────────
const App = () => {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* ── Admin ── */}
      <Route path="/admin" element={
        <PrivateRoute allowedRoles={['ADMIN']}>
          <AdminLayout />
        </PrivateRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="salaries" element={<SalariesPage />} />
        <Route path="coins" element={<AdminCoinsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="chat" element={<ChatPage />} />
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
        <Route path="grades" element={<GradesPage />} />
        <Route path="coins" element={<CoinsPage />} />
        <Route path="chat" element={<ChatPage />} />
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
        <Route path="grades" element={<StudentGradesPage />} />
        <Route path="coins" element={<StudentCoinsPage />} />
        <Route path="payments" element={<StudentPaymentsPage />} />
        <Route path="chat" element={<ChatPage />} />
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
        <Route path="chat" element={<ChatPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
