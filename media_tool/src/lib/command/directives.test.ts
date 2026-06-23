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

  it("parses generate and text commands", () => {
    expect(parseDirectiveInput("@generate sticker cracked vinyl skull")).toEqual({
      kind: "generate",
      variant: "sticker",
      prompt: "cracked vinyl skull",
    });
    expect(parseDirectiveInput("@generate image smoky arena crowd")).toEqual({
      kind: "generate",
      variant: "image",
      prompt: "smoky arena crowd",
    });
    expect(parseDirectiveInput("@text add Rock N Roll")).toEqual({
      kind: "text",
      action: "add",
      value: "Rock N Roll",
    });
    expect(parseDirectiveInput("@text animate word_reveal")).toEqual({
      kind: "text",
      action: "animate",
      value: "word_reveal",
    });
    expect(parseDirectiveInput("@text size xl")).toEqual({
      kind: "text",
      action: "size",
      value: "xl",
    });
    expect(parseDirectiveInput("@text size xxl")).toEqual({
      kind: "text",
      action: "size",
      value: "xxl",
    });
    expect(parseDirectiveInput("@text clear")).toEqual({
      kind: "text",
      action: "clear",
      value: undefined,
    });
    expect(parseDirectiveInput("@sticker clear")).toEqual({
      kind: "sticker",
      action: "clear",
      value: undefined,
    });
    expect(parseDirectiveInput("@overlay add 2")).toEqual({
      kind: "sticker",
      action: "add",
      value: "2",
    });
    expect(parseDirectiveInput("@sticker place top_right")).toEqual({
      kind: "sticker",
      action: "place",
      value: "top_right",
    });
  });

  it("parses render ranges", () => {
    expect(parseDirectiveInput("@render 0")).toEqual({
      kind: "render",
      command: { action: "start", from: "m000", to: "m000", quality: "preview" },
    });
    expect(parseDirectiveInput("@render 1 2")).toEqual({
      kind: "render",
      command: { action: "start", from: "m001", to: "m002", quality: "preview" },
    });
    expect(parseDirectiveInput("@render all")).toEqual({
      kind: "render",
      command: { action: "startAll", quality: "preview" },
    });
    expect(parseDirectiveInput("@render final all")).toEqual({
      kind: "render",
      command: { action: "startAll", quality: "full" },
    });
  });

  it("parses help topics", () => {
    expect(parseDirectiveInput("@help effects")).toEqual({
      kind: "helpTopic",
      topic: "effects",
    });
    expect(parseDirectiveInput("@help mode")).toEqual({
      kind: "helpTopic",
      topic: "mode",
    });
    expect(parseDirectiveInput("@help render")).toEqual({
      kind: "helpTopic",
      topic: "render",
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
    expect(parseDirectiveInput("@help overlay")).toEqual({
      kind: "helpTopic",
      topic: "sticker",
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

  it("parses bing search", () => {
    expect(parseDirectiveInput("@search bing steampunk guitar")).toEqual({
      kind: "search",
      engine: "bing",
      query: "steampunk guitar",
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
