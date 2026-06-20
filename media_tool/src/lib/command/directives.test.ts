import { describe, expect, it } from "vitest";
import { parseDirectiveInput } from "./directives";

describe("parseDirectiveInput", () => {
  it("parses navigation and meta commands", () => {
    expect(parseDirectiveInput("@help")).toEqual({ kind: "help" });
    expect(parseDirectiveInput("@clear")).toEqual({ kind: "clear" });
    expect(parseDirectiveInput("@next")).toEqual({
      kind: "navigate",
      target: "next",
    });
    expect(parseDirectiveInput("@prev")).toEqual({
      kind: "navigate",
      target: "prev",
    });
    expect(parseDirectiveInput("@cue 22")).toEqual({
      kind: "navigate",
      target: "cue",
      cueId: "m022",
    });
  });

  it("parses mode and play", () => {
    expect(parseDirectiveInput("@mode")).toEqual({ kind: "mode" });
    expect(parseDirectiveInput("@mode effect_only")).toEqual({
      kind: "mode",
      set: "effect_only",
    });
    expect(parseDirectiveInput("@play")).toEqual({ kind: "play" });
    expect(parseDirectiveInput("@play loop 5")).toEqual({
      kind: "play",
      loopCount: 5,
    });
    expect(parseDirectiveInput("@play loop")).toEqual({
      kind: "play",
      loopCount: null,
    });
  });

  it("parses render ranges", () => {
    expect(parseDirectiveInput("@render 0")).toEqual({
      kind: "render",
      args: ["0"],
    });
    expect(parseDirectiveInput("@render 1 2")).toEqual({
      kind: "render",
      args: ["1", "2"],
    });
  });

  it("parses help topics", () => {
    expect(parseDirectiveInput("@help effects")).toEqual({
      kind: "helpTopic",
      topic: "effects",
    });
    expect(parseDirectiveInput("@help mode")).toEqual({
      kind: "helpTopic",
      topic: "modes",
    });
  });

  it("parses inpoint", () => {
    expect(parseDirectiveInput("@inpoint")).toEqual({ kind: "inpoint" });
    expect(parseDirectiveInput("@inpoint 45")).toEqual({
      kind: "inpoint",
      arg: "45",
    });
    expect(parseDirectiveInput("@inpoint playhead")).toEqual({
      kind: "inpoint",
      arg: "playhead",
    });
    expect(parseDirectiveInput("@inpoint 1:23.4")).toEqual({
      kind: "inpoint",
      arg: "1:23.4",
    });
  });

  it("returns unknown for bad directives and NL", () => {
    expect(parseDirectiveInput("@nope")).toEqual({
      kind: "unknown",
      raw: "@nope",
    });
    expect(parseDirectiveInput("search bon")).toEqual({
      kind: "unknown",
      raw: "search bon",
    });
  });
});
