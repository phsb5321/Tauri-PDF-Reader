import type { RepositoryContextValue } from './context/repository-context';
import {
  MockDocumentRepository,
  MockHighlightRepository,
  MockSettingsAdapter,
  MockTtsAdapter,
} from './mock';
import { TauriSettingsAdapter } from './tauri/settings.adapter';

// Declare Tauri global for type checking
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

/**
 * Detects if we're running inside a Tauri application.
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}

/**
 * Creates repository instances for the application.
 *
 * In development/testing, this returns mock implementations.
 * In production with Tauri, this returns Tauri adapters.
 *
 * The Strangler Fig pattern allows gradual migration:
 * - SettingsAdapter uses the new v2 hexagonal commands
 * - Other adapters still use mocks until migrated
 */
export function createRepositories(): RepositoryContextValue {
  if (isTauriEnvironment()) {
    return {
      // Migrated to hexagonal architecture (v2 commands)
      settingsAdapter: new TauriSettingsAdapter(),
      // Still using mocks - to be migrated
      documentRepository: new MockDocumentRepository(),
      highlightRepository: new MockHighlightRepository(),
      ttsAdapter: new MockTtsAdapter(),
    };
  }

  // Mock adapters for testing and non-Tauri environments
  return {
    documentRepository: new MockDocumentRepository(),
    highlightRepository: new MockHighlightRepository(),
    ttsAdapter: new MockTtsAdapter(),
    settingsAdapter: new MockSettingsAdapter(),
  };
}
