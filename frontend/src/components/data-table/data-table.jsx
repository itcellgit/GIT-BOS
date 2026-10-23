// Building blocks for tables driven by useDataTable (hooks/use-data-table.js): a toolbar with search and
// filters, sortable column headers, a pagination bar and a "no matching rows" row.
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { PAGE_SIZES } from "@/hooks/use-data-table";
import { pageWindow } from "@/lib/data-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

const ALL = "__all__";

/**
 * Search box, filter menus and a count of matching rows.
 * @param {{ key: string, label: string, options: { value: string, label: string }[], allLabel?: string, width?: string }[]} filters
 * @param {string} noun  plural name of the rows, for the count: "users", "courses"
 * @param {React.ReactNode} [start]     controls before the search box (e.g. a scheme picker)
 * @param {React.ReactNode} [children]  extra controls at the end of the toolbar
 */
export function DataTableToolbar({
  table,
  searchLabel = "Search",
  searchPlaceholder,
  filters = [],
  noun,
  start,
  children,
}) {
  const baseId = useId();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        {start}
        <div className="min-w-56 flex-1 sm:max-w-sm">
          <Label htmlFor={`${baseId}-q`} className="mb-1.5 text-xs text-muted-foreground">
            {searchLabel}
          </Label>
          <SearchBox
            id={`${baseId}-q`}
            value={table.search}
            resetVersion={table.resetVersion}
            onChange={table.setSearch}
            placeholder={searchPlaceholder}
          />
        </div>
        {filters
          .filter((f) => f.options.length > 0)
          .map((f) => (
            <div key={f.key}>
              <Label htmlFor={`${baseId}-${f.key}`} className="mb-1.5 text-xs text-muted-foreground">
                {f.label}
              </Label>
              <Select
                value={table.filters[f.key] || ALL}
                onValueChange={(v) => table.setFilter(f.key, v === ALL ? "" : v)}
              >
                <SelectTrigger id={`${baseId}-${f.key}`} className={f.width ?? "w-40"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{f.allLabel ?? "All"}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        {table.isFiltered && (
          <Button variant="ghost" onClick={table.reset}>
            <X />
            Reset filters
          </Button>
        )}
        {children}
      </div>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {table.isFiltered ? `${table.total} of ${table.all} ${noun} match` : `${table.all} ${noun}`}
      </p>
    </div>
  );
}

/**
 * The search input keeps what is typed in its own state and writes it to the table (the URL) after a
 * short pause, so typing stays instant however the URL update is scheduled. A change from outside
 * (Reset filters, the Back button) replaces the text.
 */
function SearchBox({ id, value, resetVersion, onChange, placeholder, delay = 250 }) {
  const [text, setText] = useState(value);
  const sent = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // "Reset filters" clears the box even if the URL value did not change in between.
  useEffect(() => {
    if (resetVersion === 0) return;
    sent.current = "";
    setText("");
  }, [resetVersion]);

  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === sent.current) return undefined;
    const timer = setTimeout(() => {
      if (text === sent.current) return; // already applied (Enter or leaving the box)
      sent.current = text;
      onChangeRef.current(text);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  function flush() {
    if (text === sent.current) return;
    sent.current = text;
    onChangeRef.current(text);
  }

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        placeholder={placeholder}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && flush()}
        // Leaving the box applies the text at once, so a click on "Reset filters" right after typing
        // resets the search instead of being overtaken by the pending update.
        onBlur={flush}
      />
      {text && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          onClick={() => {
            setText("");
            sent.current = "";
            onChangeRef.current("");
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** A column header that sorts the table when clicked (and tells screen readers the current order). */
export function SortableHead({ table, column, className, align = "left", children }) {
  const active = table.sort?.key === column ? table.sort.dir : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      className={className}
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
    >
      <button
        type="button"
        onClick={() => table.toggleSort(column)}
        className={cn(
          "-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 tracking-wider uppercase transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          active && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <Icon className={cn("size-3.5 shrink-0", !active && "opacity-40")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

/** "S.No": the first column of every table. */
export function SerialHead() {
  return <TableHead className="w-14 text-right">S.No</TableHead>;
}

/**
 * The row's serial number, in the order shown. In a paged table pass `table.from + index`, so the
 * numbering continues across pages.
 */
export function SerialCell({ n }) {
  return <TableCell className="w-14 text-right text-muted-foreground tabular-nums">{n}</TableCell>;
}

/** Shown inside the table body when the search or filters leave no rows. */
export function NoResultsRow({ table, colSpan }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center whitespace-normal text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <SearchX className="size-6" aria-hidden="true" />
          No rows match the search or filters.
          {table.isFiltered && (
            <Button variant="outline" size="sm" onClick={table.reset}>
              Reset filters
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** "26–50 of 120", rows per page, and page buttons. Hidden entirely when everything fits on one page. */
export function DataTablePagination({ table, className }) {
  const sizeId = useId();
  if (table.total <= PAGE_SIZES[0] && table.pageCount === 1) return null;
  const { page, pageCount } = table;
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t px-3 py-3 text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Label htmlFor={sizeId} className="font-normal">
          Rows per page
        </Label>
        <Select value={String(table.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
          <SelectTrigger id={sizeId} size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular-nums">
          {table.from}–{table.to} of {table.total}
        </span>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <PageButton label="First page" disabled={page === 1} onClick={() => table.setPage(1)} icon={ChevronsLeft} />
          <PageButton
            label="Previous page"
            disabled={page === 1}
            onClick={() => table.setPage(page - 1)}
            icon={ChevronLeft}
          />
          <span className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, pageCount).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden="true">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "ghost"}
                  size="icon-sm"
                  className="tabular-nums"
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => table.setPage(p)}
                >
                  {p}
                </Button>
              ),
            )}
          </span>
          <span className="px-2 text-muted-foreground tabular-nums sm:hidden">
            Page {page} of {pageCount}
          </span>
          <PageButton
            label="Next page"
            disabled={page === pageCount}
            onClick={() => table.setPage(page + 1)}
            icon={ChevronRight}
          />
          <PageButton
            label="Last page"
            disabled={page === pageCount}
            onClick={() => table.setPage(pageCount)}
            icon={ChevronsRight}
          />
        </div>
      )}
    </nav>
  );
}

function PageButton({ label, icon: Icon, ...props }) {
  return (
    <Button variant="outline" size="icon-sm" aria-label={label} title={label} {...props}>
      <Icon />
    </Button>
  );
}
