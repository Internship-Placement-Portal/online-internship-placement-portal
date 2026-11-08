import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StudentDashboard from './StudentDashboard.jsx';
import { studentDashboardApi } from '../../api/dashboard.js';

vi.mock('../../api/dashboard.js', () => ({
  studentDashboardApi: vi.fn(),
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { name: 'Taylor Student', role: 'student' } }),
}));

const dashboard = {
  applications: {
    total: 3,
    byStatus: { Applied: 1, Shortlisted: 1, Selected: 1, Rejected: 0 },
    recent: [{ id: 'app-1', title: 'Frontend Intern', company: 'Acme', status: 'Shortlisted', appliedAt: '2026-10-12T12:00:00.000Z' }],
  },
  interviews: {
    scheduled: 1,
    upcoming: [{
      applicationId: 'app-1',
      title: 'Frontend Intern',
      company: 'Acme',
      date: '2026-12-01T10:00:00.000Z',
      mode: 'online',
      link: 'https://meet.example.test/interview',
      notes: 'Bring your portfolio',
    }],
  },
  tests: {
    attempts: 2,
    avgAccuracy: 72.5,
    bestAccuracy: 85,
    recent: [],
    trend: [{ label: 'JavaScript basics', accuracy: 85, submittedAt: '2026-10-20T12:00:00.000Z' }],
    categoryAccuracy: [{ category: 'JavaScript', accuracy: 80, total: 10 }],
  },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <StudentDashboard />
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
  studentDashboardApi.mockResolvedValue(dashboard);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StudentDashboard', () => {
  it('renders application, interview, and test progress from the dashboard API', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: "here's your progress" })).toBeInTheDocument();
    expect(screen.getByText('Applications submitted')).toBeInTheDocument();
    expect(screen.getByText('Interviews scheduled')).toBeInTheDocument();
    expect(screen.getByText('Tests completed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming interviews' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming interviews' }).closest('section')).toHaveTextContent('Bring your portfolio');
    expect(screen.getByRole('link', { name: /Join interview/ })).toHaveAttribute('href', 'https://meet.example.test/interview');
    expect(screen.getAllByRole('link', { name: /Frontend Intern/ })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /Frontend Intern/ })[1]).toHaveAttribute('href', '/student/applications/app-1');
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
  });

  it('refreshes dashboard data when the student requests it', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('heading', { name: "here's your progress" });

    await user.click(screen.getByRole('button', { name: 'Refresh dashboard' }));

    await waitFor(() => expect(studentDashboardApi).toHaveBeenCalledTimes(2));
  });
});
