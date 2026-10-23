import { embeddedFontUrl, htmlToPdf, PdfUnavailableError } from "../services/pdf.js";
import { sendError } from "./handler.js";

/**
 * Express handler that sends a PDF made from HTML. `build(req, fontUrl)` returns { html, fileName };
 * `?download=1` sends it as an attachment instead of inline.
 */
export function pdfRoute(build) {
  return async (req, res) => {
    try {
      const { html, fileName } = await build(req, await embeddedFontUrl());
      const pdf = await htmlToPdf(html);
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `${req.query.download === "1" ? "attachment" : "inline"}; filename="${fileName.replace(/[^\w.-]/g, "_")}"`,
        "Cache-Control": "no-store",
      });
      res.send(pdf);
    } catch (e) {
      if (e instanceof PdfUnavailableError) {
        return res.status(503).json({ ok: false, error: e.message, code: "PDF_UNAVAILABLE" });
      }
      sendError(res, e);
    }
  };
}
