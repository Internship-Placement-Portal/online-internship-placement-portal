import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROLE_HOME, useAuth } from '../context/AuthContext.jsx';

function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      Loading…
    </div>
  );
}

// Any logged-in user. Anonymous visitors go to /login.
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// Only the listed roles. Everyone else is sent to their own dashboard (the API enforces RBAC regardless).
export function RoleRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

// Login/register pages: bounce already-authenticated users to their dashboard.
export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}
