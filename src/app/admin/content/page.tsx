"use client";
import { ImageUp, MousePointerClick, Pencil, Save, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { Card, PageHeader } from "../_ui";

/**
 * Store text and pictures are edited only in the visual editor (its own page, opened in a new tab), so this page
 * stays light: nothing loads here until the owner chooses to open it.
 */
export default function ContentPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Store text" description="Change any words or pictures on the store by tapping them on the store itself." />
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-gold/25 via-paper to-peacock/15 px-5 py-8 text-center sm:px-8">
          <Pencil className="mx-auto mb-3 size-8 text-royal" aria-hidden />
          <h2 className="font-display text-2xl sm:text-3xl">Visual Editor</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">The real store opens with every editable text and picture outlined. Nothing changes for shoppers until you press Save.</p>
          <ButtonLink href="/admin/content/visual" target="_blank" size="lg" className="mt-6">
            <Pencil className="size-4" aria-hidden /> Open Visual Editor
          </ButtonLink>
          <p className="mt-2 text-xs text-ink-mute">Opens in a new tab.</p>
        </div>
        <ul className="grid gap-px bg-line sm:grid-cols-2">
          {[
            [MousePointerClick, "Tap any text", "Edit it in the side panel; the page changes as you type."],
            [ImageUp, "Tap a picture", "Upload a new logo or painting, or go back to the original."],
            [Search, "Find any text", "Search every line, including ones that only show sometimes (sold out, empty cart, login)."],
            [Save, "Save once", "Press Save when you are happy. Discard throws away unsaved changes."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof Pencil;
            return (
              <li key={title as string} className="flex gap-3 bg-paper p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky text-royal">
                  <I className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold">{title as string}</span>
                  <span className="text-sm text-ink-soft">{body as string}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
