/** "€ 3,99". */
export const formatPrice = (n: number): string =>
  `€ ${n.toFixed(2).replace(".", ",")}`;
