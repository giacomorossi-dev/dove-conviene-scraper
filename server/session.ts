// A dc browsing session positioned at a place, as if a visitor had picked it
// in dc's location panel: dc keeps the position in its encrypted `dc[User]`
// cookie and then serves "nelle vicinanze" pages for it, e.g. /iper-e-super
// with the flyers of the stores closest to that point. Only the coordinates
// pick the flyers; name and zip are just the "Sei qui" label.
import { BASE_URL } from "../shared/categories";
import type { Place } from "../shared/types";
import { BROWSER_HEADERS } from "./http";

export interface PlaceSession {
  fetchHtml(url: string): Promise<string>;
}

export async function openPlaceSession(place: Place): Promise<PlaceSession> {
  const cookies = new Map<string, string>();
  const request = async (url: string, init: RequestInit = {}) => {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      headers: {
        ...BROWSER_HEADERS,
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...init.headers,
      },
    });
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const eq = pair.indexOf("=");
      cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
    return res;
  };

  // The first page view sets the session cookie the position is stored on.
  await request(`${BASE_URL}/`);
  const data = {
    locationSlug: "",
    country: "IT",
    ll: [place.lat, place.lng],
    addressString: `${place.name}, Italia`,
    cityName: place.name,
    zipCode: place.zip ?? "",
    locationStatus: "confirmed",
    changePosition: true,
    currentPath: "/",
  };
  const res = await request(`${BASE_URL}/Users/changePosition`, {
    method: "POST",
    body: new URLSearchParams({ data: JSON.stringify(data) }),
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    },
  });
  if (!res.ok) throw new Error(`changePosition → ${res.status}`);

  return {
    async fetchHtml(url) {
      const page = await request(url);
      if (!page.ok) throw new Error(`GET ${url} → ${page.status}`);
      return page.text();
    },
  };
}
