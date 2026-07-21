import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  PropertyStatus,
  PropertyType,
  Role,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyFilterDto } from './dto/property-filter.dto';
import { PropertyImageInputDto } from './dto/property-image-input.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

const propertyInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  region: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  },
} satisfies Prisma.PropertyInclude;

const allowedPropertyStatuses = [
  PropertyStatus.AVAILABLE,
  PropertyStatus.COMING_SOON,
  PropertyStatus.DEPOSITED,
  PropertyStatus.HIDDEN,
];

const allowedPropertyTypes = [
  PropertyType.APARTMENT,
  PropertyType.HOUSE,
  PropertyType.LAND,
  PropertyType.VILLA,
  PropertyType.OFFICE,
  PropertyType.OTHER,
];

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(filters: PropertyFilterDto) {
    const pagination = this.parsePagination(filters);
    const where = this.buildWhere(filters, false);
    const orderBy = this.buildOrderBy(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: propertyInclude,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.property.count({ where }),
    ]);

    return this.toPagedResponse(items, total, pagination);
  }

  async findForManagement(
    filters: PropertyFilterDto,
    user: AuthenticatedUser,
  ) {
    this.assertCanManageProperties(user);

    const pagination = this.parsePagination(filters);
    const where = await this.applyUserScope(
      this.buildWhere(filters, this.parseBoolean(filters.includeHidden)),
      user,
    );
    const orderBy = this.buildOrderBy(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: propertyInclude,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.property.count({ where }),
    ]);

    return this.toPagedResponse(items, total, pagination);
  }

  async findPublicById(rawId: string) {
    const id = this.parseId(rawId, 'Property id');
    const property = await this.prisma.property.findFirst({
      where: {
        id,
        status: { not: PropertyStatus.HIDDEN },
      },
      include: {
        ...propertyInclude,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    return property;
  }

  async findManageById(rawId: string, user: AuthenticatedUser) {
    this.assertCanManageProperties(user);
    const id = this.parseId(rawId, 'Property id');
    const where = await this.applyUserScope({ id }, user);
    const property = await this.prisma.property.findFirst({
      where,
      include: {
        ...propertyInclude,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or access is denied.');
    }

    return property;
  }

  async create(dto: CreatePropertyDto, user: AuthenticatedUser) {
    this.assertCanManageProperties(user);
    const data = await this.toCreateData(dto, user);
    const { regionId, ...propertyData } = data;

    await this.assertCanAccessRegion(user, regionId ?? null);

    const property = await this.prisma.property.create({
      data: {
        ...propertyData,
        statusHistory: {
          create: {
            newStatus: propertyData.status ?? PropertyStatus.AVAILABLE,
            changedById: user.id,
            note: 'Property created.',
          },
        },
      },
      include: propertyInclude,
    });

    return {
      message: 'Property created successfully.',
      property,
    };
  }

  async update(rawId: string, dto: UpdatePropertyDto, user: AuthenticatedUser) {
    this.assertCanManageProperties(user);
    const id = this.parseId(rawId, 'Property id');
    const property = await this.findManageableProperty(id, user);
    const data = this.toUpdateData(dto);
    const requestedRegionId = data.regionId ?? null;
    const regionIdWasProvided = Object.prototype.hasOwnProperty.call(
      data,
      'regionId',
    );
    const newStatus = data.status as PropertyStatus | undefined;
    const { regionId: _regionId, ...propertyData } = data;

    if (regionIdWasProvided) {
      await this.assertCanAccessRegion(user, requestedRegionId);
    }

    const hasStatusChange = newStatus !== undefined && newStatus !== property.status;

    const updatedProperty = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({
        where: { id },
        data: {
          ...propertyData,
          images: dto.images
            ? {
                deleteMany: {},
                create: this.toImageCreateMany(dto.images),
              }
            : undefined,
          statusHistory: hasStatusChange
            ? {
                create: {
                  oldStatus: property.status,
                  newStatus,
                  changedById: user.id,
                  note: dto.statusChangeNote?.trim() || undefined,
                },
              }
            : undefined,
        },
        include: propertyInclude,
      });

      if (hasStatusChange) {
        const favorites = await tx.favorite.findMany({
          where: { propertyId: id },
          select: { userId: true },
        });

        if (favorites.length > 0) {
          await tx.notification.createMany({
            data: favorites.map((favorite) => ({
              userId: favorite.userId,
              senderId: user.id,
              type: NotificationType.PROPERTY_STATUS_CHANGED,
              title: 'Favorite property status changed',
              message: `The status of ${updated.title} changed to ${newStatus}.`,
              data: {
                propertyId: updated.id,
                oldStatus: property.status,
                newStatus,
              },
            })),
          });
        }
      }

      return updated;
    });

    return {
      message: 'Property updated successfully.',
      property: updatedProperty,
    };
  }

  async remove(rawId: string, user: AuthenticatedUser) {
    this.assertCanManageProperties(user);
    const id = this.parseId(rawId, 'Property id');
    const property = await this.findManageableProperty(id, user);

    await this.prisma.property.delete({
      where: { id },
    });

    return {
      message: 'Property deleted successfully.',
      propertyId: property.id,
    };
  }

  private buildWhere(
    filters: PropertyFilterDto,
    includeHidden: boolean,
  ): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {};
    const and: Prisma.PropertyWhereInput[] = [];

    if (!includeHidden) {
      and.push({ status: { not: PropertyStatus.HIDDEN } });
    }

    if (filters.q?.trim()) {
      const query = filters.q.trim();
      and.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { district: { contains: query, mode: 'insensitive' } },
          { ward: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    const types = this.parseEnumList(
      filters.type,
      allowedPropertyTypes,
      'Property type',
    );
    if (types.length > 0) {
      and.push({ type: { in: types } });
    }

    const statuses = this.parseEnumList(
      filters.status,
      allowedPropertyStatuses,
      'Property status',
    );
    if (statuses.length > 0) {
      and.push({ status: { in: statuses } });
    }

    if (filters.city?.trim()) {
      and.push({ city: { equals: filters.city.trim(), mode: 'insensitive' } });
    }

    if (filters.district?.trim()) {
      and.push({
        district: { equals: filters.district.trim(), mode: 'insensitive' },
      });
    }

    if (filters.ward?.trim()) {
      and.push({ ward: { equals: filters.ward.trim(), mode: 'insensitive' } });
    }

    if (filters.regionId?.trim()) {
      and.push({ regionId: this.parseId(filters.regionId, 'Region id') });
    }

    this.addDecimalRange(and, 'price', filters.minPrice, filters.maxPrice);
    this.addDecimalRange(and, 'area', filters.minArea, filters.maxArea);
    this.addIntRange(and, 'bedroom', filters.minBedroom, filters.maxBedroom);
    this.addIntRange(and, 'bathroom', filters.minBathroom, filters.maxBathroom);
    this.addIntRange(and, 'floor', filters.minFloor, filters.maxFloor);

    if (and.length > 0) {
      where.AND = and;
    }

    return where;
  }

  private buildOrderBy(
    filters: PropertyFilterDto,
  ): Prisma.PropertyOrderByWithRelationInput[] {
    const allowedSortFields = ['createdAt', 'price', 'area', 'title'];
    const sortBy = filters.sortBy?.trim() || 'createdAt';

    if (!allowedSortFields.includes(sortBy)) {
      throw new BadRequestException(
        `sortBy must be one of: ${allowedSortFields.join(', ')}.`,
      );
    }

    const sortOrder = filters.sortOrder?.trim().toLowerCase() || 'desc';

    if (!['asc', 'desc'].includes(sortOrder)) {
      throw new BadRequestException('sortOrder must be asc or desc.');
    }

    return [
      { [sortBy]: sortOrder as Prisma.SortOrder },
      { id: 'desc' },
    ] as Prisma.PropertyOrderByWithRelationInput[];
  }

  private parsePagination(filters: PropertyFilterDto): Pagination {
    const page = this.parseOptionalPositiveInt(filters.page, 'page') ?? 1;
    const limit = this.parseOptionalPositiveInt(filters.limit, 'limit') ?? 20;

    if (limit > 100) {
      throw new BadRequestException('limit must be less than or equal to 100.');
    }

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private toPagedResponse<T>(items: T[], total: number, pagination: Pagination) {
    return {
      data: items,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  private async toCreateData(
    dto: CreatePropertyDto,
    user: AuthenticatedUser,
  ): Promise<Prisma.PropertyCreateInput & { regionId?: number }> {
    this.validateRequiredText(dto.title, 'Title');
    this.validateRequiredText(dto.address, 'Address');
    this.validateRequiredText(dto.city, 'City');
    this.validateRequiredText(dto.district, 'District');

    const type = this.parseEnum(dto.type, allowedPropertyTypes, 'Property type');
    const status = dto.status
      ? this.parseEnum(dto.status, allowedPropertyStatuses, 'Property status')
      : PropertyStatus.AVAILABLE;
    const regionId = this.parseOptionalId(dto.regionId, 'Region id');

    if (user.role === Role.SALES_AGENT && !regionId) {
      throw new BadRequestException('Sales agents must select a region.');
    }

    if (regionId) {
      await this.assertRegionExists(regionId);
    }

    return {
      title: dto.title.trim(),
      description: this.trimOptional(dto.description),
      type,
      status,
      price: this.parseDecimal(dto.price, 'Price'),
      area: this.parseDecimal(dto.area, 'Area'),
      address: dto.address.trim(),
      city: dto.city.trim(),
      district: dto.district.trim(),
      ward: this.trimOptional(dto.ward),
      latitude: this.parseOptionalDecimal(dto.latitude, 'Latitude'),
      longitude: this.parseOptionalDecimal(dto.longitude, 'Longitude'),
      bedroom: this.parseOptionalNonNegativeInt(dto.bedroom, 'Bedroom'),
      bathroom: this.parseOptionalNonNegativeInt(dto.bathroom, 'Bathroom'),
      floor: this.parseOptionalNonNegativeInt(dto.floor, 'Floor'),
      region: regionId ? { connect: { id: regionId } } : undefined,
      regionId,
      createdBy: { connect: { id: user.id } },
      images: dto.images
        ? { create: this.toImageCreateMany(dto.images) }
        : undefined,
    };
  }

  private toUpdateData(
    dto: UpdatePropertyDto,
  ): Prisma.PropertyUpdateInput & { status?: PropertyStatus; regionId?: number } {
    const data: Prisma.PropertyUpdateInput & {
      status?: PropertyStatus;
      regionId?: number;
    } = {};

    if (dto.title !== undefined) {
      this.validateRequiredText(dto.title, 'Title');
      data.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      data.description = this.trimNullable(dto.description);
    }
    if (dto.type !== undefined) {
      data.type = this.parseEnum(dto.type, allowedPropertyTypes, 'Property type');
    }
    if (dto.status !== undefined) {
      data.status = this.parseEnum(
        dto.status,
        allowedPropertyStatuses,
        'Property status',
      );
    }
    if (dto.price !== undefined) {
      data.price = this.parseDecimal(dto.price, 'Price');
    }
    if (dto.area !== undefined) {
      data.area = this.parseDecimal(dto.area, 'Area');
    }
    if (dto.address !== undefined) {
      this.validateRequiredText(dto.address, 'Address');
      data.address = dto.address.trim();
    }
    if (dto.city !== undefined) {
      this.validateRequiredText(dto.city, 'City');
      data.city = dto.city.trim();
    }
    if (dto.district !== undefined) {
      this.validateRequiredText(dto.district, 'District');
      data.district = dto.district.trim();
    }
    if (dto.ward !== undefined) {
      data.ward = this.trimNullable(dto.ward);
    }
    if (dto.latitude !== undefined) {
      data.latitude = this.parseOptionalDecimal(dto.latitude, 'Latitude');
    }
    if (dto.longitude !== undefined) {
      data.longitude = this.parseOptionalDecimal(dto.longitude, 'Longitude');
    }
    if (dto.bedroom !== undefined) {
      data.bedroom = this.parseOptionalNonNegativeInt(dto.bedroom, 'Bedroom');
    }
    if (dto.bathroom !== undefined) {
      data.bathroom = this.parseOptionalNonNegativeInt(dto.bathroom, 'Bathroom');
    }
    if (dto.floor !== undefined) {
      data.floor = this.parseOptionalNonNegativeInt(dto.floor, 'Floor');
    }
    if (dto.regionId !== undefined) {
      const regionId = this.parseOptionalId(dto.regionId, 'Region id');
      data.region = regionId ? { connect: { id: regionId } } : { disconnect: true };
      data.regionId = regionId;
    }

    if (dto.images !== undefined) {
      this.toImageCreateMany(dto.images);
    }

    return data;
  }

  private toImageCreateMany(images: PropertyImageInputDto[]) {
    if (!Array.isArray(images)) {
      throw new BadRequestException('Images must be an array.');
    }

    return images.map((image, index) => {
      this.validateRequiredText(image.url, 'Image url');

      return {
        url: image.url.trim(),
        alt: this.trimOptional(image.alt),
        sortOrder:
          this.parseOptionalNonNegativeInt(image.sortOrder, 'Image sortOrder') ??
          index,
      };
    });
  }

  private async findManageableProperty(id: number, user: AuthenticatedUser) {
    const where = await this.applyUserScope({ id }, user);
    const property = await this.prisma.property.findFirst({
      where,
      include: { region: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found or access is denied.');
    }

    return property;
  }

  private async applyUserScope(
    where: Prisma.PropertyWhereInput,
    user: AuthenticatedUser,
  ): Promise<Prisma.PropertyWhereInput> {
    if (user.role === Role.ADMIN) {
      return where;
    }

    if (user.role !== Role.SALES_AGENT) {
      throw new ForbiddenException('Only admins and sales agents can manage properties.');
    }

    const regionIds = await this.getAgentRegionIds(user.id);

    if (regionIds.length === 0) {
      return { AND: [where, { id: -1 }] };
    }

    return {
      AND: [where, { regionId: { in: regionIds } }],
    };
  }

  private assertCanManageProperties(user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && user.role !== Role.SALES_AGENT) {
      throw new ForbiddenException('Only admins and sales agents can manage properties.');
    }
  }

  private async assertCanAccessRegion(
    user: AuthenticatedUser,
    regionId: number | null,
  ): Promise<void> {
    if (user.role === Role.ADMIN) {
      if (regionId) {
        await this.assertRegionExists(regionId);
      }
      return;
    }

    if (!regionId) {
      throw new BadRequestException('Sales agents must select a region.');
    }

    const regionIds = await this.getAgentRegionIds(user.id);

    if (!regionIds.includes(regionId)) {
      throw new ForbiddenException(
        'Sales agents can only manage properties in assigned regions.',
      );
    }
  }

  private async getAgentRegionIds(userId: number): Promise<number[]> {
    const agentProfile = await this.prisma.agentProfile.findUnique({
      where: { userId },
      include: {
        regions: {
          select: { regionId: true },
        },
      },
    });

    return agentProfile?.regions.map((region) => region.regionId) ?? [];
  }

  private async assertRegionExists(regionId: number): Promise<void> {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
      select: { id: true },
    });

    if (!region) {
      throw new BadRequestException('Region does not exist.');
    }
  }

  private addDecimalRange(
    and: Prisma.PropertyWhereInput[],
    field: 'price' | 'area',
    min?: string,
    max?: string,
  ): void {
    const gte = this.parseOptionalDecimal(min, `Minimum ${field}`);
    const lte = this.parseOptionalDecimal(max, `Maximum ${field}`);

    if (gte !== undefined || lte !== undefined) {
      if (gte !== undefined && lte !== undefined && Number(gte) > Number(lte)) {
        throw new BadRequestException(`Minimum ${field} cannot exceed maximum ${field}.`);
      }

      and.push({ [field]: { gte, lte } });
    }
  }

  private addIntRange(
    and: Prisma.PropertyWhereInput[],
    field: 'bedroom' | 'bathroom' | 'floor',
    min?: string,
    max?: string,
  ): void {
    const gte = this.parseOptionalNonNegativeInt(min, `Minimum ${field}`);
    const lte = this.parseOptionalNonNegativeInt(max, `Maximum ${field}`);

    if (gte !== undefined || lte !== undefined) {
      if (gte !== undefined && lte !== undefined && gte > lte) {
        throw new BadRequestException(`Minimum ${field} cannot exceed maximum ${field}.`);
      }

      and.push({ [field]: { gte, lte } });
    }
  }

  private parseEnumList<T extends string>(
    value: string | undefined,
    enumValues: readonly T[],
    label: string,
  ): T[] {
    if (!value?.trim()) {
      return [];
    }

    return value
      .split(',')
      .map((item) => this.parseEnum(item.trim(), enumValues, label));
  }

  private parseEnum<T extends string>(
    value: string,
    enumValues: readonly T[],
    label: string,
  ): T {
    if (!enumValues.includes(value as T)) {
      throw new BadRequestException(
        `${label} must be one of: ${enumValues.join(', ')}.`,
      );
    }

    return value as T;
  }

  private parseId(value: string, label: string): number {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(`${label} must be a positive integer.`);
    }

    return id;
  }

  private parseOptionalId(
    value: number | string | null | undefined,
    label: string,
  ): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return this.parseId(String(value), label);
  }

  private parseDecimal(value: number | string, label: string): string {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`${label} must be a non-negative number.`);
    }

    return parsed.toFixed(2);
  }

  private parseOptionalDecimal(
    value: number | string | null | undefined,
    label: string,
  ): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return this.parseDecimal(value, label);
  }

  private parseOptionalPositiveInt(
    value: string | undefined,
    label: string,
  ): number | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(`${label} must be a positive integer.`);
    }

    return parsed;
  }

  private parseOptionalNonNegativeInt(
    value: number | string | null | undefined,
    label: string,
  ): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(`${label} must be a non-negative integer.`);
    }

    return parsed;
  }

  private parseBoolean(value: string | undefined): boolean {
    if (!value) {
      return false;
    }

    return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
  }

  private validateRequiredText(value: string, label: string): void {
    if (!value?.trim()) {
      throw new BadRequestException(`${label} is required.`);
    }
  }

  private trimOptional(value: string | undefined): string | undefined {
    return value?.trim() || undefined;
  }

  private trimNullable(value: string | null | undefined): string | null {
    if (value === null) {
      return null;
    }

    return value?.trim() || null;
  }
}
