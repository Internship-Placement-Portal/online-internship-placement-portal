
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Internships from './Internships.jsx';
import { domainsApi, searchListingsApi } from '../../api/listings.js';

vi.mock('../../api/listings.js', () => ({
  domainsApi: vi.fn(),
  searchListingsApi: vi.fn(),
}));

const mockListing = {
  id: 'intern-1',
  company: 'Acme',
  title: 'Frontend Developer Intern',
  location: 'Bengaluru',
  duration: 3,
  domain: 'Technology',
  skills: ['React', 'JavaScript'],
  stipend: 10000,
  deadline: '2099-12-31',
};

function renderPage(initialEntry = '/student/internships') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Internships />
    </MemoryRouter>
  );
}

describe('Internships page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    domainsApi.mockResolvedValue(['Technology', 'Design']);

    searchListingsApi.mockResolvedValue({
      total: 1,
      page: 1,
      totalPages: 1,
      items: [mockListing],
    });
  });

  it('renders the internship search heading', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Find your internship' })
    ).toBeInTheDocument();
  });

  it('displays internship results returned by the API', async () => {
    renderPage();

    expect(
      await screen.findByText('Frontend Developer Intern')
    ).toBeInTheDocument();

    expect(await screen.findByText('1 internship found')).toBeInTheDocument();
  });

  it('allows the user to enter a search keyword', () => {
    renderPage();

    const search = screen.getByRole('searchbox', { name: 'Search' });

    fireEvent.change(search, {
      target: { value: 'Frontend' },
    });

    expect(search).toHaveValue('Frontend');
  });

  it('submits the search and updates the URL query', async () => {
    renderPage();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'Frontend' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      expect(searchListingsApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          q: 'Frontend',
          page: 1,
          limit: 9,
        })
      );
    });
  });

  it('shows an empty state when no internships match', async () => {
    searchListingsApi.mockResolvedValueOnce({
      total: 0,
      page: 1,
      totalPages: 0,
      items: [],
    });

    renderPage();

    expect(
      await screen.findByText('No internships match your search')
    ).toBeInTheDocument();
  });

  it('shows the Clear button when URL filters exist', () => {
    renderPage('/student/internships?domain=Technology');

    expect(
      screen.getByRole('button', { name: 'Clear' })
    ).toBeInTheDocument();
  });
});
