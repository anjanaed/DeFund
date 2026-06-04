import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '../generated/prisma';

const mockPrisma = {
  contribution: { findMany: jest.fn() },
  notification: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('createForContributors', () => {
    it('does nothing when the campaign has no contributors', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      await service.createForContributors(
        'campaign-1',
        NotificationType.CAMPAIGN_FULLY_FUNDED,
        'Title',
        'Body',
      );

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('creates a notification for each distinct contributor', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([
        { contributorId: 'user-1' },
        { contributorId: 'user-2' },
      ]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      await service.createForContributors(
        'campaign-1',
        NotificationType.CAMPAIGN_FULLY_FUNDED,
        'Campaign Fully Funded',
        'It reached the goal!',
        { campaignId: 'campaign-1', campaignTitle: 'Test' },
      );

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: 'user-1', type: NotificationType.CAMPAIGN_FULLY_FUNDED }),
            expect.objectContaining({ userId: 'user-2', type: NotificationType.CAMPAIGN_FULLY_FUNDED }),
          ]),
        }),
      );
    });
  });

  describe('getForUser', () => {
    it('returns paginated notifications for the user', async () => {
      const items = [{ id: 'n-1', userId: 'user-1', isRead: false, createdAt: new Date() }];
      mockPrisma.notification.findMany.mockResolvedValue(items);

      const result = await service.getForUser('user-1', { limit: 20 });

      expect(result.notifications).toEqual(items);
      expect(result.nextCursor).toBeNull();
    });

    it('sets nextCursor when there are more items than limit', async () => {
      const items = Array.from({ length: 21 }, (_, i) => ({ id: `n-${i}`, userId: 'user-1' }));
      mockPrisma.notification.findMany.mockResolvedValue(items);

      const result = await service.getForUser('user-1', { limit: 20 });

      expect(result.notifications).toHaveLength(20);
      expect(result.nextCursor).toBe('n-19');
    });
  });

  describe('getUnreadCount', () => {
    it('returns the count of unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(5);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  describe('markRead', () => {
    it('marks a notification as read when the user owns it', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({ id: 'n-1', userId: 'user-1' });
      mockPrisma.notification.update.mockResolvedValue({ id: 'n-1', isRead: true });

      await service.markRead('n-1', 'user-1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isRead: true } }),
      );
    });

    it('throws NotFoundException when the notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markRead('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the notification belongs to a different user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({ id: 'n-1', userId: 'other-user' });

      await expect(service.markRead('n-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read for the user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      await service.markAllRead('user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
    });
  });
});
