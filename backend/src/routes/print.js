// Static assets for the print layouts (the on-screen preview). Mounted at /api/print
// PDFs embed the fonts directly (services/pdf.js), so this is only for the browser.
import { Router } from "express";
import { printFontPath } from "../services/pdf.js";

export const printRouter = Router();

/** Carlito (metric-compatible with Calibri, README §8). Only the known file names are served. */
printRouter.get("/fonts/:file", (req, res) => {
  const path = printFontPath(req.params.file);
  if (!path) return res.status(404).json({ ok: false, error: "Not found." });
  res.sendFile(path, { maxAge: "30d", immutable: true, headers: { "Content-Type": "font/woff2" } });
});
