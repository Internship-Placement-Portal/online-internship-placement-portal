import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { HomeRedirect, PublicOnlyRoute, RoleRoute } from './components/RouteGuards.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import RecruiterDashboard from './pages/recruiter/RecruiterDashboard.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import './styles/app.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route element={<RoleRoute roles={['student']} />}>
            <Route path="/student" element={<StudentDashboard />} />
          </Route>
          <Route element={<RoleRoute roles={['recruiter']} />}>
            <Route path="/recruiter" element={<RecruiterDashboard />} />
          </Route>
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
