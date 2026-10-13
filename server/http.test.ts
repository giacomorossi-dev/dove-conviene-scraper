import { describe, expect, test } from "bun:test";
import { absoluteUrl, collapseSpaces, normalize, slugify } from "./http";

describe("collapseSpaces / normalize", () => {
  test("collapses whitespace and trims", () => {
    expect(collapseSpaces("  Latte \n\t intero  ")).toBe("Latte intero");
  });

  test("normalize also lowercases", () => {
    expect(normalize("  Burro  DI Montagna ")).toBe("burro di montagna");
  });
});

describe("slugify", () => {
  test.each([
    ["Rimini", "rimini"],
    ["Forlì", "forli"],
    ["Reggio nell'Emilia", "reggio-nell-emilia"],
    ["Iper & Super", "iper-e-super"],
    ["  Cura casa & corpo  ", "cura-casa-e-corpo"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("absoluteUrl", () => {
  test("resolves site-relative paths against doveconviene.it", () => {
    expect(absoluteUrl("/rimini/iper-e-super")).toBe(
      "https://www.doveconviene.it/rimini/iper-e-super"
    );
  });

  test("adds https to protocol-relative URLs", () => {
    expect(absoluteUrl("//cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png"
    );
  });

  test("keeps absolute URLs untouched", () => {
    expect(absoluteUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});
