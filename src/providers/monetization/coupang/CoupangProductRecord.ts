export interface CoupangProductRecord {
  id: string;
  productName: string;
  productDescription?: string;
  categoryName?: string;
  keywords: string[];
  brandName?: string;
  priceAmount?: number;
  currency?: string;
  rating?: number;
  imageUrl?: string;
  productUrl?: string;
  coupangProductId: string;
  mockUri: string;
}

export interface CoupangProductSearchResponse {
  products: CoupangProductRecord[];
}
