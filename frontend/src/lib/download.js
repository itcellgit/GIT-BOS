// Downloads a PDF made by the API (GET /api{path}?download=1). Throws with the API's message.
export async function downloadPdf(path, fileName) {
  const res = await fetch(`/api${path}${path.includes("?") ? "&" : "?"}download=1`, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `The PDF could not be made (${res.status}).`);
  }
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "2026-10-22T10:30" for an <input type="datetime-local">, in the browser's time zone. */
export function toLocalInput(value) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatDateTime = (value) =>
  new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const formatDate = (value) =>
  new Date(value).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
