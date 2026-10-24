// The text of every notification email (README §7, "Notifications"). Pure functions: the sender
// (services/notifications.js) passes the rows of one email, and these return { subject, text }.
// Rows that share a group arrive together and become one digest ("3 new review inputs").
import { stageLabels } from "@acp/shared/domain/reviews/workflow";
import { assignmentRoleLabels } from "@acp/shared/labels";

const PORTAL = "Academic Curriculum Portal";

/** "1BCS304 Data Structures and Applications" */
const courseName = (c) => `${c.code} ${c.title}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const link = (appUrl, path) => `${appUrl.replace(/\/$/, "")}${path}`;

/** Each kind: (rows, appUrl) => { subject, lines }. `rows` are the payloads, oldest first (never empty). */
const kinds = {
  assignment([p], appUrl) {
    return {
      subject: `${p.course.code}: you are ${p.role === "COORDINATOR" ? "the Course Coordinator" : "a co-author"}`,
      lines: [
        `You have been assigned to ${courseName(p.course)} (${p.schemeName}) as ${assignmentRoleLabels[p.role] ?? p.role}.`,
        p.by ? `Assigned by ${p.by}.` : null,
        "",
        "Open the syllabus to start framing it:",
        link(appUrl, p.path),
      ],
    };
  },

  submitted([p], appUrl) {
    return {
      subject: `${p.course.code} submitted for the Internal BOS (${p.version})`,
      lines: [
        `${p.by ?? "The course team"} submitted the syllabus of ${courseName(p.course)} (${p.schemeName}) as ${p.version}.`,
        `It is now in the ${stageLabels.INTERNAL_BOS} stage. Record the meeting inputs on the review page:`,
        link(appUrl, `${p.path}/review`),
      ],
    };
  },

  inputs(rows, appUrl) {
    const p = rows[0];
    const sections = [...new Set(rows.map((r) => r.section).filter(Boolean))];
    return {
      subject: `${p.course.code}: ${plural(rows.length, "new review input")} to answer`,
      lines: [
        `${plural(rows.length, "review input")} ${rows.length === 1 ? "was" : "were"} recorded for ${courseName(p.course)} in the ${stageLabels[p.stage] ?? p.stage} stage.`,
        sections.length ? `Sections: ${sections.join(", ")}.` : null,
        "",
        "Record the action taken on each input, update the syllabus and save a version:",
        link(appUrl, `${p.path}/review`),
      ],
    };
  },

  expertComments(rows, appUrl) {
    const p = rows[0];
    const experts = [...new Set(rows.map((r) => r.reviewer).filter(Boolean))];
    return {
      subject: `${p.course.code}: ${plural(rows.length, "expert comment")} received`,
      lines: [
        `${experts.join(", ") || "An expert"} commented on ${courseName(p.course)} through the review link (${plural(rows.length, "comment")}).`,
        "The comments are inputs of the Industry Experts & Alumni stage:",
        link(appUrl, `${p.path}/review`),
      ],
    };
  },

  inputsAnswered([p], appUrl) {
    return {
      subject: `${p.course.code}: every ${stageLabels[p.stage] ?? p.stage} input has an action taken`,
      lines: [
        `The course team has recorded the action taken on every input of the ${stageLabels[p.stage] ?? p.stage} stage for ${courseName(p.course)}.`,
        "When the syllabus is ready, you can close the stage:",
        link(appUrl, `${p.path}/review`),
      ],
    };
  },

  stageClosed([p], appUrl) {
    return {
      subject: `${p.course.code} moved to the ${stageLabels[p.toStage] ?? p.toStage} stage${p.version ? ` (${p.version})` : ""}`,
      lines: [
        `The ${stageLabels[p.fromStage] ?? p.fromStage} stage of ${courseName(p.course)} is closed${p.version ? ` and the syllabus was saved as ${p.version}` : ""}.`,
        `It is now in the ${stageLabels[p.toStage] ?? p.toStage} stage.`,
        "",
        link(appUrl, p.path),
      ],
    };
  },

  approved([p], appUrl) {
    return {
      subject: `${p.course.code} approved: ${p.version} is the official syllabus`,
      lines: [
        `The Academic Council approved the syllabus of ${courseName(p.course)} (${p.schemeName}).`,
        `${p.version} is now the official version${p.approvedOn ? `, approved on ${formatDate(p.approvedOn)}` : ""}${p.reference ? ` (${p.reference})` : ""}.`,
        "",
        "View or download the approved copy:",
        link(appUrl, `/approved-syllabi?scheme=${p.schemeId}&approved.q=${encodeURIComponent(p.course.code)}`),
      ],
    };
  },

  unlocked([p], appUrl) {
    return {
      subject: `${p.course.code} unlocked for a correction`,
      lines: [
        `${p.by ?? "The BoS Coordinator"} unlocked the approved syllabus of ${courseName(p.course)} for a correction.`,
        p.reason ? `Reason: ${p.reason}` : null,
        `${p.from ?? "The approved version"} stays official until the correction is approved.`,
        "",
        link(appUrl, p.path),
      ],
    };
  },

  needsRevision(rows, appUrl) {
    const courses = [...new Map(rows.map((r) => [r.course.code, r])).values()];
    const changes = [...new Set(rows.map((r) => r.summary))];
    return {
      subject:
        courses.length === 1
          ? `${courses[0].course.code} needs revision after a scheme change`
          : `${courses.length} syllabi need revision after a scheme change`,
      lines: [
        `The rules of ${rows[0].schemeName} changed:`,
        ...changes.map((c) => `  • ${c}`),
        "",
        `Check ${courses.length === 1 ? "this syllabus" : "these syllabi"} and save a new version (or ask the BoS Coordinator to mark it as needing no change):`,
        ...courses.map((r) => `  • ${courseName(r.course)}: ${link(appUrl, r.path)}`),
      ],
    };
  },
};

export const notificationKinds = Object.keys(kinds);

/**
 * The email for one recipient.
 * @param {{ kind: string, rows: object[], recipient: { name: string }, appUrl: string }} input
 * @returns {{ subject: string, text: string }}
 */
export function composeEmail({ kind, rows, recipient, appUrl }) {
  const build = kinds[kind];
  if (!build) throw new Error(`Unknown notification kind: ${kind}`);
  if (!rows.length) throw new Error("A notification needs at least one row.");
  const { subject, lines } = build(rows, appUrl);
  const text = [
    `Dear ${recipient.name},`,
    "",
    ...lines.filter((l) => l !== null),
    "",
    "—",
    `${PORTAL}`,
    `You receive these emails because of your role in the portal. Turn them off under My account: ${link(appUrl, "/account")}`,
  ].join("\n");
  return { subject: `${subject} — ${PORTAL}`, text };
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
