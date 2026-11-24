"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { Select } from "@/components/select";
import type { Address } from "@/db/schema";
import { useTRPC } from "@/lib/trpc/client";
import { cn, INDIAN_STATES } from "@/lib/utils";

type Form = { id?: number; name: string; phone: string; line1: string; line2: string; landmark: string; city: string; state: string; pincode: string; isDefault: boolean };
const blank = (isDefault: boolean): Form => ({ name: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "", isDefault });

function AddressForm({ initial, onDone, onCancel }: { initial: Form; onDone: () => void; onCancel: () => void }) {
  const trpc = useTRPC();
  const [f, setF] = useState<Form>(initial);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const pinOk = /^[1-9]\d{5}$/.test(f.pincode);
  const pin = useQuery({ ...trpc.pincode.lookup.queryOptions({ pincode: f.pincode }), enabled: pinOk && f.pincode !== initial.pincode });
  useEffect(() => {
    const d = pin.data;
    if (d && d.found) {
      const { city, state } = d;
      setF((s) => ({ ...s, city: s.city || city, state: INDIAN_STATES.find((x) => x.toLowerCase() === state.toLowerCase()) ?? state }));
    }
  }, [pin.data]);
  const save = useMutation(trpc.account.saveAddress.mutationOptions({ onSuccess: onDone }));

  return (
    <form
      className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ ...f, line2: f.line2 || null, landmark: f.landmark || null });
      }}
    >
      <label className="block"><span className="label">Full name</span><input required autoComplete="name" className="field" value={f.name} onChange={set("name")} /></label>
      <label className="block"><span className="label">Mobile number</span><input required type="tel" inputMode="tel" autoComplete="tel" className="field" value={f.phone} onChange={set("phone")} placeholder="10-digit number" /></label>
      <label className="block sm:col-span-2"><span className="label">House / flat, street</span><input required autoComplete="address-line1" className="field" value={f.line1} onChange={set("line1")} /></label>
      <label className="block"><span className="label">Area, colony (optional)</span><input autoComplete="address-line2" className="field" value={f.line2} onChange={set("line2")} /></label>
      <label className="block"><span className="label">Landmark (optional)</span><input className="field" value={f.landmark} onChange={set("landmark")} /></label>
      <label className="block">
        <span className="label">Pincode</span>
        <input required inputMode="numeric" maxLength={6} autoComplete="postal-code" className="field" value={f.pincode} onChange={(e) => setF((s) => ({ ...s, pincode: e.target.value.replace(/\D/g, ""), city: "" }))} />
        <span className="mt-1 block min-h-[1lh] text-xs text-ink-mute" aria-live="polite">
          {pin.isFetching ? "Looking up pincode…" : pin.data?.found ? `${pin.data.city}, ${pin.data.state}` : ""}
        </span>
      </label>
      <label className="block"><span className="label">City / district</span><input required autoComplete="address-level2" className="field" value={f.city} onChange={set("city")} /></label>
      <label className="block sm:col-span-2">
        <span className="label">State</span>
        <Select required autoComplete="address-level1" value={f.state} onChange={(v) => setF((s) => ({ ...s, state: v }))} placeholder="Choose state" options={STATE_OPTIONS} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="size-4 accent-royal" checked={f.isDefault} onChange={(e) => setF((s) => ({ ...s, isDefault: e.target.checked }))} />
        Use this as my default address
      </label>
      {save.error && <p className="text-sm text-error sm:col-span-2">{save.error.message}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={save.isPending}>{save.isPending && <Spinner />} {f.id ? "Save address" : "Add address"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Form | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const refresh = () => {
    setEditing(null);
    setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: trpc.account.addresses.queryKey() });
    router.refresh();
  };
  const del = useMutation(trpc.account.deleteAddress.mutationOptions({ onSuccess: refresh }));
  const makeDefault = useMutation(trpc.account.setDefaultAddress.mutationOptions({ onSuccess: refresh }));

  return (
    <div className="mt-4 space-y-4">
      {addresses.length === 0 && !editing && (
        <p className="text-ink-soft">No saved addresses yet. Add one and checkout fills it in for you.</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {addresses.map((a) => (
          <li key={a.id} className={cn("flex flex-col rounded-[var(--radius-card)] border p-4 text-sm", a.isDefault ? "border-royal/40 bg-paper-2" : "border-line")}>
            <p className="flex items-center gap-2 font-bold">
              <MapPin className="size-4 shrink-0 text-royal" aria-hidden />
              {a.name}
              {a.isDefault && <span className="rounded-full bg-mor-soft px-2 py-0.5 text-xs font-normal text-mor">Default</span>}
            </p>
            <p className="mt-1 text-ink-soft">
              {a.line1}
              {a.line2 && `, ${a.line2}`}
              {a.landmark && `, near ${a.landmark}`}, {a.city}, {a.state} {a.pincode}
            </p>
            <p className="text-ink-soft">{a.phone}</p>
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3">
              <button type="button" className="font-bold text-royal" onClick={() => setEditing({ ...a, line2: a.line2 ?? "", landmark: a.landmark ?? "" })}>Edit</button>
              {!a.isDefault && (
                <button type="button" className="font-bold text-ink-soft hover:text-ink" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate({ id: a.id })}>
                  Make default
                </button>
              )}
              {confirmDelete === a.id ? (
                <span className="inline-flex gap-2">
                  <button type="button" className="font-bold text-gulal" onClick={() => del.mutate({ id: a.id })}>Delete</button>
                  <button type="button" className="text-ink-soft" onClick={() => setConfirmDelete(null)}>Keep</button>
                </span>
              ) : (
                <button type="button" className="text-ink-mute hover:text-gulal" onClick={() => setConfirmDelete(a.id)}>Delete</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <AddressForm key={editing.id ?? "new"} initial={editing} onDone={refresh} onCancel={() => setEditing(null)} />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setEditing(blank(addresses.length === 0))}>
          <Plus className="size-4" /> Add an address
        </Button>
      )}
    </div>
  );
}
