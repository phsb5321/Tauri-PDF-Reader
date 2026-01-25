import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from '../../ui/components/IconButton/IconButton';

describe('IconButton', () => {
  const TestIcon = () => <svg data-testid="test-icon" />;

  it('renders with icon', () => {
    render(
      <IconButton label="Test">
        <TestIcon />
      </IconButton>
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(
      <IconButton label="Close dialog">
        <TestIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Close dialog'
    );
  });

  it('applies size classes', () => {
    const { rerender } = render(
      <IconButton label="Small" size="sm">
        <TestIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('icon-button--sm');

    rerender(
      <IconButton label="Large" size="lg">
        <TestIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('icon-button--lg');
  });

  it('applies variant classes', () => {
    const { rerender } = render(
      <IconButton label="Primary" variant="primary">
        <TestIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('icon-button--primary');

    rerender(
      <IconButton label="Ghost" variant="ghost">
        <TestIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('icon-button--ghost');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(
      <IconButton label="Click" onClick={handleClick}>
        <TestIcon />
      </IconButton>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    const handleClick = vi.fn();
    render(
      <IconButton label="Disabled" disabled onClick={handleClick}>
        <TestIcon />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows tooltip on hover when title is provided', () => {
    render(
      <IconButton label="Settings" title="Open settings">
        <TestIcon />
      </IconButton>
    );

    expect(screen.getByRole('button')).toHaveAttribute('title', 'Open settings');
  });

  it('applies active state class', () => {
    render(
      <IconButton label="Active" active>
        <TestIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('icon-button--active');
  });
});
