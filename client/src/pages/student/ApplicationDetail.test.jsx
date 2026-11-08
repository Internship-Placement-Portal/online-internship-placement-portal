import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ApplicationDetail from './ApplicationDetail.jsx';
import { getApplicationApi, openResume } from '../../api/applications.js';
import { ToastProvider } from '../../components/ui.jsx';

vi.mock('../../api/applications.js', () => ({
  getApplicationApi: vi.fn(),
  openResume: vi.fn(),
}));

const application = {
  id: 'application-1',
  status: 'Selected',
  listing: { id: 'listing-1', title: 'Frontend Intern', company: 'Acme', location: 'Remote' },
  interview: {
    date: '2026-12-01T10:00:00.000Z',
    mode: 'online',
    link: 'https://meet.example.test/interview',
    notes: 'Bring your portfolio',
  },
  resumeOriginalName: 'harshith-resume.pdf',
  statusHistory: [{ status: 'Shortlisted', at: '2026-10-15T12:00:00.000Z' }],
};

function renderApplication() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/student/applications/application-1']}>
        <Routes>
          <Route path="/student/applications/:id" element={<ApplicationDetail />} />
          <Route path="/student/applications" element={<p>Applications list</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getApplicationApi.mockResolvedValue(application);
});

afterEach(cleanup);

describe('ApplicationDetail', () => {
  it('shows selected progress, interview information, and the internship link', async () => {
    renderApplication();

    expect(await screen.findByRole('heading', { name: 'Frontend Intern' })).toBeInTheDocument();
    expect(getApplicationApi).toHaveBeenCalledWith('application-1');
    expect(screen.getByText('Congratulations! You have been selected for this internship.')).toBeInTheDocument();

    const progress = screen.getByRole('list', { name: 'Application progress' });
    expect(within(progress).getByRole('listitem', { current: 'step' })).toHaveTextContent('Selected');
    expect(screen.getByText(/Shortlisted ·/)).toBeInTheDocument();

    const interview = screen.getByRole('heading', { name: 'Interview' }).closest('section');
    expect(within(interview).getByText('Bring your portfolio')).toBeInTheDocument();
    expect(within(interview).getByRole('link', { name: 'https://meet.example.test/interview' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'View internship' })).toHaveAttribute('href', '/student/internships/listing-1');
  });

  it('explains that a shortlisted application is awaiting an interview', async () => {
    getApplicationApi.mockResolvedValueOnce({ ...application, status: 'Shortlisted', interview: null });
    renderApplication();

    expect(await screen.findByText('You are shortlisted. The recruiter will schedule an interview soon.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'https://meet.example.test/interview' })).not.toBeInTheDocument();
    expect(screen.queryByText('Congratulations! You have been selected for this internship.')).not.toBeInTheDocument();
  });

  it('reports resume access errors without losing the application page', async () => {
    const user = userEvent.setup();
    openResume.mockRejectedValueOnce({ request: {}, message: 'Network error' });
    renderApplication();

    await user.click(await screen.findByRole('button', { name: 'View PDF' }));

    expect(await screen.findByText('Cannot reach the server. Check your connection.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frontend Intern' })).toBeInTheDocument();
    expect(openResume).toHaveBeenCalledWith('application-1');
  });
});
