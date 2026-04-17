import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { decodeHTML } from "entities";

export function scrubHtmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  $("table").each((_, el) => {
    const md = tableToMarkdown($, el);
    $(el).replaceWith(`\n\n${md}\n\n`);
  });

  $("br").replaceWith("\n");
  $("p, div, li, h1, h2, h3, h4, h5, h6, tr").each((_, el) => {
    $(el).append("\n");
  });

  let text = $("body").length ? $("body").text() : $.root().text();
  text = decodeHTML(text);
  text = text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function tableToMarkdown($: cheerio.CheerioAPI, table: Element): string {
  const rows: string[][] = [];
  $(table)
    .find("tr")
    .each((_, tr) => {
      const cells: string[] = [];
      $(tr)
        .find("th,td")
        .each((_, cell) => {
          const t = normalizeCell($(cell).text());
          cells.push(t);
        });
      if (cells.length) rows.push(cells);
    });
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => {
    while (r.length < width) r.push("");
    return r;
  };
  const normalized = rows.map(pad);
  const header = normalized[0];
  const sep = header.map(() => "---");
  const lines = [
    "| " + header.join(" | ") + " |",
    "| " + sep.join(" | ") + " |",
    ...normalized.slice(1).map((r) => "| " + r.join(" | ") + " |"),
  ];
  return lines.join("\n");
}

function normalizeCell(s: string): string {
  return decodeHTML(s.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim());
}
