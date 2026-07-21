export type PropertyType =
  | "APARTMENT"
  | "HOUSE"
  | "LAND"
  | "VILLA"
  | "OFFICE"
  | "OTHER";

export type PropertyStatus =
  | "AVAILABLE"
  | "COMING_SOON"
  | "DEPOSITED"
  | "HIDDEN";

export type PropertyImage = {
  id?: number;
  url: string;
  alt?: string | null;
  sortOrder?: number;
};

export type Property = {
  id: number;
  title: string;
  description?: string | null;
  type: PropertyType;
  status: PropertyStatus;
  price: string;
  area: string;
  address: string;
  city: string;
  district: string;
  ward?: string | null;
  bedroom?: number | null;
  bathroom?: number | null;
  floor?: number | null;
  regionId?: number | null;
  images: PropertyImage[];
  createdAt: string;
  updatedAt: string;
};

export type PropertyListResponse = {
  data: Property[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type PropertyMutationResponse = {
  message: string;
  property?: Property;
  propertyId?: number;
};

export const PROPERTY_TYPES: PropertyType[] = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "VILLA",
  "OFFICE",
  "OTHER"
];

export const PROPERTY_STATUSES: PropertyStatus[] = [
  "AVAILABLE",
  "COMING_SOON",
  "DEPOSITED",
  "HIDDEN"
];

export function formatMoney(value: string | number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return `${value} VND`;
  }

  return new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(numberValue);
}

export function formatStatus(status: PropertyStatus) {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}
