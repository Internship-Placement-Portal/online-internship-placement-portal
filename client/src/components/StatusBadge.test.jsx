import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatusBadge } from './ui.jsx';

afterEach(() => {
  cleanup();
});

describe('StatusBadge (IPP-F-011, IPP-F-006, IPP-F-014 UI mapping)', () => {
  describe('application lifecycle status badges', () => {
    it('renders Applied status with badge-info styling', () => {
      const { container } = render(<StatusBadge status="Applied" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-info');
      expect(screen.getByText('Applied')).toBeInTheDocument();
    });

    it('renders Shortlisted status with badge-warning styling', () => {
      const { container } = render(<StatusBadge status="Shortlisted" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-warning');
      expect(screen.getByText('Shortlisted')).toBeInTheDocument();
    });

    it('renders Selected status with badge-success styling', () => {
      const { container } = render(<StatusBadge status="Selected" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-success');
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('renders Rejected status with badge-danger styling', () => {
      const { container } = render(<StatusBadge status="Rejected" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-danger');
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
  });

  describe('test attempt status badges', () => {
    it('renders in_progress as In progress with badge-info', () => {
      const { container } = render(<StatusBadge status="in_progress" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-info');
      expect(screen.getByText('In progress')).toBeInTheDocument();
    });

    it('renders submitted as Submitted with badge-success', () => {
      const { container } = render(<StatusBadge status="submitted" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-success');
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('renders auto_submitted as Auto-submitted with badge-warning', () => {
      const { container } = render(<StatusBadge status="auto_submitted" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-warning');
      expect(screen.getByText('Auto-submitted')).toBeInTheDocument();
    });
  });

  describe('listing approval workflow badges', () => {
    it('renders pending_approval as Pending approval with badge-warning', () => {
      const { container } = render(<StatusBadge status="pending_approval" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-warning');
      expect(screen.getByText('Pending approval')).toBeInTheDocument();
    });

    it('renders approved as Approved with badge-success', () => {
      const { container } = render(<StatusBadge status="approved" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-success');
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('renders closed as Closed with badge-neutral', () => {
      const { container } = render(<StatusBadge status="closed" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-neutral');
      expect(screen.getByText('Closed')).toBeInTheDocument();
    });
  });

  describe('fallback handling', () => {
    it('handles unexpected status gracefully with badge-neutral and literal label', () => {
      const { container } = render(<StatusBadge status="custom_state" />);
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('badge-neutral');
      expect(screen.getByText('custom_state')).toBeInTheDocument();
    });
  });
});
