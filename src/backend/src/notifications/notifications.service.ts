import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      data: notifications,
      meta: {
        unreadCount: notifications.filter(
          (notification) => !notification.readAt,
        ).length,
      },
    };
  }

  async markAsRead(rawId: string, user: AuthenticatedUser) {
    const id = this.parseId(rawId);
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }
    if (notification.readAt) {
      return { message: 'Notification is already read.', notification };
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { message: 'Notification marked as read.', notification: updated };
  }

  async markAllAsRead(user: AuthenticatedUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return {
      message: 'All notifications marked as read.',
      updatedCount: result.count,
    };
  }

  private parseId(value: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'Notification id must be a positive integer.',
      );
    }
    return id;
  }
}
