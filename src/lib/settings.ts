/**
 * DealFlow AI — settings RPC surface (client-safe module).
 *
 * Only `createServerFn` definitions live here. All real logic lives in
 * `./settings.server.ts` (server-only), loaded dynamically inside each handler
 * the moment it executes — which only happens on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import type { UserSettings } from "./settings.server";
export type { SettingsInput, UserSettings } from "./settings.server";

/** The session user's settings (defaults when nothing saved yet). */
export const getSettings = createServerFn().handler(async () => {
  const { getSettingsForUser } = await import("./settings.server");
  return await getSettingsForUser();
});

/** Validate + upsert the session user's settings. */
export const saveSettings = createServerFn({ method: "POST" })
  .validator((d: { settings: UserSettings }) => d)
  .handler(async ({ data }) => {
    const { saveSettingsForUser } = await import("./settings.server");
    return await saveSettingsForUser(data.settings);
  });