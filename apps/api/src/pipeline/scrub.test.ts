import { describe, expect, it } from "vitest";
import { scrubHtmlToText } from "./scrub";

describe("scrubHtmlToText", () => {
  it("converts a simple table to markdown-like text", () => {
    const html =
      "<html><body><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>";
    const t = scrubHtmlToText(html);
    expect(t).toContain("| A | B |");
    expect(t).toContain("| --- | --- |");
    expect(t).toContain("| 1 | 2 |");
  });
});
