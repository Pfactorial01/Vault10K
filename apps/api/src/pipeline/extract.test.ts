import { describe, expect, it } from "vitest";
import { extractPrimary10kHtml } from "./extract";

const fixture = `
<DOCUMENT>
<TYPE>GRAPHIC</TYPE>
<TEXT>skip</TEXT>
</DOCUMENT>
<DOCUMENT>
<TYPE>10-K</TYPE>
<FILENAME>report.htm</FILENAME>
<TEXT>
<html><body><p>Item 1. Business</p><p>Hello</p></body></html>
</TEXT>
</DOCUMENT>
`;

describe("extractPrimary10kHtml", () => {
  it("selects first 10-K htm document body", () => {
    const html = extractPrimary10kHtml(fixture);
    expect(html).toContain("Item 1.");
    expect(html).toContain("<html>");
  });

  it("parses SEC line-style TYPE/FILENAME without closing tags (real EDGAR)", () => {
    const secStyle = `
<DOCUMENT>
<TYPE>10-K
<FILENAME>nvda-20240128.htm
<TEXT>
<html><body><p>SEC line SGML</p></body></html>
</TEXT>
</DOCUMENT>
`;
    const html = extractPrimary10kHtml(secStyle);
    expect(html).toContain("SEC line SGML");
    expect(html).toContain("<html>");
  });

  it("uses last </TEXT> when inline SVG has </text> before <html>", () => {
    const inlineSvg = `
<DOCUMENT>
<TYPE>10-K</TYPE>
<FILENAME>r.htm</FILENAME>
<TEXT>
<XBRL>
<svg><text>Hi</text></svg>
<html><body><p>Item 1. Real body</p></body></html>
</TEXT>
</DOCUMENT>
`;
    const html = extractPrimary10kHtml(inlineSvg);
    expect(html).toContain("Item 1. Real body");
    expect(html).toMatch(/^<html/i);
    expect(html).not.toContain("<XBRL>");
    expect(html).not.toContain("<svg>");
  });

  it("strips XBRL wrapper and keeps only inner html document (inline XBRL)", () => {
    const wrapped = `
<DOCUMENT>
<TYPE>10-K
<FILENAME>co-10k.htm
<TEXT>
<XBRL>
<?xml version="1.0" encoding="ASCII"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Readable body</p></body></html>
</TEXT>
</DOCUMENT>
`;
    const html = extractPrimary10kHtml(wrapped);
    expect(html).toBe(
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Readable body</p></body></html>'
    );
    expect(html).not.toContain("XBRL");
  });
});
