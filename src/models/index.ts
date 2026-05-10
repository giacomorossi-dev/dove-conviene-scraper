export const BASE_URL = "https://www.doveconviene.it/";

export interface Flyer {
  name: string;
  imageUrl: string;
  category: Category;
  url?: string;
  products?: Array<Product>;
}

export interface ProductInput {
  name: string;
  price: number;
}

export interface Product {
  name: string;
  imageUrl: string | null;
  price: number | null;
}

export interface Category {
  url: string;
  name: string;
}

export const CATEGORIES: Array<Category> = [
  {
    name: "Iper & Super",
    url: BASE_URL + "iper-e-super",
  },
  {
    name: "Cura casa & corpo",
    url: BASE_URL + "cura-casa-e-corpo",
  },
];

export const FLYERS = [
  {
    name: "Conad",
    imageUrl: "/images/flyer-logo/conad.png",
    category: CATEGORIES[0],
  },
  {
    name: "Spazio Conad",
    imageUrl: "/images/flyer-logo/spazio-conad.png",
    category: CATEGORIES[0],
  },
  {
    name: "Conad Superstore",
    imageUrl: "/images/flyer-logo/conad-superstore.png",
    category: CATEGORIES[0],
  },
  {
    name: "Conad City",
    imageUrl: "/images/flyer-logo/conad-city.png",
    category: CATEGORIES[0],
  },
  {
    name: "Coop",
    imageUrl: "/images/flyer-logo/coop.png",
    category: CATEGORIES[0],
  },
  {
    name: "Acqua & Sapone",
    imageUrl: "/images/flyer-logo/acqua-e-sapone.png",
    category: CATEGORIES[1],
  },
];
