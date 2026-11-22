import { PageLoader } from "@/components/ui";

/** Shown the moment an admin menu item is tapped, until the page is ready. */
export default function Loading() {
  return <PageLoader className="min-h-[50vh]" />;
}
