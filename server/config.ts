export const BASE_URL = "https://www.doveconviene.it";

export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export interface Category {
  name: string;
  url: string;
}

export const CATEGORIES: Category[] = [
  { name: "Iper & Super", url: `${BASE_URL}/iper-e-super` },
  { name: "Discount", url: `${BASE_URL}/discount` },
  { name: "Cura casa & corpo", url: `${BASE_URL}/cura-casa-e-corpo` },
];
