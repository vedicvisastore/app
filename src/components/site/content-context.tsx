"use client";
import { createContext, useContext } from "react";
import { DEFAULT_CONTENT, type SiteContent } from "@/content/defaults";
import { DEFAULT_IMAGES, type SiteImages } from "@/content/images";

const Ctx = createContext<SiteContent>(DEFAULT_CONTENT);
const ImgCtx = createContext<SiteImages>(DEFAULT_IMAGES);

export function ContentProvider({ content, images = DEFAULT_IMAGES, children }: { content: SiteContent; images?: SiteImages; children: React.ReactNode }) {
  return (
    <Ctx.Provider value={content}>
      <ImgCtx.Provider value={images}>{children}</ImgCtx.Provider>
    </Ctx.Provider>
  );
}

/** Editable storefront copy in client components (server components use getSite()). */
export const useContent = () => useContext(Ctx);
/** Swappable store pictures (logo, paintings) in client components. */
export const useImages = () => useContext(ImgCtx);
