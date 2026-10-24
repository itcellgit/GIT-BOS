// Public verification of approved PDFs (README §8). No sign-in: anyone holding a printed or forwarded copy
// opens the link from its QR code. Mounted at /api/verify (rate-limited per IP in app.js).
import { Router } from "express";
import { NotFoundError } from "../errors.js";
import { handle } from "../http/handler.js";
import { db } from "../infra/db.js";
import { verifiedDocument } from "../services/verification.js";

export const verifyRouter = Router();

verifyRouter.get(
  "/:documentId",
  handle(null, async (_data, req) => {
    const document = await verifiedDocument(req.params.documentId);
    if (!document) throw new NotFoundError("No approved document has this verification code.");
    const institution = await db.institutionSettings.findUnique({ where: { id: 1 }, select: { name: true } });
    return { ...document, institution: institution?.name ?? "" };
  }),
);
