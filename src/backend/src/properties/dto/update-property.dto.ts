import { PropertyStatus, PropertyType } from '@prisma/client';
import { PropertyImageInputDto } from './property-image-input.dto';

export class UpdatePropertyDto {
  title?: string;
  description?: string | null;
  type?: PropertyType;
  status?: PropertyStatus;
  price?: number | string;
  area?: number | string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  bedroom?: number | string | null;
  bathroom?: number | string | null;
  floor?: number | string | null;
  regionId?: number | string | null;
  images?: PropertyImageInputDto[];
  statusChangeNote?: string;
}
