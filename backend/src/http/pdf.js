import { embeddedFontUrl, htmlToPdf, PdfUnavailableError } from "../services/pdf.js";
import { sendError } from "./handler.js";

/**
 * Express handler that sends a PDF. `build(req, fontUrl)` returns { html, fileName } to render, or
 * { pdf, fileName, headers? } for a stored document. `?download=1` sends it as an attachment.
 */
export function pdfRoute(build) {
  return async (req, res) => {
    try {
      const out = await build(req, await embeddedFontUrl());
      const { fileName } = out;
      const pdf = out.pdf ?? (await htmlToPdf(out.html));
      res.set({
        ...out.headers,
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
