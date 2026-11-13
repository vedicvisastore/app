import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { createCaller } from "./root";
import { createContext } from "./trpc";

/** tRPC caller for Server Components: same procedures, no HTTP hop. */
export const api = cache(async () => {
  const jar = await cookies();
  const ctx = await createContext(db, jar.toString(), () => {});
  return createCaller(ctx);
});
