import { describe, expect, it } from "vitest";
import {
  formatHelpTopic,
  formatUnknownHelpTopic,
  resolveHelpTopic,
} from "./help-topics";
import { parseDirectiveInput } from "./directives";

describe("resolveHelpTopic", () => {
  it("resolves aliases to canonical topics", () => {
    expect(resolveHelpTopic("render")).toBe("render");
    expect(resolveHelpTopic("renders")).toBe("render");
    expect(resolveHelpTopic("generate")).toBe("generate");
    expect(resolveHelpTopic("overlay")).toBe("sticker");
    expect(resolveHelpTopic("overlays")).toBe("sticker");
    expect(resolveHelpTopic("title")).toBe("text");
    expect(resolveHelpTopic("effect")).toBe("effects");
    expect(resolveHelpTopic("modes")).toBe("mode");
    expect(resolveHelpTopic("nav")).toBe("cue");
    expect(resolveHelpTopic("nope")).toBeNull();
  });
});

describe("formatHelpTopic render", () => {
  it("includes render list and load commands", () => {
    const text = formatHelpTopic("render");
    expect(text).toContain("@render list preview");
    expect(text).toContain("@render load");
    expect(text).toContain("@render delete preview all");
  });
});

describe("parseDirectiveInput help topics", () => {
  it("parses @help and @help render", () => {
    expect(parseDirectiveInput("@help").kind).toBe("help");
    expect(parseDirectiveInput("@help render")).toEqual({
      kind: "helpTopic",
      topic: "render",
    });
    expect(parseDirectiveInput("@help effects")).toEqual({
      kind: "helpTopic",
      topic: "effects",
    });
    expect(parseDirectiveInput("@help mode")).toEqual({
      kind: "helpTopic",
      topic: "mode",
    });
    expect(parseDirectiveInput("@help text")).toEqual({
      kind: "helpTopic",
      topic: "text",
    });
    expect(parseDirectiveInput("@help generate")).toEqual({
      kind: "helpTopic",
      topic: "generate",
    });
    expect(parseDirectiveInput("@help sticker")).toEqual({
      kind: "helpTopic",
      topic: "sticker",
    });
  });

  it("returns unknown with topic list for bad topic", () => {
    const parsed = parseDirectiveInput("@help foo");
    expect(parsed.kind).toBe("unknown");
    if (parsed.kind === "unknown") {
      expect(parsed.raw).toContain("Unknown help topic");
      expect(parsed.raw).toContain("@help render");
    }
  });
});

describe("formatUnknownHelpTopic", () => {
  it("lists available topics", () => {
    expect(formatUnknownHelpTopic("xyz")).toContain("@help search");
  });
});
