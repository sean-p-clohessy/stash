export type Product = {
  id: string;
  name: string;
  brand: string;
  variant: string;
  category: "Drinks" | "Snacks" | "Household";
  barcode: string;
  unitQuantity: number;
  measurement: string;
  unit: string;
  color: string;
  art: "can" | "box" | "roll";
  history: number[];
};
export type Retailer = {
  id: string;
  name: string;
  color: string;
  loyalty?: string;
  online: boolean;
  deliveryPence: number;
};
export type Offer = {
  id: string;
  productId: string;
  retailerId: string;
  title: string;
  packSize: number;
  pricePence: number;
  loyalty?: string;
};
export type Comparison = {
  retailer: Retailer;
  items: { offer: Offer; count: number }[];
  units: number;
  totalPence: number;
  unitPence: number;
  excess: number;
};
export type StashItem = {
  productId: string;
  current: number;
  target: number;
  monthly: number;
  maximum: number;
  alertPence: number;
  alertEnabled: boolean;
};
