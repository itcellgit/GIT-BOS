import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import { attachUser } from "./auth/session.js";
import { sendError } from "./http/handler.js";
import { adminRouter } from "./routes/admin.js";
import { courseListsRouter } from "./routes/course-lists.js";
import { departmentsRouter } from "./routes/departments.js";
import { meRouter } from "./routes/me.js";
import { printRouter } from "./routes/print.js";
import { reviewsRouter } from "./routes/reviews.js";
import { schemesRouter } from "./routes/schemes.js";
import { syllabiRouter } from "./routes/syllabi.js";

/** The built React app (frontend/dist). Served by Express in production. */
const frontendDist = fileURLToPath(new URL("../../frontend/dist", import.meta.url));

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Caddy in production: use X-Forwarded-For for client IPs
  app.use(helmet());

  // Better Auth handles its own body parsing, so it is mounted before express.json().
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use("/api", attachUser);
  app.use("/api", meRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/schemes/:schemeId/programmes/:programmeId", courseListsRouter);
  app.use("/api/schemes", schemesRouter);
  app.use("/api/departments", departmentsRouter);
  app.use("/api/syllabi/:schemeId/:courseId", reviewsRouter);
  app.use("/api/syllabi", syllabiRouter);
  app.use("/api/print", printRouter);
  app.use("/api", (_req, res) => res.status(404).json({ ok: false, error: "Not found." }));

  // Production: the React app and its client-side routes.
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { index: false, maxAge: "1h" }));
    app.get("/{*splat}", (_req, res) => res.sendFile("index.html", { root: frontendDist }));
  }

  // Malformed JSON and anything else thrown outside a route handler.
  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") return res.status(400).json({ ok: false, error: "Invalid JSON." });
    sendError(res, err);
  });

  return app;
}
