import { invoke } from "@tauri-apps/api/core";
import {
  RenderSettingsSchema,
  UpdateRenderSettingsResponseSchema,
  type RenderSettings,
  type UpdateRenderSettingsResponse,
} from "../../domain/rendering";

export async function getRenderSettings(): Promise<RenderSettings> {
  return RenderSettingsSchema.parse(await invoke("get_render_settings"));
}

export async function updateRenderSettings(
  settings: Partial<RenderSettings>,
): Promise<UpdateRenderSettingsResponse> {
  return UpdateRenderSettingsResponseSchema.parse(
    await invoke("update_render_settings", settings),
  );
}
