// Institution branding (README §5): name, address and logo printed on syllabi, Action Taken reports and the
// syllabus book. Administrator only.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp, Landmark, Pencil, Trash2 } from "lucide-react";
import { useApiQuery, useRefreshAll } from "@/hooks/use-api";
import { removeInstitutionLogo, saveInstitution, uploadInstitutionLogo } from "@/lib/actions";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { QueryState } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const fields = [
  { name: "name", label: "Name", type: "text" },
  { name: "shortName", label: "Short name", type: "text", width: "half", description: "Used in page footers" },
  { name: "estd", label: "Established", type: "text", width: "third", placeholder: "1979" },
  { name: "address", label: "Address", type: "textarea", rows: 2 },
];

export function InstitutionCard() {
  const query = useApiQuery("/admin/institution");
  return <QueryState query={query}>{(institution) => <Institution institution={institution} />}</QueryState>;
}

function Institution({ institution }) {
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const refreshAll = useRefreshAll();

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("logo", file);
    setUploading(true);
    const result = await uploadInstitutionLogo(form);
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    refreshAll();
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>
          <Landmark />
          Institution
        </CardTitle>
        <CardDescription>
          Printed at the top of syllabi, Action Taken reports and on the syllabus book cover. Approved PDFs keep the
          details they were approved with.
        </CardDescription>
        <CardAction>
          <EntityFormDialog
            schema="institution"
            title="Institution details"
            fields={fields}
            defaultValues={{
              name: institution.name ?? "",
              shortName: institution.shortName ?? "",
              estd: institution.estd ?? "",
              address: institution.address ?? "",
            }}
            action={saveInstitution}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil />
                Edit details
              </Button>
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-6">
        <div className="flex size-24 shrink-0 items-center justify-center rounded-lg border bg-white p-2">
          {institution.logoUrl ? (
            <img src={institution.logoUrl} alt="Institution logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-center text-xs text-muted-foreground">No logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-medium">{institution.name}</p>
          {institution.address && <p className="text-muted-foreground">{institution.address}</p>}
          {institution.shortName && <p className="text-xs text-muted-foreground">Footer: {institution.shortName}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              id="institution-logo"
              aria-label="Logo file"
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
              <ImageUp />
              {uploading ? "Uploading…" : institution.logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {institution.logoUrl && (
              <ConfirmActionButton
                action={removeInstitutionLogo}
                label="Remove logo"
                icon={Trash2}
                variant="ghost"
                title="Remove the logo?"
                description="Documents made from now on print without a logo. Approved PDFs keep theirs."
                confirmLabel="Remove"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG or JPEG, at most 200 KB.</p>
        </div>
      </CardContent>
    </Card>
  );
}
