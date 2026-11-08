import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Tests from './Tests.jsx';
import { listTestsApi, myAttemptsApi, startTestApi } from '../../api/tests.js';
import { ToastProvider } from '../../components/ui.jsx';

vi.mock('../../api/tests.js', () => ({
  listTestsApi: vi.fn(),
  myAttemptsApi: vi.fn(),
  startTestApi: vi.fn(),
}));

const available = { id: 'available-1', title: 'Available test', description: 'Ready to take', durationMinutes: 20, questionCount: 10, state: 'available' };
const inProgress = { id: 'progress-1', title: 'In-progress test', description: 'Continue where you left off', durationMinutes: 30, questionCount: 15, state: 'in_progress' };
const completed = {
  id: 'completed-1',
  title: 'Completed test',
  description: 'Already submitted',
  durationMinutes: 15,
  questionCount: 8,
  state: 'completed',
  attemptId: 'attempt-1',
  lastResult: { score: 6, maxScore: 8, accuracy: 75 },
};

function renderTests() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/student/tests']}>
        <Routes>
          <Route path="/student/tests" element={<Tests />} />
          <Route path="/student/tests/attempt/:id" element={<p>Attempt route opened</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listTestsApi.mockResolvedValue([available, inProgress, completed]);
  myAttemptsApi.mockResolvedValue({ items: [], page: 1, totalPages: 1 });
  startTestApi.mockResolvedValue({ id: 'attempt-new' });
});

afterEach(cleanup);

describe('Aptitude tests page', () => {
  it('shows the correct action for available, in-progress, and completed tests', async () => {
    renderTests();

    const availableCard = await screen.findByRole('heading', { name: 'Available test' }).then((heading) => heading.closest('article'));
    const progressCard = screen.getByRole('heading', { name: 'In-progress test' }).closest('article');
    const completedCard = screen.getByRole('heading', { name: 'Completed test' }).closest('article');

    expect(within(availableCard).getByRole('button', { name: 'Start test' })).toBeEnabled();
    expect(within(progressCard).getByRole('button', { name: 'Resume test' })).toBeEnabled();
    expect(within(completedCard).getByRole('link', { name: 'View result' })).toHaveAttribute('href', '/student/tests/result/attempt-1');
    expect(within(completedCard).getByText('6/8')).toBeInTheDocument();
    expect(within(completedCard).getByText(/Last score/)).toHaveTextContent('75% accuracy');
  });

  it('opens the attempt route after starting a test', async () => {
    const user = userEvent.setup();
    renderTests();

    await user.click(await screen.findByRole('button', { name: 'Start test' }));

    expect(await screen.findByText('Attempt route opened')).toBeInTheDocument();
    expect(startTestApi).toHaveBeenCalledWith('available-1');
  });

  it('shows an error and reloads the test list if starting an attempt fails', async () => {
    const user = userEvent.setup();
    startTestApi.mockRejectedValueOnce({ request: {}, message: 'Network error' });
    renderTests();
    const startButton = await screen.findByRole('button', { name: 'Start test' });

    await user.click(startButton);

    expect(await screen.findByText('Cannot reach the server. Check your connection.')).toBeInTheDocument();
    await waitFor(() => expect(listTestsApi).toHaveBeenCalledTimes(2));
  });
});
