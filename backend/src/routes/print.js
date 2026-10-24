// Static assets for the print layouts (the on-screen preview). Mounted at /api/print
// PDFs embed the fonts directly (services/pdf.js), so this is only for the browser.
import { Router } from "express";
import { db } from "../infra/db.js";
import { printFontPath } from "../services/pdf.js";

export const printRouter = Router();

/** Carlito (metric-compatible with Calibri, README §8). Only the known file names are served. */
printRouter.get("/fonts/:file", (req, res) => {
  const path = printFontPath(req.params.file);
  if (!path) return res.status(404).json({ ok: false, error: "Not found." });
  res.sendFile(path, { maxAge: "30d", immutable: true, headers: { "Content-Type": "font/woff2" } });
});

/** The institution's logo for print previews (public: it is printed on every document). */
printRouter.get("/logo", async (_req, res) => {
  const row = await db.institutionSettings.findUnique({ where: { id: 1 }, select: { logo: true, logoType: true } });
  if (!row?.logo) return res.status(404).json({ ok: false, error: "Not found." });
  // The URL carries a version (?v=), so the browser may keep it; a new logo gets a new URL.
  res.set({
    "Content-Type": row.logoType,
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(Buffer.from(row.logo));
});
