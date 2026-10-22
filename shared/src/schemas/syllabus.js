// Shape of a syllabus working copy when it is saved (autosave). Drafts may be incomplete, so this
// only checks types and sizes; completeness is checked by the validation rules before submission.
import { z } from "zod";

const text = (max) => z.string().max(max, `Keep this under ${max} characters`);
const hours = z.number().int("Use a whole number").min(0, "Cannot be negative").max(1000).nullable();
const codes = z.array(text(20)).max(60);
const rows = (item, max) => z.array(item).max(max, `At most ${max} rows`);

const book = z.object({
  authors: text(300),
  title: text(300),
  publisher: text(200),
  edition: text(50),
  year: text(50),
});

const activity = z.object({ activity: text(500), hours });

export const theoryContentSchema = z.object({
  objectives: rows(text(1000), 20),
  prerequisites: text(2000),
  units: rows(z.object({ title: text(300), content: text(10_000), hours }), 12),
  flippedSessions: rows(hours, 12),
  textBooks: rows(book, 20),
  referenceBooks: rows(book, 20),
  eResources: rows(z.object({ title: text(300), url: text(1000) }), 30),
  termWork: rows(activity, 30),
  selfLearning: rows(activity, 30),
  outcomes: rows(
    z.object({
      statement: text(1000),
      verb: text(50),
      level: z.number().int().min(1).max(6).nullable(),
      pos: codes,
      psos: z.record(text(50), codes),
      wks: codes,
      sdgs: codes,
    }),
    12,
  ),
});

/** Autosave request: the content plus the revision it was based on (to detect conflicting edits). */
export const saveSyllabusSchema = z.object({
  revision: z.number().int().min(0), // 0 = the syllabus has not been saved yet
  content: theoryContentSchema,
});
