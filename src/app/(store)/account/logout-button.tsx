"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";

export function LogoutButton() {
  const trpc = useTRPC();
  const router = useRouter();
  const logout = useMutation(trpc.auth.logout.mutationOptions({ onSuccess: () => { router.replace("/"); router.refresh(); } }));
  return (
    <Button variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
      Log out
    </Button>
  );
}
