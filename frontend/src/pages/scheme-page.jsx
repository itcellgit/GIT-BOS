import { Link, useNavigate, useParams } from "react-router";
import { schemeStatusLabels } from "@acp/shared/labels";
import { useApiQuery } from "@/hooks/use-api";
import { deleteDraftScheme, publishScheme, retireScheme, updateScheme } from "@/lib/actions";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { SyllabusBookMenu } from "@/components/forms/syllabus-book-menu";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { AmendmentsSection } from "@/components/schemes/amendments-section";
import { BloomSection } from "@/components/schemes/bloom-section";
import { CategoriesSection } from "@/components/schemes/categories-section";
import { FormatsSection } from "@/components/schemes/formats-section";
import { OutcomesSection } from "@/components/schemes/outcomes-section";
import { ProgrammesSection } from "@/components/schemes/programmes-section";
import { TextBlocksSection } from "@/components/schemes/text-blocks-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Archive,
  Brain,
  CircleCheck,
  FileCheck2,
  FileText,
  GraduationCap,
  History,
  LayoutTemplate,
  Pencil,
  Tags,
  Target,
  Trash2,
} from "lucide-react";
export function SchemePage() {
  const { schemeId } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery(`/schemes/${schemeId}`);

  return (
    <QueryState query={query}>
      {({ scheme, programmes, semesters, amendments, canConfigure, editable }) => (
        <>
          <PageHeader
            back={{ href: "/schemes", label: "All schemes" }}
            title={scheme.name}
            description={
              <span className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    scheme.status === "PUBLISHED" ? "success" : scheme.status === "DRAFT" ? "warning" : "outline"
                  }
                >
                  {schemeStatusLabels[scheme.status]}
                </Badge>
                {scheme.framework && <span>{scheme.framework}</span>}
                {scheme.effectiveFrom && <span>· Effective from {scheme.effectiveFrom}</span>}
                {scheme.clonedFrom && <span>· Copied from {scheme.clonedFrom.name}</span>}
              </span>
            }
            actions={
              <>
                {scheme.status !== "DRAFT" && (
                  <Button asChild variant="outline">
                    <Link to={`/approved-syllabi?scheme=${scheme.id}`}>
                      <FileCheck2 />
                      Approved syllabi
                    </Link>
                  </Button>
                )}
                {canConfigure && (
                  <>
                    {scheme.status !== "DRAFT" && semesters.length > 0 && (
                      <SyllabusBookMenu
                        basePath={`/schemes/${scheme.id}`}
                        fileStem={`${scheme.code}_all_programmes`}
                        semesters={semesters}
                        wholeLabel="All programmes, all semesters"
                      />
                    )}
                    {editable && (
                      <EntityFormDialog
                        schema="scheme"
                        title="Edit scheme"
                        fields={[
                          { name: "code", label: "Code", type: "text", width: "third", disabled: true },
                          { name: "name", label: "Name", type: "text", width: "half" },
                          { name: "effectiveFrom", label: "Effective from", type: "text", width: "third" },
                          { name: "framework", label: "Framework", type: "text" },
                          {
                            name: "teachingWeeks",
                            label: "Teaching weeks per semester",
                            type: "number",
                            width: "half",
                          },
                          { name: "hoursPerCredit", label: "Hours per credit", type: "number", width: "half" },
                        ]}
                        defaultValues={{
                          code: scheme.code,
                          name: scheme.name,
                          effectiveFrom: scheme.effectiveFrom ?? "",
                          framework: scheme.framework ?? "",
                          teachingWeeks: scheme.teachingWeeks,
                          hoursPerCredit: scheme.hoursPerCredit,
                          cloneFromId: "",
                        }}
                        action={updateScheme.bind(null, scheme.id)}
                        trigger={
                          <Button variant="outline">
                            <Pencil />
                            Edit details
                          </Button>
                        }
                      />
                    )}
                    {scheme.status === "DRAFT" && (
                      <>
                        <ConfirmActionButton
                          action={publishScheme.bind(null, scheme.id)}
                          label="Publish"
                          icon={CircleCheck}
                          variant="default"
                          size="default"
                          title={`Publish ${scheme.name}?`}
                          description="Departments will be able to set up their course lists and faculty can start framing syllabi under this scheme."
                          confirmLabel="Publish"
                        />
                        <ConfirmActionButton
                          action={deleteDraftScheme.bind(null, scheme.id)}
                          onSuccess={() => navigate("/schemes", { replace: true })}
                          label="Delete draft"
                          icon={Trash2}
                          variant="destructive"
                          size="default"
                          title={`Delete ${scheme.name}?`}
                          description="The draft and all of its configuration will be removed. This cannot be undone."
                          confirmLabel="Delete"
                        />
                      </>
                    )}
                    {scheme.status === "PUBLISHED" && (
                      <ConfirmActionButton
                        action={retireScheme.bind(null, scheme.id)}
                        label="Retire"
                        icon={Archive}
                        size="default"
                        title={`Retire ${scheme.name}?`}
                        description="The scheme becomes a read-only archive. Do this only when no batch is studying under it any more."
                        confirmLabel="Retire"
                      />
                    )}
                  </>
                )}
              </>
            }
          />

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat tone="primary" label="Teaching weeks per semester" value={scheme.teachingWeeks} />
            <Stat
              tone="teal"
              label="Hours per credit"
              value={scheme.hoursPerCredit}
              hint="Total hours = credits × this value"
            />
            <Stat tone="amber" label="Course categories" value={scheme.categories.length} />
          </div>

          {scheme.status === "PUBLISHED" && canConfigure && (
            <Alert className="mb-6">
              <AlertTitle>This scheme is in use</AlertTitle>
              <AlertDescription>
                Changes to rules (categories, credit patterns, formats, outcome lists, Bloom levels, weeks) are recorded
                as amendments. Every syllabus a change can affect is flagged “Needs revision” and its checks are re-run;
                course lists that no longer fit are flagged on the list.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="categories">
            <TabsList className="flex-wrap">
              <TabsTrigger value="categories">
                <Tags />
                Categories
              </TabsTrigger>
              <TabsTrigger value="formats">
                <LayoutTemplate />
                Formats
              </TabsTrigger>
              <TabsTrigger value="outcomes">
                <Target />
                Outcome lists
              </TabsTrigger>
              <TabsTrigger value="bloom">
                <Brain />
                Bloom levels
              </TabsTrigger>
              <TabsTrigger value="text">
                <FileText />
                Standard text
              </TabsTrigger>
              <TabsTrigger value="programmes">
                <GraduationCap />
                Programmes
              </TabsTrigger>
              {scheme.status !== "DRAFT" && (
                <TabsTrigger value="amendments">
                  <History />
                  Amendments
                  {amendments.length > 0 && <span className="tabular-nums">({amendments.length})</span>}
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="categories" className="pt-4">
              <CategoriesSection scheme={scheme} editable={editable} />
            </TabsContent>
            <TabsContent value="formats" className="pt-4">
              <FormatsSection scheme={scheme} editable={editable} />
            </TabsContent>
            <TabsContent value="outcomes" className="pt-4">
              <OutcomesSection scheme={scheme} editable={editable} />
            </TabsContent>
            <TabsContent value="bloom" className="pt-4">
              <BloomSection scheme={scheme} editable={editable} />
            </TabsContent>
            <TabsContent value="text" className="pt-4">
              <TextBlocksSection scheme={scheme} editable={editable} />
            </TabsContent>
            <TabsContent value="programmes" className="pt-4">
              <ProgrammesSection scheme={scheme} programmes={programmes} />
            </TabsContent>
            <TabsContent value="amendments" className="pt-4">
              <AmendmentsSection scheme={scheme} amendments={amendments} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </QueryState>
  );
}

const statTones = {
  primary: "border-l-primary bg-primary/5 text-primary",
  teal: "border-l-chart-2 bg-chart-2/5 text-chart-2",
  amber: "border-l-chart-3 bg-chart-3/10 text-warning-foreground dark:text-chart-3",
};

function Stat({ label, value, hint, tone = "primary" }) {
  return (
    <div className={`rounded-lg border border-l-4 p-4 shadow-sm ${statTones[tone]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
