/** Map Item codes to short labels for UI / RAG. */
const ITEM_LABELS: Record<string, string> = {
  "1": "Business",
  "1A": "Risk Factors",
  "1B": "Unresolved Staff Comments",
  "1C": "Cybersecurity",
  "2": "Properties",
  "3": "Legal Proceedings",
  "4": "Mine Safety",
  "5": "Market for Registrant",
  "6": "Reserved",
  "7": "MD&A",
  "7A": "Market Risk Disclosures",
  "8": "Financial Statements",
  "9": "Changes in Accountants",
  "9A": "Controls and Procedures",
  "9B": "Other Information",
  "9C": "Foreign Jurisdictions",
  "10": "Directors and Officers",
  "11": "Executive Compensation",
  "12": "Security Ownership",
  "13": "Certain Relationships",
  "14": "Principal Accountant",
  "15": "Exhibits",
};

const itemHeaderRe =
  /(?:^|\n)\s*(?:ITEM|Item)\s+(\d{1,2}[A-C]?)\s*[.:]\s*([^\n]{0,120})/gm;

export type SectionSpan = { start: number; end: number; item: string; label: string };

export function detectItemSections(text: string): SectionSpan[] {
  const spans: SectionSpan[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(itemHeaderRe.source, "gim");
  while ((m = re.exec(text)) !== null) {
    const item = m[1].toUpperCase();
    const label = ITEM_LABELS[item] ?? m[2]?.trim() ?? `Item ${item}`;
    spans.push({ start: m.index, end: text.length, item, label });
  }
  if (spans.length === 0) return [];
  for (let i = 0; i < spans.length; i++) {
    spans[i].end = i + 1 < spans.length ? spans[i + 1].start : text.length;
  }
  return spans;
}

export function sectionAtOffset(
  spans: SectionSpan[],
  offset: number
): { item: string; label: string } {
  for (const s of spans) {
    if (offset >= s.start && offset < s.end) {
      return { item: s.item, label: s.label };
    }
  }
  return { item: "", label: "Unknown" };
}
