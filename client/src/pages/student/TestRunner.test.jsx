import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TestRunner from './TestRunner.jsx';
import { getAttemptApi, saveAnswersApi, submitAttemptApi } from '../../api/tests.js';
import { ToastProvider } from '../../components/ui.jsx';

vi.mock('../../api/tests.js', () => ({
  getAttemptApi: vi.fn(),
  saveAnswersApi: vi.fn(),
  submitAttemptApi: vi.fn(),
}));

const attempt = {
  id: 'attempt-42',
  status: 'in_progress',
  remainingSeconds: 600,
  test: { title: 'JavaScript assessment', durationMinutes: 20 },
  answers: [],
  questions: [
    { id: 'q-1', type: 'mcq', category: 'JavaScript', text: 'Which value is a string?', marks: 1, options: ['42', "'hello'"] },
    { id: 'q-2', type: 'coding', category: 'Functions', text: 'Double the input.', marks: 2 },
  ],
};

function renderRunner() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/student/tests/attempt/attempt-42']}>
        <Routes>
          <Route path="/student/tests/attempt/:id" element={<TestRunner />} />
          <Route path="/student/tests/result/:id" element={<p>Result route opened</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getAttemptApi.mockResolvedValue(attempt);
  saveAnswersApi.mockResolvedValue({ remainingSeconds: 600 });
  submitAttemptApi.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('TestRunner', () => {
  it('records answers and submits the completed attempt for scoring', async () => {
    const user = userEvent.setup();
    renderRunner();

    expect(await screen.findByRole('heading', { name: 'JavaScript assessment' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('radio')[1]);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByLabelText('Your answer'), 'return input * 2;');
    expect(screen.getByRole('progressbar', { name: 'Answered questions' })).toHaveAttribute('aria-valuenow', '2');

    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    expect(screen.getByRole('heading', { name: 'Submit your test?' })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('You answered 2 of 2 questions.'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit now' }));

    expect(await screen.findByText('Result route opened')).toBeInTheDocument();
    expect(submitAttemptApi).toHaveBeenCalledWith(
      'attempt-42',
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'q-1', selectedIndex: 1 }),
        expect.objectContaining({ questionId: 'q-2', codeAnswer: 'return input * 2;' }),
      ])
    );
    expect(localStorage.getItem('ipp-attempt-attempt-42')).toBeNull();
  });

  it('opens the result page instead of an already closed attempt', async () => {
    getAttemptApi.mockResolvedValueOnce({ ...attempt, status: 'submitted' });
    renderRunner();

    expect(await screen.findByText('Result route opened')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'JavaScript assessment' })).not.toBeInTheDocument();
  });
});
