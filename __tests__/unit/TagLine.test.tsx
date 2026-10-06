import { render, screen } from '@testing-library/react';
import TagLine from '@/components/TagLine';

describe('TagLine', () => {
  it('renders the default line', () => {
    render(<TagLine />);
    expect(screen.getByText('Your #1 Platform for Tutors')).toBeInTheDocument();
  });

  it('renders a custom line when provided', () => {
    render(<TagLine line='Custom tag' />);
    expect(screen.getByText('Custom tag')).toBeInTheDocument();
  });

  it('renders the briefcase icon', () => {
    render(<TagLine />);
    expect(screen.getByAltText('Masters Hub')).toBeInTheDocument();
  });
});
