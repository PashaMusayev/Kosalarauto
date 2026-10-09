export function buildWhatsappInquiry(vehicleMainTitle: string, price: string, link: string): string {
  const pricePart = price && price !== '0' ? ` – ${price} AZN` : '';
  return encodeURIComponent(`Salam! ${vehicleMainTitle}${pricePart} elanı ilə maraqlanıram.\n${link}`);
}
