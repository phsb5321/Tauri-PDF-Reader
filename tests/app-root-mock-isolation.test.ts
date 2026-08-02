import "../src/__tests__/ui/app-root-reachability.test";
import { expect, it } from "vitest";
import { mockInvoke } from "./setup";

it("leaves the next test module without the App fixture IPC implementation", () => {
  // Importing the App test above registers its scoped test first in this
  // worker. This assertion runs before Vitest's end-of-file mock restoration.
  expect(mockInvoke.getMockImplementation()).toBeUndefined();
});
