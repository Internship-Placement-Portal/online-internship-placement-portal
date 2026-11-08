import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TestResult from './TestResult.jsx';
import { attemptResultApi } from '../../api/tests.js';

vi.mock('../../api/tests.js', () => ({
  attemptResultApi: vi.fn(),
}));

const result = {
  test: { title: 'JavaScript assessment' },
  attemptNo: 2,
  submittedAt: '2026-10-20T12:00:00.000Z',
  status: 'auto_submitted',
  accuracy: 75,
  score: 3,
  maxScore: 4,
  correctCount: 1,
  answeredCount: 3,
  totalQuestions: 4,
  timeTakenSec: 125,
  avgTimePerQuestionSec: 31,
  codingPending: 1,
  categoryBreakdown: [{ category: 'JavaScript', accuracy: 50, correct: 1, total: 2 }],
  review: [
    {
      questionId: 'q-1',
      type: 'mcq',
      correct: true,
      order: 1,
      text: 'Which value is a string?',
      timeSpentSec: 12,
      options: ['42', "'hello'", 'true'],
      correctIndex: 1,
      selectedIndex: 1,
    },
    {
      questionId: 'q-2',
      type: 'mcq',
      correct: false,
      order: 2,
      text: 'Which method creates a new array?',
      timeSpentSec: 25,
      options: ['push', 'map', 'pop'],
      correctIndex: 1,
      selectedIndex: 0,
    },
    {
      questionId: 'q-3',
      type: 'mcq',
      correct: null,
      order: 3,
      text: 'Which keyword declares a constant?',
      timeSpentSec: 8,
      options: ['let', 'const', 'var'],
      correctIndex: 1,
      selectedIndex: null,
    },
    {
      questionId: 'q-4',
      type: 'coding',
      correct: null,
      order: 4,
      text: 'Write a function that doubles a number.',
      timeSpentSec: 80,
      codeAnswer: 'return value * 2;',
    },
  ],
};

function renderResult() {
  return render(
    <MemoryRouter initialEntries={['/student/tests/result/attempt-42']}>
      <Routes>
        <Route path="/student/tests/result/:id" element={<TestResult />} />
        <Route path="/student/tests" element={<p>Tests list</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  attemptResultApi.mockResolvedValue(result);
});

afterEach(cleanup);

describe('TestResult', () => {
  it('shows the score, submission warning, summary, and category breakdown', async () => {
    renderResult();

    expect(await screen.findByRole('heading', { name: 'JavaScript assessment' })).toBeInTheDocument();
    expect(attemptResultApi).toHaveBeenCalledWith('attempt-42');
    expect(screen.getByText('Time ran out, so your test was submitted automatically with the answers saved so far.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'accuracy: 75%' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/ 4')).toBeInTheDocument();
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
    expect(screen.getByText('2m 05s')).toBeInTheDocument();
    expect(screen.getByText('1 awaiting review')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'JavaScript: 50%' })).toBeInTheDocument();
  });

  it('reveals correct, incorrect, unanswered, and coding responses in the review', async () => {
    const user = userEvent.setup();
    renderResult();

    const correctDetails = (await screen.findByText(/Which value is a string\?/)).closest('details');
    await user.click(within(correctDetails).getByText(/Which value is a string\?/));
    expect(within(correctDetails).getByText(/hello/)).toBeInTheDocument();
    expect(within(correctDetails).getByText(/correct answer/)).toBeInTheDocument();

    const incorrectDetails = screen.getByText(/Which method creates a new array\?/).closest('details');
    await user.click(within(incorrectDetails).getByText(/Which method creates a new array\?/));
    expect(within(incorrectDetails).getByText(/your answer/)).toBeInTheDocument();

    const unansweredDetails = screen.getByText(/Which keyword declares a constant\?/).closest('details');
    await user.click(within(unansweredDetails).getByText(/Which keyword declares a constant\?/));
    expect(within(unansweredDetails).getByText('You did not answer this question.')).toBeInTheDocument();

    const codingDetails = screen.getByText(/Write a function that doubles a number\./).closest('details');
    await user.click(within(codingDetails).getByText(/Write a function that doubles a number\./));
    expect(within(codingDetails).getByText('return value * 2;')).toBeInTheDocument();
  });

  it('returns to tests when the attempt result cannot be loaded', async () => {
    attemptResultApi.mockRejectedValueOnce({ request: {}, message: 'Network error' });
    renderResult();

    expect(await screen.findByText('Cannot reach the server. Check your connection.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tests' })).toHaveAttribute('href', '/student/tests');
    await userEvent.click(screen.getByRole('link', { name: 'Tests' }));
    expect(await screen.findByText('Tests list')).toBeInTheDocument();
  });
});
