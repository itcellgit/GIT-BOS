// Client-side table querying: search → filters → sort → page. Pure functions (no React), so the rules
// are unit-tested in data-table.test.js and every table in the portal behaves the same way.
//
// A table is described once:
//   columns:    { [key]: { sortValue: (row) => string | number | Date | boolean | null } }
//   searchText: (row) => string            everything a search should match, joined
//   filterDefs: { [key]: (row, value) => boolean }   value is the chosen option (never "")
// and queried with the current state:
//   { search, filters: { [key]: value }, sort: { key, dir: "asc" | "desc" } | null, page, pageSize }

/** Lower case without accents, so "Bélgaum" matches "belgaum". */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Every word of the search must appear somewhere in the row's text (order does not matter). */
export function matchesSearch(text, search) {
  const terms = normalizeText(search).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeText(text);
  return terms.every((t) => haystack.includes(t));
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const isBlank = (v) => v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));

/**
 * Compares two sort values. Blank values always go last (in both directions); numbers and dates
 * compare numerically; text compares naturally ("Sem 2" before "Sem 10") and ignores case.
 */
export function compareValues(a, b, dir = "asc") {
  const blankA = isBlank(a);
  const blankB = isBlank(b);
  if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1;
  const sign = dir === "desc" ? -1 : 1;
  if (a instanceof Date) a = a.getTime();
  if (b instanceof Date) b = b.getTime();
  if (typeof a === "boolean") a = Number(a);
  if (typeof b === "boolean") b = Number(b);
  if (typeof a === "number" && typeof b === "number") return sign * (a - b);
  return sign * collator.compare(String(a), String(b));
}

/**
 * Runs the whole query.
 * @returns {{ rows: object[], total: number, all: number, page: number, pageCount: number, from: number, to: number }}
 *   rows: the current page · total: rows after search and filters · all: rows before ·
 *   page: the page shown (clamped to 1…pageCount) · from/to: 1-based positions shown ("26–50 of 120")
 */
export function queryRows(rows, { columns = {}, searchText, filterDefs = {} }, state = {}) {
  const { search = "", filters = {}, sort = null, page = 1, pageSize = 25 } = state;

  let result = rows;
  if (searchText && search.trim()) result = result.filter((r) => matchesSearch(searchText(r), search));
  for (const [key, value] of Object.entries(filters)) {
    const test = filterDefs[key];
    if (test && value !== "" && value !== undefined && value !== null) result = result.filter((r) => test(r, value));
  }

  const sortValue = sort && columns[sort.key]?.sortValue;
  if (sortValue) {
    // Decorate–sort–undecorate keeps the sort stable and calls sortValue once per row.
    result = result
      .map((row, index) => ({ row, index, value: sortValue(row) }))
      .sort((x, y) => compareValues(x.value, y.value, sort.dir) || x.index - y.index)
      .map((x) => x.row);
  }

  const total = result.length;
  const size = pageSize > 0 ? pageSize : total || 1;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (current - 1) * size;
  const pageRows = result.slice(start, start + size);
  return {
    rows: pageRows,
    total,
    all: rows.length,
    page: current,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: start + pageRows.length,
  };
}

/** The next sort when a column header is clicked: ascending → descending → back to the default order. */
export function nextSort(current, key, firstDir = "asc") {
  if (!current || current.key !== key) return { key, dir: firstDir };
  if (current.dir === firstDir) return { key, dir: firstDir === "asc" ? "desc" : "asc" };
  return null;
}

/** Page numbers to show, with "…" gaps: [1, "…", 4, 5, 6, "…", 12]. */
export function pageWindow(page, pageCount, radius = 1) {
  const pages = new Set([1, pageCount]);
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= pageCount) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : "…");
    out.push(p);
  });
  return out;
}

/** Options for a filter menu from the distinct values in the rows, sorted. */
export function distinctOptions(rows, valueOf, labelOf = (v) => String(v)) {
  const values = [
    ...new Set(rows.flatMap((r) => [valueOf(r)].flat()).filter((v) => v !== null && v !== undefined && v !== "")),
  ];
  values.sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))));
  return values.map((v) => ({ value: String(v), label: labelOf(v) }));
}
