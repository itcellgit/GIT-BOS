import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit.js";

function appWith(limiter) {
  const app = express();
  app.use(limiter);
  app.get("/x", (_req, res) => res.json({ ok: true }));
  app.get("/free", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("rate limit (README §11)", () => {
  it("refuses requests beyond the limit with 429 and Retry-After", async () => {
    const app = appWith(rateLimit({ windowMs: 60_000, max: 2, enabled: true }));
    await request(app).get("/x").expect(200);
    await request(app).get("/x").expect(200);
    const res = await request(app).get("/x").expect(429);
    expect(res.body).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("leaves requests alone when the key is null, or when disabled", async () => {
    const keyed = appWith(
      rateLimit({ windowMs: 60_000, max: 1, enabled: true, key: (req) => (req.path === "/x" ? "k" : null) }),
    );
    await request(keyed).get("/free").expect(200);
    await request(keyed).get("/free").expect(200);
    const off = appWith(rateLimit({ windowMs: 60_000, max: 1, enabled: false }));
    await request(off).get("/x").expect(200);
    await request(off).get("/x").expect(200);
  });

  it("opens a new window after the old one ends", async () => {
    const app = appWith(rateLimit({ windowMs: 50, max: 1, enabled: true }));
    await request(app).get("/x").expect(200);
    await request(app).get("/x").expect(429);
    await new Promise((r) => setTimeout(r, 60));
    await request(app).get("/x").expect(200);
  });
});
