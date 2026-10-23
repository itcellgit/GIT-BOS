// Where the syllabus stands in the review workflow (README §7) and the actions available now.
// The rules come from @acp/shared/domain/reviews/workflow, the same ones the API enforces.
import { Link } from "react-router";
import { GitCommitHorizontal, Lock, LockOpen, MessageSquareText, Send, Stamp } from "lucide-react";
import {
  nextVersion,
  stageAfter,
  stageLabels,
  syllabusStatusLabels,
  versionLabel,
  workflowBlocker,
} from "@acp/shared/domain/reviews/workflow";
import { approveSyllabus, closeStage, commitVersion, submitSyllabus, unlockSyllabus } from "@/lib/actions";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const statusVariant = { DRAFT: "warning", IN_REVIEW: "secondary", APPROVED: "success", REVISING: "warning" };

const reasonField = (label, description) => ({ name: "reason", label, type: "textarea", rows: 3, description });
const approvalFields = [
  { name: "approvedOn", label: "Academic Council meeting date", type: "date", width: "half" },
  {
    name: "reference",
    label: "Meeting reference",
    type: "text",
    width: "half",
    placeholder: "e.g. AC/2026/14, item 5",
  },
  reasonField("Note (optional)"),
];
const today = () => new Date().toISOString().slice(0, 10);

/** A button that is shown disabled with the reason as its tooltip and text. */
function Blocked({ label, icon: Icon, reason }) {
  return (
    <Button variant="outline" disabled title={reason}>
      <Icon data-icon="inline-start" />
      {label}
    </Button>
  );
}

/**
 * @param {object} props
 * @param {string} props.path        "/syllabi/:schemeId/:courseId"
 * @param {object} props.data        editor data (workflow, canEdit, canReview…)
 * @param {object} props.state       data.workflow with live values (uncommitted changes, error count)
 * @param {() => Promise<void>} props.beforeAction  saves pending edits, so a version holds what is on screen
 */
export function WorkflowBar({ path, data, state, beforeAction }) {
  const { status, stage, label } = state;
  const canEdit = data.canEdit;
  const canReview = data.canReview;
  const run = (fn) => async (values) => {
    await beforeAction();
    return fn(path, values);
  };
  const blocker = (action) => workflowBlocker(action, state);

  const closing = status === "IN_REVIEW" ? nextVersion(state, "close") : null;
  const next = stage ? stageAfter(stage) : null;
  const closeDescription =
    stage === "ACADEMIC_COUNCIL"
      ? `Creates ${versionLabel(4, 0)} (Final) and records the Academic Council approval. The working copy is then locked.`
      : `${closing ? `Creates ${versionLabel(closing.major, closing.minor)} and moves` : "Moves"} the syllabus to the ${stageLabels[next]} stage. Inputs of this stage can no longer change.`;

  return (
    <Card className="mb-6">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant[status]}>{syllabusStatusLabels[status]}</Badge>
            {label && <span className="font-semibold">{label}</span>}
            {status === "IN_REVIEW" && <span className="text-sm">· {stageLabels[stage]} stage</span>}
            {data.syllabus.officialVersion && (
              <span className="text-sm text-muted-foreground">· Official: {data.syllabus.officialVersion.label}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "DRAFT" && "Not submitted yet. Submitting creates V1.0 for the Internal BOS."}
            {status === "IN_REVIEW" &&
              (state.inputCount === 0
                ? "No inputs recorded for this stage yet."
                : state.pendingCount > 0
                  ? `${state.pendingCount} of ${state.inputCount} inputs still need an action taken.`
                  : `All ${state.inputCount} inputs of this stage have an action taken.`)}
            {status === "APPROVED" && "Approved and locked. The BoS Coordinator can unlock it for a correction."}
            {status === "REVISING" &&
              "Unlocked for a correction. The approved version stays official until the correction is approved."}
            {state.hasUncommittedChanges && label && ` Changes since ${label} are not saved as a version yet.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {status !== "DRAFT" && (
            <Button variant="outline" asChild>
              <Link to={`${path}/review`}>
                <MessageSquareText data-icon="inline-start" />
                Inputs, versions &amp; Action Taken
              </Link>
            </Button>
          )}

          {status === "DRAFT" &&
            canEdit &&
            (blocker("submit") ? (
              <Blocked label="Submit" icon={Send} reason={blocker("submit")} />
            ) : (
              <ConfirmActionButton
                action={run(submitSyllabus)}
                label="Submit as V1.0"
                variant="default"
                size="default"
                title="Submit the syllabus?"
                description="The saved syllabus becomes V1.0, which cannot be changed. It goes to the Internal BOS; you can keep improving the working copy and save further versions (V1.1…)."
                confirmLabel="Submit"
              />
            ))}

          {(status === "IN_REVIEW" || status === "REVISING") &&
            canEdit &&
            (blocker("commit") ? (
              <Blocked label="Save version" icon={GitCommitHorizontal} reason={blocker("commit")} />
            ) : (
              <EntityFormDialog
                schema="commitVersion"
                title={`Save as ${versionLabel(state.major, state.minor + 1)}`}
                description="The working copy is frozen as a new version, which cannot be changed. Answered inputs of this stage are recorded as incorporated in it."
                fields={[reasonField("What changed", "e.g. Inputs of Dr. Rao incorporated in units 2 and 4")]}
                defaultValues={{ reason: "" }}
                action={run(commitVersion)}
                submitLabel="Save version"
                trigger={
                  <Button>
                    <GitCommitHorizontal data-icon="inline-start" />
                    Save version
                  </Button>
                }
              />
            ))}

          {status === "IN_REVIEW" &&
            canReview &&
            (blocker("close") ? (
              <Blocked label={`Close ${stageLabels[stage]}`} icon={Lock} reason={blocker("close")} />
            ) : (
              <EntityFormDialog
                schema={stage === "ACADEMIC_COUNCIL" ? "approval" : "closeStage"}
                title={
                  stage === "ACADEMIC_COUNCIL"
                    ? "Close the Academic Council stage and approve"
                    : `Close the ${stageLabels[stage]} stage`
                }
                description={closeDescription}
                fields={stage === "ACADEMIC_COUNCIL" ? approvalFields : [reasonField("Note (optional)")]}
                defaultValues={
                  stage === "ACADEMIC_COUNCIL" ? { approvedOn: today(), reference: "", reason: "" } : { reason: "" }
                }
                action={run(closeStage)}
                submitLabel={stage === "ACADEMIC_COUNCIL" ? "Approve" : "Close stage"}
                trigger={
                  <Button variant="outline">
                    {stage === "ACADEMIC_COUNCIL" ? (
                      <Stamp data-icon="inline-start" />
                    ) : (
                      <Lock data-icon="inline-start" />
                    )}
                    {stage === "ACADEMIC_COUNCIL" ? "Close & approve" : `Close ${stageLabels[stage]}`}
                  </Button>
                }
              />
            ))}

          {status === "APPROVED" && canReview && (
            <EntityFormDialog
              schema="unlock"
              title="Unlock the approved syllabus"
              description="The working copy opens for a correction, which is saved as the next minor version. The approved version stays official until the correction is approved. The reason appears in the Action Taken report."
              fields={[reasonField("Reason for unlocking")]}
              defaultValues={{ reason: "" }}
              action={(values) => unlockSyllabus(path, values)}
              submitLabel="Unlock"
              trigger={
                <Button variant="outline">
                  <LockOpen data-icon="inline-start" />
                  Unlock
                </Button>
              }
            />
          )}

          {status === "REVISING" &&
            canReview &&
            (blocker("approve") ? (
              <Blocked label="Record approval" icon={Stamp} reason={blocker("approve")} />
            ) : (
              <EntityFormDialog
                schema="approval"
                title="Record the approval of the correction"
                description={
                  state.hasUncommittedChanges
                    ? `The working copy is saved as ${versionLabel(state.major, state.minor + 1)} and becomes the official version.`
                    : `${label} becomes the official version.`
                }
                fields={approvalFields}
                defaultValues={{ approvedOn: today(), reference: "", reason: "" }}
                action={run(approveSyllabus)}
                submitLabel="Approve"
                trigger={
                  <Button variant="outline">
                    <Stamp data-icon="inline-start" />
                    Record approval
                  </Button>
                }
              />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
