"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "../ui";

/**
 * Feedback while the next store page loads, without a loading screen. A full-page Suspense fallback
 * (loading.tsx) made the server stream "Loading…" first and swap in the page a moment later, a visible flash
 * on every first visit. Instead the current page stays put and a thin brand bar plus a small lotus show at the
 * top until the new page arrives.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    const start = (url: URL) => {
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setActive(true);
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      start(new URL(a.href, location.href));
    };
    // Search forms navigate with router.push: show progress for them too.
    const onSubmit = (e: SubmitEvent) => {
      if ((e.target as HTMLFormElement | null)?.getAttribute("role") === "search") setActive(true);
    };
    // Capture phase: next/link calls preventDefault() on the click before it bubbles up to the document.
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  // Never stay stuck (e.g. a link that turned out to be the same page).
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setActive(false), 12_000);
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <div className="vv-progress" data-active={active || undefined} aria-hidden={!active} role="status">
      <span className="vv-progress-bar" />
      {active && (
        <span className="vv-progress-lotus">
          <Spinner className="size-5 text-gulal" label="Loading the page" />
        </span>
      )}
    </div>
  );
}
