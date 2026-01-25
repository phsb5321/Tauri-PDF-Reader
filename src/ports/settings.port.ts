/**
 * SettingsPort
 *
 * User settings persistence.
 * Implemented by: TauriSettingsAdapter, MockSettingsAdapter
 */

export interface SettingsPort {
  /**
   * Get a setting value by key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a setting value
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Get all settings
   */
  getAll(): Promise<Record<string, unknown>>;

  /**
   * Delete a setting
   */
  delete(key: string): Promise<void>;

  /**
   * Set multiple settings at once
   */
  setBatch(settings: Record<string, unknown>): Promise<void>;
}
