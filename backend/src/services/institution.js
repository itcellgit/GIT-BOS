// Institution branding (README §5): name, address and logo printed on syllabi, Action Taken reports and the
// syllabus book. The logo is stored in the database; previews load it from /api/print/logo, and PDF jobs get it
// inlined as a data: URL because headless Chromium is not allowed to fetch anything (services/pdf.js).
import { db } from "../infra/db.js";

export const MAX_LOGO_BYTES = 200 * 1024;

/**
 * The image type from the file's first bytes (not its name or the browser's claim). PNG and JPEG only: SVG can
 * carry scripts, and the logo is served from the portal's own origin.
 */
export function logoTypeOf(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

/** The URL the print layouts load the logo from in a browser (the version makes caches pick up a new logo). */
export const logoPath = (version) => `/api/print/logo?v=${version}`;

/** The logo as a data: URL, or null when there is none. */
export async function logoDataUrl() {
  const row = await db.institutionSettings.findUnique({ where: { id: 1 }, select: { logo: true, logoType: true } });
  return row?.logo ? `data:${row.logoType};base64,${Buffer.from(row.logo).toString("base64")}` : null;
}

/** Replaces the logo's preview URL in a print document with the image itself (for PDF jobs, which load nothing). */
export async function inlineLogo(html) {
  if (!html.includes("/api/print/logo")) return html;
  const dataUrl = await logoDataUrl();
  return dataUrl ? html.replace(/\/api\/print\/logo\?v=\d+/g, dataUrl) : html;
}
