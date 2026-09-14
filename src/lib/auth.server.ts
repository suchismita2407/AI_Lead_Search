/**
 * DealFlow AI — auth internals (SERVER-ONLY).
 *
 * This file is named `*.server.ts` and must NEVER be statically imported by
 * client-visible code — the TanStack Start import-protection plugin enforces
 * that at build time. Client code reaches this logic only via the RPC
 * definitions in `src/lib/auth.ts`, whose handlers dynamically import this
 * module on the server.
 *
 * All DB access happens here and inside server-fn handlers — never in client
 * components.
 */
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { sql } from "~/db";

export const COOKIE_NAME = "dealflow_session";

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dealflow-dev-secret-change-me-9c1e4f";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  company: string | null;
}

/* ------------------------- session primitives ------------------------- */

function nowIso(): string {
  return new Date().toISOString();
}

function expiresIso(): string {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function signCookie(token: string): Promise<string> {
  return `${token}.${await hmacHex(`session:${token}`)}`;
}

/** Returns the session token if the cookie is validly signed, else null. */
async function unsignCookie(
  value: string | undefined | null,
): Promise<string | null> {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const token = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = await hmacHex(`session:${token}`);
  if (expected.length !== signature.length || !safeEqual(expected, signature)) {
    return null;
  }
  return token;
}

async function createSessionFor(userId: number): Promise<void> {
  const token = randomToken();
  await sql().run`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresIso()})`;
  setCookie(COOKIE_NAME, await signCookie(token), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: false,
  });
}

async function destroySession(): Promise<void> {
  const token = await unsignCookie(getCookie(COOKIE_NAME));
  if (token) {
    await sql().run`DELETE FROM sessions WHERE token = ${token}`;
  }
  deleteCookie(COOKIE_NAME, { path: "/" });
}

function toSessionUser(row: Record<string, unknown>): SessionUser {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    company: row.company == null ? null : String(row.company),
  };
}

/** The user behind the current request's session, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await unsignCookie(getCookie(COOKIE_NAME));
  if (!token) return null;
  const rows = await sql()`
    SELECT u.id, u.name, u.email, u.company
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > ${nowIso()}
  `;
  const row = rows[0];
  if (!row) return null;
  return toSessionUser(row);
}

/** 302 to /login when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw redirect({ to: "/login" });
  return user;
}

/* --------------------------- implementations --------------------------- */

export async function loginWithCredentials(data: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const email = data.email.trim().toLowerCase();
  const rows = await sql()`
    SELECT id, name, email, company, password_hash
    FROM users WHERE email = ${email}
  `;
  const row = rows[0];
  if (
    !row ||
    !(await Bun.password.verify(data.password, String(row.password_hash)))
  ) {
    return { ok: false as const, error: "Invalid email or password." };
  }
  const user = toSessionUser(row);
  await createSessionFor(user.id);
  return { ok: true as const, user };
}

export async function registerNewUser(data: {
  name: string;
  email: string;
  password: string;
  company?: string;
}): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const password = data.password;
  const company = (data.company ?? "").trim() || null;

  if (!name) {
    return { ok: false as const, error: "Please enter your name." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return {
      ok: false as const,
      error: "Password must be at least 8 characters.",
    };
  }

  const existing = await sql()`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) {
    return {
      ok: false as const,
      error: "An account with that email already exists.",
    };
  }

  const hash = Bun.password.hashSync(password);
  const id = await sql().insert`INSERT INTO users (name, email, company, password_hash) VALUES (${name}, ${email}, ${company}, ${hash})`;
  await createSessionFor(id);
  return { ok: true as const, user: { id, name, email, company } };
}

export async function logoutCurrentSession(): Promise<{ ok: true }> {
  await destroySession();
  return { ok: true as const };
}