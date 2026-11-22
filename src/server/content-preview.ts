/**
 * Live preview for Admin → Store text. The editor sends its unsaved text to the server, which puts it in a
 * short-lived, HttpOnly cookie. While that cookie is present AND the visitor is signed in as an admin, pages
 * render with the draft text (see getSite()). Shoppers never see drafts: no admin session, no preview.
 */
import { CONTENT_KEYS } from "@/content/defaults";
import { env } from "./env";

export const PREVIEW_COOKIE = "vv_text_preview";
/** Visual editor: store pages tag their text so the admin can click to edit it (see src/lib/stega.ts). */
export const EDIT_COOKIE = "vv_visual_edit";
const MAX = 3800; // stay under the 4 KB cookie limit

export function encodePreview(content: Record<string, string>) {
  const clean = Object.fromEntries(Object.entries(content).filter(([k, v]) => CONTENT_KEYS.has(k) && typeof v === "string" && v.trim()));
  const value = Buffer.from(JSON.stringify(clean), "utf8").toString("base64url");
  return value.length <= MAX ? value : null;
}

export function decodePreview(value: string | undefined): Record<string, string> | null {
  if (!value) return null;
  try {
    const obj = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!obj || typeof obj !== "object") return null;
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).filter(([k, v]) => CONTENT_KEYS.has(k) && typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 600)]));
  } catch {
    return null;
  }
}

const attrs = () => ["Path=/", "HttpOnly", "SameSite=Lax", process.env.COOKIE_DOMAIN ? `Domain=${process.env.COOKIE_DOMAIN}` : "", env.isProd ? "Secure" : ""].filter(Boolean).join("; ");
export const previewCookie = (value: string) => `${PREVIEW_COOKIE}=${value}; Max-Age=1800; ${attrs()}`;
export const clearPreviewCookie = () => `${PREVIEW_COOKIE}=; Max-Age=0; ${attrs()}`;
export const editCookie = () => `${EDIT_COOKIE}=1; Max-Age=7200; ${attrs()}`;
export const clearEditCookie = () => `${EDIT_COOKIE}=; Max-Age=0; ${attrs()}`;

/**
 * Draft text and visual-edit mode for this request, only for a signed-in admin. Shoppers have neither cookie,
 * so for them this costs nothing (no session lookup).
 */
export async function requestAdminView(): Promise<{ draft: Record<string, string> | null; edit: boolean }> {
  const none = { draft: null, edit: false };
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const draft = decodePreview(jar.get(PREVIEW_COOKIE)?.value);
    const edit = jar.get(EDIT_COOKIE)?.value === "1";
    if (!draft && !edit) return none;
    const [{ db }, { userFromSessionToken, SESSION_COOKIE }] = await Promise.all([import("@/db"), import("./auth")]);
    const user = await userFromSessionToken(db, jar.get(SESSION_COOKIE)?.value);
    return user?.role === "admin" ? { draft, edit } : none;
  } catch {
    return none;
  }
}
