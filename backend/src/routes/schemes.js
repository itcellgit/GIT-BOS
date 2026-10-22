// Layer 1 — Dean Academics: schemes, categories, credit patterns, formats, outcome lists,
// Bloom levels and standard text (README §5).
import { Router } from "express";
import { can } from "@acp/shared/domain/auth/permissions";
import {
  bloomLevelSchema,
  categorySchema,
  creditPatternSchema,
  formatConfigSchema,
  outcomeItemSchema,
  schemeSchema,
  textBlockSchema,
} from "@acp/shared/schemas/config";
import { assertPermission } from "../auth/session.js";
import { NotFoundError, UserError } from "../errors.js";
import { handle } from "../http/handler.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";
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
    return {
      scheme,
      programmes: await listSchemeProgrammes(scheme.id, user),
      canConfigure,
      editable: canConfigure && scheme.status !== "RETIRED",
    };
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
      await db.$transaction(async (tx) => {
        await tx.scheme.update({ where: { id: schemeId }, data });
        await writeAudit(
          { actorId: actor.id, action: "scheme.update", entityType: "Scheme", entityId: schemeId, details: data },
          tx,
        );
      });
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

/** Permission + editable-state check, then the write and its audit entry in one transaction. */
async function layer1Change(req, action, entityType, details, write) {
  const schemeId = req.params.id;
  const actor = assertPermission(req, "scheme.configure");
  await assertSchemeEditable(schemeId);
  await db.$transaction(async (tx) => {
    const row = await write(tx);
    await writeAudit(
      { actorId: actor.id, action, entityType, entityId: row?.id ?? null, details: { schemeId, ...details } },
      tx,
    );
  });
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
    await layer1Change(req, categoryId ? "category.update" : "category.create", "CourseCategory", data, (tx) =>
      categoryId
        ? tx.courseCategory.update({ where: { id: categoryId }, data })
        : tx.courseCategory.create({ data: { ...data, schemeId: req.params.id } }),
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
      await layer1Change(req, "category.delete", "CourseCategory", { code: category.code }, (tx) =>
        tx.courseCategory.delete({ where: { id: cid } }),
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
      owned(await db.courseCategory.findUnique({ where: { id: categoryId } }), req.params.id);
      await layer1Change(req, "creditPattern.create", "CreditPattern", { categoryId, ...data }, (tx) =>
        tx.creditPattern.create({ data: { ...data, categoryId } }),
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
      await layer1Change(req, "creditPattern.delete", "CreditPattern", { categoryId: pattern.categoryId }, (tx) =>
        tx.creditPattern.delete({ where: { id: pid } }),
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
      owned(await db.formatConfig.findUnique({ where: { id: formatId } }), req.params.id);
      await layer1Change(req, "format.update", "FormatConfig", data, (tx) =>
        tx.formatConfig.update({ where: { id: formatId }, data }),
      );
    },
    "Format settings saved",
  ),
);

// --- Outcome lists (PO / WK / SDG) ------------------------------------------------------

const saveOutcomeItem = handle(
  outcomeItemSchema,
  async (data, req) => {
    const itemId = req.params.itemId ?? null;
    if (itemId) owned(await db.outcomeItem.findUnique({ where: { id: itemId } }), req.params.id);
    await layer1Change(req, itemId ? "outcome.update" : "outcome.create", "OutcomeItem", data, (tx) =>
      itemId
        ? tx.outcomeItem.update({ where: { id: itemId }, data })
        : tx.outcomeItem.create({ data: { ...data, schemeId: req.params.id } }),
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
      await layer1Change(req, "outcome.delete", "OutcomeItem", { code: item.code }, (tx) =>
        tx.outcomeItem.delete({ where: { id: oid } }),
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
      owned(await db.bloomLevel.findUnique({ where: { id: levelId } }), req.params.id);
      await layer1Change(req, "bloom.update", "BloomLevel", data, (tx) =>
        tx.bloomLevel.update({ where: { id: levelId }, data }),
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
      await layer1Change(req, "textBlock.delete", "TextBlock", { title: block.title }, (tx) =>
        tx.textBlock.delete({ where: { id: bid } }),
      );
    },
    "Text block deleted",
  ),
);
