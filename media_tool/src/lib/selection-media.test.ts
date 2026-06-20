import { describe, expect, it } from "vitest";
import { parseInpointArg } from "./selection-media";

describe("parseInpointArg", () => {
  it("parses seconds", () => {
    expect(parseInpointArg("45")).toBe(45);
    expect(parseInpointArg("12.5")).toBe(12.5);
  });

  it("parses m:ss", () => {
    expect(parseInpointArg("1:23.4")).toBe(83.4);
    expect(parseInpointArg("0:05")).toBe(5);
  });

  it("parses keywords", () => {
    expect(parseInpointArg("playhead")).toBe("playhead");
    expect(parseInpointArg("clear")).toBe("clear");
  });

  it("rejects invalid input", () => {
    expect(parseInpointArg("1:65")).toBeNull();
    expect(parseInpointArg("nope")).toBeNull();
  });
});
