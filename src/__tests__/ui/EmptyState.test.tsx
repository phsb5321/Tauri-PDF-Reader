import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../../ui/components/EmptyState/EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No documents"
        description="Add your first document to get started"
      />
    );

    expect(screen.getByText('No documents')).toBeInTheDocument();
    expect(screen.getByText('Add your first document to get started')).toBeInTheDocument();
  });

  it('renders without description', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const TestIcon = () => <svg data-testid="empty-icon" />;
    render(<EmptyState title="Empty" icon={<TestIcon />} />);
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{
          label: 'Add item',
          onClick: handleAction,
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Add item' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('applies variant classes', () => {
    const { container, rerender } = render(
      <EmptyState title="Default" variant="default" />
    );
    expect(container.firstChild).toHaveClass('empty-state--default');

    rerender(<EmptyState title="Compact" variant="compact" />);
    expect(container.firstChild).toHaveClass('empty-state--compact');
  });

  it('renders secondary action when provided', () => {
    const handlePrimary = vi.fn();
    const handleSecondary = vi.fn();

    render(
      <EmptyState
        title="Multiple actions"
        action={{
          label: 'Primary',
          onClick: handlePrimary,
        }}
        secondaryAction={{
          label: 'Learn more',
          onClick: handleSecondary,
        }}
      />
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    render(
      <EmptyState
        title="Semantic Empty"
        description="With proper structure"
      />
    );

    // Title should be a heading
    expect(screen.getByRole('heading', { name: 'Semantic Empty' })).toBeInTheDocument();
  });
});
