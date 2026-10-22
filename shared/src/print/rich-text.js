// Small, safe formatting for standard text blocks (CIE/SEE schemes, rubrics) written by Dean Academics.
// Everything is HTML-escaped first, so the text can never inject markup. Supported, line by line:
//
//   | Components | Marks |      consecutive "|" lines form a table; the first row is the heading row
//   |---|---|                   (markdown-style separator rows are ignored)
//   - item                      bullet list
//   1. item                     numbered list
//   **bold**                    bold, anywhere
//   <br>                        line break inside a table cell
//   any other line              a paragraph
//
// Used by the print layouts and by the editor's read-only "Standard sections".

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => entities[c]);
}

/** Escaped text with **bold** and <br> applied. */
export function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}

const isTableLine = (l) => l.startsWith("|");
const isSeparatorRow = (l) => /^\|[\s|:-]+\|?$/.test(l) && l.includes("-");
const bulletOf = (l) => l.match(/^[-•]\s+(.*)$/)?.[1];
const numberedOf = (l) => l.match(/^\d+[.)]\s+(.*)$/)?.[1];

function cells(line) {
  const trimmed = line.replace(/^\|/, "").replace(/\|\s*$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function table(lines) {
  const rows = lines.filter((l) => !isSeparatorRow(l)).map(cells);
  const width = Math.max(...rows.map((r) => r.length));
  const row = (r, tag) => {
    const out = r.map((c, i) => {
      // The last cell spans the rest when a row is shorter than the widest one (e.g. a note row).
      const span = i === r.length - 1 && r.length < width ? ` colspan="${width - r.length + 1}"` : "";
      return `<${tag}${span}>${inline(c)}</${tag}>`;
    });
    return `<tr>${out.join("")}</tr>`;
  };
  const [head, ...body] = rows;
  return `<table class="rt-table"><thead>${row(head, "th")}</thead><tbody>${body.map((r) => row(r, "td")).join("")}</tbody></table>`;
}

/** Converts a text block body to HTML (see the format above). */
export function renderRichText(body) {
  const lines = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  const out = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line) {
      i += 1;
      continue;
    }
    const take = (test) => {
      const group = [];
      while (i < lines.length && lines[i] && test(lines[i])) group.push(lines[i++]);
      return group;
    };
    if (isTableLine(line)) out.push(table(take(isTableLine)));
    else if (bulletOf(line) !== undefined)
      out.push(
        `<ul>${take((l) => bulletOf(l) !== undefined)
          .map((l) => `<li>${inline(bulletOf(l))}</li>`)
          .join("")}</ul>`,
      );
    else if (numberedOf(line) !== undefined)
      out.push(
        `<ol>${take((l) => numberedOf(l) !== undefined)
          .map((l) => `<li>${inline(numberedOf(l))}</li>`)
          .join("")}</ol>`,
      );
    else {
      out.push(`<p>${inline(line)}</p>`);
      i += 1;
    }
  }
  return out.join("\n");
}
