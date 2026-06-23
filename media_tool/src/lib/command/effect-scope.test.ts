import { describe, expect, it } from "vitest";
import type { MediaToolItem } from "@/lib/types";
import {
  itemsForEffectScope,
  parseEffectScope,
} from "./effect-scope";
import { parseDirectiveInput } from "./directives";

const items: MediaToolItem[] = [
  {
    id: "m000",
    cue: 0,
    t_start: 0,
    t_end: 2,
    duration_sec: 2,
    spoken: "",
    visual_mode: "text_graphic",
    text_graphic: null,
    artifact: null,
    editorial_intent: "",
    people: [],
    situation: "",
    date_from: "",
    date_to: "",
    location: "",
    search_queries: [],
    avoid: [],
    media_type: "generated",
    reuse_id: "",
    priority: "low",
  },
  {
    id: "m001",
    cue: 1,
    t_start: 2,
    t_end: 6,
    duration_sec: 4,
    spoken: "one",
    visual_mode: "historical",
    text_graphic: null,
    artifact: null,
    editorial_intent: "",
    people: [],
    situation: "",
    date_from: "",
    date_to: "",
    location: "",
    search_queries: [],
    avoid: [],
    media_type: "photo",
    reuse_id: "",
    priority: "low",
  },
  {
    id: "m002",
    cue: 2,
    t_start: 6,
    t_end: 10,
    duration_sec: 4,
    spoken: "two",
    visual_mode: "historical",
    text_graphic: null,
    artifact: null,
    editorial_intent: "",
    people: [],
    situation: "",
    date_from: "",
    date_to: "",
    location: "",
    search_queries: [],
    avoid: [],
    media_type: "photo",
    reuse_id: "",
    priority: "low",
  },
  {
    id: "m010",
    cue: 10,
    t_start: 40,
    t_end: 44,
    duration_sec: 4,
    spoken: "ten",
    visual_mode: "historical",
    text_graphic: null,
    artifact: null,
    editorial_intent: "",
    people: [],
    situation: "",
    date_from: "",
    date_to: "",
    location: "",
    search_queries: [],
    avoid: [],
    media_type: "photo",
    reuse_id: "",
    priority: "low",
  },
];

describe("parseEffectScope", () => {
  it("parses current, bulk, range, and single-cue forms", () => {
    expect(parseEffectScope("film_scratches")).toEqual({
      scope: { type: "current" },
      effectRaw: "film_scratches",
    });
    expect(parseEffectScope("all film_grain")).toEqual({
      scope: { type: "all" },
      effectRaw: "film_grain",
    });
    expect(parseEffectScope("even film_scratches")).toEqual({
      scope: { type: "even" },
      effectRaw: "film_scratches",
    });
    expect(parseEffectScope("odd film_damage")).toEqual({
      scope: { type: "odd" },
      effectRaw: "film_damage",
    });
    expect(parseEffectScope("000 010 film_scratches")).toEqual({
      scope: { type: "range", fromId: "m000", toId: "m010" },
      effectRaw: "film_scratches",
    });
    expect(parseEffectScope("8 film_grain")).toEqual({
      scope: { type: "cue", cueId: "m008" },
      effectRaw: "film_grain",
    });
  });
});

describe("itemsForEffectScope", () => {
  it("selects even, odd, range, and single cues", () => {
    expect(itemsForEffectScope(items, { type: "all" }).map((it) => it.id)).toEqual([
      "m000",
      "m001",
      "m002",
      "m010",
    ]);
    expect(itemsForEffectScope(items, { type: "even" }).map((it) => it.id)).toEqual([
      "m000",
      "m002",
      "m010",
    ]);
    expect(itemsForEffectScope(items, { type: "odd" }).map((it) => it.id)).toEqual([
      "m001",
    ]);
    expect(
      itemsForEffectScope(items, {
        type: "range",
        fromId: "m001",
        toId: "m002",
      }).map((it) => it.id),
    ).toEqual(["m001", "m002"]);
    expect(
      itemsForEffectScope(items, { type: "cue", cueId: "m010" }).map(
        (it) => it.id,
      ),
    ).toEqual(["m010"]);
  });
});

describe("parseDirectiveInput effect bulk", () => {
  it("parses scoped effect directives", () => {
    expect(parseDirectiveInput("@effect add film_scratches")).toEqual({
      kind: "effect",
      action: "add",
      id: "film_scratches",
      scope: { type: "current" },
    });
    expect(parseDirectiveInput("@effect remove all film_grain")).toEqual({
      kind: "effect",
      action: "remove",
      id: "film_grain",
      scope: { type: "all" },
    });
    expect(parseDirectiveInput("@effect add 0 10 film_scratches")).toEqual({
      kind: "effect",
      action: "add",
      id: "film_scratches",
      scope: { type: "range", fromId: "m000", toId: "m010" },
    });
  });
});
