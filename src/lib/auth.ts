/**
 * DealFlow AI — authentication RPC surface (client-safe module).
 *
 * Only `createServerFn` definitions live here. All real logic — hashing,
 * sessions, cookies, DB access — lives in `./auth.server.ts` (server-only;
 * import-protection guarantees it never ships to the browser). Handlers load
 * it dynamically the moment they execute, which only happens on the server.
 */
import { createServerFn } from "@tanstack/react-start";

export type { SessionUser } from "./auth.server";

export const getCurrentUser = createServerFn().handler(async () => {
  const { getSessionUser } = await import("./auth.server");
  return await getSessionUser();
});

export const loginUser = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { loginWithCredentials } = await import("./auth.server");
    return await loginWithCredentials(data);
  });

export const registerUser = createServerFn({ method: "POST" })
  .validator((d: { name: string; email: string; password: string; company?: string }) =>
    d,
  )
  .handler(async ({ data }) => {
    const { registerNewUser } = await import("./auth.server");
    return await registerNewUser(data);
  });

export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutCurrentSession } = await import("./auth.server");
  return await logoutCurrentSession();
});