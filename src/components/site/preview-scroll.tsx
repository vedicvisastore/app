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

/** Inside the admin's preview frame: no scrollbar, so the phone preview is a true phone width. */
export function FramedNoScrollbar() {
  useEffect(() => {
    if (window.self !== window.top) document.documentElement.style.scrollbarWidth = "none";
  }, []);
  return null;
}

/** Visual editor (admins only): loads the click-to-edit overlay. Never rendered for shoppers. */
export function VisualEditBridge() {
  useEffect(() => {
    // After the page has fully hydrated: the overlay edits text nodes, which must not race React's hydration.
    const go = () => window.setTimeout(() => void import("./visual-edit-overlay").then((m) => m.start()), 150);
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }, []);
  return null;
}
