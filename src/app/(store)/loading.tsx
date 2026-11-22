import { PageLoader } from "@/components/ui";

/** Shown while the next store page loads (tapping a menu link, a product, a filter). */
export default function Loading() {
  return <PageLoader className="min-h-[60vh]" />;
}
