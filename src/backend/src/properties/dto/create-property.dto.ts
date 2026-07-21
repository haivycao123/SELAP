import { PropertyStatus, PropertyType } from '@prisma/client';
import { PropertyImageInputDto } from './property-image-input.dto';

export class CreatePropertyDto {
  title: string;
  description?: string;
  type: PropertyType;
  status?: PropertyStatus;
  price: number | string;
  area: number | string;
  address: string;
  city: string;
  district: string;
  ward?: string;
  latitude?: number | string;
  longitude?: number | string;
  bedroom?: number | string;
  bathroom?: number | string;
  floor?: number | string;
  regionId?: number | string;
  images?: PropertyImageInputDto[];
}
