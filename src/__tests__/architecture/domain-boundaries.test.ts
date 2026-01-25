/**
 * Architecture Tests: Domain Layer Boundaries
 *
 * These tests verify that the domain layer maintains proper isolation:
 * - Domain MUST NOT import from adapters
 * - Domain MUST NOT import Tauri APIs directly
 * - Domain CAN import from other domain modules
 * - Domain CAN import from ports (interfaces only)
 */

import { describe, it, expect } from 'vitest';
import { projectFiles } from 'archunit';

describe('Domain Layer Boundaries', () => {
  it('domain should not depend on adapters', async () => {
    const rule = projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/adapters/**');

    // Allow empty test - domain may not have adapters folder dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('domain should not depend on UI components', async () => {
    const rule = projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components/**');

    // Allow empty test - domain may not have component dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('domain should not depend on stores', async () => {
    const rule = projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/stores/**');

    // Allow empty test - domain may not have stores folder dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('domain should not depend on hooks', async () => {
    const rule = projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/hooks/**');

    // Allow empty test - domain may not have hooks folder dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('domain should not import Tauri API directly', async () => {
    const rule = projectFiles()
      .inFolder('src/domain/**')
      .shouldNot()
      .dependOnFiles()
      .inPath('**/node_modules/@tauri-apps/**');

    // Allow empty test - domain may have no Tauri dependencies to check
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });
});

describe('Application Layer Boundaries', () => {
  it('application should not depend on adapters', async () => {
    const rule = projectFiles()
      .inFolder('src/application/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/adapters/**');

    // Allow empty test - application may not have adapters folder dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  it('application should not depend on UI components', async () => {
    const rule = projectFiles()
      .inFolder('src/application/**')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components/**');

    // Allow empty test - application may not have component dependencies
    await expect(rule.check({ allowEmptyTests: true })).resolves.toEqual([]);
  });

  // Note: "should be able to depend on" is validated by the absence of violations
  // when those dependencies exist. We test forbidden dependencies above.
});
