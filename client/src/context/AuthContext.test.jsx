
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  setAccessToken: vi.fn(),
  setSessionLostHandler: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../api/http.js', () => ({
  setAccessToken: mocks.setAccessToken,
  setSessionLostHandler: mocks.setSessionLostHandler,
}));

vi.mock('../api/auth.js', () => ({
  loginApi: mocks.loginApi,
  logoutApi: mocks.logoutApi,
  refreshSession: mocks.refreshSession,
}));

function AuthConsumer() {
  const { user, loading, login, logout } = useAuth();

  return (
    <div>
      <p role="status">{loading ? 'Loading session' : 'Session ready'}</p>
      <p>Current user: {user?.email ?? 'Guest'}</p>
      <button onClick={() => login('student@example.com', 'password123')}>
        Login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshSession.mockResolvedValue({ user: null });
  mocks.loginApi.mockResolvedValue({
    token: 'test-token',
    user: { email: 'student@example.com', role: 'student' },
  });
  mocks.logoutApi.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe('AuthContext', () => {
  it('finishes loading when no session is available', async () => {
    renderAuth();

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Session ready');
    });

    expect(screen.getByText('Current user: Guest')).toBeInTheDocument();
  });

  it('restores the user from an existing session', async () => {
    mocks.refreshSession.mockResolvedValue({
      user: { email: 'student@example.com', role: 'student' },
    });

    renderAuth();

    expect(
      await screen.findByText('Current user: student@example.com')
    ).toBeInTheDocument();
  });

  it('sets the access token and user after login', async () => {
    renderAuth();

    await screen.findByText('Session ready');
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(mocks.loginApi).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'password123',
      });
      expect(mocks.setAccessToken).toHaveBeenCalledWith('test-token');
      expect(
        screen.getByText('Current user: student@example.com')
      ).toBeInTheDocument();
    });
  });

  it('clears the user after logout', async () => {
    mocks.refreshSession.mockResolvedValue({
      user: { email: 'student@example.com', role: 'student' },
    });

    renderAuth();

    await screen.findByText('Current user: student@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(mocks.logoutApi).toHaveBeenCalled();
      expect(screen.getByText('Current user: Guest')).toBeInTheDocument();
    });
  });

  it('clears the session when restoring a session fails', async () => {
    mocks.refreshSession.mockRejectedValue(new Error('Session expired'));

    renderAuth();

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Session ready');
    });

    expect(screen.getByText('Current user: Guest')).toBeInTheDocument();
  });
});
