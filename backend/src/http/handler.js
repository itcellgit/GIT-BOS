import prismaClient from "../generated/prisma/index.js";
import { ConflictError, NotFoundError, PermissionError, UserError } from "../errors.js";

const { Prisma } = prismaClient;

/**
 * Every API response has the same shape (also used by the frontend forms):
 *   { ok: true, data, message? }
 *   { ok: false, error, fieldErrors?, code? }
 */

/** Turns Zod issues into { "field.path": "first message" }. */
export function zodFieldErrors(error) {
  const fieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Wraps a route: validates req.body with `schema` (when given), runs `fn(data, req, res)` and
 * sends `{ ok: true, data, message }`. Expected errors become 4xx JSON; others are logged (500).
 * @param {import("zod").ZodType | null} schema
 * @param {(data: any, req: import("express").Request, res: import("express").Response) => Promise<any>} fn
 * @param {string} [message] success message shown to the user
 */
export function handle(schema, fn, message) {
  return async (req, res) => {
    let data = req.body;
    if (schema) {
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: "Please correct the highlighted fields.",
          fieldErrors: zodFieldErrors(parsed.error),
        });
      }
      data = parsed.data;
    }
    try {
      const result = await fn(data, req, res);
      if (!res.headersSent) res.json({ ok: true, data: result ?? null, message });
    } catch (e) {
      sendError(res, e);
    }
  };
}

export function sendError(res, e) {
  if (res.headersSent) return;
  if (e instanceof UserError) return res.status(400).json({ ok: false, error: e.message, fieldErrors: e.fieldErrors });
  if (e instanceof PermissionError) return res.status(e.status).json({ ok: false, error: e.message, code: e.code });
  if (e instanceof NotFoundError) return res.status(404).json({ ok: false, error: e.message });
  if (e instanceof ConflictError)
    return res.status(409).json({ ok: false, error: e.message, code: "CONFLICT", latest: e.latest });
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002")
      return res.status(409).json({ ok: false, error: "A record with the same code or name already exists." });
    if (e.code === "P2003")
      return res.status(409).json({ ok: false, error: "This record is still used elsewhere and cannot be removed." });
    if (e.code === "P2025") return res.status(404).json({ ok: false, error: "Not found." });
  }
  console.error("[api] unexpected error", e);
  res.status(500).json({ ok: false, error: "Something went wrong. Please try again or contact the administrator." });
}
