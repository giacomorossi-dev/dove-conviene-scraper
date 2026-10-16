import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "@shared/categories";
import { applyLine, IDLE, lineSplitter, progress, started } from "./search";

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

  test("the total of flyers to read is known once the server says it", () => {
    expect(started().total).toBeNull();
    expect(applyLine(started(), JSON.stringify({ total: 12 })).total).toBe(12);
  });

  test("progress counts flyers read and flyers dc didn't give", () => {
    let s = applyLine(started(), JSON.stringify({ total: 3 }));
    s = applyLine(s, JSON.stringify({ flyer }));
    s = applyLine(
      s,
      JSON.stringify({ flyerError: { name: "Coop", url: "", error: "x" } })
    );
    expect(progress(s)).toEqual({ done: 2, total: 3 });
  });

  test("starting a search starts from scratch", () => {
    expect(started()).toEqual({ ...IDLE, phase: "running" });
  });
});
