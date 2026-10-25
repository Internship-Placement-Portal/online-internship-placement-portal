
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function TestExample() {
  return <h1>Internship Placement Portal</h1>;
}

describe('Frontend testing setup', () => {
  it('renders the portal heading', () => {
    render(<TestExample />);

    expect(
      screen.getByRole('heading', {
        name: 'Internship Placement Portal',
      })
    ).toBeInTheDocument();
  });
});
