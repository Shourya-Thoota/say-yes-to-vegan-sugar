import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../lib/csv";

describe("csvCell", () => {
  it("escapes quotes, commas, and newlines", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("neutralizes formula injection", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe('"\'=SUM(A1:A2)"');
    expect(csvCell("+123")).toBe('"\'+123"');
    expect(csvCell("@evil")).toBe('"\'@evil"');
    expect(csvCell("-5")).toBe('"\'-5"');
    expect(csvCell("safe")).toBe("safe");
  });
});

describe("toCsv", () => {
  it("builds a BOM-prefixed CSV with headers", () => {
    const out = toCsv(["a", "b"], [{ a: "x", b: "=cmd" }]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("a,b");
    expect(out).toContain("'=cmd");
  });
});
