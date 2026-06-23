import { describe, expect, it } from "vitest";
import { parseRenderCommand } from "./render-command-parse";
import { parseDirectiveInput } from "./directives";

describe("parseRenderCommand", () => {
  it("parses cue start, list, load, and delete forms", () => {
    expect(parseRenderCommand(["0"])).toEqual({
      action: "start",
      from: "m000",
      to: "m000",
      quality: "preview",
    });
    expect(parseRenderCommand(["1", "2"])).toEqual({
      action: "start",
      from: "m001",
      to: "m002",
      quality: "preview",
    });
    expect(parseRenderCommand(["all"])).toEqual({
      action: "startAll",
      quality: "preview",
    });
    expect(parseRenderCommand(["final", "all"])).toEqual({
      action: "startAll",
      quality: "full",
    });
    expect(parseRenderCommand(["final", "0"])).toEqual({
      action: "start",
      from: "m000",
      to: "m000",
      quality: "full",
    });
    expect(parseRenderCommand(["final", "1", "2"])).toEqual({
      action: "start",
      from: "m001",
      to: "m002",
      quality: "full",
    });
    expect(parseRenderCommand(["list"])).toEqual({
      action: "list",
      filter: "all",
    });
    expect(parseRenderCommand(["list", "preview"])).toEqual({
      action: "list",
      filter: "preview",
    });
    expect(parseRenderCommand(["list", "final"])).toEqual({
      action: "list",
      filter: "final",
    });
    expect(parseRenderCommand(["load", "2"])).toEqual({
      action: "load",
      ref: "2",
    });
    expect(parseRenderCommand(["load", "preview-m000"])).toEqual({
      action: "load",
      ref: "preview-m000",
    });
    expect(parseRenderCommand(["delete", "all"])).toEqual({
      action: "delete",
      filter: "all",
      target: "all",
    });
    expect(parseRenderCommand(["delete", "preview", "all"])).toEqual({
      action: "delete",
      filter: "preview",
      target: "all",
    });
    expect(parseRenderCommand(["delete", "2"])).toEqual({
      action: "delete",
      filter: "all",
      target: "2",
    });
  });
});

describe("parseDirectiveInput render", () => {
  it("parses render subcommands", () => {
    expect(parseDirectiveInput("@render 0 1")).toEqual({
      kind: "render",
      command: { action: "start", from: "m000", to: "m001", quality: "preview" },
    });
    expect(parseDirectiveInput("@render all")).toEqual({
      kind: "render",
      command: { action: "startAll", quality: "preview" },
    });
    expect(parseDirectiveInput("@render final all")).toEqual({
      kind: "render",
      command: { action: "startAll", quality: "full" },
    });
    expect(parseDirectiveInput("@render final 0")).toEqual({
      kind: "render",
      command: { action: "start", from: "m000", to: "m000", quality: "full" },
    });
    expect(parseDirectiveInput("@render final 1 2")).toEqual({
      kind: "render",
      command: { action: "start", from: "m001", to: "m002", quality: "full" },
    });
    expect(parseDirectiveInput("@render list preview")).toEqual({
      kind: "render",
      command: { action: "list", filter: "preview" },
    });
    expect(parseDirectiveInput("@render load 2")).toEqual({
      kind: "render",
      command: { action: "load", ref: "2" },
    });
    expect(parseDirectiveInput("@render delete preview all")).toEqual({
      kind: "render",
      command: { action: "delete", filter: "preview", target: "all" },
    });
  });
});
