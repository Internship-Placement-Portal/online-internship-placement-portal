import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Analytics from './Analytics.jsx';
import { placementApi } from '../../api/dashboard.js';
import { ToastProvider } from '../../components/ui.jsx';

vi.mock('../../api/dashboard.js', () => ({
  downloadExport: vi.fn(),
  placementApi: vi.fn(),
}));

const analytics = {
  filters: { from: '2026-11-01', to: '2026-11-30', company: '', companies: [] },
  kpis: {
    placementRate: 50,
    placedStudents: 2,
    totalStudents: 4,
    applications: 6,
    conversionRate: 33.3,
    shortlisted: 1,
    selections: 2,
    activeListings: 2,
    recruiters: 2,
    avgTestAccuracy: 75,
    scoredTestAttempts: 2,
    testAttempts: 3,
  },
  monthly: [
    {
      month: '2026-11',
      label: 'Nov 2026',
      applications: 6,
      selections: 2,
      testAttempts: 3,
      scoredAttempts: 2,
      avgAccuracy: 75,
    },
  ],
  statusBreakdown: [
    { status: 'Applied', count: 2 },
    { status: 'Shortlisted', count: 1 },
    { status: 'Selected', count: 2 },
    { status: 'Rejected', count: 1 },
  ],
  domainBreakdown: [],
  companyWise: [],
};

function renderAnalytics() {
  return render(
    <ToastProvider>
      <Analytics />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  placementApi.mockResolvedValue(analytics);
});

afterEach(() => {
  cleanup();
});

describe('Placement analytics page', () => {
  it('distinguishes scored and total attempts in the KPI and monthly table', async () => {
    renderAnalytics();

    expect(await screen.findByText('2 scored · 3 total attempts')).toBeInTheDocument();

    const trend = screen.getByRole('heading', { name: 'Student performance trend' }).closest('figure');
    fireEvent.click(within(trend).getByRole('button', { name: 'View as table' }));

    expect(within(trend).getByRole('columnheader', { name: 'Scored attempts' })).toBeInTheDocument();
    expect(within(trend).getByRole('cell', { name: 'Nov 2026' })).toBeInTheDocument();
    expect(within(trend).getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(within(trend).getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(within(trend).getByRole('cell', { name: '75%' })).toBeInTheDocument();
  });

  it('clears a pending date edit without applying it', async () => {
    const user = userEvent.setup();
    renderAnalytics();
    await screen.findByText('2 scored · 3 total attempts');

    await user.type(screen.getByLabelText('From'), '2026-01-01');
    expect(screen.getByText(/You have unapplied filter changes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeEnabled();
    expect(placementApi).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Reset filters' }));

    expect(screen.getByLabelText('From')).toHaveValue('');
    expect(screen.queryByText(/You have unapplied filter changes/)).not.toBeInTheDocument();
    expect(placementApi).toHaveBeenCalledTimes(1);
  });

  it('resets applied filters and reloads the default analytics', async () => {
    const user = userEvent.setup();
    renderAnalytics();
    await screen.findByText('2 scored · 3 total attempts');

    await user.type(screen.getByLabelText('From'), '2026-01-01');
    expect(screen.getByText(/You have unapplied filter changes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(placementApi).toHaveBeenLastCalledWith({ from: '2026-01-01', to: '', company: '' }));
    expect(screen.queryByText(/You have unapplied filter changes/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset filters' }));

    await waitFor(() => expect(placementApi).toHaveBeenLastCalledWith({ from: '', to: '', company: '' }));
    expect(screen.getByLabelText('From')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDisabled();
  });

  it('lets an admin retry after analytics fails to load', async () => {
    const user = userEvent.setup();
    placementApi
      .mockRejectedValueOnce({ request: {}, message: 'Network error' })
      .mockResolvedValueOnce(analytics);

    renderAnalytics();

    expect(await screen.findByText('Cannot reach the server. Check your connection.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('2 scored · 3 total attempts')).toBeInTheDocument();
    expect(placementApi).toHaveBeenCalledTimes(2);
  });
});
