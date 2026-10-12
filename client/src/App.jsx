import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { HomeRedirect, PublicOnlyRoute, RoleRoute } from './components/RouteGuards.jsx';
import AppLayout from './components/AppLayout.jsx';
import { ToastProvider } from './components/ui.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import Profile from './pages/Profile.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import Internships from './pages/student/Internships.jsx';
import RecruiterDashboard from './pages/recruiter/RecruiterDashboard.jsx';
import MyListings from './pages/recruiter/MyListings.jsx';
import ListingForm from './pages/recruiter/ListingForm.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import Approvals from './pages/admin/Approvals.jsx';
import './styles/app.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<RoleRoute roles={['student']} />}>
              <Route path="/student" element={<AppLayout />}>
                <Route index element={<StudentDashboard />} />
                <Route path="internships" element={<Internships />} />
                <Route path="internships/:id" element={<ListingDetail backTo="/student/internships" backLabel="All internships" />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={['recruiter']} />}>
              <Route path="/recruiter" element={<AppLayout />}>
                <Route index element={<RecruiterDashboard />} />
                <Route path="listings" element={<MyListings />} />
                <Route path="listings/new" element={<ListingForm />} />
                <Route path="listings/:id" element={<ListingDetail backTo="/recruiter/listings" backLabel="My listings" />} />
                <Route path="listings/:id/edit" element={<ListingForm />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/admin" element={<AppLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="approvals" element={<Approvals />} />
                <Route path="listings/:id" element={<ListingDetail backTo="/admin/approvals" backLabel="Approvals" />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
