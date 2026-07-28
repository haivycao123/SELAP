import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, PropertyStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

const favoriteInclude = {
  property: {
    include: {
      images: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
} satisfies Prisma.FavoriteInclude;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        userId: user.id,
        property: { status: { not: PropertyStatus.HIDDEN } },
      },
      include: favoriteInclude,
      orderBy: { createdAt: 'desc' },
    });

    return { data: favorites };
  }

  async create(rawPropertyId: string, user: AuthenticatedUser) {
    const propertyId = this.parsePropertyId(rawPropertyId);
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, status: { not: PropertyStatus.HIDDEN } },
      select: { id: true, title: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_propertyId: { userId: user.id, propertyId } },
    });

    if (existing) {
      return { message: 'Property is already saved.', favorite: existing };
    }

    const favorite = await this.prisma.$transaction(async (tx) => {
      const created = await tx.favorite.create({
        data: { userId: user.id, propertyId },
      });
      await tx.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.PROPERTY_FAVORITE_CHANGED,
          title: 'Property saved',
          message: `${property.title} was added to your saved properties.`,
          data: { propertyId },
        },
      });
      return created;
    });

    return { message: 'Property saved successfully.', favorite };
  }

  async remove(rawPropertyId: string, user: AuthenticatedUser) {
    const propertyId = this.parsePropertyId(rawPropertyId);
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_propertyId: { userId: user.id, propertyId } },
    });

    if (!favorite) {
      throw new NotFoundException('Saved property not found.');
    }

    await this.prisma.favorite.delete({ where: { id: favorite.id } });
    return { message: 'Property removed from saved properties.', propertyId };
  }

  private parsePropertyId(value: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Property id must be a positive integer.');
    }
    return id;
  }
}
