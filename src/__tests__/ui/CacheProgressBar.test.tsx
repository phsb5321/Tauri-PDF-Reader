/**
 * Tests for CacheProgressBar component (T043)
 *
 * Verifies:
 * - Renders correctly with different coverage percentages
 * - Shows empty state when no cache data
 * - Displays correct visual width for progress
 * - Shows label with percentage
 * - Applies correct styling for different states
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CacheProgressBar } from "../../components/audio-progress/CacheProgressBar";

describe("CacheProgressBar", () => {
  it("renders with 0% coverage", () => {
    render(<CacheProgressBar coveragePercent={0} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders with 50% coverage", () => {
    render(<CacheProgressBar coveragePercent={50} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders with 100% coverage (fully cached)", () => {
    render(<CacheProgressBar coveragePercent={100} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
    expect(progressBar).toHaveClass("cache-progress-bar--complete");
  });

  it("shows percentage label", () => {
    render(<CacheProgressBar coveragePercent={75} showLabel />);

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("hides label when showLabel is false", () => {
    render(<CacheProgressBar coveragePercent={75} showLabel={false} />);

    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<CacheProgressBar coveragePercent={50} className="custom-class" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveClass("custom-class");
  });

  it("shows correct visual width via inline style", () => {
    const { container } = render(<CacheProgressBar coveragePercent={42} />);

    const fill = container.querySelector(".cache-progress-bar__fill");
    expect(fill).toHaveStyle({ width: "42%" });
  });

  it("renders compact variant", () => {
    render(<CacheProgressBar coveragePercent={30} variant="compact" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveClass("cache-progress-bar--compact");
  });

  it("renders default variant", () => {
    render(<CacheProgressBar coveragePercent={30} variant="default" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).not.toHaveClass("cache-progress-bar--compact");
  });

  it("handles decimal percentages by rounding", () => {
    render(<CacheProgressBar coveragePercent={33.33} showLabel />);

    // Should round to nearest integer for display
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("clamps percentage to valid range (0-100)", () => {
    const { rerender } = render(<CacheProgressBar coveragePercent={-10} />);

    let progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");

    rerender(<CacheProgressBar coveragePercent={150} />);
    progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
  });

  it("provides accessible label", () => {
    render(<CacheProgressBar coveragePercent={60} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute(
      "aria-label",
      "Audio cache coverage: 60%",
    );
  });
});
