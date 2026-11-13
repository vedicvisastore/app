/**
 * Media storage on Cloudflare R2 (free tier: 10 GB, zero egress fees).
 * The admin browser uploads straight to R2 with a short-lived presigned PUT URL,
 * so large videos never pass through our server.
 * Dev fallback (no R2 env vars): files are written to ./public/uploads via /api/upload.
 */
import { randomBytes } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { env } from "./env";

type MediaBucket = {
  put(key: string, value: ReadableStream | ArrayBuffer, options: { httpMetadata: { contentType: string; cacheControl?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

/**
 * On Cloudflare Workers the media bucket is bound directly (SITE_CONFIG_BUCKET → vedicvisa-media), so uploads can
 * go through our own /api/upload without any S3 access keys. Returns undefined outside a Worker.
 */
export function mediaBucket(): MediaBucket | undefined {
  try {
    const { env: cf } = getCloudflareContext();
    return (cf as typeof cf & { SITE_CONFIG_BUCKET?: MediaBucket }).SITE_CONFIG_BUCKET;
  } catch {
    return undefined;
  }
}

export const ALLOWED_MEDIA: Record<string, number> = {
  "image/jpeg": 10, "image/png": 10, "image/webp": 10, "image/avif": 10, "image/gif": 10,
  "video/mp4": 100, "video/webm": 100, "video/quicktime": 100,
};

export function mediaKey(filename: string) {
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const d = new Date();
  return `products/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(8).toString("hex")}.${ext}`;
}

export async function presignUpload(filename: string, contentType: string) {
  const r2 = env.r2();
  const key = mediaKey(filename);
  const client = new AwsClient({ accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey, service: "s3", region: "auto" });
  const url = new URL(`https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucket}/${key}`);
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await client.sign(new Request(url, { method: "PUT", headers: { "Content-Type": contentType } }), {
    aws: { signQuery: true },
  });
  return { uploadUrl: signed.url, publicUrl: `${r2.publicUrl}/${key}`, headers: { "Content-Type": contentType } };
}

export async function deleteMedia(publicUrl: string) {
  const r2 = env.r2();
  if (!r2.publicUrl || !publicUrl.startsWith(r2.publicUrl + "/")) return;
  const key = publicUrl.slice(r2.publicUrl.length + 1);
  const bucket = mediaBucket();
  if (bucket) return void (await bucket.delete(key));
  if (!env.r2Configured()) return;
  const client = new AwsClient({ accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey, service: "s3", region: "auto" });
  await client.fetch(`https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucket}/${key}`, { method: "DELETE" });
}

export const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);
