// Compiled syllabus book (README §8, Phase 4): cover, scheme of teaching and examination, a clickable table of
// contents with PDF bookmarks, then the approved syllabi in scheme order. Each syllabus is its frozen PDF,
// appended unchanged, so the book prints every course exactly as it was approved.
import { PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { normalizeSyllabusContent } from "@acp/shared/domain/syllabi/content";
import { formatCredits } from "@acp/shared/domain/schemes/rules";
import { bookLinkPrefix, renderBookFrontMatter } from "@acp/shared/print/book-layout";
import { NotFoundError, UserError } from "../errors.js";
import { db } from "../infra/db.js";
import { frozenSyllabusPdf } from "./documents.js";
import { logoPath } from "./institution.js";
import { embeddedFontUrl, htmlToPdf } from "./pdf.js";
import { buildEditorData, loadSyllabusContext } from "./syllabi.js";

/** The approved syllabus PDF of a course (frozen the first time it is needed). */
async function approvedPdf(schemeId, courseId, versionId) {
  const stored = await db.generatedDocument.findUnique({
    where: { versionId_kind: { versionId, kind: "SYLLABUS" } },
  });
  if (stored) return stored.pdf;
  const { ctx, data } = await buildEditorData(await loadSyllabusContext(null, schemeId, courseId));
  const version = await db.syllabusVersion.findUnique({ where: { id: versionId } });
  const doc = await frozenSyllabusPdf(data, version, normalizeSyllabusContent(version.content, ctx.format));
  return doc.pdf;
}

/**
 * Builds the book for one programme of a scheme, or (programmeId null) for every programme of the scheme, for
 * one semester or (semester null) all of them. In a whole-scheme book a course shared by programmes is printed
 * once; each programme's contents link to that one copy.
 * @returns {Promise<{ pdf: Buffer, fileName: string, included: number, missing: number }>}
 */
export async function buildSyllabusBook({ schemeId, programmeId = null, semester = null }) {
  const [scheme, programme, institution] = await Promise.all([
    db.scheme.findUnique({ where: { id: schemeId } }),
    programmeId ? db.programme.findUnique({ where: { id: programmeId }, include: { department: true } }) : null,
    db.institutionSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!scheme || (programmeId && !programme)) throw new NotFoundError("Course list not found.");
  const rows = await db.schemeCourse.findMany({
    where: { schemeId, ...(programmeId ? { programmeId } : {}), ...(semester ? { semester } : {}) },
    orderBy: [{ programme: { code: "asc" } }, { semester: "asc" }, { sortOrder: "asc" }, { course: { code: "asc" } }],
    include: { course: true, category: true, electiveGroup: true, programme: { include: { department: true } } },
  });
  if (rows.length === 0) throw new UserError(semester ? `Semester ${semester} has no courses.` : "No courses yet.");
  const syllabi = await db.syllabus.findMany({
    where: { schemeId, courseId: { in: [...new Set(rows.map((r) => r.courseId))] } },
    select: { courseId: true, status: true, officialVersionId: true, officialVersion: { select: { label: true } } },
  });

  // One entry per course, in scheme order; only courses with an approved version go into the book.
  const entries = [];
  const entryOf = new Map(); // courseId → entry number (a shared course appears once)
  const parts = [];
  for (const r of rows) {
    let part = parts.at(-1);
    if (part?.programme.id !== r.programmeId) {
      const p = r.programme;
      parts.push(
        (part = { programme: { id: p.id, code: p.code, name: p.name, department: p.department.code }, semesters: [] }),
      );
    }
    let sem = part.semesters.at(-1);
    if (sem?.semester !== r.semester) part.semesters.push((sem = { semester: r.semester, courses: [] }));
    const y = syllabi.find((s) => s.courseId === r.courseId);
    const course = {
      code: r.course.code,
      title: r.course.title,
      category: r.category.code,
      credits: formatCredits(r),
      lHours: r.lHours,
      tHours: r.tHours,
      pHours: r.pHours,
      twSlHours: r.twSlHours,
      cieMarks: r.cieMarks,
      seeMarks: r.seeMarks,
      group: r.electiveGroup ? `${r.electiveGroup.code} – ${r.electiveGroup.title} (one option is chosen)` : null,
      entry: null,
      page: null,
      note: !r.category.syllabusRequired ? "No syllabus required" : "Not yet approved",
    };
    if (r.category.syllabusRequired && y?.officialVersionId) {
      if (!entryOf.has(r.courseId)) {
        const pdf = await PDFDocument.load(await approvedPdf(schemeId, r.courseId, y.officialVersionId));
        entryOf.set(r.courseId, entries.length);
        entries.push({ courses: [], pdf, version: y.officialVersion.label });
      }
      course.entry = entryOf.get(r.courseId);
      entries[course.entry].courses.push(course);
    }
    sem.courses.push(course);
  }
  if (entries.length === 0) throw new UserError("No syllabus of these courses has been approved yet.");

  // The front matter goes first, so the page numbers in the contents depend on its length: render until stable.
  const fontUrl = await embeddedFontUrl();
  const doc = {
    institution: {
      name: institution?.name ?? "",
      shortName: institution?.shortName,
      address: institution?.address,
      logoUrl: institution?.logoType ? logoPath(institution.updatedAt.getTime()) : null,
    },
    scheme,
    parts,
    fontUrl,
  };
  let front;
  let frontPages = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    let page = frontPages + 1;
    for (const e of entries) {
      for (const c of e.courses) c.page = page;
      page += e.pdf.getPageCount();
    }
    front = await PDFDocument.load(await htmlToPdf(renderBookFrontMatter(doc)));
    if (front.getPageCount() === frontPages) break;
    frontPages = front.getPageCount();
  }

  const book = await PDFDocument.create();
  const name = programme ? programme.code : "All programmes";
  book.setTitle(`${name} ${scheme.name} – Syllabus book`);
  book.setCreator("Academic Curriculum Portal");
  for (const p of await book.copyPages(front, front.getPageIndices())) book.addPage(p);
  for (const e of entries) {
    e.startIndex = book.getPageCount();
    for (const p of await book.copyPages(e.pdf, e.pdf.getPageIndices())) book.addPage(p);
  }

  linkContents(book, frontPages, entries);
  const semesterOutline = (semesters) =>
    semesters
      .map((s) => ({
        title: `Semester ${s.semester}`,
        children: s.courses
          .filter((c) => c.entry != null)
          .map((c) => ({ title: `${c.code} – ${c.title}`, pageIndex: entries[c.entry].startIndex })),
      }))
      .filter((s) => s.children.length)
      .map((s) => ({ ...s, pageIndex: s.children[0].pageIndex }));
  const courseOutline =
    parts.length === 1
      ? semesterOutline(parts[0].semesters)
      : parts
          .map((p) => ({ title: `${p.programme.code} – ${p.programme.name}`, children: semesterOutline(p.semesters) }))
          .filter((p) => p.children.length)
          .map((p) => ({ ...p, pageIndex: p.children[0].pageIndex }));
  addOutline(book, [
    { title: "Cover", pageIndex: 0 },
    { title: "Scheme of Teaching and Examination", pageIndex: 1 },
    { title: "Contents", pageIndex: contentsPageIndex(front) },
    ...courseOutline,
  ]);

  const pdf = Buffer.from(await book.save());
  const sem = semester ? `sem${semester}` : "all";
  return {
    pdf,
    fileName: programme
      ? `${programme.code}_${scheme.code}_${sem}_syllabus_book.pdf`
      : `${scheme.code}_all_programmes_${sem}_syllabus_book.pdf`,
    included: entries.length,
    missing: new Set(rows.map((r) => r.courseId)).size - entries.length,
  };
}

/** The front-matter page that starts the contents: the first page holding a contents link. */
function contentsPageIndex(front) {
  const index = front.getPages().findIndex((p) => linkAnnotations(p).length > 0);
  return index >= 0 ? index : front.getPageCount() - 1;
}

/** URI link annotations of a page as [dict, uri]. */
function linkAnnotations(page) {
  const annots = page.node.Annots();
  if (!annots) return [];
  const out = [];
  for (let i = 0; i < annots.size(); i++) {
    const dict = page.doc.context.lookup(annots.get(i));
    const action = dict?.lookup?.(PDFName.of("A"));
    const uri = action?.lookup?.(PDFName.of("URI"));
    if (uri instanceof PDFString || uri instanceof PDFHexString) out.push([dict, uri.decodeText()]);
  }
  return out;
}

/** Turns the contents' placeholder links into jumps to the first page of each syllabus. */
function linkContents(book, frontPages, entries) {
  for (const page of book.getPages().slice(0, frontPages)) {
    for (const [dict, uri] of linkAnnotations(page)) {
      if (!uri.startsWith(bookLinkPrefix)) continue;
      const entry = entries[Number(uri.slice(bookLinkPrefix.length))];
      if (!entry) continue;
      const target = book.getPage(entry.startIndex).ref;
      dict.set(PDFName.of("A"), book.context.obj({ Type: "Action", S: "GoTo", D: [target, "Fit"] }));
    }
  }
}

/**
 * Adds PDF bookmarks. `items`: { title, pageIndex, children? }[] (two levels are enough for a book).
 * pdf-lib has no outline API, so the dictionaries are written directly (PDF 1.7, §12.3.3).
 */
function addOutline(book, items) {
  const { context } = book;
  const rootRef = context.nextRef();
  const dest = (pageIndex) => [book.getPage(pageIndex ?? 0).ref, "Fit"];

  const build = (list, parentRef) => {
    const refs = list.map(() => context.nextRef());
    let count = 0;
    list.forEach((item, i) => {
      const children = item.children?.length ? build(item.children, refs[i]) : null;
      const dict = {
        Title: PDFHexString.fromText(item.title),
        Parent: parentRef,
        Dest: dest(item.pageIndex),
        ...(i > 0 ? { Prev: refs[i - 1] } : {}),
        ...(i < list.length - 1 ? { Next: refs[i + 1] } : {}),
        ...(children ? { First: children.first, Last: children.last, Count: children.count } : {}),
      };
      context.assign(refs[i], context.obj(dict));
      count += 1 + (children?.count ?? 0);
    });
    return { first: refs[0], last: refs.at(-1), count };
  };

  const top = build(items, rootRef);
  context.assign(rootRef, context.obj({ Type: "Outlines", First: top.first, Last: top.last, Count: top.count }));
  book.catalog.set(PDFName.of("Outlines"), rootRef);
  book.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}
