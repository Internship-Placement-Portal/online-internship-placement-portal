import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard.jsx';
import { listPendingListingsApi, listRecruitersApi } from '../../api/admin.js';
import { placementApi } from '../../api/dashboard.js';

vi.mock('../../api/admin.js', () => ({
  listPendingListingsApi: vi.fn(),
  listRecruitersApi: vi.fn(),
}));

vi.mock('../../api/dashboard.js', () => ({
  placementApi: vi.fn(),
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { name: 'Jordan Admin' } }),
}));

const monthly = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, '0')}`,
  label: `Month ${i + 1}`,
  applications: i,
  selections: 0,
  avgAccuracy: null,
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  listRecruitersApi.mockResolvedValue({ total: 3 });
  listPendingListingsApi.mockResolvedValue({ total: 4 });
  placementApi.mockResolvedValue({
    kpis: {
      placementRate: 50,
      applications: 11,
      selections: 2,
      avgTestAccuracy: 75,
      scoredTestAttempts: 6,
      testAttempts: 7,
    },
    monthly,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminDashboard', () => {
  it('loads pending review and placement summary data for the admin', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Pending reviews' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Last 12 months at a glance' })).toBeInTheDocument();
    expect(listRecruitersApi).toHaveBeenCalledWith({ status: 'pending', limit: 1 });
    expect(listPendingListingsApi).toHaveBeenCalledWith({ status: 'pending_approval', limit: 1 });
    expect(placementApi).toHaveBeenCalledWith();
  });

  it('shows an error instead of partial dashboard data when a required request fails', async () => {
    placementApi.mockRejectedValueOnce({ request: {}, message: 'Network error' });
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server. Check your connection.');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Last 12 months at a glance' })).not.toBeInTheDocument();
    });
  });
});
