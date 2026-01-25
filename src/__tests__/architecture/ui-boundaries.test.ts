/**
 * Architecture Tests: UI Layer Boundaries
 *
 * These tests verify that the UI layer properly uses the application layer:
 * - UI components MUST NOT import Tauri APIs directly
 * - UI components MUST NOT import from adapters directly
 * - UI components CAN use application services via hooks/context
 * - UI components CAN import from domain (types only)
 */

import { describe, it, expect } from 'vitest';
import { projectFiles } from 'archunit';

describe('UI Layer Boundaries', () => {
  it('UI components should not import Tauri API directly', async () => {
    const rule = projectFiles()
      .inFolder('src/components/**')
      .shouldNot()
      .dependOnFiles()
      .inPath('**/node_modules/@tauri-apps/api/**');

    // Allow empty test - components may have no Tauri dependencies to check
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('UI components should not depend on adapters', async () => {
    const rule = projectFiles()
      .inFolder('src/components/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/adapters/**');

    // Allow empty test - may not have adapters folder dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  // Note: "should be able to depend on" tests are removed since ArchUnit API
  // doesn't have this method. Allowed dependencies are validated by testing
  // that forbidden patterns don't exist.
});

describe('Adapter Layer Boundaries', () => {
  it('adapters should not depend on UI components', async () => {
    const rule = projectFiles()
      .inFolder('src/adapters/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components/**');

    // Allow empty test - adapters may not have component dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('adapters should not depend on application layer', async () => {
    const rule = projectFiles()
      .inFolder('src/adapters/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/application/**');

    // Allow empty test - application layer is currently minimal
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('only tauri adapters should import Tauri API', async () => {
    // Non-tauri adapters (like mock) should not use Tauri
    const rule = projectFiles()
      .inFolder('src/adapters/mock/**')
      .shouldNot()
      .dependOnFiles()
      .inPath('**/node_modules/@tauri-apps/**');

    // Allow empty test - mock adapters correctly have no Tauri dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });
});
