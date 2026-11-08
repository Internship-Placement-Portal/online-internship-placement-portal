import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecruiterDashboard from './RecruiterDashboard.jsx';
import { myListingsApi } from '../../api/listings.js';

vi.mock('../../api/listings.js', () => ({
  myListingsApi: vi.fn(),
}));

const mockUseAuth = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <RecruiterDashboard />
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
  mockUseAuth.mockReturnValue({
    user: {
      name: 'Riley Recruiter',
      role: 'recruiter',
      approvalStatus: 'approved',
      profile: { companyName: 'Acme' },
    },
  });
  myListingsApi.mockResolvedValue({
    total: 4,
    items: [
      { id: '1', status: 'approved' },
      { id: '2', status: 'approved' },
      { id: '3', status: 'pending_approval' },
      { id: '4', status: 'draft' },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RecruiterDashboard', () => {
  it('summarizes listing statuses and links to listing management', async () => {
    renderDashboard();

    expect(await screen.findByText('Hey Riley,')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(myListingsApi).toHaveBeenCalledWith({ limit: 50 });
    expect(screen.getByRole('link', { name: 'New listing' })).toHaveAttribute('href', '/recruiter/listings/new');
    expect(screen.getByRole('link', { name: 'My listings' })).toHaveAttribute('href', '/recruiter/listings');
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText(/awaiting approval from a placement officer/)).not.toBeInTheDocument();
  });

  it('explains why a pending recruiter cannot publish listings', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        name: 'Riley Recruiter',
        role: 'recruiter',
        approvalStatus: 'pending',
        profile: { companyName: 'Acme' },
      },
    });

    renderDashboard();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your account is awaiting approval from a placement officer.'
    );
    expect(myListingsApi).toHaveBeenCalledWith({ limit: 50 });
  });
});
