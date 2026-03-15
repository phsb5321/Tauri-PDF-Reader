/**
 * FileDialogAdapter Tests
 *
 * Tests for the TauriFileDialogAdapter and FileDialogPort interface.
 * Uses mocking since actual dialog calls require user interaction.
 *
 * @feature 007-ui-ux-overhaul (P0-2)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  FileDialogPort,
  OpenDialogOptions,
  SaveDialogOptions,
} from "../../ports/file-dialog.port";
import { FILE_FILTERS } from "../../ports/file-dialog.port";

// Mock the @tauri-apps/plugin-dialog module
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Import after mocking
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  TauriFileDialogAdapter,
  fileDialog,
} from "../../adapters/tauri/file-dialog.adapter";

describe("FileDialogPort", () => {
  describe("FILE_FILTERS constants", () => {
    it("should have PDF filter with correct structure", () => {
      expect(FILE_FILTERS.PDF).toEqual({
        name: "PDF Documents",
        extensions: ["pdf"],
      });
    });

    it("should have JSON filter with correct structure", () => {
      expect(FILE_FILTERS.JSON).toEqual({
        name: "JSON Files",
        extensions: ["json"],
      });
    });

    it("should have TEXT filter with correct structure", () => {
      expect(FILE_FILTERS.TEXT).toEqual({
        name: "Text Files",
        extensions: ["txt"],
      });
    });

    it("should have AUDIO filter with correct structure", () => {
      expect(FILE_FILTERS.AUDIO).toEqual({
        name: "Audio Files",
        extensions: ["mp3", "wav", "ogg"],
      });
    });

    it("should have ALL filter with wildcard", () => {
      expect(FILE_FILTERS.ALL).toEqual({
        name: "All Files",
        extensions: ["*"],
      });
    });
  });
});

describe("TauriFileDialogAdapter", () => {
  let adapter: FileDialogPort;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TauriFileDialogAdapter();
  });

  describe("open()", () => {
    it("should call tauri open with no options", async () => {
      vi.mocked(open).mockResolvedValue("/path/to/file.pdf");

      const result = await adapter.open();

      expect(open).toHaveBeenCalledWith({
        title: undefined,
        filters: undefined,
        defaultPath: undefined,
        multiple: undefined,
        directory: undefined,
      });
      expect(result).toBe("/path/to/file.pdf");
    });

    it("should pass all options to tauri open", async () => {
      const options: OpenDialogOptions = {
        title: "Select PDF",
        filters: [FILE_FILTERS.PDF],
        defaultPath: "/home/user",
        multiple: false,
        directory: false,
      };

      vi.mocked(open).mockResolvedValue("/selected/file.pdf");

      const result = await adapter.open(options);

      expect(open).toHaveBeenCalledWith({
        title: "Select PDF",
        filters: [FILE_FILTERS.PDF],
        defaultPath: "/home/user",
        multiple: false,
        directory: false,
      });
      expect(result).toBe("/selected/file.pdf");
    });

    it("should return null when user cancels", async () => {
      vi.mocked(open).mockResolvedValue(null);

      const result = await adapter.open();

      expect(result).toBeNull();
    });

    it("should return array when multiple is true", async () => {
      const paths = ["/file1.pdf", "/file2.pdf"];
      vi.mocked(open).mockResolvedValue(paths);

      const result = await adapter.open({ multiple: true });

      expect(result).toEqual(paths);
    });

    it("should return directory path when directory is true", async () => {
      vi.mocked(open).mockResolvedValue("/selected/directory");

      const result = await adapter.open({ directory: true });

      expect(result).toBe("/selected/directory");
    });

    it("should handle multiple filters", async () => {
      const options: OpenDialogOptions = {
        filters: [FILE_FILTERS.PDF, FILE_FILTERS.ALL],
      };

      vi.mocked(open).mockResolvedValue("/file.pdf");

      await adapter.open(options);

      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [FILE_FILTERS.PDF, FILE_FILTERS.ALL],
        }),
      );
    });
  });

  describe("save()", () => {
    it("should call tauri save with no options", async () => {
      vi.mocked(save).mockResolvedValue("/path/to/save.pdf");

      const result = await adapter.save();

      expect(save).toHaveBeenCalledWith({
        title: undefined,
        filters: undefined,
        defaultPath: undefined,
      });
      expect(result).toBe("/path/to/save.pdf");
    });

    it("should pass all options to tauri save", async () => {
      const options: SaveDialogOptions = {
        title: "Export Highlights",
        filters: [FILE_FILTERS.JSON],
        defaultPath: "highlights.json",
      };

      vi.mocked(save).mockResolvedValue("/home/user/highlights.json");

      const result = await adapter.save(options);

      expect(save).toHaveBeenCalledWith({
        title: "Export Highlights",
        filters: [FILE_FILTERS.JSON],
        defaultPath: "highlights.json",
      });
      expect(result).toBe("/home/user/highlights.json");
    });

    it("should return null when user cancels", async () => {
      vi.mocked(save).mockResolvedValue(null);

      const result = await adapter.save();

      expect(result).toBeNull();
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton fileDialog instance", () => {
      expect(fileDialog).toBeInstanceOf(TauriFileDialogAdapter);
    });

    it("should be the same instance on multiple imports", async () => {
      // This tests that the singleton pattern works
      const { fileDialog: fileDialog2 } = await import(
        "../../adapters/tauri/file-dialog.adapter"
      );
      expect(fileDialog).toBe(fileDialog2);
    });
  });
});

describe("FileDialogPort interface compliance", () => {
  let adapter: FileDialogPort;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TauriFileDialogAdapter();
  });

  it("should implement open method", () => {
    expect(typeof adapter.open).toBe("function");
  });

  it("should implement save method", () => {
    expect(typeof adapter.save).toBe("function");
  });

  it("should return correct types from open", async () => {
    vi.mocked(open).mockResolvedValue("/file.pdf");

    const result = await adapter.open();

    // Result should be string | string[] | null
    expect(
      typeof result === "string" || result === null || Array.isArray(result),
    ).toBe(true);
  });

  it("should return correct types from save", async () => {
    vi.mocked(save).mockResolvedValue("/file.json");

    const result = await adapter.save();

    // Result should be string | null
    expect(typeof result === "string" || result === null).toBe(true);
  });
});
