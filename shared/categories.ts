// dc's flyer categories, shared by the API server and the client.
export const BASE_URL = "https://www.doveconviene.it";

export interface Category {
  name: string;
  url: string;
}

const category = (slug: string, name: string): Category => ({
  name,
  url: `${BASE_URL}/${slug}`,
});

/** All dc categories with retailers, groceries first, with dc's names. */
export const CATEGORIES: Category[] = [
  category("iper-e-super", "Iper e super"),
  category("discount", "Discount"),
  category("cura-casa-e-corpo", "Cura casa e corpo"),
  category("elettronica", "Elettronica"),
  category("arredamento", "Arredamento"),
  category("bricolage", "Bricolage"),
  category("sport-e-moda", "Sport e Moda"),
  category("infanzia-e-giochi", "Infanzia e giochi"),
  category("animali", "Animali"),
  category("salute-e-benessere", "Salute e Benessere"),
  category("motori", "Motori"),
  category("viaggi", "Viaggi"),
  category("ristoranti", "Ristoranti"),
  category("banche-e-assicurazioni", "Banche e Assicurazioni"),
  category("servizi", "Servizi"),
  category("novita", "Novità"),
];

/** "iper-e-super" for …/iper-e-super (also for categories saved in presets). */
export const categorySlug = (c: Category): string =>
  c.url.replace(/\/+$/, "").split("/").pop()!;

export const categoryBySlug = (slug: string): Category | undefined =>
  CATEGORIES.find((c) => categorySlug(c) === slug);
