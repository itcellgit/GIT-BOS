// Sections of the Theory syllabus editor, in the order of the Word template (README Appendix B).
// Every section gets `content` (the working copy), `update(fn)` (mutates a copy and saves it) and
// `ctx` (scheme course, format settings and outcome lists from GET /api/syllabi/...).
import { Plus, Trash2 } from "lucide-react";
import {
  emptyActivity,
  emptyBook,
  emptyEResource,
  emptyOutcome,
  romanNumeral,
} from "@acp/shared/domain/syllabi/theory";
import { renderRichText } from "@acp/shared/print/rich-text";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// --- Small building blocks ------------------------------------------------------------

export function SectionCard({ id, title, description, status, children }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {status && <CardAction>{status}</CardAction>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** "40 / 42 hours" — green when it matches the expected value, amber otherwise. */
function TotalBadge({ value, expected, unit = "hours" }) {
  if (expected === undefined || expected === null) return <Badge variant="secondary">{`${value} ${unit}`}</Badge>;
  return <Badge variant={value === expected ? "success" : "warning"}>{`${value} / ${expected} ${unit}`}</Badge>;
}

function HoursInput({ value, onChange, className, ...props }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      className={cn("w-20 tabular-nums", className)}
      value={value ?? ""}
      onChange={(e) => {
        const n = Number.parseInt(e.target.value, 10);
        onChange(Number.isNaN(n) ? null : Math.max(0, n));
      }}
      {...props}
    />
  );
}

function RemoveButton({ label, onClick, disabled }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Trash2 />
    </Button>
  );
}

function AddButton({ children, onClick, disabled }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Plus data-icon="inline-start" />
      {children}
    </Button>
  );
}

const offeringOf = (ctx) => ctx.offerings[0];
const perWeek = (hours, weeks) => {
  const v = hours / weeks;
  return Number.isInteger(v) ? v : v.toFixed(1);
};

// --- Header (read-only, from the scheme) -------------------------------------------------

export function HeaderSection({ ctx, totals }) {
  const o = offeringOf(ctx);
  const weeks = ctx.scheme.teachingWeeks;
  const credits = o.lCredits + o.tCredits + o.pCredits;
  const cell = "border px-3 py-2 align-top";
  const label = cn(cell, "bg-muted/60 font-medium text-muted-foreground");
  return (
    <SectionCard
      id="header"
      title="Course details"
      description="From the scheme's course list. Ask the BoS Coordinator if anything here is wrong."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <tbody>
            <tr>
              <td className={label}>Course code</td>
              <td className={cn(cell, "font-medium")}>{ctx.course.code}</td>
              <td className={label}>Course type</td>
              <td className={cell}>{o.category.code}</td>
              <td className={label}>Credits L:T:P</td>
              <td className={cn(cell, "tabular-nums")}>{`${o.lCredits}:${o.tCredits}:${o.pCredits}`}</td>
            </tr>
            <tr>
              <td className={label}>Hours/week L:T:P</td>
              <td className={cn(cell, "tabular-nums")}>
                {`${perWeek(o.lHours, weeks)}:${perWeek(o.tHours, weeks)}:${perWeek(o.pHours, weeks)}`}
              </td>
              <td className={label}>Total credits</td>
              <td className={cn(cell, "tabular-nums")}>{credits}</td>
              <td className={label}>CIE marks</td>
              <td className={cn(cell, "tabular-nums")}>{o.cieMarks}</td>
            </tr>
            <tr>
              <td className={label}>Total hours L:T:P:SL:TW</td>
              <td className={cn(cell, "tabular-nums")} colSpan={3}>
                {`${o.lHours}:${o.tHours}:${o.pHours}:${totals.slHours}:${totals.twHours}`}
                <span className="text-muted-foreground"> · Total = {credits * ctx.scheme.hoursPerCredit} hrs</span>
              </td>
              <td className={label}>SEE marks</td>
              <td className={cn(cell, "tabular-nums")}>{o.seeMarks ?? "—"}</td>
            </tr>
            <tr>
              <td className={label}>Flipped classes</td>
              <td className={cn(cell, "tabular-nums")} colSpan={5}>
                {totals.flippedSessions} hours
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {ctx.offerings.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Offered in {ctx.offerings.map((x) => `${x.programme.code} (semester ${x.semester})`).join(", ")}. One syllabus
          serves all of them.
        </p>
      )}
    </SectionCard>
  );
}

// --- Course learning objectives and prerequisites ---------------------------------------------

export function ObjectivesSection({ content, update, ctx }) {
  const { cloMin, cloMax } = ctx.format;
  const items = content.objectives;
  return (
    <SectionCard
      id="objectives"
      title="Course learning objectives"
      description={`What the course sets out to teach: ${cloMin}–${cloMax} objectives.`}
      status={<TotalBadge value={items.filter((t) => t.trim()).length} unit="written" />}
    >
      <ol className="space-y-2">
        {items.map((text, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="w-6 pt-2 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
            <Textarea
              aria-label={`Objective ${i + 1}`}
              rows={2}
              className="min-h-0 flex-1"
              value={text}
              onChange={(e) => update((c) => (c.objectives[i] = e.target.value))}
            />
            <RemoveButton
              label={`Remove objective ${i + 1}`}
              disabled={items.length <= 1}
              onClick={() => update((c) => c.objectives.splice(i, 1))}
            />
          </li>
        ))}
      </ol>
      <AddButton disabled={items.length >= cloMax} onClick={() => update((c) => c.objectives.push(""))}>
        Add objective
      </AddButton>
    </SectionCard>
  );
}

export function PrerequisitesSection({ content, update, ctx }) {
  return (
    <SectionCard id="prerequisites" title={ctx.format.prerequisiteLabel}>
      <Textarea
        aria-label={ctx.format.prerequisiteLabel}
        rows={3}
        placeholder="Courses or knowledge students need before this course."
        value={content.prerequisites}
        onChange={(e) => update((c) => (c.prerequisites = e.target.value))}
      />
    </SectionCard>
  );
}

// --- Units and flipped classroom ---------------------------------------------------------------

export function UnitsSection({ content, update, ctx, totals }) {
  const expected = offeringOf(ctx).lHours;
  return (
    <SectionCard
      id="units"
      title="Units"
      description="Topics of each unit and its contact hours. The unit hours must add up to the lecture hours in the scheme."
      status={<TotalBadge value={totals.unitHours} expected={expected} />}
    >
      {content.units.map((unit, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor={`unit-${i}-title`}>Unit – {romanNumeral(i + 1)}</Label>
              <Input
                id={`unit-${i}-title`}
                placeholder="Unit title"
                value={unit.title}
                onChange={(e) => update((c) => (c.units[i].title = e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`unit-${i}-hours`}>Contact hours</Label>
              <HoursInput
                id={`unit-${i}-hours`}
                value={unit.hours}
                onChange={(v) => update((c) => (c.units[i].hours = v))}
              />
            </div>
          </div>
          <Textarea
            aria-label={`Unit ${romanNumeral(i + 1)} content`}
            rows={5}
            placeholder="Content of the unit"
            value={unit.content}
            onChange={(e) => update((c) => (c.units[i].content = e.target.value))}
          />
        </div>
      ))}
    </SectionCard>
  );
}

export function FlippedSection({ content, update, totals }) {
  return (
    <SectionCard
      id="flipped"
      title="Flipped classroom"
      description="Number of flipped classroom sessions in each unit."
      status={<TotalBadge value={totals.flippedSessions} unit="sessions" />}
    >
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-muted/60 px-3 py-2 text-left font-medium text-muted-foreground">Unit</th>
              {content.flippedSessions.map((_, i) => (
                <th key={i} className="border bg-muted/60 px-3 py-2 font-medium">
                  {romanNumeral(i + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-3 py-2 text-muted-foreground">Sessions</td>
              {content.flippedSessions.map((v, i) => (
                <td key={i} className="border p-1.5">
                  <HoursInput
                    aria-label={`Flipped sessions, unit ${romanNumeral(i + 1)}`}
                    className="w-16"
                    value={v}
                    onChange={(n) => update((c) => (c.flippedSessions[i] = n))}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// --- Books and e-resources --------------------------------------------------------------------

const bookFields = [
  ["authors", "Author(s)", "min-w-40 flex-[2]"],
  ["title", "Title", "min-w-48 flex-[3]"],
  ["publisher", "Publisher", "min-w-32 flex-[2]"],
  ["edition", "Edition", "w-24"],
  ["year", "Year", "w-24"],
];

function BookList({ name, label, books, update }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{label}</h3>
      {books.map((b, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-2">
          <span className="w-5 pb-2 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
          {bookFields.map(([key, fieldLabel, width]) => (
            <div key={key} className={cn("space-y-1", width)}>
              <Label htmlFor={`${name}-${i}-${key}`} className="text-xs text-muted-foreground">
                {fieldLabel}
              </Label>
              <Input
                id={`${name}-${i}-${key}`}
                value={b[key]}
                onChange={(e) => update((c) => (c[name][i][key] = e.target.value))}
              />
            </div>
          ))}
          <RemoveButton
            label={`Remove ${label.toLowerCase()} ${i + 1}`}
            disabled={books.length <= 1}
            onClick={() => update((c) => c[name].splice(i, 1))}
          />
        </div>
      ))}
      <AddButton onClick={() => update((c) => c[name].push(emptyBook()))}>
        Add {label.toLowerCase().replace(/s$/, "")}
      </AddButton>
    </div>
  );
}

export function BooksSection({ content, update, ctx }) {
  return (
    <SectionCard
      id="books"
      title="Books and e-resources"
      description="Mention the edition or year “and onwards” where it applies."
    >
      <BookList name="textBooks" label="Text books" books={content.textBooks} update={update} />
      {ctx.format.hasReferenceBooks && (
        <BookList name="referenceBooks" label="Reference books" books={content.referenceBooks} update={update} />
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">E-resources (NPTEL, SWAYAM or others)</h3>
        {content.eResources.map((r, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-2">
            <span className="w-5 pb-2 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
            <div className="min-w-48 flex-[2] space-y-1">
              <Label htmlFor={`eres-${i}-title`} className="text-xs text-muted-foreground">
                Title
              </Label>
              <Input
                id={`eres-${i}-title`}
                value={r.title}
                onChange={(e) => update((c) => (c.eResources[i].title = e.target.value))}
              />
            </div>
            <div className="min-w-56 flex-[3] space-y-1">
              <Label htmlFor={`eres-${i}-url`} className="text-xs text-muted-foreground">
                Link
              </Label>
              <Input
                id={`eres-${i}-url`}
                type="url"
                placeholder="https://"
                value={r.url}
                onChange={(e) => update((c) => (c.eResources[i].url = e.target.value))}
              />
            </div>
            <RemoveButton
              label={`Remove e-resource ${i + 1}`}
              disabled={content.eResources.length <= 1}
              onClick={() => update((c) => c.eResources.splice(i, 1))}
            />
          </div>
        ))}
        <AddButton onClick={() => update((c) => c.eResources.push(emptyEResource()))}>Add e-resource</AddButton>
      </div>
    </SectionCard>
  );
}

// --- Term work and self learning ----------------------------------------------------------------

function ActivityTable({ name, title, hint, rows, update }) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
          <Input
            aria-label={`${title} activity ${i + 1}`}
            className="flex-1"
            placeholder="Activity"
            value={row.activity}
            onChange={(e) => update((c) => (c[name][i].activity = e.target.value))}
          />
          <HoursInput
            aria-label={`${title} hours ${i + 1}`}
            placeholder="Hrs"
            value={row.hours}
            onChange={(v) => update((c) => (c[name][i].hours = v))}
          />
          <RemoveButton
            label={`Remove ${title.toLowerCase()} row ${i + 1}`}
            disabled={rows.length <= 1}
            onClick={() => update((c) => c[name].splice(i, 1))}
          />
        </div>
      ))}
      <AddButton onClick={() => update((c) => c[name].push(emptyActivity()))}>Add row</AddButton>
    </div>
  );
}

export function TwSlSection({ content, update, ctx, totals }) {
  const expected = offeringOf(ctx).twSlHours;
  return (
    <SectionCard
      id="twsl"
      title="Term work and self learning"
      description="Hours per semester. Term work + self learning must add up to the TW & SL hours in the scheme."
      status={<TotalBadge value={totals.twHours + totals.slHours} expected={expected} />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityTable
          name="termWork"
          title="Term work (TW)"
          hint="Assignments, projects and other student activities."
          rows={content.termWork}
          update={update}
        />
        <ActivityTable
          name="selfLearning"
          title="Self learning (SL)"
          hint="MOOCs, spoken tutorials, online educational resources."
          rows={content.selfLearning}
          update={update}
        />
      </div>
    </SectionCard>
  );
}

// --- Course outcomes ----------------------------------------------------------------------------

export function OutcomesSection({ content, update, ctx }) {
  const { coMin, coMax } = ctx.format;
  const levels = ctx.bloomLevels;
  return (
    <SectionCard
      id="outcomes"
      title="Course outcomes (COs)"
      description={`At the end of the course, the student will be able to… (${coMin}–${coMax} COs). Pick the learning level and the action verb used in the statement.`}
    >
      {levels.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Learning levels: {levels.map((l) => `${l.shortCode} – ${l.name}`).join("; ")}
        </p>
      )}
      {content.outcomes.map((co, i) => {
        const level = levels.find((l) => l.level === co.level);
        const verbs = level ? level.verbs : levels.flatMap((l) => l.verbs);
        return (
          <div key={i} className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-start gap-2">
              <span className="pt-2 text-sm font-semibold text-primary">CO{i + 1}</span>
              <Textarea
                aria-label={`CO${i + 1} statement`}
                rows={2}
                className="min-h-0 flex-1"
                value={co.statement}
                onChange={(e) => update((c) => (c.outcomes[i].statement = e.target.value))}
              />
              <RemoveButton
                label={`Remove CO${i + 1}`}
                disabled={content.outcomes.length <= 1}
                onClick={() => update((c) => c.outcomes.splice(i, 1))}
              />
            </div>
            <div className="flex flex-wrap gap-3 pl-11">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Learning level</Label>
                <Select
                  value={co.level ? String(co.level) : ""}
                  onValueChange={(v) => update((c) => (c.outcomes[i].level = Number(v)))}
                >
                  <SelectTrigger aria-label={`CO${i + 1} learning level`} className="w-44">
                    <SelectValue placeholder="Choose level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.level} value={String(l.level)}>
                        {l.shortCode} – {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`co-${i}-verb`} className="text-xs text-muted-foreground">
                  Action verb
                </Label>
                <Input
                  id={`co-${i}-verb`}
                  className="w-44"
                  list={`co-${i}-verbs`}
                  value={co.verb}
                  onChange={(e) => update((c) => (c.outcomes[i].verb = e.target.value))}
                />
                <datalist id={`co-${i}-verbs`}>
                  {verbs.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        );
      })}
      <AddButton
        disabled={content.outcomes.length >= coMax}
        onClick={() => update((c) => c.outcomes.push(emptyOutcome()))}
      >
        Add CO
      </AddButton>
    </SectionCard>
  );
}

// --- CO–PO–PSO–WK–SDG mapping (tick marks, D2) -----------------------------------------------------

function toggle(list, code, on) {
  const set = new Set(list);
  if (on) set.add(code);
  else set.delete(code);
  return [...set];
}

/** WK / SDG cell: several codes picked from a menu. */
function CodePicker({ label, items, value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={label}
          className="h-7 max-w-36 justify-start font-normal"
        >
          <span className="truncate">{value.length ? value.join(", ") : "—"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 w-72 overflow-y-auto">
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.code}
            checked={value.includes(item.code)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => onChange(toggle(value, item.code, on))}
          >
            <span className="font-medium">{item.code}</span>
            <span className="truncate text-muted-foreground">{item.title}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MappingSection({ content, update, ctx }) {
  const { pos, psos, wks, sdgs } = ctx.lists;
  const psoGroups = psos.filter((g) => g.items.length > 0);
  const showProgramme = psos.length > 1;
  const th = "border bg-muted/60 px-2 py-1.5 text-xs font-medium";
  const td = "border px-2 py-1 text-center";
  return (
    <SectionCard
      id="mapping"
      title="CO–PO–PSO–WK–SDG mapping"
      description="Tick each programme outcome a CO addresses (planned mapping)."
    >
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className={th} rowSpan={showProgramme ? 2 : 1}>
                CO
              </th>
              {pos.map((p) => (
                <th key={p.code} className={th} rowSpan={showProgramme ? 2 : 1} title={p.title}>
                  {p.code}
                </th>
              ))}
              {psoGroups.map((g) =>
                showProgramme ? (
                  <th key={g.programmeCode} className={th} colSpan={g.items.length}>
                    {g.programmeCode}
                  </th>
                ) : (
                  g.items.map((p) => (
                    <th key={p.code} className={th} title={p.title}>
                      {p.code}
                    </th>
                  ))
                ),
              )}
              <th className={th} rowSpan={showProgramme ? 2 : 1}>
                WK
              </th>
              <th className={th} rowSpan={showProgramme ? 2 : 1}>
                SDG
              </th>
            </tr>
            {showProgramme && (
              <tr>
                {psoGroups.flatMap((g) =>
                  g.items.map((p) => (
                    <th key={`${g.programmeCode}-${p.code}`} className={th} title={p.title}>
                      {p.code}
                    </th>
                  )),
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {content.outcomes.map((co, i) => (
              <tr key={i}>
                <td className={cn(td, "font-medium")}>{i + 1}</td>
                {pos.map((p) => (
                  <td key={p.code} className={td}>
                    <Checkbox
                      aria-label={`CO${i + 1} ${p.code}`}
                      checked={co.pos.includes(p.code)}
                      onCheckedChange={(on) =>
                        update((c) => (c.outcomes[i].pos = toggle(c.outcomes[i].pos, p.code, on)))
                      }
                    />
                  </td>
                ))}
                {psoGroups.flatMap((g) =>
                  g.items.map((p) => (
                    <td key={`${g.programmeCode}-${p.code}`} className={td}>
                      <Checkbox
                        aria-label={`CO${i + 1} ${showProgramme ? `${g.programmeCode} ` : ""}${p.code}`}
                        checked={(co.psos[g.programmeCode] ?? []).includes(p.code)}
                        onCheckedChange={(on) =>
                          update((c) => {
                            const current = c.outcomes[i].psos[g.programmeCode] ?? [];
                            c.outcomes[i].psos[g.programmeCode] = toggle(current, p.code, on);
                          })
                        }
                      />
                    </td>
                  )),
                )}
                <td className={td}>
                  <CodePicker
                    label={`CO${i + 1} WK`}
                    items={wks}
                    value={co.wks}
                    onChange={(v) => update((c) => (c.outcomes[i].wks = v))}
                  />
                </td>
                <td className={td}>
                  <CodePicker
                    label={`CO${i + 1} SDG`}
                    items={sdgs}
                    value={co.sdgs}
                    onChange={(v) => update((c) => (c.outcomes[i].sdgs = v))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {psoGroups.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No PSOs are defined for {psos.map((g) => g.programmeCode).join(", ")} yet. The BoS Coordinator adds them on
          the programme&apos;s course list page.
        </p>
      )}
    </SectionCard>
  );
}

// --- Standard text (set by Dean Academics; read-only for faculty) -----------------------------------

export function StandardTextSection({ ctx, kindLabels }) {
  const year = Math.ceil(offeringOf(ctx).semester / 2);
  const blocks = ctx.textBlocks.filter((b) => b.yearOfStudy === null || b.yearOfStudy === year);
  if (blocks.length === 0) return null;
  return (
    <SectionCard
      id="standard"
      title="Standard sections"
      description="Delivery and assessment methods, CIE and SEE schemes and rubrics are set by Dean Academics for the whole scheme and printed as they are."
    >
      {blocks.map((b) => (
        <details key={b.id} className="rounded-lg border bg-muted/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            {b.title} <span className="font-normal text-muted-foreground">· {kindLabels[b.kind]}</span>
          </summary>
          <div
            className="prose-standard mt-2 text-sm text-muted-foreground"
            // renderRichText escapes all text first; only its own table/list/bold tags are produced.
            dangerouslySetInnerHTML={{ __html: renderRichText(b.body) }}
          />
        </details>
      ))}
    </SectionCard>
  );
}
