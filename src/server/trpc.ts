import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { DB } from "@/db/connect";
import type { User } from "@/db/schema";
import { clearCache } from "./cache";
import { AuthError, parseCookies, SESSION_COOKIE, userFromSessionToken } from "./auth";

export type Context = {
  db: DB;
  user: User | null;
  sessionToken: string | null;
  /** Client IP (Cloudflare's CF-Connecting-IP), used for rate limits. */
  ip: string;
  /** Adds a Set-Cookie header to the response (no-op for server-side callers). */
  setCookie: (cookie: string) => void;
};

/** Adapter-agnostic: works for the fetch adapter (Next / Workers) and the standalone Node server. */
export async function createContext(db: DB, cookieHeader: string | null, setCookie: (c: string) => void, ip = "unknown"): Promise<Context> {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE] ?? null;
  const user = await userFromSessionToken(db, token);
  return { db, user, sessionToken: token, setCookie, ip };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const zod = error.cause instanceof ZodError ? error.cause.issues[0] : null;
    const hidden = error.code === "INTERNAL_SERVER_ERROR" && process.env.NODE_ENV === "production";
    return {
      ...shape,
      message: zod ? `${zod.path.join(".") || "Input"}: ${zod.message}` : hidden ? "Something went wrong on our side. Please try again." : shape.message,
      data: { ...shape.data, stack: undefined },
    };
  },
});

/** Turn known domain errors into readable 400s instead of 500s. */
const errorMapper = t.middleware(async ({ next }) => {
  const res = await next();
  if (!res.ok && res.error.cause instanceof AuthError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: res.error.cause.message });
  }
  return res;
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure.use(errorMapper);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Log in to continue." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next, type }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admins only." });
  const res = await next({ ctx });
  if (type === "mutation") clearCache();
  return res;
});
