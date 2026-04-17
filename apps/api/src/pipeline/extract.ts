/**
 * Split SEC full-submission .txt on <DOCUMENT>…</DOCUMENT> (robust: case-insensitive),
 * pick first TYPE 10-K whose FILENAME looks like primary HTML (.htm/.html).
 *
 * SEC EDGAR often uses **line SGML** inside <DOCUMENT>: `<TYPE>10-K` and `<FILENAME>x.htm`
 * with **no** `</TYPE>` / `</FILENAME>` — values run to the next `<` or newline.
 */
export function extractPrimary10kHtml(raw: string): string {
  const docs = splitDocuments(raw);
  for (const block of docs) {
    const type = extractSecField(block, "TYPE")?.trim();
    if (type !== "10-K") continue;
    const filename = extractSecField(block, "FILENAME")?.trim() ?? "";
    if (!/\.html?$/i.test(filename)) continue;
    const text = extractTextBlock(block);
    if (text && text.includes("<")) {
      return normalizeDisplayHtml(text);
    }
  }
  for (const block of docs) {
    const type = extractSecField(block, "TYPE")?.trim();
    if (type !== "10-K") continue;
    const text = extractTextBlock(block);
    if (text && (text.includes("<html") || text.includes("<HTML"))) {
      return normalizeDisplayHtml(text);
    }
  }
  throw new Error("Could not find primary 10-K HTML document in submission");
}

/**
 * Inline XBRL filings wrap the real document as:
 * `<TEXT><XBRL><?xml ...?><html>...</html></TEXT>`
 * Serving the full TEXT fragment makes browsers treat `<XBRL>` as a custom
 * element and expose hidden ix: metadata as visible noise. Keep only the
 * standard HTML document for storage and iframe display.
 */
export function normalizeDisplayHtml(s: string): string {
  const t = s.trim();
  if (!/<html[\s>]/i.test(t)) {
    return t;
  }
  const start = t.search(/<html[\s>]/i);
  const lower = t.toLowerCase();
  const end = lower.lastIndexOf("</html>");
  if (end === -1 || end < start) {
    return t;
  }
  return t.slice(start, end + "</html>".length);
}

const docRe = /<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/gi;

function splitDocuments(raw: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = docRe.exec(raw)) !== null) {
    out.push(m[1]);
  }
  if (out.length === 0) {
    throw new Error("No <DOCUMENT> blocks found");
  }
  return out;
}

/**
 * SEC line-style `<TAG>value` (no closing tag) or XML-style `<TAG>value</TAG>`.
 * Value is non-newline, non-`<` run after optional whitespace.
 */
function extractSecField(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>\\s*([^\\n<]+)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

/**
 * SEC wraps the main filing in <TEXT>…</TEXT>. A non-greedy regex stops at the
 * first `</TEXT>` (case-insensitive), but Inline XBRL/HTML contains many
 * lowercase `</text>` (e.g. SVG). Use the **last** closing tag in the block.
 */
function extractTextBlock(block: string): string | null {
  const open = /<TEXT>/i.exec(block);
  if (!open || open.index === undefined) return null;
  const start = open.index + open[0].length;
  const re = /<\/TEXT>/gi;
  let lastIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    lastIdx = m.index;
  }
  if (lastIdx < start) return null;
  return block.slice(start, lastIdx).trim();
}
