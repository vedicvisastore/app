"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** While an admin previews unsaved text, the preview frame reloads after each edit: keep the scroll position. */
export function PreviewScrollKeeper() {
  const path = usePathname();
  useEffect(() => {
    const key = `vv-preview-scroll:${path}`;
    try {
      const y = Number(sessionStorage.getItem(key));
      if (y) window.scrollTo(0, y);
    } catch {}
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          sessionStorage.setItem(key, String(window.scrollY));
        } catch {}
      }, 100);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [path]);
  return null;
}
