import type { SettingsPort } from '../../ports/settings.port';

/**
 * Mock implementation of SettingsPort for testing.
 * Stores settings in memory.
 */
export class MockSettingsAdapter implements SettingsPort {
  private storage = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    const value = this.storage.get(key);
    return value !== undefined ? (value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value);
  }

  async getAll(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.storage) {
      result[key] = value;
    }
    return result;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async setBatch(settings: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      this.storage.set(key, value);
    }
  }

  // Test helpers
  clear(): void {
    this.storage.clear();
  }

  getStorage(): Map<string, unknown> {
    return new Map(this.storage);
  }
}
