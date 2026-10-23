// Zod schemas for the review workflow (Phase 2). Used by the browser forms and again by the API.
import { z } from "zod";
import { stages } from "../domain/reviews/workflow.js";

const requiredText = (label, max) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));
const optionalId = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().nullable());
const reason = requiredText("A reason", 1000);

/** "Save version" (commit): a short note on what changed, e.g. "Inputs of Dr. Rao incorporated". */
export const commitVersionSchema = z.object({ reason });

/** Closing a stage. The note is optional; the Academic Council stage also needs the approval record. */
export const closeStageSchema = z.object({ reason: optionalText(1000) });

/** The Academic Council decision (README §7, rule 4). */
export const approvalSchema = z.object({
  approvedOn: z.iso.date("Enter the date of the Academic Council meeting"),
  reference: requiredText("The meeting reference", 200),
  reason: optionalText(1000),
});

export const unlockSchema = z.object({ reason });

/** A BOS meeting. One meeting can cover many syllabi (README §7, rule 7). */
export const reviewMeetingSchema = z.object({
  schemeId: z.string().min(1, "Choose a scheme"),
  stage: z.enum(stages),
  heldAt: z.iso.datetime({ local: true, error: "Enter the date and time of the meeting" }),
  venue: requiredText("Venue", 200),
  title: optionalText(200),
  attendeeIds: z.array(z.string()).max(100).default([]),
});

/** An input recorded by the BoS Coordinator (D3). */
export const reviewInputSchema = z.object({
  sectionRef: z.string().trim().min(1, "Choose a section").max(40),
  inputText: requiredText("The input", 4000),
  givenById: optionalId,
  meetingId: optionalId,
});

/** The Course Coordinator's (or BoS Coordinator's) response to an input. */
export const actionTakenSchema = z.object({
  actionTaken: requiredText("The action taken", 4000),
  decision: z.enum(["ACCEPTED", "PARTLY", "NOT_ACCEPTED"], { error: "Choose a decision" }),
});

export const reviewFormSchemas = {
  commitVersion: commitVersionSchema,
  closeStage: closeStageSchema,
  approval: approvalSchema,
  unlock: unlockSchema,
  reviewMeeting: reviewMeetingSchema,
  reviewInput: reviewInputSchema,
  actionTaken: actionTakenSchema,
};
