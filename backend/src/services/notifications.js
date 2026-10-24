// Email notifications (README §7, "Notifications"): an outbox in the `notification` table.
//
// Queueing: a workflow change calls notify…() inside its own transaction, so a notification exists
// exactly when the change commits. The person who made the change is never notified, nor anyone
// inactive or with emails turned off.
//
// Sending: startNotificationSender() runs in the API process. Every few seconds it claims the due rows
// (FOR UPDATE SKIP LOCKED, so two API processes never send the same row), groups rows of one recipient
// that share a groupKey into one digest email, and retries failures with a growing delay.
import { db } from "../infra/db.js";
import { sendMail } from "../infra/mail.js";
import { composeEmail } from "./notification-messages.js";

const production = process.env.NODE_ENV === "production";
/** A number of seconds from the environment; empty or invalid values use the default. */
const seconds = (name, fallback, min = 0) => {
  const raw = process.env[name]?.trim();
  const v = raw ? Number(raw) : NaN;
  return Number.isFinite(v) && v >= min ? v : fallback;
};
/** How long inputs and comments are collected into one digest email. */
export const DIGEST_SECONDS = seconds("NOTIFY_DIGEST_SECONDS", production ? 600 : 10);
/** How often the sender looks for due notifications. */
export const INTERVAL_SECONDS = seconds("NOTIFY_INTERVAL_SECONDS", production ? 30 : 3, 1);
/** Delay before attempt 2, 3, 4, 5 (minutes); after the last attempt the row is FAILED. */
const RETRY_MINUTES = [1, 5, 15, 60];
const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;

const appUrl = () => process.env.BETTER_AUTH_URL || "http://localhost:5173";

// --- Recipients -------------------------------------------------------------------------------------

/** Course Coordinator and co-authors of a course in a scheme. */
export async function courseTeam(tx, schemeId, courseId) {
  const rows = await tx.courseAssignment.findMany({ where: { schemeId, courseId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Users holding a role in a department (BoS Coordinators, HoDs). */
export async function departmentRole(tx, departmentId, role) {
  const rows = await tx.roleAssignment.findMany({ where: { departmentId, role }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

// --- Queueing ---------------------------------------------------------------------------------------

/**
 * Queues one notification per recipient (inside the caller's transaction).
 * @param {object} tx           Prisma transaction client
 * @param {object} n
 * @param {string} n.kind       a kind of services/notification-messages.js
 * @param {string[]} n.userIds  recipients (duplicates and the actor are removed)
 * @param {string|null} [n.actorId]
 * @param {object} n.payload    facts for the message
 * @param {string} [n.groupKey] rows of one recipient with this key become one digest email
 * @param {boolean} [n.digest]  wait DIGEST_SECONDS so later rows of the same group join the email
 * @param {boolean} [n.once]    skip a recipient who was already notified with this groupKey
 * @returns {Promise<number>} rows queued
 */
export async function queueNotification(
  tx,
  { kind, userIds, actorId = null, payload, groupKey = null, digest = false, once = false },
) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== actorId);
  if (ids.length === 0) return 0;
  const recipients = await tx.user.findMany({
    where: { id: { in: ids }, isActive: true, emailNotifications: true },
    select: { id: true },
  });
  let queued = 0;
  for (const { id: userId } of recipients) {
    if (once && groupKey && (await tx.notification.count({ where: { userId, groupKey } }))) continue;
    // Rows of one digest share the first row's send time, so they are due (and sent) together.
    const open =
      digest && groupKey
        ? await tx.notification.findFirst({
            where: { userId, groupKey, status: "PENDING" },
            orderBy: { createdAt: "asc" },
            select: { sendAfter: true },
          })
        : null;
    const sendAfter = open?.sendAfter ?? new Date(Date.now() + (digest ? DIGEST_SECONDS * 1000 : 0));
    await tx.notification.create({ data: { userId, kind, groupKey, payload, sendAfter } });
    queued++;
  }
  return queued;
}

/** Facts every syllabus notification shares, from a syllabus context (services/syllabi.js). */
export function syllabusFacts(ctx) {
  return {
    course: { code: ctx.course.code, title: ctx.course.title },
    schemeId: ctx.scheme.id,
    schemeName: ctx.scheme.name,
    path: `/syllabi/${ctx.scheme.id}/${ctx.course.id}`,
  };
}

/**
 * The workflow notifications, by event. `ctx` is the syllabus context of routes/reviews.js
 * (user, scheme, course, syllabus); `details` holds what the event adds.
 */
export async function notifyWorkflow(tx, ctx, event, details = {}) {
  const facts = syllabusFacts(ctx);
  const departmentId = ctx.course.owningDepartmentId;
  const actorId = ctx.user?.id ?? null;
  const by = ctx.user?.name ?? null;
  const team = () => courseTeam(tx, ctx.scheme.id, ctx.course.id);
  const bos = () => departmentRole(tx, departmentId, "BOS_COORDINATOR");
  const hods = () => departmentRole(tx, departmentId, "HOD");
  const syllabusId = ctx.syllabus.id;

  switch (event) {
    case "submitted":
      return queueNotification(tx, {
        kind: "submitted",
        userIds: await bos(),
        actorId,
        payload: { ...facts, by, version: details.version },
      });
    case "inputRecorded":
      return queueNotification(tx, {
        kind: "inputs",
        userIds: await team(),
        actorId,
        payload: { ...facts, stage: details.stage, section: details.section },
        groupKey: `inputs:${syllabusId}:${details.stage}`,
        digest: true,
      });
    case "expertComment":
      return queueNotification(tx, {
        kind: "expertComments",
        userIds: [...(await team()), ...(await bos())],
        actorId,
        payload: { ...facts, reviewer: details.reviewer },
        groupKey: `expert:${syllabusId}`,
        digest: true,
      });
    case "inputAnswered": {
      const pending = await tx.reviewInput.count({ where: { syllabusId, stage: details.stage, actionTaken: null } });
      if (pending > 0) return 0;
      return queueNotification(tx, {
        kind: "inputsAnswered",
        userIds: await bos(),
        actorId,
        payload: { ...facts, stage: details.stage },
        // Once per stage, even if an answer is edited afterwards.
        groupKey: `answered:${syllabusId}:${details.stage}`,
        once: true,
      });
    }
    case "stageClosed":
      return queueNotification(tx, {
        kind: "stageClosed",
        userIds: await team(),
        actorId,
        payload: { ...facts, fromStage: details.fromStage, toStage: details.toStage, version: details.version },
      });
    case "approved":
      return queueNotification(tx, {
        kind: "approved",
        userIds: [...(await team()), ...(await bos()), ...(await hods())],
        actorId,
        payload: { ...facts, version: details.version, approvedOn: details.approvedOn, reference: details.reference },
      });
    case "unlocked":
      return queueNotification(tx, {
        kind: "unlocked",
        userIds: await team(),
        actorId,
        payload: { ...facts, by, reason: details.reason, from: details.from },
      });
  }
  throw new Error(`Unknown workflow event: ${event}`);
}

// --- Sending ----------------------------------------------------------------------------------------

/** Claims up to `limit` due rows. A row claimed by a process that died is released after 10 minutes. */
async function claimDue(limit) {
  await db.$executeRaw`
    UPDATE "notification" SET "status" = 'PENDING', "claimedAt" = NULL
    WHERE "status" = 'SENDING' AND "claimedAt" < now() - interval '10 minutes'`;
  return db.$queryRaw`
    UPDATE "notification" SET "status" = 'SENDING', "claimedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "notification"
      WHERE "status" = 'PENDING' AND "sendAfter" <= now()
      ORDER BY "createdAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "userId", "kind", "groupKey", "payload", "attempts", "createdAt"`;
}

/** One email per recipient, kind and group (rows without a group are sent alone). */
function groupRows(rows) {
  const groups = new Map();
  for (const r of [...rows].sort((a, b) => a.createdAt - b.createdAt)) {
    const key = `${r.userId}|${r.kind}|${r.groupKey ?? r.id}`;
    if (!groups.has(key)) groups.set(key, { userId: r.userId, kind: r.kind, rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()];
}

/**
 * Sends every due notification once. Safe to call at any time (also from tests).
 * @returns {Promise<{ sent: number, skipped: number, failed: number, retried: number }>} emails, not rows
 */
export async function processDueNotifications({ limit = 200 } = {}) {
  const rows = await claimDue(limit);
  const result = { sent: 0, skipped: 0, failed: 0, retried: 0 };
  if (rows.length === 0) return result;
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, name: true, email: true, isActive: true, emailNotifications: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  for (const group of groupRows(rows)) {
    const ids = group.rows.map((r) => r.id);
    const user = userById.get(group.userId);
    if (!user?.isActive || !user.emailNotifications) {
      await db.notification.updateMany({ where: { id: { in: ids } }, data: { status: "SKIPPED", claimedAt: null } });
      result.skipped++;
      continue;
    }
    try {
      const { subject, text } = composeEmail({
        kind: group.kind,
        rows: group.rows.map((r) => r.payload),
        recipient: user,
        appUrl: appUrl(),
      });
      await sendMail({ to: user.email, subject, text });
      await db.notification.updateMany({
        where: { id: { in: ids } },
        data: { status: "SENT", sentAt: new Date(), claimedAt: null, lastError: null },
      });
      result.sent++;
    } catch (e) {
      const attempts = Math.max(...group.rows.map((r) => r.attempts)) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      await db.notification.updateMany({
        where: { id: { in: ids } },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          attempts,
          lastError: String(e?.message ?? e).slice(0, 500),
          claimedAt: null,
          ...(giveUp ? {} : { sendAfter: new Date(Date.now() + RETRY_MINUTES[attempts - 1] * 60_000) }),
        },
      });
      console.warn(
        `[notify] ${giveUp ? "gave up on" : "will retry"} ${group.kind} to ${user.email}: ${e?.message ?? e}`,
      );
      result[giveUp ? "failed" : "retried"]++;
    }
  }
  return result;
}

/** Starts the background sender (API process only). Returns a function that stops it. */
export function startNotificationSender() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processDueNotifications();
    } catch (e) {
      console.error("[notify] sender error:", e?.message ?? e);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, INTERVAL_SECONDS * 1000);
  timer.unref?.();
  return () => clearInterval(timer);
}
