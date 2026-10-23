import { describe, expect, it } from "vitest";
import { compareValues, distinctOptions, matchesSearch, nextSort, pageWindow, queryRows } from "./data-table.js";

const rows = [
  { id: 1, code: "1BCS304", title: "Data Structures", dept: "CSE", sem: 3, faculty: "Asha" },
  { id: 2, code: "1BMAT301", title: "Discrete Mathematics", dept: "MATH", sem: 3, faculty: null },
  { id: 3, code: "1BCS402", title: "Operating Systems", dept: "CSE", sem: 4, faculty: "Ravi" },
  { id: 4, code: "1BCS10", title: "Élective Studio", dept: "CSE", sem: 10, faculty: "" },
];
const table = {
  columns: {
    code: { sortValue: (r) => r.code },
    sem: { sortValue: (r) => r.sem },
    faculty: { sortValue: (r) => r.faculty },
  },
  searchText: (r) => [r.code, r.title, r.faculty].join(" "),
  filterDefs: { dept: (r, v) => r.dept === v, sem: (r, v) => r.sem === Number(v) },
};
const ids = (result) => result.rows.map((r) => r.id);

describe("matchesSearch", () => {
  it("matches every word, in any order, ignoring case and accents", () => {
    expect(matchesSearch("Data Structures 1BCS304", "structures data")).toBe(true);
    expect(matchesSearch("Data Structures", "data graphs")).toBe(false);
    expect(matchesSearch("Élective Studio", "elective")).toBe(true);
    expect(matchesSearch("anything", "   ")).toBe(true);
  });
});

describe("compareValues", () => {
  it("sorts numbers and natural text, and keeps blanks last in both directions", () => {
    expect(["Sem 10", "Sem 2", "sem 1"].sort((a, b) => compareValues(a, b))).toEqual(["sem 1", "Sem 2", "Sem 10"]);
    expect([3, null, 1, ""].sort((a, b) => compareValues(a, b, "asc"))).toEqual([1, 3, null, ""]);
    expect([3, null, 1].sort((a, b) => compareValues(a, b, "desc"))).toEqual([3, 1, null]);
    expect(compareValues(new Date("2026-01-02"), new Date("2026-01-01"))).toBeGreaterThan(0);
  });
});

describe("queryRows", () => {
  it("returns everything on one page by default", () => {
    const r = queryRows(rows, table);
    expect(ids(r)).toEqual([1, 2, 3, 4]);
    expect(r).toMatchObject({ total: 4, all: 4, page: 1, pageCount: 1, from: 1, to: 4 });
  });

  it("combines search and filters", () => {
    expect(ids(queryRows(rows, table, { search: "bcs" }))).toEqual([1, 3, 4]);
    expect(ids(queryRows(rows, table, { search: "bcs", filters: { sem: "3" } }))).toEqual([1]);
    expect(ids(queryRows(rows, table, { filters: { dept: "MATH", sem: "" } }))).toEqual([2]);
    expect(queryRows(rows, table, { search: "ravi" }).total).toBe(1);
  });

  it("sorts stably by a column, numbers numerically, blanks last", () => {
    expect(ids(queryRows(rows, table, { sort: { key: "sem", dir: "asc" } }))).toEqual([1, 2, 3, 4]);
    expect(ids(queryRows(rows, table, { sort: { key: "sem", dir: "desc" } }))).toEqual([4, 3, 1, 2]);
    expect(ids(queryRows(rows, table, { sort: { key: "code", dir: "asc" } }))).toEqual([4, 1, 3, 2]);
    expect(ids(queryRows(rows, table, { sort: { key: "faculty", dir: "desc" } }))).toEqual([3, 1, 2, 4]);
    // An unknown column leaves the original order.
    expect(ids(queryRows(rows, table, { sort: { key: "nope", dir: "asc" } }))).toEqual([1, 2, 3, 4]);
  });

  it("pages the result and clamps an out-of-range page", () => {
    const p2 = queryRows(rows, table, { pageSize: 3, page: 2 });
    expect(ids(p2)).toEqual([4]);
    expect(p2).toMatchObject({ page: 2, pageCount: 2, from: 4, to: 4, total: 4 });
    expect(queryRows(rows, table, { pageSize: 3, page: 9 }).page).toBe(2);
    expect(queryRows(rows, table, { pageSize: 3, page: -1 }).page).toBe(1);
    const none = queryRows(rows, table, { search: "zzz", pageSize: 3 });
    expect(none).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1, from: 0, to: 0 });
  });
});

describe("nextSort", () => {
  it("cycles ascending → descending → default order", () => {
    let s = nextSort(null, "code");
    expect(s).toEqual({ key: "code", dir: "asc" });
    s = nextSort(s, "code");
    expect(s).toEqual({ key: "code", dir: "desc" });
    expect(nextSort(s, "code")).toBeNull();
    expect(nextSort(s, "sem")).toEqual({ key: "sem", dir: "asc" });
    expect(nextSort(null, "when", "desc")).toEqual({ key: "when", dir: "desc" });
  });
});

describe("pageWindow", () => {
  it("shows the first, last and nearby pages with gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 5)).toEqual([1, 2, "…", 5]);
    expect(pageWindow(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("distinctOptions", () => {
  it("lists each value once, sorted, skipping blanks and flattening lists", () => {
    expect(distinctOptions(rows, (r) => r.sem)).toEqual([
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "10", label: "10" },
    ]);
    expect(
      distinctOptions(
        [{ d: ["CSE", "MATH"] }, { d: ["CSE", null] }],
        (r) => r.d,
        (v) => `Dept ${v}`,
      ),
    ).toEqual([
      { value: "CSE", label: "Dept CSE" },
      { value: "MATH", label: "Dept MATH" },
    ]);
  });
});
