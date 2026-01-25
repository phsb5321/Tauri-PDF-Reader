import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Panel } from '../../ui/components/Panel/Panel';

describe('Panel', () => {
  it('renders with title and children', () => {
    render(
      <Panel title="Test Panel">
        <p>Panel content</p>
      </Panel>
    );

    expect(screen.getByText('Test Panel')).toBeInTheDocument();
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('renders without title', () => {
    render(
      <Panel>
        <p>No title panel</p>
      </Panel>
    );

    expect(screen.getByText('No title panel')).toBeInTheDocument();
  });

  it('applies position class', () => {
    const { rerender, container } = render(
      <Panel title="Left" position="left">
        Content
      </Panel>
    );
    expect(container.firstChild).toHaveClass('panel--left');

    rerender(
      <Panel title="Right" position="right">
        Content
      </Panel>
    );
    expect(container.firstChild).toHaveClass('panel--right');
  });

  it('can be collapsed', () => {
    const { container } = render(
      <Panel title="Collapsible" collapsed>
        Content
      </Panel>
    );
    expect(container.firstChild).toHaveClass('panel--collapsed');
  });

  it('calls onClose when close button clicked', () => {
    const handleClose = vi.fn();
    render(
      <Panel title="Closable" onClose={handleClose}>
        Content
      </Panel>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not show close button when onClose not provided', () => {
    render(<Panel title="No Close">Content</Panel>);
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('renders header actions', () => {
    render(
      <Panel
        title="With Actions"
        headerActions={<button>Action</button>}
      >
        Content
      </Panel>
    );

    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('applies custom width', () => {
    const { container } = render(
      <Panel title="Custom Width" width={400}>
        Content
      </Panel>
    );
    expect(container.firstChild).toHaveStyle({ width: '400px' });
  });

  it('has proper ARIA attributes', () => {
    render(
      <Panel title="Accessible Panel">
        Panel body
      </Panel>
    );

    const panel = screen.getByRole('complementary');
    expect(panel).toHaveAttribute('aria-label', 'Accessible Panel');
  });
});
