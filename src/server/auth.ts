import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { otpCodes, sessions, users, type User } from "@/db/schema";
import { env } from "./env";

export const SESSION_COOKIE = "vv_session";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const otpHash = (email: string, code: string) => sha256(`${env.authSecret()}:${email}:${code}`);

export class AuthError extends Error {}

export async function userFromSessionToken(db: DB, token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function createSession(db: DB, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(db: DB, token: string | undefined | null) {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export function sessionCookie(token: string, expiresAt: Date) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    process.env.COOKIE_DOMAIN ? `Domain=${process.env.COOKIE_DOMAIN}` : "",
    env.isProd ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : ""}`;

export function parseCookies(header: string | null | undefined) {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function sendOtpEmail(email: string, code: string) {
  const key = env.resendKey();
  if (!key) {
    if (env.isProd) throw new AuthError("Email sending isn't set up yet. Please try again later.");
    console.log(`\n  ✉  Login code for ${email}: ${code}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom(),
      to: [email],
      subject: `${code} is your VedicVisa login code`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#14236b">
        <p style="font-size:15px">Hare Krishna! Use this code to log in to VedicVisa:</p>
        <p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:16px 0">${code}</p>
        <p style="font-size:13px;color:#5b6690">It expires in ${OTP_MINUTES} minutes. If you didn't ask for it, ignore this email.</p></div>`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (!env.isProd) {
      // Resend's free tier only delivers to your own address until a domain is verified.
      console.warn(`\n  ✉  Resend refused (${res.status}): ${detail}\n  ✉  Login code for ${email}: ${code}\n`);
      return;
    }
    console.error("Resend error", res.status, detail);
    throw new AuthError("We couldn't send the code. Check the email address and try again.");
  }
}

export async function requestOtp(db: DB, rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  const recent = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), gt(otpCodes.createdAt, new Date(Date.now() - 60 * 60e3))))
    .orderBy(desc(otpCodes.createdAt));
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30e3)
    throw new AuthError("A code was just sent. Wait 30 seconds before asking for another.");
  if (recent.length >= 6) throw new AuthError("Too many codes requested. Try again in an hour.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(otpCodes).values({ email, codeHash: otpHash(email, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60e3) });
  await sendOtpEmail(email, code);
}

export async function verifyOtp(db: DB, rawEmail: string, code: string): Promise<User> {
  const email = rawEmail.trim().toLowerCase();
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw new AuthError("That code has expired. Ask for a new one.");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new AuthError("Too many wrong attempts. Ask for a new code.");

  const a = Buffer.from(otp.codeHash);
  const b = Buffer.from(otpHash(email, code.trim()));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw new AuthError("That code doesn't match. Check the email and try again.");
  }
  await db.update(otpCodes).set({ usedAt: new Date() }).where(eq(otpCodes.id, otp.id));

  const isAdmin = env.adminEmails().includes(email);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    if (isAdmin && existing.role !== "admin") {
      const [u] = await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id)).returning();
      return u;
    }
    return existing;
  }
  const [u] = await db.insert(users).values({ email, role: isAdmin ? "admin" : "customer" }).returning();
  return u;
}
