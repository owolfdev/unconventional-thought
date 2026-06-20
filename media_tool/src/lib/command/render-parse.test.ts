import { describe, expect, it } from "vitest";
import { parseRenderRange, renderRangeLabel } from "./render-parse";

describe("parseRenderRange", () => {
  it("normalizes single cue", () => {
    expect(parseRenderRange(["0"])).toEqual({ from: "m000", to: "m000" });
    expect(parseRenderRange(["22"])).toEqual({ from: "m022", to: "m022" });
  });

  it("normalizes cue span", () => {
    expect(parseRenderRange(["1", "2"])).toEqual({
      from: "m001",
      to: "m002",
    });
  });

  it("returns usage on bad input", () => {
    expect(typeof parseRenderRange([])).toBe("string");
  });
});

describe("renderRangeLabel", () => {
  it("formats single and span labels", () => {
    expect(renderRangeLabel("m000", "m000")).toBe("0");
    expect(renderRangeLabel("m001", "m002")).toBe("1–2");
  });
});
