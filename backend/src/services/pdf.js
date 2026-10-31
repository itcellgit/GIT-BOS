// HTML → PDF with headless Chromium (README §8, §10).
//   GOTENBERG_URL set: Gotenberg (e.g. http://gotenberg:3000 on the internal Docker network).
//   Otherwise: Playwright's Chromium (development, and a VPS without Docker: npx playwright install chromium).
// Both honour the layout's @page rules (A4, margins, running header, "Page X of Y").
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { printFontFiles } from "@acp/shared/print/syllabus-layout";
import { inlineLogo } from "./institution.js";

const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve("@fontsource/carlito/package.json")), "files");

/** Absolute path of a print font file, or null when the name is not one of ours. */
export function printFontPath(file) {
  return printFontFiles.includes(file) ? join(fontDir, file) : null;
}

let fontDataUrls;
/** The print fonts as data: URLs, so a PDF job needs no network access to load them. */
export async function embeddedFontUrl() {
  fontDataUrls ??= Object.fromEntries(
    await Promise.all(
      printFontFiles.map(async (f) => [
        f,
        `data:font/woff2;base64,${(await readFile(join(fontDir, f))).toString("base64")}`,
      ]),
    ),
  );
  return (file) => fontDataUrls[file];
}

export class PdfUnavailableError extends Error {}

// Headless Chromium needs a lot of memory per page (README §14), so only a few renders run at once; the rest
// wait in a short queue, and beyond that the request is refused with "busy" instead of exhausting the server.
const MAX_RENDERS = Number(process.env.PDF_CONCURRENCY) || 2;
const MAX_WAITING = Number(process.env.PDF_QUEUE) || 20;
let running = 0;
const waiting = [];

async function withRenderSlot(fn) {
  if (running < MAX_RENDERS) running++;
  else if (waiting.length >= MAX_WAITING) {
    throw new PdfUnavailableError("The PDF service is busy. Please try again in a minute.");
  } else {
    await new Promise((resolve) => waiting.push(resolve)); // the finishing render hands its slot over
  }
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

/** Renders a complete HTML document to a PDF Buffer. */
export async function htmlToPdf(html) {
  const gotenberg = process.env.GOTENBERG_URL;
  html = await inlineLogo(html); // the renderer loads nothing from the network
  return withRenderSlot(() => (gotenberg ? viaGotenberg(gotenberg, html) : viaPlaywright(html)));
}

async function viaGotenberg(baseUrl, html) {
  const form = new FormData();
  form.append("files", new Blob([html], { type: "text/html" }), "index.html");
  form.append("preferCssPageSize", "true");
  form.append("printBackground", "true");
  form.append("waitForExpression", "document.fonts.status === 'loaded'");
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/forms/chromium/convert/html`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Gotenberg returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

let browserPromise;
async function viaPlaywright(html) {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new PdfUnavailableError(
      "No PDF engine: set GOTENBERG_URL, or install Playwright's Chromium (npx playwright install chromium).",
    );
  }
  browserPromise ??= chromium.launch().catch((e) => {
    browserPromise = undefined;
    throw new PdfUnavailableError(`Chromium could not start (${e.message}). Run: npx playwright install chromium`);
  });
  const browser = await browserPromise;
  const page = await browser.newPage();
  try {
    // No page script runs: the layout is static HTML. Block every network request it might make.
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate("document.fonts.ready.then(() => true)"); // runs in the page, not in Node
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close();
  }
}
