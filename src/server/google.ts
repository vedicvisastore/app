/** "Continue with Google" via the standard OAuth 2.0 authorization-code flow (no extra libraries). */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { users } from "@/db/schema";
import { createSession, parseCookies, sessionCookie } from "./auth";
import { env } from "./env";

const STATE_COOKIE = "vv_oauth";

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");
const origin = (req: Request) => {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}`;
};

export function googleStart(req: Request) {
  if (!googleConfigured()) return new Response("Google login isn't configured", { status: 404 });
  const state = randomBytes(16).toString("base64url");
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin(req)}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const cookie = `${STATE_COOKIE}=${encodeURIComponent(JSON.stringify({ state, next }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${env.isProd ? "; Secure" : ""}`;
  return new Response(null, { status: 302, headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, "Set-Cookie": cookie } });
}

export async function googleCallback(req: Request, db: DB) {
  const url = new URL(req.url);
  const fail = (msg: string) =>
    new Response(null, { status: 302, headers: { Location: `/login?error=${encodeURIComponent(msg)}`, "Set-Cookie": `${STATE_COOKIE}=; Path=/; Max-Age=0` } });

  let saved: { state: string; next: string } | null = null;
  try {
    saved = JSON.parse(parseCookies(req.headers.get("cookie"))[STATE_COOKIE] ?? "null");
  } catch {}
  if (!saved || saved.state !== url.searchParams.get("state")) return fail("Login took too long. Please try again.");
  const code = url.searchParams.get("code");
  if (!code) return fail("Google sign-in was cancelled.");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin(req)}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error("Google token exchange failed", tokenRes.status, await tokenRes.text());
    return fail("Google sign-in failed. Please try again.");
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
  if (!info.email || !info.email_verified) return fail("Your Google account's email isn't verified.");

  const email = info.email.toLowerCase();
  const isAdmin = env.adminEmails().includes(email);
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) [user] = await db.insert(users).values({ email, name: info.name ?? null, role: isAdmin ? "admin" : "customer" }).returning();
  else if ((isAdmin && user.role !== "admin") || (!user.name && info.name))
    [user] = await db.update(users).set({ role: isAdmin ? "admin" : user.role, name: user.name ?? info.name ?? null }).where(eq(users.id, user.id)).returning();

  const s = await createSession(db, user.id);
  const next = user.role === "admin" && saved.next === "/account" ? "/admin" : saved.next;
  const headers = new Headers({ Location: next });
  headers.append("Set-Cookie", sessionCookie(s.token, s.expiresAt));
  headers.append("Set-Cookie", `${STATE_COOKIE}=; Path=/; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}
