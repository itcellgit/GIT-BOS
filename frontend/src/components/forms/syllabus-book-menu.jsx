// Compiled syllabus book (Phase 4, README §8): the whole programme or one semester, as one PDF.
import { useState } from "react";
import { toast } from "sonner";
import { BookCopy, Loader2 } from "lucide-react";
import { downloadPdf } from "@/lib/download";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * @param {object} props
 * @param {string} props.basePath   "/schemes/:schemeId/programmes/:programmeId"
 * @param {string} props.fileStem   e.g. "BE-CSE_2025"
 * @param {number[]} props.semesters
 */
export function SyllabusBookMenu({ basePath, fileStem, semesters }) {
  const [busy, setBusy] = useState(false);
  const download = async (semester) => {
    setBusy(true);
    try {
      const query = semester ? `?semester=${semester}` : "";
      await downloadPdf(
        `${basePath}/book/pdf${query}`,
        `${fileStem}_${semester ? `sem${semester}` : "all"}_syllabus_book.pdf`,
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <BookCopy />}
          {busy ? "Compiling…" : "Syllabus book"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Approved syllabi as one PDF</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => download(null)}>Whole programme</DropdownMenuItem>
        <DropdownMenuSeparator />
        {semesters.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => download(s)}>
            Semester {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
