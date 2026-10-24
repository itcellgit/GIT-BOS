import { expect, test } from "@playwright/test";
import { signIn } from "./helpers.js";

// Institution branding (README §5, audit M2): the Administrator uploads the logo; it is served for previews,
// inlined into PDFs, and only PNG/JPEG are accepted. The test removes the logo again at the end.

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("the Administrator uploads the institution logo; it prints on syllabi; SVG is refused", async ({
  page,
  browser,
}) => {
  await signIn(page, "it.admin@example.edu");
  await page.goto("/admin/departments");
  await expect(page.getByText("Printed at the top of syllabi")).toBeVisible();

  try {
    // An SVG (which could carry scripts) is refused whatever it is called.
    const svg = await page.request.post("/api/admin/institution/logo", {
      multipart: {
        logo: {
          name: "logo.png",
          mimeType: "image/png",
          buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
        },
      },
    });
    expect(svg.status()).toBe(400);
    expect((await svg.json()).error).toBe("The logo must be a PNG or JPEG image.");

    await page.getByLabel("Logo file").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(/Logo saved/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Institution logo" })).toBeVisible();

    const logo = await page.request.get("/api/print/logo");
    expect(logo.status()).toBe(200);
    expect(logo.headers()["content-type"]).toBe("image/png");

    // A syllabus carries the logo's address; its PDF renders with the image inlined.
    const bos = await (await browser.newContext()).newPage();
    await signIn(bos, "bos.cse@example.edu");
    const dept = (await (await bos.request.get("/api/departments/CSE")).json()).data;
    const course = dept.courses.find((c) => c.syllabus);
    const path = `/api/syllabi/${course.schemeId}/${course.courseId}`;
    const data = (await (await bos.request.get(path)).json()).data;
    expect(data.institution.logoUrl).toMatch(/^\/api\/print\/logo\?v=\d+$/);
    const pdf = await bos.request.get(`${path}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  } finally {
    // Leave the institution as it was.
    await page.request.delete("/api/admin/institution/logo");
  }
});
