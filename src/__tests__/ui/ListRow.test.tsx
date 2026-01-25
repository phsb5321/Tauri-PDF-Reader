import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListRow } from '../../ui/components/ListRow/ListRow';

describe('ListRow', () => {
  it('renders with primary text', () => {
    render(<ListRow primary="Item title" />);
    expect(screen.getByText('Item title')).toBeInTheDocument();
  });

  it('renders with secondary text', () => {
    render(<ListRow primary="Title" secondary="Subtitle" />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('renders leading element', () => {
    const LeadingIcon = () => <svg data-testid="leading-icon" />;
    render(<ListRow primary="With icon" leading={<LeadingIcon />} />);
    expect(screen.getByTestId('leading-icon')).toBeInTheDocument();
  });

  it('renders trailing element', () => {
    const TrailingIcon = () => <svg data-testid="trailing-icon" />;
    render(<ListRow primary="With trailing" trailing={<TrailingIcon />} />);
    expect(screen.getByTestId('trailing-icon')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<ListRow primary="Clickable" onClick={handleClick} />);

    fireEvent.click(screen.getByText('Clickable').closest('div')!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies selected state', () => {
    const { container } = render(<ListRow primary="Selected" selected />);
    expect(container.firstChild).toHaveClass('list-row--selected');
  });

  it('applies disabled state', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <ListRow primary="Disabled" disabled onClick={handleClick} />
    );

    expect(container.firstChild).toHaveClass('list-row--disabled');

    fireEvent.click(screen.getByText('Disabled').closest('div')!);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders as interactive when onClick provided', () => {
    const { container } = render(
      <ListRow primary="Interactive" onClick={() => {}} />
    );
    expect(container.firstChild).toHaveClass('list-row--interactive');
  });

  it('renders metadata slot', () => {
    render(
      <ListRow
        primary="With metadata"
        metadata={<span data-testid="metadata">Info</span>}
      />
    );
    expect(screen.getByTestId('metadata')).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    render(
      <ListRow
        primary="Accessible Row"
        secondary="With description"
        onClick={() => {}}
      />
    );

    // Should be a button when clickable for accessibility
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
