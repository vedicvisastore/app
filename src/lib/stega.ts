/**
 * Invisible key tags for the visual text editor (Admin → Store text → Visual editor).
 * In edit mode only, every store text value carries its content key ("home.heroTitle") as zero-width characters
 * after the visible words. The overlay in the store finds them, strips them and marks the element as editable.
 * Shoppers never get tagged text: edit mode needs an admin session.
 */
const DIGITS = ["\u200b", "\u200c", "\u200d", "\u2060"]; // base-4
const OPEN = "\u2062";
const CLOSE = "\u2063";

export function tag(text: string, key: string) {
  let out = OPEN;
  for (const ch of key) {
    const code = ch.charCodeAt(0) & 0xff;
    out += DIGITS[(code >> 6) & 3] + DIGITS[(code >> 4) & 3] + DIGITS[(code >> 2) & 3] + DIGITS[code & 3];
  }
  return text + out + CLOSE;
}

export const TAG_RE = /\u2062([\u200b\u200c\u200d\u2060]+)\u2063/g;

export function decodeTag(body: string) {
  let key = "";
  for (let i = 0; i + 3 < body.length; i += 4) {
    const d = (j: number) => DIGITS.indexOf(body[i + j]);
    key += String.fromCharCode((d(0) << 6) | (d(1) << 4) | (d(2) << 2) | d(3));
  }
  return key;
}
