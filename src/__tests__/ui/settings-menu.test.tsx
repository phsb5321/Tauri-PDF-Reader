/**
 * The Settings menu item opens the settings panel — from the shell, both
 * with and without a document open.
 *
 * `SettingsPanel` (appearance/rendering/tts/cache/highlights/shortcuts/
 * telemetry) was built, styled and exported from `components/settings/`, but
 * nothing in the tree ever mounted it — the same "shipped unreachable" defect
 * class as #71/#69. A unit test on `SettingsPanel` in isolation cannot catch
 * that its parent never renders it, so this test goes through the real
 * shell: `ReaderView` is rendered for real, and the native `"settings"` menu
 * action is dispatched through the real `onMenuAction` subscription and the
 * real `dispatchMenuAction`/`useMenuActions` wiring — only the Tauri IPC
 * boundary (`listen`) is stubbed, the same boundary substitution every other
 * shell test in this file uses.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../../tests/setup";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import type { MenuAction } from "../../lib/api/menu";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), getPage: vi.fn() },
}));

// Stubs for what the shell hosts around the surface under test.
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("../../components/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("../../components/playback-bar/AiPlaybackBar", () => ({
  AiPlaybackBar: () => <div data-testid="playback-bar" />,
}));

// Capture the real listener `useMenuActions` registers, so the test can fire
// a "settings" activation the same way the native menu bridge would — only
// the Tauri `listen()` call underneath `onMenuAction` is stubbed.
let menuActionListener: ((action: MenuAction) => void) | undefined;
vi.mock("../../lib/api/menu", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/api/menu")>(
      "../../lib/api/menu",
    );
  return {
    ...actual,
    onMenuAction: vi.fn((callback: (action: MenuAction) => void) => {
      menuActionListener = callback;
      return Promise.resolve(() => {
        menuActionListener = undefined;
      });
    }),
  };
});

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);

const IN_FLIGHT: Document = {
  id: "doc-1",
  filePath: "/books/moby-dick.pdf",
  title: "Moby-Dick",
  pageCount: 585,
  currentPage: 213,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-07-30T10:00:00Z",
  fileHash: null,
  createdAt: "2026-07-01T00:00:00Z",
} as Document;

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({
    numPages: 585,
  } as unknown as PDFDocumentProxy);
  menuActionListener = undefined;

  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_list_documents":
        return Promise.resolve([IN_FLIGHT]);
      case "collections_list":
      case "collections_list_memberships":
        return Promise.resolve([]);
      case "library_heal_document":
      case "library_open_document":
        return Promise.resolve(IN_FLIGHT);
      case "settings_get_all_v2":
        return Promise.resolve({ settings: {} });
      default:
        return Promise.resolve(null);
    }
  });
});

/** Fire the "settings" native menu action through the real listener. */
function activateSettingsFromMenu() {
  act(() => {
    menuActionListener?.("settings");
  });
}

describe("the Settings menu action", () => {
  it("opens the settings panel from the reading home (no document open)", async () => {
    render(<ReaderView />);
    await waitFor(() => expect(menuActionListener).toBeDefined());

    expect(
      screen.queryByRole("dialog", { name: "Settings" }),
    ).not.toBeInTheDocument();

    activateSettingsFromMenu();

    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("opens the settings panel from inside a document", async () => {
    render(<ReaderView />);
    await waitFor(() => expect(menuActionListener).toBeDefined());

    const shelf = await screen.findByRole("region", {
      name: "Continue reading",
    });
    fireEvent.click(within(shelf).getByRole("button", { name: /Moby-Dick/ }));
    await waitFor(() =>
      expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument(),
    );

    activateSettingsFromMenu();

    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeInTheDocument();
  });
});
