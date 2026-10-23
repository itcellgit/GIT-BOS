import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { nextSort, queryRows } from "@/lib/data-table";

export const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Search, filters, sorting and pagination for a table (see lib/data-table.js for the rules).
 *
 * The state lives in the URL, prefixed with the table `id` ("users.q=asha&users.page=2"), so the
 * Back button, a refresh or a shared link shows the same view, and several tables on one page keep
 * separate state. Other URL parameters are left alone.
 *
 * @param {object} options
 * @param {string} options.id            short, unique on the page: "users", "courses"…
 * @param {object[]} options.rows        all rows (already loaded)
 * @param {object} [options.columns]     { key: { sortValue(row), firstDir?: "asc" | "desc" } }
 * @param {(row) => string} [options.searchText]
 * @param {object} [options.filterDefs]  { key: (row, value) => boolean }
 * @param {{ key: string, dir: "asc" | "desc" } | null} [options.defaultSort]
 * @param {number} [options.defaultPageSize]
 */
export function useDataTable({
  id,
  rows,
  columns = {},
  searchText,
  filterDefs = {},
  defaultSort = null,
  defaultPageSize = 25,
}) {
  const [params, setParams] = useSearchParams();
  // Bumped by reset(), so the search box also drops text it has not applied yet.
  const [resetVersion, setResetVersion] = useState(0);
  const key = (name) => `${id}.${name}`;

  const search = params.get(key("q")) ?? "";
  const filters = Object.fromEntries(Object.keys(filterDefs).map((f) => [f, params.get(key(`f.${f}`)) ?? ""]));
  const sortParam = params.get(key("sort"));
  // "code" = ascending, "-code" = descending; no parameter = the table's default order.
  const sort =
    sortParam && columns[sortParam.replace(/^-/, "")]
      ? { key: sortParam.replace(/^-/, ""), dir: sortParam.startsWith("-") ? "desc" : "asc" }
      : defaultSort;
  const sizeParam = Number(params.get(key("size")));
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : defaultPageSize;
  const page = Number(params.get(key("page"))) || 1;

  const result = useMemo(
    () => queryRows(rows, { columns, searchText, filterDefs }, { search, filters, sort, page, pageSize }),
    // columns/searchText/filterDefs are recreated each render by callers; the inputs below decide the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, search, JSON.stringify(filters), sort?.key, sort?.dir, page, pageSize],
  );

  /** Writes the given URL values (null removes one) without adding a history entry per keystroke. */
  function update(values, { resetPage = true } = {}) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [name, value] of Object.entries(values)) {
          if (value === null || value === undefined || value === "") next.delete(key(name));
          else next.set(key(name), String(value));
        }
        if (resetPage) next.delete(key("page"));
        return next;
      },
      { replace: true },
    );
  }

  const isFiltered = search.trim() !== "" || Object.values(filters).some((v) => v !== "");

  return {
    ...result,
    search,
    filters,
    sort,
    pageSize,
    isFiltered,
    resetVersion,
    setSearch: (value) => update({ q: value }),
    setFilter: (name, value) => update({ [`f.${name}`]: value }),
    // Ascending → descending → back to the default order (for the default column: just flips).
    toggleSort: (column) => {
      let s = nextSort(sort, column, columns[column]?.firstDir);
      if (!s && column === defaultSort?.key) s = { key: column, dir: columns[column]?.firstDir ?? "asc" };
      const isDefault = !s || (s.key === defaultSort?.key && s.dir === defaultSort?.dir);
      update({ sort: isDefault ? null : `${s.dir === "desc" ? "-" : ""}${s.key}` });
    },
    setPage: (value) => update({ page: value > 1 ? value : null }, { resetPage: false }),
    setPageSize: (value) => update({ size: value === defaultPageSize ? null : value }),
    reset: () => {
      setResetVersion((v) => v + 1);
      update(Object.fromEntries([["q", null], ...Object.keys(filterDefs).map((f) => [`f.${f}`, null])]));
    },
  };
}
