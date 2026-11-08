import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MyApplications from './MyApplications.jsx';
import { myApplicationsApi } from '../../api/applications.js';

vi.mock('../../api/applications.js', () => ({
  myApplicationsApi: vi.fn(),
}));

function renderApplications() {
  return render(
    <MemoryRouter>
      <MyApplications />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  myApplicationsApi.mockResolvedValue({
    items: [
      {
        id: 'application-1',
        status: 'Shortlisted',
        createdAt: '2026-10-12T12:00:00.000Z',
        listing: { company: 'Acme', title: 'Frontend Intern' },
        interview: { mode: 'online', date: '2026-12-01T10:00:00.000Z' },
      },
    ],
    page: 1,
    totalPages: 2,
  });
});

afterEach(cleanup);

describe('MyApplications', () => {
  it('shows application status and scheduled interview details', async () => {
    renderApplications();

    const applicationLink = await screen.findByRole('link', { name: /Frontend Intern/ });
    expect(applicationLink).toHaveAttribute('href', '/student/applications/application-1');
    expect(within(applicationLink).getByText('Acme · Applied 12 Oct 2026')).toBeInTheDocument();
    expect(within(applicationLink).getAllByText('Shortlisted')).toHaveLength(2);
    expect(within(applicationLink).getByText(/Interview: 1 Dec 2026/)).toBeInTheDocument();
    expect(myApplicationsApi).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('loads the selected page when the student uses pagination', async () => {
    const user = userEvent.setup();
    renderApplications();

    await screen.findByRole('link', { name: /Frontend Intern/ });
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(myApplicationsApi).toHaveBeenLastCalledWith({ page: 2, limit: 10 });
    });
  });

  it('offers internship browsing when the student has no applications', async () => {
    myApplicationsApi.mockResolvedValueOnce({ items: [], page: 1, totalPages: 1 });
    renderApplications();

    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse internships' })).toHaveAttribute('href', '/student/internships');
  });
});
