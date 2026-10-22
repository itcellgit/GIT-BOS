import { useWatch } from "react-hook-form";
import { formatCredits, suggestFigures, validateSchemeCourse } from "@acp/shared/domain/schemes/rules";
import { Button } from "@/components/ui/button";
const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
/**
 * Inside the course form: offers the credit patterns allowed for the chosen category,
 * fills hours/marks from a pattern, and shows rule problems as the user types.
 */
export function CourseRulesHelper({ form, data }) {
  const values = useWatch({ control: form.control });
  const category = data.categories.find((c) => c.id === values.categoryId);
  if (!category) {
    return <p className="text-xs text-muted-foreground">Choose a category to see its allowed credit patterns.</p>;
  }
  const fill = (pattern) => {
    const figures = pattern
      ? suggestFigures(pattern, category, data.scheme)
      : { lCredits: 0, tCredits: 0, pCredits: 0, cieMarks: category.cieMarks, seeMarks: null };
    for (const [k, v] of Object.entries(figures)) {
      form.setValue(k, v ?? "", { shouldDirty: true, shouldValidate: false });
    }
    if (!values.format && category.defaultFormat)
      form.setValue("format", category.defaultFormat, { shouldDirty: true });
    form.clearErrors();
  };
  const complete = ["lCredits", "tCredits", "pCredits", "lHours", "tHours", "pHours", "twSlHours", "cieMarks"].every(
    (k) => !Number.isNaN(num(values[k])),
  );
  const issues = complete
    ? validateSchemeCourse(
        {
          lCredits: num(values.lCredits),
          tCredits: num(values.tCredits),
          pCredits: num(values.pCredits),
          lHours: num(values.lHours),
          tHours: num(values.tHours),
          pHours: num(values.pHours),
          twSlHours: num(values.twSlHours),
          cieMarks: num(values.cieMarks),
          seeMarks: Number.isNaN(num(values.seeMarks)) ? null : num(values.seeMarks),
          format: values.format || null,
        },
        category,
        data.scheme,
      )
    : [];
  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
      <p className="text-xs font-medium">Fill credits, hours and marks from a {category.code} pattern:</p>
      <div className="flex flex-wrap gap-2">
        {category.passFail ? (
          <Button type="button" size="xs" variant="outline" onClick={() => fill(null)}>
            Pass/fail (0 credits)
          </Button>
        ) : (
          category.creditPatterns.map((p) => (
            <Button
              key={formatCredits(p) + p.lHours + p.pHours}
              type="button"
              size="xs"
              variant="outline"
              onClick={() => fill(p)}
            >
              {formatCredits(p)} · {p.lHours}:{p.tHours}:{p.pHours} h/wk
            </Button>
          ))
        )}
      </div>
      {complete &&
        (issues.length === 0 ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">✓ Matches the scheme rules.</p>
        ) : (
          <ul className="list-inside list-disc text-xs text-destructive">
            {issues.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        ))}
    </div>
  );
}
