// Approved syllabi of a scheme (the official, frozen copies). Mounted at /api/schemes/:schemeId/approved-syllabi
// Everyone with a role can list them and view or download their PDFs ("syllabus.viewApproved"); the
// working copies, versions and review history stay limited to "syllabus.view".
import { Router } from "express";
import { normalizeSyllabusContent } from "@acp/shared/domain/syllabi/content";
import { assertPermission } from "../auth/session.js";
import { NotFoundError } from "../errors.js";
import { handle } from "../http/handler.js";
import { pdfRoute } from "../http/pdf.js";
import { db } from "../infra/db.js";
import { frozenSyllabusPdf } from "../services/documents.js";
import { buildEditorData, loadSyllabusContext } from "../services/syllabi.js";

export const approvedSyllabiRouter = Router({ mergeParams: true });

approvedSyllabiRouter.get(
  "/",
  handle(null, async (_data, req) => {
    assertPermission(req, "syllabus.viewApproved");
    const { schemeId } = req.params;
    const scheme = await db.scheme.findUnique({
      where: { id: schemeId },
      select: { id: true, name: true, code: true, status: true },
    });
    if (!scheme) throw new NotFoundError("Scheme not found.");

    const [syllabi, rows] = await Promise.all([
      db.syllabus.findMany({
        where: { schemeId, officialVersionId: { not: null } },
        include: {
          course: { include: { owningDepartment: { select: { code: true, name: true } } } },
          officialVersion: {
            select: {
              id: true,
              label: true,
              approvals: { orderBy: { approvedOn: "desc" }, take: 1, select: { approvedOn: true, reference: true } },
            },
          },
        },
      }),
      db.schemeCourse.findMany({
        where: { schemeId },
        select: { courseId: true, semester: true, programme: { select: { code: true } } },
      }),
    ]);

    const courses = syllabi.map((s) => {
      const placements = rows.filter((r) => r.courseId === s.courseId);
      const approval = s.officialVersion.approvals[0] ?? null;
      return {
        courseId: s.courseId,
        code: s.course.code,
        title: s.course.title,
        department: s.course.owningDepartment,
        format: s.format,
        programmes: [...new Set(placements.map((r) => r.programme.code))].sort(),
        semesters: [...new Set(placements.map((r) => r.semester))].sort((a, b) => a - b),
        versionLabel: s.officialVersion.label,
        approvedOn: approval?.approvedOn ?? null,
        reference: approval?.reference ?? null,
        // An approved syllabus reopened for a correction keeps its approved copy in force (D5).
        underCorrection: s.status !== "APPROVED",
      };
    });
    courses.sort((a, b) => (a.semesters[0] ?? 99) - (b.semesters[0] ?? 99) || a.code.localeCompare(b.code));
    return { scheme, courses };
  }),
);

/** The frozen PDF of the course's official version. `?download=1` sends it as a file. */
approvedSyllabiRouter.get(
  "/:courseId/pdf",
  pdfRoute(async (req) => {
    assertPermission(req, "syllabus.viewApproved");
    const { schemeId, courseId } = req.params;
    const syllabus = await db.syllabus.findUnique({
      where: { schemeId_courseId: { schemeId, courseId } },
      include: { officialVersion: true, course: { select: { code: true } } },
    });
    const version = syllabus?.officialVersion;
    if (!version) throw new NotFoundError("This course has no approved syllabus yet.");

    const ctx = await loadSyllabusContext(null, schemeId, courseId);
    const { data } = await buildEditorData(ctx);
    const doc = await frozenSyllabusPdf(data, version, normalizeSyllabusContent(version.content, ctx.format));
    return {
      pdf: Buffer.from(doc.pdf),
      fileName: `${syllabus.course.code}_syllabus_${version.label}.pdf`,
      headers: {
        "X-Document-Id": doc.id,
        "X-Document-SHA256": doc.sha256,
        "X-Layout-Version": String(doc.layoutVersion),
      },
    };
  }),
);
