"use client";
import { createContext, useContext } from "react";
import { DEFAULT_CONTENT, type SiteContent } from "@/content/defaults";

const Ctx = createContext<SiteContent>(DEFAULT_CONTENT);

export function ContentProvider({ content, children }: { content: SiteContent; children: React.ReactNode }) {
  return <Ctx.Provider value={content}>{children}</Ctx.Provider>;
}

/** Editable storefront copy in client components (server components use getSite()). */
export const useContent = () => useContext(Ctx);
