import { BASE_URL, USER_AGENT } from "./config";

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "it-IT,it;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

export const collapseSpaces = (s: string): string => s.replace(/\s+/g, " ").trim();

export const normalize = (s: string): string => collapseSpaces(s).toLowerCase();

export const slugify = (s: string): string =>
  normalize(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function absoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return new URL(href, `${BASE_URL}/`).toString();
}
