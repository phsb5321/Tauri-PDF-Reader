/**
 * Settings API
 *
 * Tauri commands for application settings (v2 hexagonal architecture).
 */

import { invoke } from '@tauri-apps/api/core';

// Types

export interface SettingResponse {
  key: string;
  value: unknown;
}

export interface SettingsMap {
  settings: Record<string, unknown>;
}

// Commands

export async function settingsGet(key: string): Promise<SettingResponse> {
  return invoke('settings_get_v2', { key });
}

export async function settingsSet(key: string, value: unknown): Promise<SettingResponse> {
  return invoke('settings_set_v2', { key, value });
}

export async function settingsGetAll(): Promise<SettingsMap> {
  return invoke('settings_get_all_v2');
}

export async function settingsDelete(key: string): Promise<boolean> {
  return invoke('settings_delete_v2', { key });
}

export async function settingsSetBatch(
  settings: Record<string, unknown>
): Promise<SettingsMap> {
  return invoke('settings_set_batch_v2', { settings });
}
