// Zod schemas for configuration screens. Imported by the browser forms (instant feedback)
// AND by the Server Actions (authoritative check), so each rule is written once.
import { z } from "zod";
import { initialPasswordSchema } from "./account.js";
import { reviewFormSchemas } from "./review.js";
const requiredText = (label, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const wholeNumber = (label, max = 1000) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0)
    .max(max);
const optionalWholeNumber = (max = 1000) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(max).nullable(),
  );
const optionalId = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().nullable());
const code = (label) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(40)
    .regex(/^[A-Za-z0-9/_.-]+$/, `${label} may contain letters, digits and / _ . - only`);
export const roles = ["SUPER_ADMIN", "ADMIN", "DEAN_ACADEMICS", "BOS_COORDINATOR", "HOD", "FACULTY"];
export const formats = ["THEORY", "INTEGRATED", "INTEGRATED_PROJECT", "LAB"];
export const textBlockKinds = [
  "DELIVERY_METHODS",
  "ASSESSMENT_METHODS",
  "LEARNING_ACTIVITIES",
  "CIE_SCHEME",
  "SEE_SCHEME",
  "RUBRICS",
];
export const outcomeKinds = ["PO", "WK", "SDG"];
export const reviewerCategories = ["INTERNAL_BOS", "EXTERNAL_BOS", "INDUSTRY_EXPERT", "ALUMNUS", "ACADEMIC_COUNCIL"];
// --- Administration -------------------------------------------------------
export const departmentSchema = z.object({
  code: code("Code").transform((v) => v.toUpperCase()),
  name: requiredText("Name"),
  isActive: z.boolean().default(true),
});
export const programmeSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  code: code("Code").transform((v) => v.toUpperCase()),
  name: requiredText("Name"),
  level: z.enum(["UG", "PG"]),
});
export const userSchema = z.object({
  name: requiredText("Name"),
  email: z.email("Enter a valid email address").transform((v) => v.trim().toLowerCase()),
  designation: optionalText(120),
  isActive: z.boolean().default(true),
});
export const roleAssignmentSchema = z
  .object({
    role: z.enum(roles),
    departmentId: optionalId,
  })
  .superRefine((v, ctx) => {
    const scoped = v.role === "BOS_COORDINATOR" || v.role === "HOD" || v.role === "FACULTY";
    if (scoped && !v.departmentId) {
      ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Choose the department for this role" });
    }
  })
  .transform((v) => ({
    role: v.role,
    departmentId: v.role === "SUPER_ADMIN" || v.role === "ADMIN" || v.role === "DEAN_ACADEMICS" ? null : v.departmentId,
  }));
// --- Layer 1: Dean Academics ----------------------------------------------
export const schemeSchema = z.object({
  code: code("Code"),
  name: requiredText("Name"),
  framework: optionalText(300),
  effectiveFrom: optionalText(20),
  teachingWeeks: wholeNumber("Teaching weeks", 30).min(1, "At least 1 week"),
  hoursPerCredit: wholeNumber("Hours per credit", 100).min(1, "At least 1 hour"),
  cloneFromId: optionalId,
});
export const categorySchema = z
  .object({
    code: code("Code").transform((v) => v.toUpperCase()),
    name: requiredText("Name"),
    syllabusRequired: z.boolean(),
    passFail: z.boolean(),
    hasSee: z.boolean(),
    cieMarks: wholeNumber("CIE marks"),
    seeMarks: optionalWholeNumber(),
    allowedFormats: z.array(z.enum(formats)),
    defaultFormat: z.preprocess((v) => (v === "" ? null : v), z.enum(formats).nullable()),
  })
  .superRefine((v, ctx) => {
    if (v.hasSee && v.seeMarks === null) {
      ctx.addIssue({ code: "custom", path: ["seeMarks"], message: "Enter SEE marks, or untick “Has SEE”" });
    }
    if (v.syllabusRequired && v.allowedFormats.length === 0) {
      ctx.addIssue({ code: "custom", path: ["allowedFormats"], message: "Choose at least one format" });
    }
    if (v.defaultFormat && !v.allowedFormats.includes(v.defaultFormat)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultFormat"],
        message: "Default format must be one of the allowed formats",
      });
    }
  })
  .transform((v) => ({ ...v, seeMarks: v.hasSee ? v.seeMarks : null }));
export const creditPatternSchema = z
  .object({
    lCredits: wholeNumber("L credits", 20),
    tCredits: wholeNumber("T credits", 20),
    pCredits: wholeNumber("P credits", 20),
    lHours: wholeNumber("L hours/week", 40),
    tHours: wholeNumber("T hours/week", 40),
    pHours: wholeNumber("P hours/week", 40),
  })
  .refine((v) => v.lCredits + v.tCredits + v.pCredits > 0, {
    path: ["lCredits"],
    message: "Total credits must be more than 0",
  });
export const formatConfigSchema = z
  .object({
    title: requiredText("Title"),
    unitCount: wholeNumber("Units", 20),
    experimentCount: wholeNumber("Regular experiments", 40),
    openEndedCount: wholeNumber("Open-ended experiments", 20),
    cloMin: wholeNumber("Minimum objectives", 20),
    cloMax: wholeNumber("Maximum objectives", 20),
    coMin: wholeNumber("Minimum COs", 20),
    coMax: wholeNumber("Maximum COs", 20),
    hasReferenceBooks: z.boolean(),
    prerequisiteLabel: requiredText("Pre-requisites heading", 80),
  })
  .refine((v) => v.cloMin <= v.cloMax, { path: ["cloMax"], message: "Maximum must not be less than minimum" })
  .refine((v) => v.coMin <= v.coMax, { path: ["coMax"], message: "Maximum must not be less than minimum" });
export const outcomeItemSchema = z.object({
  kind: z.enum(outcomeKinds),
  code: code("Code").transform((v) => v.toUpperCase()),
  title: requiredText("Title", 300),
  description: optionalText(2000),
  sortOrder: wholeNumber("Order", 1000).default(0),
});
export const bloomLevelSchema = z.object({
  name: requiredText("Name", 40),
  shortCode: requiredText("Short code", 6),
  verbs: z
    .string()
    .transform((v) => [
      ...new Set(
        v
          .split(/[,\n]/)
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean),
      ),
    ])
    .refine((v) => v.length > 0, "Enter at least one verb"),
});
export const textBlockSchema = z.object({
  kind: z.enum(textBlockKinds),
  format: z.preprocess((v) => (v === "" ? null : v), z.enum(formats).nullable()),
  yearOfStudy: optionalWholeNumber(6),
  title: requiredText("Title", 200),
  body: z.string().trim().min(1, "Text is required").max(20000),
  sortOrder: wholeNumber("Order", 1000).default(0),
});
// --- Layer 2: BoS Coordinator ---------------------------------------------
export const psoSchema = z.object({
  code: code("Code").transform((v) => v.toUpperCase()),
  title: requiredText("Statement", 600),
  sortOrder: wholeNumber("Order", 1000).default(0),
});
export const electiveGroupSchema = z.object({
  semester: wholeNumber("Semester", 12).min(1),
  code: code("Code"),
  title: requiredText("Title"),
});
export const schemeCourseSchema = z.object({
  semester: wholeNumber("Semester", 12).min(1, "Semester is required"),
  code: code("Course code").transform((v) => v.toUpperCase()),
  title: requiredText("Course title"),
  categoryId: z.string().min(1, "Category is required"),
  format: z.preprocess((v) => (v === "" ? null : v), z.enum(formats).nullable()),
  teachingDepartmentId: z.string().min(1, "Teaching department is required"),
  lCredits: wholeNumber("L credits", 20),
  tCredits: wholeNumber("T credits", 20),
  pCredits: wholeNumber("P credits", 20),
  lHours: wholeNumber("L hours"),
  tHours: wholeNumber("T hours"),
  pHours: wholeNumber("P hours"),
  twSlHours: wholeNumber("TW & SL hours"),
  cieMarks: wholeNumber("CIE marks"),
  seeMarks: optionalWholeNumber(),
  examHours: optionalWholeNumber(12),
  electiveGroupId: optionalId,
});
export const reviewerSchema = z.object({
  name: requiredText("Name"),
  category: z.enum(reviewerCategories),
  designation: optionalText(200),
  organisation: optionalText(200),
  email: z
    .preprocess((v) => (v === "" ? undefined : v), z.email("Enter a valid email address").optional())
    .transform((v) => v ?? null),
  phone: optionalText(30),
  isActive: z.boolean().default(true),
});
export const courseAssignmentSchema = z.object({
  userId: z.string().min(1, "Choose a faculty member"),
  role: z.enum(["COORDINATOR", "CO_AUTHOR"]),
});
/** Phase 4: copy a programme's course list from an earlier scheme into a cloned one. */
export const copyCourseListSchema = z.object({
  fromSchemeId: z.string().min(1, "Choose the scheme to copy from"),
  withAssignments: z.boolean().default(true),
});
/** Phase 4: start a syllabus from a version of an earlier scheme's syllabus. */
export const carryForwardSchema = z.object({
  versionId: z.string().min(1, "Choose the syllabus to start from"),
});
/** Registry used by the generic form dialog (client) to look up a schema by name. */
export const formSchemas = {
  copyCourseList: copyCourseListSchema,
  carryForward: carryForwardSchema,
  department: departmentSchema,
  programme: programmeSchema,
  user: userSchema,
  roleAssignment: roleAssignmentSchema,
  scheme: schemeSchema,
  category: categorySchema,
  creditPattern: creditPatternSchema,
  formatConfig: formatConfigSchema,
  outcomeItem: outcomeItemSchema,
  bloomLevel: bloomLevelSchema,
  textBlock: textBlockSchema,
  pso: psoSchema,
  electiveGroup: electiveGroupSchema,
  schemeCourse: schemeCourseSchema,
  reviewer: reviewerSchema,
  courseAssignment: courseAssignmentSchema,
  initialPassword: initialPasswordSchema,
  ...reviewFormSchemas,
};
