import { describe, expect, it } from "vitest";
import {
  formatCueLabel,
  formatCuePositionLabel,
  isPrerollCue,
  normalizeCueId,
} from "./cue-id";

describe("normalizeCueId", () => {
  it("pads to m###", () => {
    expect(normalizeCueId("0")).toBe("m000");
    expect(normalizeCueId("22")).toBe("m022");
    expect(normalizeCueId("m22")).toBe("m022");
  });
});

describe("formatCueLabel", () => {
  it("strips leading zeros", () => {
    expect(formatCueLabel("m022")).toBe("22");
    expect(formatCueLabel("m000")).toBe("0");
  });
});

describe("formatCuePositionLabel", () => {
  it("shows preroll for cue 0", () => {
    expect(formatCuePositionLabel({ cue: 0 }, 9)).toBe("preroll");
  });

  it("shows cue number over total for content cues", () => {
    expect(formatCuePositionLabel({ cue: 1 }, 9)).toBe("1/9");
    expect(formatCuePositionLabel({ cue: 8 }, 9)).toBe("8/9");
  });
});

describe("isPrerollCue", () => {
  it("is true only for cue 0", () => {
    expect(isPrerollCue({ cue: 0 })).toBe(true);
    expect(isPrerollCue({ cue: 1 })).toBe(false);
  });
});
