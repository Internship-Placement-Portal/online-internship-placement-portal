
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ListingCard from './ListingCard.jsx';

vi.mock('../lib/format.js', () => ({
  daysLeft: vi.fn(() => '5 days left'),
  formatStipend: vi.fn(() => '₹15,000/month'),
}));

const listing = {
  company: 'Acme Technologies',
  title: 'Frontend Developer Intern',
  location: 'Bengaluru',
  duration: 3,
  domain: 'Web Development',
  skills: ['React', 'JavaScript', 'CSS', 'HTML'],
  stipend: 15000,
  deadline: '2026-12-31',
  status: 'Open',
};

afterEach(() => {
  cleanup();
});

describe('ListingCard', () => {
  it('renders the main internship details', () => {
    render(
      <MemoryRouter>
        <ListingCard listing={listing} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Frontend Developer Intern' })
    ).toBeInTheDocument();

    expect(screen.getByText('Acme Technologies')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru')).toBeInTheDocument();
    expect(screen.getByText('3 months')).toBeInTheDocument();
    expect(screen.getByText('Web Development')).toBeInTheDocument();
    expect(screen.getByText('₹15,000/month')).toBeInTheDocument();
    expect(screen.getByText('5 days left')).toBeInTheDocument();
  });

  it('displays at most three skill chips', () => {
    render(
      <MemoryRouter>
        <ListingCard listing={listing} />
      </MemoryRouter>
    );

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('CSS')).toBeInTheDocument();
    expect(screen.queryByText('HTML')).not.toBeInTheDocument();
  });

  it('shows the Apply cue and destination when a route is provided', () => {
    render(
      <MemoryRouter>
        <ListingCard listing={listing} to="/student/internships/42" />
      </MemoryRouter>
    );

    expect(screen.getByText('Apply')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Frontend Developer Intern/i })
    ).toHaveAttribute('href', '/student/internships/42');
  });

  it('renders an article instead of a link when no route is provided', () => {
    const { container } = render(
      <MemoryRouter>
        <ListingCard listing={listing} />
      </MemoryRouter>
    );

    expect(container.querySelector('article.listing-card')).not.toBeNull();
    expect(screen.queryByText('Apply')).not.toBeInTheDocument();
  });

  it('shows the status badge only when showStatus is enabled', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ListingCard listing={listing} showStatus={false} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Open')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ListingCard listing={listing} showStatus />
      </MemoryRouter>
    );

    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('handles an internship without skills', () => {
    const listingWithoutSkills = { ...listing, skills: undefined };

    render(
      <MemoryRouter>
        <ListingCard listing={listingWithoutSkills} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Frontend Developer Intern' })
    ).toBeInTheDocument();
  });
});
