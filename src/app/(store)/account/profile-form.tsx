"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";

export function ProfileForm({ name, phone, email }: { name: string | null; phone: string | null; email: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [f, setF] = useState({ name: name ?? "", phone: phone ?? "" });
  const [saved, setSaved] = useState(false);
  const save = useMutation(
    trpc.auth.updateProfile.mutationOptions({
      onSuccess: () => {
        setSaved(true);
        router.refresh();
      },
    }),
  );
  const dirty = f.name !== (name ?? "") || f.phone !== (phone ?? "");

  return (
    <form
      className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        save.mutate({ name: f.name, phone: f.phone });
      }}
    >
      <label className="block">
        <span className="label">Full name</span>
        <input required autoComplete="name" className="field" value={f.name} onChange={(e) => { setSaved(false); setF({ ...f, name: e.target.value }); }} />
      </label>
      <label className="block">
        <span className="label">Mobile number</span>
        <input type="tel" inputMode="tel" autoComplete="tel" className="field" value={f.phone} onChange={(e) => { setSaved(false); setF({ ...f, phone: e.target.value }); }} placeholder="10-digit number" />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Email</span>
        <input className="field" value={email} disabled aria-describedby="email-note" />
        <span id="email-note" className="mt-1 block text-xs text-ink-mute">This is how you log in, so it can’t be changed here.</span>
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={save.isPending || !dirty}>{save.isPending && <Spinner />} Save details</Button>
        <span className="text-sm" aria-live="polite">
          {save.error ? <span className="text-error">{save.error.message}</span> : saved && !dirty ? <span className="text-mor">Saved</span> : null}
        </span>
      </div>
    </form>
  );
}
