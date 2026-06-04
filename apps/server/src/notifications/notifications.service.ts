import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, Prisma, UserRole } from '../generated/prisma';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForContributors(
    campaignId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
    eventKey?: string,
  ): Promise<void> {
    const contributors = await this.prisma.contribution.findMany({
      where: { campaignId },
      select: { contributorId: true },
      distinct: ['contributorId'],
    });
    if (contributors.length === 0) return;

    await this.prisma.notification.createMany({
      data: contributors.map((c) => ({
        userId: c.contributorId,
        type,
        title,
        body,
        metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
        eventKey: eventKey ?? null,
      })),
      skipDuplicates: true,
    });
  }

  /** Notify the campaign's creator (F3 — creator gets notified about their own campaign events) */
  async createForCampaignCreator(
    campaignId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
    eventKey?: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { creatorId: true },
    });
    if (!campaign) return;

    await this.prisma.notification.createMany({
      data: [
        {
          userId: campaign.creatorId,
          type,
          title,
          body,
          metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
          eventKey: eventKey ?? null,
        },
      ],
      skipDuplicates: true,
    });
  }

  async notifyAdmins(
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
    eventKey?: string,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    if (admins.length === 0) return;

    await this.prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type,
        title,
        body,
        metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
        eventKey: eventKey ?? null,
      })),
      skipDuplicates: true,
    });
  }

  async getForUser(
    userId: string,
    { limit = 20, cursor }: { limit?: number; cursor?: string },
  ) {
    const take = Math.min(Math.max(1, limit), 50);
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = notifications.length > take;
    const items = hasMore ? notifications.slice(0, take) : notifications;
    return { notifications: items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
