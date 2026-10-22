import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const DELAY_MS = 1500;

/**
 * Saves `content` to `PUT /api{path}` shortly after the user stops typing.
 * Only one save runs at a time; edits made during a save are sent right after it.
 * The server refuses a save based on an old revision (409): status becomes "conflict" and
 * `conflict.latest` holds the newer copy, which `acceptLatest()` loads.
 *
 * status: "saved" | "unsaved" | "saving" | "error" | "conflict"
 */
export function useAutosave({ path, content, revision: initialRevision, enabled, onLoadLatest }) {
  const [status, setStatus] = useState("saved");
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const revision = useRef(initialRevision);
  const contentRef = useRef(content);
  const savedContent = useRef(content);
  const timer = useRef(null);
  const inFlight = useRef(false);
  const blocked = useRef(false); // stop saving after a conflict until the user resolves it

  contentRef.current = content;

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (!enabled || blocked.current || inFlight.current) return;
    const sending = contentRef.current;
    if (sending === savedContent.current) return;
    inFlight.current = true;
    setStatus("saving");
    const result = await api.put(path, { revision: revision.current, content: sending });
    inFlight.current = false;
    if (result.ok) {
      revision.current = result.data.revision;
      savedContent.current = sending;
      setSavedAt(result.data.updatedAt);
      setError(null);
      // Typed during the save? Send that too.
      if (contentRef.current !== sending) save();
      else setStatus("saved");
    } else if (result.status === 409 && result.code === "CONFLICT") {
      blocked.current = true;
      setConflict({ message: result.error, latest: result.latest });
      setStatus("conflict");
    } else {
      setError(result.error);
      setStatus("error");
    }
  }, [enabled, path]);

  useEffect(() => {
    if (!enabled || content === savedContent.current || blocked.current) return;
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, DELAY_MS);
  }, [content, enabled, save]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const warn = (e) => {
      if (contentRef.current !== savedContent.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Leaving the page inside the app: save what is pending.
  useEffect(() => () => void save(), [save]);

  /** Discards local edits and continues from the colleague's saved copy. */
  const acceptLatest = useCallback(() => {
    if (!conflict?.latest) return;
    revision.current = conflict.latest.revision;
    savedContent.current = conflict.latest.content;
    blocked.current = false;
    setConflict(null);
    setStatus("saved");
    setSavedAt(conflict.latest.updatedAt);
    onLoadLatest(conflict.latest.content);
  }, [conflict, onLoadLatest]);

  return { status, error, conflict, savedAt, saveNow: save, acceptLatest };
}
