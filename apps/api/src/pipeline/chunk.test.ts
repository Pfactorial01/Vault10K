import { describe, expect, it } from "vitest";
import { recursiveChunk } from "./chunk";

describe("recursiveChunk", () => {
  it("splits with overlap", () => {
    const text = "a".repeat(100);
    const chunks = recursiveChunk(text, 40, 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text.length).toBeLessThanOrEqual(40);
  });
});
