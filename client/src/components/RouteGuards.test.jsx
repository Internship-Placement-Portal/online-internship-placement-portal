
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import {
  ProtectedRoute,
  RoleRoute,
  PublicOnlyRoute,
} from './RouteGuards.jsx';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext.jsx', () => ({
  ROLE_HOME: {
    student: '/student',
    recruiter: '/recruiter',
    admin: '/admin',
  },
  useAuth: () => mockUseAuth(),
}));

function LocationDisplay() {
  const location = useLocation();
  return <div>Current path: {location.pathname}</div>;
}

function renderRoute(element, initialPath = '/private') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/student" element={<div>Student dashboard</div>} />
        <Route path="/recruiter" element={<div>Recruiter dashboard</div>} />
        <Route path="/admin" element={<div>Admin dashboard</div>} />
        <Route path="/private" element={element} />
        <Route path="/public" element={element} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProtectedRoute', () => {
  it('shows a loading indicator while authentication is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderRoute(
      <ProtectedRoute />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('redirects an unauthenticated user to login', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderRoute(
      <ProtectedRoute />,
    );

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.getByText('Current path: /login')).toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'student' },
      loading: false,
    });

    renderRoute(
      <ProtectedRoute />,
    );

    expect(screen.getByText('Current path: /private')).toBeInTheDocument();
  });
});

describe('RoleRoute', () => {
  it('redirects users without the required role to their dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'student' },
      loading: false,
    });

    renderRoute(
      <RoleRoute roles={['admin']} />,
    );

    expect(screen.getByText('Student dashboard')).toBeInTheDocument();
    expect(screen.getByText('Current path: /student')).toBeInTheDocument();
  });

  it('allows users with an authorized role', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'admin' },
      loading: false,
    });

    renderRoute(
      <RoleRoute roles={['admin']} />,
    );

    expect(screen.getByText('Current path: /private')).toBeInTheDocument();
  });
});

describe('PublicOnlyRoute', () => {
  it('redirects authenticated users to their dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'recruiter' },
      loading: false,
    });

    renderRoute(
      <PublicOnlyRoute />,
      '/public',
    );

    expect(screen.getByText('Recruiter dashboard')).toBeInTheDocument();
    expect(screen.getByText('Current path: /recruiter')).toBeInTheDocument();
  });
});
