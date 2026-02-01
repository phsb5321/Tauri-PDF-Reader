/**
 * Session domain validation tests
 */

import { describe, it, expect } from "vitest";
import {
  validateSessionName,
  createLocalSession,
  toSessionSummary,
  SESSION_NAME_MAX_LENGTH,
  type ReadingSession,
} from "../../../domain/sessions/session";

describe("Session Domain", () => {
  describe("validateSessionName", () => {
    it("should reject empty name", () => {
      const result = validateSessionName("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject whitespace-only name", () => {
      const result = validateSessionName("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should accept valid name", () => {
      const result = validateSessionName("My Reading Session");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject name exceeding max length", () => {
      const longName = "a".repeat(SESSION_NAME_MAX_LENGTH + 1);
      const result = validateSessionName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("100 characters");
    });

    it("should accept name at max length", () => {
      const maxName = "a".repeat(SESSION_NAME_MAX_LENGTH);
      const result = validateSessionName(maxName);
      expect(result.valid).toBe(true);
    });

    it("should trim whitespace when validating", () => {
      const result = validateSessionName("  Valid Name  ");
      expect(result.valid).toBe(true);
    });
  });

  describe("createLocalSession", () => {
    it("should create session with trimmed name", () => {
      const session = createLocalSession("  My Session  ");
      expect(session.name).toBe("My Session");
    });

    it("should create session with empty documents array", () => {
      const session = createLocalSession("Test");
      expect(session.documents).toEqual([]);
    });

    it("should set timestamps", () => {
      const before = new Date().toISOString();
      const session = createLocalSession("Test");
      const after = new Date().toISOString();

      expect(session.createdAt >= before).toBe(true);
      expect(session.createdAt <= after).toBe(true);
      expect(session.updatedAt).toBe(session.createdAt);
      expect(session.lastAccessedAt).toBe(session.createdAt);
    });

    it("should have empty id (assigned by backend)", () => {
      const session = createLocalSession("Test");
      expect(session.id).toBe("");
    });
  });

  describe("toSessionSummary", () => {
    it("should convert session to summary", () => {
      const session: ReadingSession = {
        id: "session-123",
        name: "My Session",
        documents: [
          {
            documentId: "doc-1",
            position: 0,
            currentPage: 5,
            scrollPosition: 0.5,
            createdAt: "2024-01-01T00:00:00Z",
          },
          {
            documentId: "doc-2",
            position: 1,
            currentPage: 1,
            scrollPosition: 0.0,
            createdAt: "2024-01-01T00:00:00Z",
          },
        ],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        lastAccessedAt: "2024-01-03T00:00:00Z",
      };

      const summary = toSessionSummary(session);

      expect(summary.id).toBe("session-123");
      expect(summary.name).toBe("My Session");
      expect(summary.documentCount).toBe(2);
      expect(summary.lastAccessedAt).toBe("2024-01-03T00:00:00Z");
      expect(summary.createdAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should handle session with no documents", () => {
      const session: ReadingSession = {
        id: "empty-session",
        name: "Empty",
        documents: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        lastAccessedAt: "2024-01-01T00:00:00Z",
      };

      const summary = toSessionSummary(session);
      expect(summary.documentCount).toBe(0);
    });
  });
});
