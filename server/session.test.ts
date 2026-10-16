// The dc session's cookie jar, with a fake dc (no request leaves).
import { afterEach, expect, test } from "bun:test";
import { BASE_URL } from "../shared/categories";
import { dcPacing } from "./http";
import { openPlaceSession } from "./session";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  dcPacing.minGap = 300;
});

test("keeps dc's cookies, drops expired ones and ignores malformed ones", async () => {
  dcPacing.minGap = 0;
  const sentCookies: string[] = [];
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = String(input);
    sentCookies.push(new Headers(init?.headers).get("cookie") ?? "");
    const headers = new Headers();
    if (url === `${BASE_URL}/`) {
      headers.append("set-cookie", "PHPSESSID=abc; path=/");
      headers.append("set-cookie", "old=1; path=/");
      headers.append("set-cookie", "broken; path=/");
    } else if (url.endsWith("/Users/changePosition")) {
      headers.append("set-cookie", "dc[User]=pos; path=/");
      headers.append("set-cookie", "old=; Max-Age=0; path=/");
    }
    return new Response("<html></html>", { headers });
  }) as unknown as typeof fetch;

  const session = await openPlaceSession({
    name: "Rimini",
    zip: null,
    lat: 44,
    lng: 12,
  });
  await session.fetchHtml(`${BASE_URL}/iper-e-super`);
  expect(sentCookies.at(-1)).toBe("PHPSESSID=abc; dc[User]=pos");
});
