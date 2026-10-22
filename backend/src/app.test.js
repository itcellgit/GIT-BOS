// API behaviour that does not need a database: routing, sign-in checks, validation, error format.
// Database-backed flows are covered by the end-to-end tests (e2e/).
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const app = createApp();

describe("API basics", () => {
  it("reports no signed-in user without a session", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: null });
  });

  it("refuses protected data without a session (401, friendly message)", async () => {
    const res = await request(app).get("/api/schemes");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ ok: false, error: "Your session has ended. Please sign in again." });
  });

  it("refuses changes without a session", async () => {
    const res = await request(app).post("/api/admin/users").send({ name: "X", email: "x@example.edu" });
    expect(res.status).toBe(401);
  });

  it("returns per-field messages for invalid input before checking anything else", async () => {
    const res = await request(app)
      .post("/api/account/reset-password")
      .send({ email: "not-an-email", otp: "12", newPassword: "short", confirmPassword: "other" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(Object.keys(res.body.fieldErrors)).toEqual(expect.arrayContaining(["email", "otp", "newPassword"]));
  });

  it("answers unknown API paths with 404 JSON", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "Not found." });
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await request(app).post("/api/schemes").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "Invalid JSON." });
  });

  it("sets security headers", async () => {
    const res = await request(app).get("/api/me");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
