import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyApplications from './MyApplications.jsx';
import * as applicationsApi from '../../api/applications.js';

vi.mock('../../lib/format.js', () => ({
  formatDate: vi.fn(() => 'Oct 15, 2026'),
  formatDateTime: vi.fn(() => 'Oct 20, 2026, 10:00 AM'),
}));

vi.mock('../../components/fx.jsx', () => ({
  Stepper: () => <div data-testid="mock-stepper" />,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MyApplications (IPP-F-011 student view)', () => {
  it('renders application items with company names, titles, and status badges', async () => {
    vi.spyOn(applicationsApi, 'myApplicationsApi').mockResolvedValue({
      items: [
        {
          id: 'app-1',
          listing: { title: 'Backend Software Intern', company: 'Apex Innovations' },
          status: 'Applied',
          createdAt: '2026-10-15T10:00:00Z',
        },
        {
          id: 'app-2',
          listing: { title: 'Data Engineer Intern', company: 'DataCorp' },
          status: 'Shortlisted',
          createdAt: '2026-10-12T10:00:00Z',
          interview: { mode: 'online', date: '2026-10-20T10:00:00Z' },
        },
        {
          id: 'app-3',
          listing: { title: 'DevOps Engineer Intern', company: 'CloudWorks' },
          status: 'Selected',
          createdAt: '2026-10-01T10:00:00Z',
        },
      ],
      total: 3,
      page: 1,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <MyApplications />
      </MemoryRouter>
    );

    expect(await screen.findByText('Backend Software Intern')).toBeInTheDocument();
    expect(screen.getByText('Data Engineer Intern')).toBeInTheDocument();
    expect(screen.getByText('DevOps Engineer Intern')).toBeInTheDocument();

    expect(screen.getByText('Apex Innovations · Applied Oct 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('Interview: Oct 20, 2026, 10:00 AM')).toBeInTheDocument();

    // Verify status badges are rendered
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Shortlisted')).toBeInTheDocument();
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('renders empty state when student has no applications', async () => {
    vi.spyOn(applicationsApi, 'myApplicationsApi').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });

    render(
      <MemoryRouter>
        <MyApplications />
      </MemoryRouter>
    );

    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
    expect(screen.getByText('Browse internships')).toBeInTheDocument();
  });

  it('renders error alert when API call fails', async () => {
    vi.spyOn(applicationsApi, 'myApplicationsApi').mockRejectedValue(new Error('Network error loading applications'));

    render(
      <MemoryRouter>
        <MyApplications />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Network error loading applications/i)).toBeInTheDocument();
  });
});
