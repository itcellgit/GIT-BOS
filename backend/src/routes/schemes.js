// Layer 1 — Dean Academics: schemes, categories, credit patterns, formats, outcome lists,
// Bloom levels and standard text (README §5).
import { Router } from "express";
import { can } from "@acp/shared/domain/auth/permissions";
import { amendmentScope, amendmentSummary, schemeRulesChanged } from "@acp/shared/domain/schemes/amendments";
import { formatCredits } from "@acp/shared/domain/schemes/rules";
import {
  bloomLevelSchema,
  categorySchema,
  creditPatternSchema,
  formatConfigSchema,
  formatSectionsSchema,
  outcomeItemSchema,
  schemeSchema,
  textBlockSchema,
} from "@acp/shared/schemas/config";
import { assertPermission } from "../auth/session.js";
import { NotFoundError, UserError } from "../errors.js";
import { handle } from "../http/handler.js";
import { pdfRoute } from "../http/pdf.js";
import { db } from "../infra/db.js";
import { recheckAmendment, recordAmendment } from "../services/amendments.js";
import { writeAudit } from "../services/audit.js";
import { buildSyllabusBook } from "../services/book.js";
import {
  assertSchemeEditable,
  cloneLayer1,
  getSchemeConfig,
  listSchemeProgrammes,
  publishProblems,
} from "../services/schemes.js";

export const schemesRouter = Router();

// --- Reading --------------------------------------------------------------------

schemesRouter.get(
  "/",
  handle(null, async (_data, req) => {
    const user = assertPermission(req, "scheme.view");
    const schemes = await db.scheme.findMany({
      orderBy: [{ code: "desc" }],
      include: {
        _count: { select: { categories: true, schemeCourses: true } },
        clonedFrom: { select: { name: true } },
      },
    });
    return { schemes, canConfigure: can(user, "scheme.configure") };
  }),
);

schemesRouter.get(
  "/:id",
  handle(null, async (_data, req) => {
    const user = assertPermission(req, "scheme.view");
    const scheme = await getSchemeConfig(req.params.id);
    if (!scheme) throw new NotFoundError("Scheme not found.");
    const canConfigure = can(user, "scheme.configure");
    const [programmes, amendments, semesterRows] = await Promise.all([
      listSchemeProgrammes(scheme.id, user),
      db.schemeAmendment.findMany({
        where: { schemeId: scheme.id },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { flags: { where: { resolvedAt: null } } } },
        },
      }),
      db.schemeCourse.findMany({
        where: { schemeId: scheme.id },
        distinct: ["semester"],
        select: { semester: true },
        orderBy: { semester: "asc" },
      }),
    ]);
    return {
      scheme,
      programmes,
      semesters: semesterRows.map((r) => r.semester),
      // Layer-1 changes made after publishing, newest first (README §5).
      amendments: amendments.map((a) => ({
        id: a.id,
        summary: a.summary,
        action: a.action,
        at: a.createdAt,
        by: a.createdBy?.name ?? null,
        affectedCount: a.affectedCount,
        openCount: a._count.flags,
      })),
      canConfigure,
      editable: canConfigure && scheme.status !== "RETIRED",
    };
  }),
);

/**
 * Whole-scheme syllabus book (README §8): every programme's scheme tables and contents, then each approved
 * syllabus once (a course shared by programmes is not repeated). `?semester=3` for one semester.
 */
schemesRouter.get(
  "/:id/book/pdf",
  pdfRoute(async (req) => {
    assertPermission(req, "scheme.configure");
    const semester = req.query.semester ? Number(req.query.semester) : null;
    if (semester !== null && !Number.isInteger(semester)) throw new UserError("Unknown semester.");
    return buildSyllabusBook({ schemeId: req.params.id, programmeId: null, semester });
  }),
);

// --- Scheme lifecycle -------------------------------------------------------------

schemesRouter.post(
  "/",
  handle(
    schemeSchema,
    async ({ cloneFromId, ...data }, req) => {
      const actor = assertPermission(req, "scheme.configure");
      return db.$transaction(async (tx) => {
        const scheme = await tx.scheme.create({ data: { ...data, status: "DRAFT", clonedFromId: cloneFromId } });
        if (cloneFromId) await cloneLayer1(tx, cloneFromId, scheme.id);
        await writeAudit(
          {
            actorId: actor.id,
            action: "scheme.create",
            entityType: "Scheme",
            entityId: scheme.id,
            details: { ...data, cloneFromId },
          },
          tx,
        );
        return { id: scheme.id };
      });
    },
    "Draft scheme created",
  ),
);

schemesRouter.put(
  "/:id",
  handle(
    schemeSchema,
    async ({ cloneFromId: _ignored, ...data }, req) => {
      const schemeId = req.params.id;
      const actor = assertPermission(req, "scheme.configure");
      await assertSchemeEditable(schemeId);
      const before = await db.scheme.findUnique({ where: { id: schemeId } });
      const amendmentId = await db.$transaction(async (tx) => {
        await tx.scheme.update({ where: { id: schemeId }, data });
        await writeAudit(
          { actorId: actor.id, action: "scheme.update", entityType: "Scheme", entityId: schemeId, details: data },
          tx,
        );
        // Weeks or hours per credit changed on a scheme in use: every syllabus needs a look (README §5).
        if (before.status !== "PUBLISHED" || !schemeRulesChanged(before, data)) return null;
        return recordAmendment(tx, {
          schemeId,
          actorId: actor.id,
          action: "scheme.update",
          summary: amendmentSummary("scheme.update", { before, after: data }),
          scope: amendmentScope("scheme.update"),
          details: data,
        });
      });
      if (amendmentId) recheckLater(amendmentId);
    },
    "Scheme updated",
  ),
);

schemesRouter.post(
  "/:id/publish",
  handle(
    null,
    async (_data, req) => {
      const sid = req.params.id;
      const actor = assertPermission(req, "scheme.configure");
      const scheme = await db.scheme.findUnique({ where: { id: sid } });
      if (!scheme || scheme.status !== "DRAFT") throw new UserError("Only a draft scheme can be published.");
      const problems = await publishProblems(sid);
      if (problems.length) throw new UserError(`Cannot publish yet: ${problems.join(" ")}`);
      await db.$transaction(async (tx) => {
        await tx.scheme.update({ where: { id: sid }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        await writeAudit({ actorId: actor.id, action: "scheme.publish", entityType: "Scheme", entityId: sid }, tx);
      });
    },
    "Scheme published — departments can now set up their course lists",
  ),
);

schemesRouter.post(
  "/:id/retire",
  handle(
    null,
    async (_data, req) => {
      const sid = req.params.id;
      const actor = assertPermission(req, "scheme.configure");
      const scheme = await db.scheme.findUnique({ where: { id: sid } });
      if (!scheme || scheme.status !== "PUBLISHED") throw new UserError("Only a published scheme can be retired.");
      await db.$transaction(async (tx) => {
        await tx.scheme.update({ where: { id: sid }, data: { status: "RETIRED", retiredAt: new Date() } });
        await writeAudit({ actorId: actor.id, action: "scheme.retire", entityType: "Scheme", entityId: sid }, tx);
      });
    },
    "Scheme retired",
  ),
);

schemesRouter.delete(
  "/:id",
  handle(
    null,
    async (_data, req) => {
      const sid = req.params.id;
      const actor = assertPermission(req, "scheme.configure");
      const scheme = await db.scheme.findUnique({
        where: { id: sid },
        include: { _count: { select: { schemeCourses: true } } },
      });
      if (!scheme || scheme.status !== "DRAFT") throw new UserError("Only a draft scheme can be deleted.");
      if (scheme._count.schemeCourses > 0) {
        throw new UserError("Remove the departments' course lists from this draft first.");
      }
      await db.$transaction(async (tx) => {
        await tx.scheme.delete({ where: { id: sid } });
        await writeAudit(
          {
            actorId: actor.id,
            action: "scheme.delete",
            entityType: "Scheme",
            entityId: sid,
            details: { name: scheme.name },
          },
          tx,
        );
      });
    },
    "Draft scheme deleted",
  ),
);

// --- Helpers for scheme-owned records ------------------------------------------------

/**
 * Permission + editable-state check, then the write and its audit entry in one transaction. On a
 * published scheme the change is also an amendment (README §5): `change` names what changed
 * ({ categoryId, format, code, kind, title, pattern }), which decides the syllabi flagged "Needs revision".
 */
async function layer1Change(req, action, entityType, details, write, change = {}) {
  const schemeId = req.params.id;
  const actor = assertPermission(req, "scheme.configure");
  const scheme = await assertSchemeEditable(schemeId);
  const amendmentId = await db.$transaction(async (tx) => {
    const row = await write(tx);
    await writeAudit(
      { actorId: actor.id, action, entityType, entityId: row?.id ?? null, details: { schemeId, ...details } },
      tx,
    );
    if (scheme.status !== "PUBLISHED") return null;
    return recordAmendment(tx, {
      schemeId,
      actorId: actor.id,
      action,
      summary: amendmentSummary(action, change),
      scope: amendmentScope(action, change),
      details: { entityType, entityId: row?.id ?? null },
    });
  });
  if (amendmentId) recheckLater(amendmentId);
}

/** Re-runs the checks of the flagged syllabi after the response, so the change itself stays quick. */
function recheckLater(amendmentId) {
  setImmediate(() =>
    recheckAmendment(amendmentId).catch((e) => console.warn("[amendment] re-check failed:", e.message)),
  );
}

/** Confirms a child record belongs to the scheme in the URL (prevents cross-scheme edits). */
function owned(row, schemeId) {
  if (!row || row.schemeId !== schemeId) throw new NotFoundError("Record not found in this scheme.");
  return row;
}

// --- Categories and credit patterns ---------------------------------------------------

const saveCategory = handle(
  categorySchema,
  async (data, req) => {
    const categoryId = req.params.categoryId ?? null;
    if (categoryId) owned(await db.courseCategory.findUnique({ where: { id: categoryId } }), req.params.id);
    await layer1Change(
      req,
      categoryId ? "category.update" : "category.create",
      "CourseCategory",
      data,
      (tx) =>
        categoryId
          ? tx.courseCategory.update({ where: { id: categoryId }, data })
          : tx.courseCategory.create({ data: { ...data, schemeId: req.params.id } }),
      { categoryId, code: data.code },
    );
  },
  "Category saved",
);
schemesRouter.post("/:id/categories", saveCategory);
schemesRouter.put("/:id/categories/:categoryId", saveCategory);

schemesRouter.delete(
  "/:id/categories/:categoryId",
  handle(
    null,
    async (_data, req) => {
      const cid = req.params.categoryId;
      const category = owned(
        await db.courseCategory.findUnique({
          where: { id: cid },
          include: { _count: { select: { schemeCourses: true } } },
        }),
        req.params.id,
      );
      if (category._count.schemeCourses > 0) {
        throw new UserError(
          `${category.code} is used by ${category._count.schemeCourses} course(s) and cannot be deleted.`,
        );
      }
      await layer1Change(
        req,
        "category.delete",
        "CourseCategory",
        { code: category.code },
        (tx) => tx.courseCategory.delete({ where: { id: cid } }),
        { categoryId: cid, code: category.code },
      );
    },
    "Category deleted",
  ),
);

schemesRouter.post(
  "/:id/categories/:categoryId/patterns",
  handle(
    creditPatternSchema,
    async (data, req) => {
      const categoryId = req.params.categoryId;
      const category = owned(await db.courseCategory.findUnique({ where: { id: categoryId } }), req.params.id);
      await layer1Change(
        req,
        "creditPattern.create",
        "CreditPattern",
        { categoryId, ...data },
        (tx) => tx.creditPattern.create({ data: { ...data, categoryId } }),
        { categoryId, code: category.code, pattern: formatCredits(data) },
      );
    },
    "Credit pattern added",
  ),
);

schemesRouter.delete(
  "/:id/patterns/:patternId",
  handle(
    null,
    async (_data, req) => {
      const pid = req.params.patternId;
      const pattern = await db.creditPattern.findUnique({ where: { id: pid }, include: { category: true } });
      if (!pattern || pattern.category.schemeId !== req.params.id) throw new NotFoundError("Credit pattern not found.");
      await layer1Change(
        req,
        "creditPattern.delete",
        "CreditPattern",
        { categoryId: pattern.categoryId },
        (tx) => tx.creditPattern.delete({ where: { id: pid } }),
        { categoryId: pattern.categoryId, code: pattern.category.code, pattern: formatCredits(pattern) },
      );
    },
    "Credit pattern removed",
  ),
);

// --- Formats ----------------------------------------------------------------------------

schemesRouter.put(
  "/:id/formats/:formatId",
  handle(
    formatConfigSchema,
    async (data, req) => {
      const formatId = req.params.formatId;
      const format = owned(await db.formatConfig.findUnique({ where: { id: formatId } }), req.params.id);
      await layer1Change(
        req,
        "format.update",
        "FormatConfig",
        data,
        (tx) => tx.formatConfig.update({ where: { id: formatId }, data }),
        { format: format.format },
      );
    },
    "Format settings saved",
  ),
);

/** Section order, the optional sections on or off, and printed headings (README §5, §8). */
schemesRouter.put(
  "/:id/formats/:formatId/sections",
  handle(
    formatSectionsSchema,
    async ({ sections }, req) => {
      const formatId = req.params.formatId;
      const format = owned(await db.formatConfig.findUnique({ where: { id: formatId } }), req.params.id);
      await layer1Change(
        req,
        "format.sections",
        "FormatConfig",
        { sections },
        (tx) => tx.formatConfig.update({ where: { id: formatId }, data: { sections } }),
        { format: format.format },
      );
    },
    "Section layout saved",
  ),
);

// --- Outcome lists (PO / WK / SDG) ------------------------------------------------------

const saveOutcomeItem = handle(
  outcomeItemSchema,
  async (data, req) => {
    const itemId = req.params.itemId ?? null;
    const item = itemId ? owned(await db.outcomeItem.findUnique({ where: { id: itemId } }), req.params.id) : null;
    await layer1Change(
      req,
      itemId ? "outcome.update" : "outcome.create",
      "OutcomeItem",
      data,
      (tx) =>
        itemId
          ? tx.outcomeItem.update({ where: { id: itemId }, data })
          : tx.outcomeItem.create({ data: { ...data, schemeId: req.params.id } }),
      { kind: data.kind ?? item?.kind, code: data.code ?? item?.code },
    );
  },
  "Saved",
);
schemesRouter.post("/:id/outcomes", saveOutcomeItem);
schemesRouter.put("/:id/outcomes/:itemId", saveOutcomeItem);

schemesRouter.delete(
  "/:id/outcomes/:itemId",
  handle(
    null,
    async (_data, req) => {
      const oid = req.params.itemId;
      const item = owned(await db.outcomeItem.findUnique({ where: { id: oid } }), req.params.id);
      await layer1Change(
        req,
        "outcome.delete",
        "OutcomeItem",
        { code: item.code },
        (tx) => tx.outcomeItem.delete({ where: { id: oid } }),
        { kind: item.kind, code: item.code },
      );
    },
    "Deleted",
  ),
);

// --- Bloom levels -------------------------------------------------------------------------

schemesRouter.put(
  "/:id/bloom/:levelId",
  handle(
    bloomLevelSchema,
    async (data, req) => {
      const levelId = req.params.levelId;
      const level = owned(await db.bloomLevel.findUnique({ where: { id: levelId } }), req.params.id);
      await layer1Change(
        req,
        "bloom.update",
        "BloomLevel",
        data,
        (tx) => tx.bloomLevel.update({ where: { id: levelId }, data }),
        { code: `L${level.level} ${level.name}` },
      );
    },
    "Bloom level saved",
  ),
);

// --- Text blocks ----------------------------------------------------------------------------

const saveTextBlock = handle(
  textBlockSchema,
  async (data, req) => {
    const blockId = req.params.blockId ?? null;
    if (blockId) owned(await db.textBlock.findUnique({ where: { id: blockId } }), req.params.id);
    await layer1Change(
      req,
      blockId ? "textBlock.update" : "textBlock.create",
      "TextBlock",
      { title: data.title },
      (tx) =>
        blockId
          ? tx.textBlock.update({ where: { id: blockId }, data })
          : tx.textBlock.create({ data: { ...data, schemeId: req.params.id } }),
      { title: data.title },
    );
  },
  "Text block saved",
);
schemesRouter.post("/:id/text-blocks", saveTextBlock);
schemesRouter.put("/:id/text-blocks/:blockId", saveTextBlock);

schemesRouter.delete(
  "/:id/text-blocks/:blockId",
  handle(
    null,
    async (_data, req) => {
      const bid = req.params.blockId;
      const block = owned(await db.textBlock.findUnique({ where: { id: bid } }), req.params.id);
      await layer1Change(
        req,
        "textBlock.delete",
        "TextBlock",
        { title: block.title },
        (tx) => tx.textBlock.delete({ where: { id: bid } }),
        { title: block.title },
      );
    },
    "Text block deleted",
  ),
);
