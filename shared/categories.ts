// Flyer categories offered by the app, shared by the API server and the client.

export const BASE_URL = "https://www.doveconviene.it";

export interface Category {
  name: string;
  url: string;
}

export const CATEGORIES: Category[] = [
  { name: "Iper & Super", url: `${BASE_URL}/iper-e-super` },
  { name: "Discount", url: `${BASE_URL}/discount` },
  { name: "Cura casa & corpo", url: `${BASE_URL}/cura-casa-e-corpo` },
];
