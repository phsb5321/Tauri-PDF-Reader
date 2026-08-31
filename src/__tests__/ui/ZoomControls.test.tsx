import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ZoomControls } from "../../components/ZoomControls";
import { useDocumentStore } from "../../stores/document-store";

afterEach(() => useDocumentStore.getState().reset());

function selectedZoomLabel(): string | null {
  const select = screen.getByRole("combobox", { name: "Zoom level" });
  return within(select).getByRole("option", { selected: true }).textContent;
}

describe("real PDF zoom controls", () => {
  it("shows one truthful continuous zoom value instead of a rounded preset plus a second percentage", () => {
    useDocumentStore.setState({ zoomLevel: 2.8, fitMode: "none" });
    render(<ZoomControls />);

    expect(selectedZoomLabel()).toBe("280%");
    expect(screen.queryByTitle("Current zoom level")).not.toBeInTheDocument();
  });

  it("keeps fit mode and its measured scale in one selected label", () => {
    useDocumentStore.setState({ zoomLevel: 2.8, fitMode: "fit-page" });
    render(<ZoomControls />);

    expect(selectedZoomLabel()).toBe("Fit Page · 280%");
  });

  it("reports the exact high-zoom step selected by the public control", () => {
    useDocumentStore.setState({ zoomLevel: 2.8, fitMode: "none" });
    render(<ZoomControls />);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(useDocumentStore.getState().zoomLevel).toBeCloseTo(3.3);
    expect(selectedZoomLabel()).toBe("330%");
  });
});
