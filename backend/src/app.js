import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import { attachUser } from "./auth/session.js";
import { sendError } from "./http/handler.js";
import { rateLimit, userOrIp } from "./http/rate-limit.js";
import { adminRouter } from "./routes/admin.js";
import { approvedSyllabiRouter } from "./routes/approved-syllabi.js";
import { courseListsRouter } from "./routes/course-lists.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { departmentsRouter } from "./routes/departments.js";
import { expertRouter } from "./routes/expert.js";
import { meRouter } from "./routes/me.js";
import { printRouter } from "./routes/print.js";
import { reviewsRouter } from "./routes/reviews.js";
import { schemesRouter } from "./routes/schemes.js";
import { syllabiRouter } from "./routes/syllabi.js";
import { verifyRouter } from "./routes/verify.js";

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
  // Request limits (README §11; production only). Generous for people, strict where one request is expensive
  // (PDFs and books run headless Chromium) or where the caller is not signed in (expert review links).
  app.use("/api", rateLimit({ windowMs: 60_000, max: 600, key: userOrIp }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      max: 20,
      key: (req) => (req.method === "GET" && req.path.endsWith("/pdf") ? userOrIp(req) : null), // syllabus, version, report, book
      message: "Too many PDFs requested in a short time. Please wait a minute and try again.",
    }),
  );
  app.use("/api/expert", rateLimit({ windowMs: 60_000, max: 30, key: (req) => req.ip }));
  app.use("/api/verify", rateLimit({ windowMs: 60_000, max: 30, key: (req) => req.ip }));
  app.use("/api", meRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/schemes/:schemeId/programmes/:programmeId", courseListsRouter);
  app.use("/api/schemes/:schemeId/approved-syllabi", approvedSyllabiRouter);
  app.use("/api/schemes", schemesRouter);
  app.use("/api/departments", departmentsRouter);
  app.use("/api/syllabi/:schemeId/:courseId", reviewsRouter);
  app.use("/api/syllabi", syllabiRouter);
  app.use("/api/print", printRouter);
  app.use("/api/expert", expertRouter); // public: the review link is the credential
  app.use("/api/verify", verifyRouter); // public: checks an approved PDF from its QR code
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
