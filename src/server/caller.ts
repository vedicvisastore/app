import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { createCaller } from "./root";
import { createContext } from "./trpc";

/** tRPC caller for Server Components: same procedures, no HTTP hop. */
export const api = cache(async () => {
  const jar = await cookies();
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ctx = await createContext(db, jar.toString(), () => {}, ip);
  return createCaller(ctx);
});
