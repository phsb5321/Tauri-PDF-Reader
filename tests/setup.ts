import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";

// Mock Tauri APIs for testing
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Explicit cleanup keeps the serial coverage runner isolated across test files.
// Relying on Testing Library's auto-registration leaked rendered trees into the
// next file in this Vitest configuration, turning unrelated semantic queries
// into ambiguous matches.
afterEach(cleanup);

// Export mock for test access
export { mockInvoke };
