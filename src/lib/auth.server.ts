import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { sql } from "~/db";

const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = "dealflow_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export interface SessionUser { id: number; name: string; email: string; company: string | null; }
function requireSecret(): string { const secret = process.env.SESSION_SECRET; if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be configured with at least 32 random characters."); return secret; }
function nowIso() { return new Date().toISOString(); }
function expiresIso(seconds: number) { return new Date(Date.now() + seconds * 1000).toISOString(); }
function token() { return randomBytes(32).toString("base64url"); }
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); const hash = (await scrypt(password, salt, 64)) as Buffer; return `${salt}:${hash.toString("hex")}`; }
async function verifyPassword(password: string, encoded: string) { const [salt, stored] = encoded.split(":"); if (!salt || !stored) return false; const actual = (await scrypt(password, salt, 64)) as Buffer; const expected = Buffer.from(stored, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); }
function toSessionUser(row: Record<string, unknown>): SessionUser { return { id: Number(row.id), name: String(row.name), email: String(row.email), company: row.company == null ? null : String(row.company) }; }

function sign(value: string) { return `${value}.${digest(`${requireSecret()}:${value}`)}`; }
function unsign(value: string | undefined | null) { if (!value) return null; const dot = value.lastIndexOf("."); if (dot < 1) return null; const raw = value.slice(0, dot); const given = value.slice(dot + 1); const expected = digest(`${requireSecret()}:${raw}`); return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected)) ? raw : null; }
async function createSessionFor(userId: number) { const raw = token(); await sql().run`INSERT INTO sessions (token, user_id, expires_at) VALUES (${raw}, ${userId}, ${expiresIso(SESSION_TTL_SECONDS)})`; setCookie(COOKIE_NAME, sign(raw), { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS, secure: process.env.NODE_ENV === "production" }); }

async function rateLimit(scope: string, max: number, seconds: number) {
  const cutoff = expiresIso(-seconds);
  const [row] = await sql()`SELECT COUNT(*) AS count FROM rate_limit_events WHERE scope = ${scope} AND created_at > ${cutoff}`;
  if (Number(row?.count ?? 0) >= max) throw new Error("Too many attempts. Please wait and try again.");
  await sql().run`INSERT INTO rate_limit_events (scope) VALUES (${scope})`;
}
async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY; const from = process.env.EMAIL_FROM;
  if (!key || !from) { if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured."); console.info(`[email preview] ${subject} → ${to}: ${html}`); return; }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  if (!response.ok) throw new Error("Unable to send email. Please try again later.");
}
async function issueAuthToken(userId: number, email: string, purpose: "verify_email" | "reset_password") {
  const raw = token(); const tokenHash = digest(raw);
  await sql().run`DELETE FROM auth_tokens WHERE user_id = ${userId} AND purpose = ${purpose} AND consumed_at IS NULL`;
  await sql().run`INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES (${userId}, ${purpose}, ${tokenHash}, ${expiresIso(60 * 60)})`;
  const action = purpose === "verify_email" ? "verify-email" : "reset-password";
  await sendEmail(email, purpose === "verify_email" ? "Verify your DealFlow AI email" : "Reset your DealFlow AI password", `<p>Use this link within one hour:</p><p><a href="${APP_URL}/${action}?token=${encodeURIComponent(raw)}">Continue securely</a></p>`);
}

export async function getSessionUser(): Promise<SessionUser | null> { const raw = unsign(getCookie(COOKIE_NAME)); if (!raw) return null; const [row] = await sql()`SELECT u.id, u.name, u.email, u.company FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ${raw} AND s.expires_at > ${nowIso()}`; return row ? toSessionUser(row) : null; }
export async function requireUser(): Promise<SessionUser> { const user = await getSessionUser(); if (!user) throw redirect({ to: "/login" }); return user; }
export async function loginWithCredentials(data: { email: string; password: string }) { const email = data.email.trim().toLowerCase(); await rateLimit(`login:${email}`, 8, 15 * 60); const [row] = await sql()`SELECT id, name, email, company, password_hash, email_verified_at FROM users WHERE email = ${email}`; if (!row || !(await verifyPassword(data.password, String(row.password_hash)))) return { ok: false as const, error: "Invalid email or password." }; if (!row.email_verified_at) return { ok: false as const, error: "Please verify your email before signing in." }; const user = toSessionUser(row); await createSessionFor(user.id); return { ok: true as const, user }; }
export async function registerNewUser(data: { name: string; email: string; password: string; company?: string }) { const name = data.name.trim(); const email = data.email.trim().toLowerCase(); const company = data.company?.trim() || null; if (!name) return { ok: false as const, error: "Please enter your name." }; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Please enter a valid email address." }; if (data.password.length < 12) return { ok: false as const, error: "Use a password of at least 12 characters." }; await rateLimit(`signup:${email}`, 3, 60 * 60); const existing = await sql()`SELECT id FROM users WHERE email = ${email}`; if (existing[0]) return { ok: false as const, error: "An account with that email already exists." }; const id = await sql().insert`INSERT INTO users (name, email, company, password_hash) VALUES (${name}, ${email}, ${company}, ${await hashPassword(data.password)})`; const user = { id, name, email, company }; if (process.env.NODE_ENV !== "production" && process.env.DEV_AUTO_VERIFY_EMAIL === "true") { await sql().run`UPDATE users SET email_verified_at = ${nowIso()} WHERE id = ${id}`; await createSessionFor(id); return { ok: true as const, user }; } await issueAuthToken(id, email, "verify_email"); return { ok: true as const, requiresVerification: true }; }
export async function verifyEmail(raw: string) { const hash = digest(raw); const [row] = await sql()`SELECT id, user_id FROM auth_tokens WHERE token_hash = ${hash} AND purpose = 'verify_email' AND consumed_at IS NULL AND expires_at > ${nowIso()}`; if (!row) return { ok: false as const, error: "This verification link is invalid or expired." }; await sql().run`UPDATE auth_tokens SET consumed_at = ${nowIso()} WHERE id = ${Number(row.id)}`; await sql().run`UPDATE users SET email_verified_at = ${nowIso()} WHERE id = ${Number(row.user_id)}`; return { ok: true as const }; }
export async function requestPasswordReset(emailInput: string) { const email = emailInput.trim().toLowerCase(); await rateLimit(`reset:${email}`, 3, 60 * 60); const [row] = await sql()`SELECT id, email FROM users WHERE email = ${email}`; if (row) await issueAuthToken(Number(row.id), String(row.email), "reset_password"); return { ok: true as const }; }
export async function resetPassword(raw: string, password: string) { if (password.length < 12) return { ok: false as const, error: "Use a password of at least 12 characters." }; const hash = digest(raw); const [row] = await sql()`SELECT id, user_id FROM auth_tokens WHERE token_hash = ${hash} AND purpose = 'reset_password' AND consumed_at IS NULL AND expires_at > ${nowIso()}`; if (!row) return { ok: false as const, error: "This reset link is invalid or expired." }; await sql().run`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${Number(row.user_id)}`; await sql().run`UPDATE auth_tokens SET consumed_at = ${nowIso()} WHERE id = ${Number(row.id)}`; await sql().run`DELETE FROM sessions WHERE user_id = ${Number(row.user_id)}`; return { ok: true as const }; }
export async function logoutCurrentSession() { const raw = unsign(getCookie(COOKIE_NAME)); if (raw) await sql().run`DELETE FROM sessions WHERE token = ${raw}`; deleteCookie(COOKIE_NAME, { path: "/" }); return { ok: true as const }; }
