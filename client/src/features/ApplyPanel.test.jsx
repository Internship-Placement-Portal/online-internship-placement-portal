
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApplyPanel from './ApplyPanel.jsx';
import { applyApi } from '../api/applications.js';

const mockToast = vi.fn();

vi.mock('../api/applications.js', () => ({
  applyApi: vi.fn(),
}));

vi.mock('../api/http.js', () => ({
  errorInfo: vi.fn((err) => err.info || {
    message: err.message,
    code: err.code,
  }),
}));

vi.mock('../components/ui.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

const listing = {
  id: 'listing-123',
  application: null,
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <ApplyPanel listing={listing} />
    </MemoryRouter>
  );
}

function createPdf(name = 'resume.pdf', size = 1024) {
  return new File(['x'.repeat(size)], name, {
    type: 'application/pdf',
  });
}

function getFileInput() {
  return document.querySelector('input[type="file"]');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ApplyPanel - IPP-F-010', () => {
  it('rejects files that are not PDFs', () => {
    renderPanel();

    const file = new File(['image'], 'photo.png', {
      type: 'image/png',
    });

    fireEvent.change(getFileInput(), {
      target: { files: [file] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only PDF files are accepted.'
    );
    expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
  });

  it('rejects empty PDF files', () => {
    renderPanel();

    const file = new File([], 'empty.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(getFileInput(), {
      target: { files: [file] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The selected PDF is empty.'
    );
  });

  it('rejects PDF files larger than 5 MB', () => {
    renderPanel();

    const file = createPdf('large.pdf', 5 * 1024 * 1024 + 1);

    fireEvent.change(getFileInput(), {
      target: { files: [file] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Resume must be 5 MB or smaller.'
    );
  });

  it('accepts a valid PDF and displays its name and size', () => {
    renderPanel();

    const file = createPdf('my-resume.pdf', 1024);

    fireEvent.change(getFileInput(), {
      target: { files: [file] },
    });

    expect(screen.getByText('my-resume.pdf')).toBeInTheDocument();
    expect(screen.getByText('0.00 MB')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit application' })
    ).toBeEnabled();
  });

  it('allows the student to remove a selected resume', () => {
    renderPanel();

    fireEvent.change(getFileInput(), {
      target: { files: [createPdf()] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove file' }));

    expect(screen.getByText('Choose a PDF')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit application' })
    ).toBeDisabled();
  });

  it('allows the student to change the selected resume', () => {
    renderPanel();

    fireEvent.change(getFileInput(), {
      target: { files: [createPdf('first.pdf')] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change resume' }));

    fireEvent.change(getFileInput(), {
      target: { files: [createPdf('second.pdf')] },
    });

    expect(screen.getByText('second.pdf')).toBeInTheDocument();
    expect(screen.queryByText('first.pdf')).not.toBeInTheDocument();
  });

  it('submits a valid resume successfully', async () => {
    const user = userEvent.setup();

    applyApi.mockResolvedValue({
      id: 'application-123',
      status: 'Applied',
    });

    renderPanel();

    await user.upload(getFileInput(), createPdf('resume.pdf'));

    await user.click(
      screen.getByRole('button', { name: 'Submit application' })
    );

    await waitFor(() => {
      expect(applyApi).toHaveBeenCalledWith(
        'listing-123',
        expect.objectContaining({ name: 'resume.pdf' })
      );
    });

    expect(await screen.findByText('You applied')).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      'Application submitted',
      'success'
    );
  });

  it('handles duplicate applications without allowing another submission', async () => {
    const user = userEvent.setup();

    applyApi.mockRejectedValue({
      info: {
        code: 'ALREADY_APPLIED',
        message: 'You have already applied.',
      },
    });

    renderPanel();

    await user.upload(getFileInput(), createPdf());

    await user.click(
      screen.getByRole('button', { name: 'Submit application' })
    );

    expect(await screen.findByText('You applied')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit application' })
    ).not.toBeInTheDocument();
  });
});
