import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "@shared/categories";
import { applyLine, IDLE, lineSplitter, started } from "./search";

describe("lineSplitter", () => {
  test("lines split across chunks are put back together; blank lines dropped", () => {
    const lines = lineSplitter();
    expect(lines.push('{"a":')).toEqual([]);
    expect(lines.push('1}\n\n{"b":2}\n{"c"')).toEqual(['{"a":1}', '{"b":2}']);
    expect(lines.push(":3}")).toEqual([]);
    expect(lines.end()).toEqual(['{"c":3}']);
    expect(lines.end()).toEqual([]);
  });
});

describe("applyLine", () => {
  const flyer = {
    name: "Conad",
    imageUrl: "",
    category: CATEGORIES[0],
    products: [{ name: "Latte", imageUrl: null, price: 1 }],
  };

  test("a flyer read adds its results and counts as read", () => {
    const s = applyLine(started(), JSON.stringify({ flyer }));
    expect(s.results).toEqual([flyer]);
    expect(s.flyersRead).toBe(1);
  });

  test("a flyer dc didn't give is listed as unread, not counted as read", () => {
    const s = applyLine(
      started(),
      JSON.stringify({ flyerError: { name: "Coop", url: "", error: "404" } })
    );
    expect(s.flyersRead).toBe(0);
    expect(s.unread).toEqual(["Coop"]);
  });

  test("other errors are kept; malformed lines change nothing", () => {
    const s = applyLine(
      started(),
      JSON.stringify({ error: "Categoria non letta" })
    );
    expect(s.errors).toEqual(["Categoria non letta"]);
    expect(applyLine(s, "{oops")).toBe(s);
  });

  test("starting a search starts from scratch", () => {
    expect(started()).toEqual({ ...IDLE, phase: "running" });
  });
});
