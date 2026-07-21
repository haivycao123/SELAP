import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Thêm căn hộ vào danh sách yêu thích
  async addFavorite(userId: number, propertyId: number) {
    // Kiểm tra xem căn hộ có tồn tại không
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    try {
      const favorite = await this.prisma.favorite.create({
        data: {
          userId,
          propertyId,
        },
        include: {
          property: true,
        },
      });

      return {
        message: 'Property added to favorites successfully.',
        favorite,
      };
    } catch (error) {
      // Dùng PrismaClientKnownRequestError để TypeScript bắt đúng kiểu dữ liệu
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This property is already in your favorites.',
        );
      }
      throw error;
    }
  }

  // 2. Xóa căn hộ khỏi danh sách yêu thích
  async removeFavorite(userId: number, propertyId: number) {
    try {
      await this.prisma.favorite.delete({
        where: {
          userId_propertyId: {
            userId,
            propertyId,
          },
        },
      });

      return {
        message: 'Property removed from favorites successfully.',
      };
    } catch (error) {
      // Kiểm tra lỗi P2025: không tìm thấy bản ghi để xóa
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Favorite record not found.');
      }
      throw error;
    }
  }

  // 3. Lấy danh sách các căn hộ đã lưu của người dùng
  async getUserFavorites(userId: number) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        property: {
          include: {
            images: true,
            region: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      favorites: favorites.map((fav) => fav.property),
    };
  }
}