/**
 * TauriSettingsAdapter
 *
 * Implements SettingsPort using Tauri IPC commands.
 * Calls the v2 hexagonal architecture backend commands.
 */

import { invoke } from '@tauri-apps/api/core';
import type { SettingsPort } from '../../ports/settings.port';

interface SettingResponse {
  key: string;
  value: unknown;
}

interface SettingsMap {
  settings: Record<string, unknown>;
}

export class TauriSettingsAdapter implements SettingsPort {
  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await invoke<SettingResponse>('settings_get_v2', { key });
      return response.value as T;
    } catch (error) {
      if (typeof error === 'string' && error.includes('NOT_FOUND')) {
        return null;
      }
      throw error;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await invoke<SettingResponse>('settings_set_v2', { key, value });
  }

  async getAll(): Promise<Record<string, unknown>> {
    const response = await invoke<SettingsMap>('settings_get_all_v2');
    return response.settings;
  }

  async delete(key: string): Promise<void> {
    await invoke<boolean>('settings_delete_v2', { key });
  }

  async setBatch(settings: Record<string, unknown>): Promise<void> {
    await invoke<SettingsMap>('settings_set_batch_v2', { settings });
  }
}
