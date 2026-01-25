import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../../ui/components/Toast/Toast';

describe('Toast', () => {
  it('renders message', () => {
    render(<Toast message="Operation successful" />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const { container, rerender } = render(
      <Toast message="Info" variant="info" />
    );
    expect(container.firstChild).toHaveClass('toast--info');

    rerender(<Toast message="Success" variant="success" />);
    expect(container.firstChild).toHaveClass('toast--success');

    rerender(<Toast message="Warning" variant="warning" />);
    expect(container.firstChild).toHaveClass('toast--warning');

    rerender(<Toast message="Error" variant="error" />);
    expect(container.firstChild).toHaveClass('toast--error');
  });

  it('calls onClose when close button clicked', () => {
    const handleClose = vi.fn();
    render(<Toast message="Dismissible" onClose={handleClose} />);

    const closeButton = screen.getByRole('button', { name: /dismiss|close/i });
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders action button when provided', () => {
    const handleAction = vi.fn();
    render(
      <Toast
        message="With action"
        action={{
          label: 'Undo',
          onClick: handleAction,
        }}
      />
    );

    const actionButton = screen.getByRole('button', { name: 'Undo' });
    fireEvent.click(actionButton);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after duration', async () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(<Toast message="Auto dismiss" duration={3000} onClose={handleClose} />);

    expect(handleClose).not.toHaveBeenCalled();

    // Advance timers and flush promises
    await vi.advanceTimersByTimeAsync(3000);

    expect(handleClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('does not auto-dismiss when duration is 0', async () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(<Toast message="Persistent" duration={0} onClose={handleClose} />);

    vi.advanceTimersByTime(10000);
    expect(handleClose).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<Toast message="Accessible toast" variant="success" />);

    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
  });

  it('renders icon based on variant', () => {
    const { container } = render(<Toast message="With icon" variant="success" />);
    expect(container.querySelector('.toast__icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Toast message="Custom class" className="custom-toast" />
    );
    expect(container.firstChild).toHaveClass('custom-toast');
  });
});
