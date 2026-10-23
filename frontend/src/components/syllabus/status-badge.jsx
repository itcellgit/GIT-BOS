import { BadgeCheck, Hourglass, PencilLine, RotateCcw } from "lucide-react";
import { syllabusStatusLabels } from "@acp/shared/domain/reviews/workflow";
import { Badge } from "@/components/ui/badge";

const variants = { DRAFT: "warning", IN_REVIEW: "secondary", APPROVED: "success", REVISING: "warning" };
const icons = { DRAFT: PencilLine, IN_REVIEW: Hourglass, APPROVED: BadgeCheck, REVISING: RotateCcw };

/** A syllabus's workflow status (Draft, In review, Approved, Revising) with its icon. */
export function SyllabusStatusBadge({ status }) {
  const Icon = icons[status];
  return (
    <Badge variant={variants[status]}>
      {Icon && <Icon />}
      {syllabusStatusLabels[status]}
    </Badge>
  );
}
