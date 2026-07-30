import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { CreateSessionDialog } from "../../components/session-menu/CreateSessionDialog";
import type { Document } from "../../lib/schemas";
import { useLibraryStore } from "../../stores/library-store";

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

const DOCUMENT: Document = {
  id: "document-id",
  filePath: "/books/testing.pdf",
  title: "Testing",
  pageCount: 12,
  currentPage: 1,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: null,
  fileHash: null,
  createdAt: "2026-07-30T12:00:00.000Z",
};

const originalLoadDocuments = useLibraryStore.getState().loadDocuments;

describe("CreateSessionDialog", () => {
  const loadDocuments = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    act(() => {
      useLibraryStore.setState({
        documents: [DOCUMENT],
        loadDocuments,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useLibraryStore.getState().reset();
    });
  });

  afterAll(() => {
    act(() => {
      useLibraryStore.setState({ loadDocuments: originalLoadDocuments });
    });
  });

  it("loads documents and creates a named session", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CreateSessionDialog isOpen onClose={onClose} onCreate={onCreate} />,
    );
    await waitFor(() => expect(loadDocuments).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Session Name"), {
      target: { value: "  Research  " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Testing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create Session" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith("Research", [DOCUMENT.id]);
    expect(loadDocuments).toHaveBeenCalledOnce();

    fireEvent.keyDown(screen.getByLabelText("Session Name"), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows validation and creation errors", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Database offline"));
    render(
      <CreateSessionDialog isOpen onClose={vi.fn()} onCreate={onCreate} />,
    );
    await waitFor(() => expect(loadDocuments).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Create Session" }));
    expect(
      await screen.findByText("Session name cannot be empty"),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText("Session Name"), {
      target: { value: "Research" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Session" }));

    expect(await screen.findByText("Database offline")).toBeVisible();
  });

  it("does not render while closed", () => {
    render(
      <CreateSessionDialog
        isOpen={false}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
