import ExcelJS from "exceljs";
import { db } from "../infra/db.js";
import { formatCredits, formatLabels } from "@acp/shared/domain/schemes/rules";
import { schemeCourseSchema } from "@acp/shared/schemas/config";
import { courseIssues, upsertSchemeCourse } from "./courses.js";
// Column order of the course-list workbook (template, export and import).
const COLUMNS = [
  { key: "semester", header: "Semester", width: 10 },
  { key: "code", header: "Course Code", width: 14 },
  { key: "title", header: "Course Title", width: 48 },
  { key: "category", header: "Category", width: 12 },
  { key: "format", header: "Format", width: 20 },
  { key: "teachingDepartment", header: "Teaching Department", width: 20 },
  { key: "lCredits", header: "L Credits", width: 10 },
  { key: "tCredits", header: "T Credits", width: 10 },
  { key: "pCredits", header: "P Credits", width: 10 },
  { key: "lHours", header: "L Hours", width: 10 },
  { key: "tHours", header: "T Hours", width: 10 },
  { key: "pHours", header: "P Hours", width: 10 },
  { key: "twSlHours", header: "TW&SL Hours", width: 12 },
  { key: "cieMarks", header: "CIE Marks", width: 10 },
  { key: "seeMarks", header: "SEE Marks", width: 10 },
  { key: "examHours", header: "Exam Hours", width: 11 },
  { key: "electiveGroup", header: "Elective Group", width: 16 },
];
export async function buildCourseWorkbook(list) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Academic Curriculum Portal";
  const sheet = wb.addWorksheet("Courses", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  for (const c of list.courses) {
    sheet.addRow({
      semester: c.semester,
      code: c.course.code,
      title: c.course.title,
      category: c.category.code,
      format: c.format ?? "",
      teachingDepartment: c.teachingDepartment.code,
      lCredits: c.lCredits,
      tCredits: c.tCredits,
      pCredits: c.pCredits,
      lHours: c.lHours,
      tHours: c.tHours,
      pHours: c.pHours,
      twSlHours: c.twSlHours,
      cieMarks: c.cieMarks,
      seeMarks: c.seeMarks ?? "",
      examHours: c.examHours ?? "",
      electiveGroup: c.electiveGroup?.code ?? "",
    });
  }
  // Reference sheet: valid values for the coded columns.
  const ref = wb.addWorksheet("Valid values");
  ref.columns = [{ width: 18 }, { width: 50 }, { width: 70 }];
  const heading = (text) => {
    const row = ref.addRow([text]);
    row.font = { bold: true };
  };
  heading(
    `Scheme: ${list.scheme.name} — ${list.scheme.teachingWeeks} weeks, ${list.scheme.hoursPerCredit} h per credit`,
  );
  ref.addRow([]);
  heading("Category");
  for (const c of list.scheme.categories) {
    ref.addRow([
      c.code,
      c.name,
      c.passFail
        ? "Pass/fail: credits 0:0:0"
        : `Credits: ${c.creditPatterns.map((p) => `${formatCredits(p)} (${p.lHours}:${p.tHours}:${p.pHours} h/wk)`).join(", ")}; CIE ${c.cieMarks}, SEE ${c.hasSee ? c.seeMarks : "none"}; formats: ${c.allowedFormats.join(", ") || "none"}`,
    ]);
  }
  ref.addRow([]);
  heading("Format");
  for (const [k, v] of Object.entries(formatLabels)) ref.addRow([k, v]);
  ref.addRow([]);
  heading("Teaching Department");
  for (const d of await db.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }))
    ref.addRow([d.code, d.name]);
  ref.addRow([]);
  heading("Elective Group (created automatically if new)");
  for (const g of list.electiveGroups) ref.addRow([g.code, `Semester ${g.semester}: ${g.title}`]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function cellValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return String(v.result); // formula
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v).trim();
}
/**
 * Imports a course-list workbook into a programme's scheme. All rows are checked first;
 * if any row has a problem nothing is saved, and every problem is reported with its row number.
 * Rows whose course code is already in the list update that row; others are added.
 */
export async function importCourseWorkbook(list, file) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file);
  } catch {
    return {
      errors: [
        { row: 0, code: "", message: "The file could not be read. Upload an .xlsx file downloaded from this page." },
      ],
      imported: 0,
    };
  }
  const sheet = wb.getWorksheet("Courses") ?? wb.worksheets[0];
  if (!sheet) return { errors: [{ row: 0, code: "", message: "The workbook has no sheets." }], imported: 0 };
  // Map header names to column numbers so column order does not matter.
  const headerIndex = new Map();
  sheet.getRow(1).eachCell((cell, col) => headerIndex.set(cellValue(cell.value).toLowerCase(), col));
  const missing = COLUMNS.filter((c) => !headerIndex.has(c.header.toLowerCase()));
  if (missing.length) {
    return {
      errors: [{ row: 1, code: "", message: `Missing columns: ${missing.map((m) => m.header).join(", ")}` }],
      imported: 0,
    };
  }
  const departments = await db.department.findMany();
  const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d.id]));
  const categoryByCode = new Map(list.scheme.categories.map((c) => [c.code.toUpperCase(), c]));
  const groupByCode = new Map(list.electiveGroups.map((g) => [g.code.toUpperCase(), g]));
  const formatByText = new Map();
  for (const [k, v] of Object.entries(formatLabels)) {
    formatByText.set(k.toLowerCase(), k);
    formatByText.set(v.toLowerCase(), k);
  }
  const errors = [];
  const rows = [];
  const seenCodes = new Set();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (key) =>
      cellValue(row.getCell(headerIndex.get(COLUMNS.find((c) => c.key === key).header.toLowerCase())).value);
    if (COLUMNS.every((c) => get(c.key) === "")) return; // blank row
    const code = get("code").toUpperCase();
    const fail = (message) => errors.push({ row: rowNumber, code, message });
    const category = categoryByCode.get(get("category").toUpperCase());
    if (!category) return fail(`Unknown category “${get("category")}”.`);
    const teachingDepartmentId = deptByCode.get(get("teachingDepartment").toUpperCase());
    if (!teachingDepartmentId) return fail(`Unknown teaching department “${get("teachingDepartment")}”.`);
    const formatText = get("format").toLowerCase();
    const format = formatText ? formatByText.get(formatText) : null;
    if (formatText && !format) return fail(`Unknown format “${get("format")}”.`);
    const groupCode = get("electiveGroup");
    const existingGroup = groupCode ? groupByCode.get(groupCode.toUpperCase()) : undefined;
    const parsed = schemeCourseSchema.safeParse({
      semester: get("semester"),
      code,
      title: get("title"),
      categoryId: category.id,
      format: format ?? "",
      teachingDepartmentId,
      lCredits: get("lCredits"),
      tCredits: get("tCredits"),
      pCredits: get("pCredits"),
      lHours: get("lHours"),
      tHours: get("tHours"),
      pHours: get("pHours"),
      twSlHours: get("twSlHours"),
      cieMarks: get("cieMarks"),
      seeMarks: get("seeMarks"),
      examHours: get("examHours"),
      electiveGroupId: existingGroup?.id ?? "",
    });
    if (!parsed.success) return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    if (seenCodes.has(parsed.data.code)) return fail("This course code appears more than once in the file.");
    seenCodes.add(parsed.data.code);
    const issues = courseIssues(list.scheme, parsed.data, category);
    if (issues.length) return fail(issues.map((i) => i.message).join(" "));
    rows.push({
      rowNumber,
      input: parsed.data,
      newGroup: groupCode && !existingGroup ? { code: groupCode, semester: parsed.data.semester } : undefined,
    });
  });
  if (errors.length) return { errors, imported: 0 };
  if (rows.length === 0)
    return { errors: [{ row: 0, code: "", message: "The file has no course rows." }], imported: 0 };
  const existingByCode = new Map(list.courses.map((c) => [c.course.code, c.id]));
  await db.$transaction(
    async (tx) => {
      const createdGroups = new Map();
      for (const r of rows) {
        if (r.newGroup) {
          const key = r.newGroup.code.toUpperCase();
          let groupId = createdGroups.get(key);
          if (!groupId) {
            const g = await tx.electiveGroup.create({
              data: {
                schemeId: list.scheme.id,
                programmeId: list.programme.id,
                semester: r.newGroup.semester,
                code: r.newGroup.code,
                title: `Elective group ${r.newGroup.code}`,
              },
            });
            groupId = g.id;
            createdGroups.set(key, groupId);
          }
          r.input.electiveGroupId = groupId;
        }
        await upsertSchemeCourse(tx, list.scheme, list.programme.id, r.input, existingByCode.get(r.input.code) ?? null);
      }
    },
    { timeout: 60_000 },
  );
  return { errors: [], imported: rows.length };
}
