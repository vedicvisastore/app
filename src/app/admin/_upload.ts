"use client";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

/** Uploads one file: straight to R2 with a presigned URL in production, to /api/upload in dev. Returns its public URL. */
export function useUploadFile() {
  const trpc = useTRPC();
  const presign = useMutation(trpc.admin.presignUpload.mutationOptions());
  return async (file: File): Promise<string> => {
    const p = await presign.mutateAsync({ filename: file.name, contentType: file.type, size: file.size });
    if (p.mode === "r2") {
      const res = await fetch(p.uploadUrl, { method: "PUT", body: file, headers: p.headers });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      return p.publicUrl;
    }
    const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file, headers: { "Content-Type": file.type } });
    const j = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed");
    return j.url;
  };
}
