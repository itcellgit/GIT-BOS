// Seeds the 2025 scheme, B.E. CSE semesters III–IV, outcome lists and the Super Admin.
// Safe to run more than once: every record is upserted by its natural key.
// Run: npm run db:seed   (demo users are added unless NODE_ENV=production)
import "../src/config/load-env.js";
import { createDb } from "../src/infra/db.js";
import { ensureSuperAdmin } from "./super-admin.js";
import {
  bloomLevels,
  categories2025,
  cseCourses2025,
  departments2025,
  electiveGroups2025,
  formatConfigs2025,
  knowledgeProfiles,
  programmeOutcomes,
  programmes2025,
  scheme2025,
  sustainableDevelopmentGoals,
  textBlocks2025,
} from "@acp/shared/data/scheme-2025";
const db = createDb();
async function seedInstitution() {
  await db.institutionSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "KLS Gogte Institute of Technology",
      shortName: "KLS GIT",
      address: "Jnana Ganga, Udyambag, Belagavi-590008",
      estd: "1979",
    },
  });
}
async function seedDepartments() {
  const ids = {};
  for (const d of departments2025) {
    const row = await db.department.upsert({ where: { code: d.code }, update: {}, create: d });
    ids[d.code] = row.id;
  }
  const programmeIds = {};
  for (const p of programmes2025) {
    const row = await db.programme.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, name: p.name, level: p.level, departmentId: ids[p.departmentCode] },
    });
    programmeIds[p.code] = row.id;
  }
  return { departmentIds: ids, programmeIds };
}
async function seedScheme() {
  const scheme = await db.scheme.upsert({
    where: { code: scheme2025.code },
    update: {},
    create: { ...scheme2025, status: "PUBLISHED", publishedAt: new Date() },
  });
  const categoryIds = {};
  for (const [i, c] of categories2025.entries()) {
    const data = {
      name: c.name,
      syllabusRequired: c.syllabusRequired,
      passFail: c.passFail,
      hasSee: c.hasSee,
      cieMarks: c.cieMarks,
      seeMarks: c.seeMarks,
      allowedFormats: c.allowedFormats,
      defaultFormat: c.defaultFormat,
      sortOrder: i,
    };
    const row = await db.courseCategory.upsert({
      where: { schemeId_code: { schemeId: scheme.id, code: c.code } },
      update: {},
      create: { schemeId: scheme.id, code: c.code, ...data },
    });
    categoryIds[c.code] = row.id;
    for (const p of c.creditPatterns) {
      await db.creditPattern.upsert({
        where: { categoryId_lCredits_tCredits_pCredits_lHours_tHours_pHours: { categoryId: row.id, ...p } },
        update: {},
        create: { categoryId: row.id, ...p },
      });
    }
  }
  for (const f of formatConfigs2025) {
    await db.formatConfig.upsert({
      where: { schemeId_format: { schemeId: scheme.id, format: f.format } },
      update: {},
      create: { schemeId: scheme.id, ...f },
    });
  }
  for (const b of bloomLevels) {
    await db.bloomLevel.upsert({
      where: { schemeId_level: { schemeId: scheme.id, level: b.level } },
      update: {},
      create: { schemeId: scheme.id, ...b },
    });
  }
  // Outcome lists and text blocks have no natural unique key, so seed them only once.
  if ((await db.outcomeItem.count({ where: { schemeId: scheme.id } })) === 0) {
    const items = [
      ...programmeOutcomes.map(([code, title], i) => ({ kind: "PO", code, title, sortOrder: i })),
      ...knowledgeProfiles.map(([code, title], i) => ({ kind: "WK", code, title, sortOrder: i })),
      ...sustainableDevelopmentGoals.map(([code, title], i) => ({ kind: "SDG", code, title, sortOrder: i })),
    ];
    await db.outcomeItem.createMany({ data: items.map((x) => ({ ...x, schemeId: scheme.id })) });
  }
  // Text blocks: add any standard block that is missing (matched by kind, format, year and title),
  // so blocks added in later releases reach existing databases without touching edited ones.
  const existingBlocks = await db.textBlock.findMany({ where: { schemeId: scheme.id } });
  const blockKey = (t) => [t.kind, t.format ?? "", t.yearOfStudy ?? "", t.title].join("|");
  const haveBlocks = new Set(existingBlocks.map(blockKey));
  const missingBlocks = textBlocks2025
    .map((t, i) => ({ ...t, schemeId: scheme.id, sortOrder: i }))
    .filter((t) => !haveBlocks.has(blockKey(t)));
  if (missingBlocks.length) await db.textBlock.createMany({ data: missingBlocks });
  return { schemeId: scheme.id, categoryIds };
}
async function seedCseCourses(schemeId, categoryIds, departmentIds, programmeId) {
  const groupIds = {};
  for (const g of electiveGroups2025) {
    const row = await db.electiveGroup.upsert({
      where: { schemeId_programmeId_code: { schemeId, programmeId, code: g.code } },
      update: {},
      create: { schemeId, programmeId, ...g },
    });
    groupIds[g.code] = row.id;
  }
  for (const [i, c] of cseCourses2025.entries()) {
    const teachingDepartmentId = departmentIds[c.teachingDepartment];
    const course = await db.course.upsert({
      where: { code: c.code },
      update: {},
      // README §3 Q1 working assumption: the teaching department owns the syllabus.
      create: { code: c.code, title: c.title, owningDepartmentId: teachingDepartmentId },
    });
    const figures = {
      semester: c.semester,
      categoryId: categoryIds[c.category],
      format: c.format,
      teachingDepartmentId,
      lCredits: c.credits[0],
      tCredits: c.credits[1],
      pCredits: c.credits[2],
      lHours: c.hours[0],
      tHours: c.hours[1],
      pHours: c.hours[2],
      twSlHours: c.hours[3],
      cieMarks: c.cie,
      seeMarks: c.see,
      examHours: c.examHours,
      electiveGroupId: c.electiveGroup ? groupIds[c.electiveGroup] : null,
      sortOrder: i,
    };
    await db.schemeCourse.upsert({
      where: { schemeId_programmeId_courseId: { schemeId, programmeId, courseId: course.id } },
      update: {},
      create: { schemeId, programmeId, courseId: course.id, ...figures },
    });
  }
}
async function upsertUser(email, name, roles) {
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, emailVerified: true },
  });
  for (const r of roles) {
    const existing = await db.roleAssignment.findFirst({
      where: { userId: user.id, role: r.role, departmentId: r.departmentId },
    });
    if (!existing) await db.roleAssignment.create({ data: { userId: user.id, ...r } });
  }
  return user;
}
async function seedUsers(departmentIds, schemeId) {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  if (!email) throw new Error("Set SUPER_ADMIN_EMAIL in .env before seeding.");
  const password = process.env.SUPER_ADMIN_PASSWORD || undefined;
  const result = await ensureSuperAdmin(db, {
    email,
    name: process.env.SUPER_ADMIN_NAME || "Super Admin",
    password,
    resetPassword: false, // never overwrite an existing password from the seed; use `npm run super-admin`
  });
  console.log(`  Super Admin: ${result.user.email}`);
  if (result.passwordSet)
    console.log("    password set from SUPER_ADMIN_PASSWORD; it must be changed at first sign-in");
  else if (!result.hadPassword)
    console.log("    no password yet (SUPER_ADMIN_PASSWORD is empty): signs in with an email code");
  if (process.env.NODE_ENV === "production") return;
  // Demo accounts for local development only.
  const cse = departmentIds.CSE;
  await upsertUser("it.admin@example.edu", "IT Administrator (demo)", [{ role: "ADMIN", departmentId: null }]);
  await upsertUser("dean@example.edu", "Dean Academics (demo)", [{ role: "DEAN_ACADEMICS", departmentId: null }]);
  await upsertUser("bos.cse@example.edu", "BoS Coordinator CSE (demo)", [
    { role: "BOS_COORDINATOR", departmentId: cse },
    { role: "FACULTY", departmentId: cse },
  ]);
  await upsertUser("hod.cse@example.edu", "HoD CSE (demo)", [{ role: "HOD", departmentId: cse }]);
  const faculty = await upsertUser("faculty.cse@example.edu", "Faculty CSE (demo)", [
    { role: "FACULTY", departmentId: cse },
  ]);
  const dsa = await db.course.findUnique({ where: { code: "1BCS304" } });
  if (dsa) {
    await db.courseAssignment.upsert({
      where: { schemeId_courseId_userId: { schemeId, courseId: dsa.id, userId: faculty.id } },
      update: {},
      create: { schemeId, courseId: dsa.id, userId: faculty.id, role: "COORDINATOR" },
    });
  }
  console.log("  demo users: it.admin@, dean@, bos.cse@, hod.cse@, faculty.cse@example.edu");
}
async function main() {
  console.log("Seeding …");
  await seedInstitution();
  const { departmentIds, programmeIds } = await seedDepartments();
  const { schemeId, categoryIds } = await seedScheme();
  await seedCseCourses(schemeId, categoryIds, departmentIds, programmeIds["BE-CSE"]);
  await seedUsers(departmentIds, schemeId);
  console.log("Done.");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
