import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ForumService } from './forum.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReactionType, UserRole } from '../generated/prisma';

const makeForum = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'forum-1',
  campaignId: 'campaign-1',
  ...overrides,
});

const makeMessage = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'msg-1',
  content: 'Hello',
  forumId: 'forum-1',
  userId: 'user-1',
  parentId: null,
  isDeleted: false,
  createdAt: new Date(),
  user: { id: 'user-1', name: 'Alice', walletAddress: '0xabc', avatar: null },
  reactions: [],
  _count: { replies: 0 },
  ...overrides,
});

const mockPrisma = {
  campaign: {
    findUnique: jest.fn(),
  },
  forum: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  reaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  contribution: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ForumService', () => {
  let service: ForumService;

  beforeEach(async () => {
    // resetAllMocks clears both the one-time queue and any persistent default set by mockResolvedValue
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ForumService>(ForumService);
  });

  describe('getForumByProjectId', () => {
    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.getForumByProjectId('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('creates a forum if one does not exist for the campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(null);
      mockPrisma.forum.create.mockResolvedValue(makeForum());
      mockPrisma.message.findMany
        .mockResolvedValueOnce([])  // top-level messages
        .mockResolvedValueOnce([]); // replies

      await service.getForumByProjectId('campaign-1');

      expect(mockPrisma.forum.create).toHaveBeenCalledWith({ data: { campaignId: 'campaign-1' } });
    });

    it('does not create a forum if one already exists', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      mockPrisma.message.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getForumByProjectId('campaign-1');

      expect(mockPrisma.forum.create).not.toHaveBeenCalled();
    });

    it('returns messages with nested replies attached', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'creator-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      const parent = makeMessage({ id: 'msg-1' });
      const reply = makeMessage({ id: 'msg-r1', parentId: 'msg-1' });
      mockPrisma.message.findMany
        .mockResolvedValueOnce([parent])  // top-level (no hasMore)
        .mockResolvedValueOnce([reply]);  // replies
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getForumByProjectId('campaign-1');

      expect(result.messages[0].replies[0]).toMatchObject({ id: reply.id });
    });

    it('sets nextCursor when there are more messages than the limit', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'creator-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      // Return limit+1 items to signal hasMore
      const messages = Array.from({ length: 21 }, (_, i) =>
        makeMessage({ id: `msg-${i}` }),
      );
      mockPrisma.message.findMany
        .mockResolvedValueOnce(messages)
        .mockResolvedValueOnce([]);
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getForumByProjectId('campaign-1', undefined, 20);

      expect(result.nextCursor).toBe('msg-19');
      expect(result.messages).toHaveLength(20);
    });

    it('sets nextCursor to null when there are no more messages', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'creator-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      mockPrisma.message.findMany
        .mockResolvedValueOnce([makeMessage()])
        .mockResolvedValueOnce([]);
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getForumByProjectId('campaign-1');

      expect(result.nextCursor).toBeNull();
    });

    it('caps limit at MAX_PAGE_SIZE (50)', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      mockPrisma.message.findMany.mockResolvedValue([]).mockResolvedValue([]);

      await service.getForumByProjectId('campaign-1', undefined, 999);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }), // 50 + 1 for hasMore check
      );
    });
  });

  describe('createMessage', () => {
    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.createMessage('bad-id', 'user-1', { content: 'Hello' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a top-level message without parentId', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'user-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      const created = makeMessage({ content: 'Hello' });
      mockPrisma.message.create.mockResolvedValue(created);
      mockPrisma.contribution.findFirst.mockResolvedValue(null);

      const result = await service.createMessage('campaign-1', 'user-1', { content: 'Hello' });

      expect(result).toMatchObject({ content: 'Hello', parentId: null });
      expect(result.user.isCreator).toBe(true);
      expect(result.user.isContributor).toBe(false);
      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parentId: null }),
        }),
      );
    });

    it('allows a contributor (non-creator) to post and marks isContributor as true', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'other-user' });
      mockPrisma.contribution.findFirst.mockResolvedValue({ id: 'c-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      const created = makeMessage({ content: 'Hello from contributor' });
      mockPrisma.message.create.mockResolvedValue(created);

      const result = await service.createMessage('campaign-1', 'user-1', { content: 'Hello from contributor' });

      expect(result.user.isContributor).toBe(true);
      expect(result.user.isCreator).toBe(false);
    });

    it('allows a non-contributor non-creator to post and marks isContributor as false', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'other-user' });
      mockPrisma.contribution.findFirst.mockResolvedValue(null);
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      const created = makeMessage({ content: 'Hello from newcomer' });
      mockPrisma.message.create.mockResolvedValue(created);

      const result = await service.createMessage('campaign-1', 'user-1', { content: 'Hello from newcomer' });

      expect(result.user.isContributor).toBe(false);
      expect(result.user.isCreator).toBe(false);
    });

    it('creates a reply to an existing top-level message', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'user-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      const parent = makeMessage({ id: 'msg-1', parentId: null, isDeleted: false });
      mockPrisma.message.findUnique.mockResolvedValue(parent);
      const reply = makeMessage({ id: 'reply-1', parentId: 'msg-1' });
      mockPrisma.message.create.mockResolvedValue(reply);

      const result = await service.createMessage('campaign-1', 'user-1', {
        content: 'Reply!',
        parentId: 'msg-1',
      });

      expect(result.parentId).toBe(reply.parentId);
    });

    it('throws BadRequestException when trying to reply to a reply (max 1 level deep)', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'user-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      const nestedReply = makeMessage({ id: 'r1', parentId: 'msg-0', isDeleted: false });
      mockPrisma.message.findUnique.mockResolvedValue(nestedReply);

      await expect(
        service.createMessage('campaign-1', 'user-1', { content: 'Deep reply', parentId: 'r1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when parent message is deleted', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'user-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum());
      const deletedParent = makeMessage({ id: 'msg-1', parentId: null, isDeleted: true });
      mockPrisma.message.findUnique.mockResolvedValue(deletedParent);

      await expect(
        service.createMessage('campaign-1', 'user-1', { content: 'Reply', parentId: 'msg-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when parent message belongs to a different forum', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'campaign-1', creatorId: 'user-1' });
      mockPrisma.forum.findUnique.mockResolvedValue(makeForum({ id: 'forum-1' }));
      const foreignParent = makeMessage({ id: 'msg-other', forumId: 'forum-9' });
      mockPrisma.message.findUnique.mockResolvedValue(foreignParent);

      await expect(
        service.createMessage('campaign-1', 'user-1', { content: 'Hi', parentId: 'msg-other' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMessage', () => {
    const editorUser = { userId: 'user-1', role: UserRole.USER };
    const adminUser = { userId: 'admin-1', role: UserRole.ADMIN };

    it('allows the message owner to edit their message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ userId: 'user-1', isDeleted: false }));
      const updated = makeMessage({ content: 'Edited' });
      mockPrisma.message.update.mockResolvedValue(updated);

      const result = await service.updateMessage('msg-1', editorUser, { content: 'Edited' });

      expect(result).toEqual(updated);
    });

    it('allows an admin to edit any message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ userId: 'user-99', isDeleted: false }));
      mockPrisma.message.update.mockResolvedValue(makeMessage({ content: 'Admin edit' }));

      await expect(
        service.updateMessage('msg-1', adminUser, { content: 'Admin edit' }),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when non-owner non-admin tries to edit', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ userId: 'owner', isDeleted: false }));

      await expect(
        service.updateMessage('msg-1', { userId: 'stranger', role: UserRole.USER }, { content: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when trying to edit a deleted message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ userId: 'user-1', isDeleted: true }));

      await expect(
        service.updateMessage('msg-1', editorUser, { content: 'Edit' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMessage('bad-id', editorUser, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMessage', () => {
    const ownerUser = { userId: 'user-1', role: UserRole.USER };
    const adminUser = { userId: 'admin-1', role: UserRole.ADMIN };

    it('soft-deletes the message (sets isDeleted=true, clears content)', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ userId: 'user-1' }));
      mockPrisma.message.update.mockResolvedValue(makeMessage({ isDeleted: true, content: '' }));

      await service.deleteMessage('msg-1', ownerUser);

      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isDeleted: true, content: '' },
        }),
      );
    });

    it('allows an admin to delete any message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ userId: 'user-99' }));
      mockPrisma.message.update.mockResolvedValue(makeMessage({ isDeleted: true }));

      await expect(service.deleteMessage('msg-1', adminUser)).resolves.toBeDefined();
    });

    it('throws ForbiddenException when non-owner non-admin tries to delete', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ userId: 'owner' }));

      await expect(
        service.deleteMessage('msg-1', { userId: 'intruder', role: UserRole.USER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(service.deleteMessage('bad-id', ownerUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleReaction', () => {
    it('adds a reaction when one does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ isDeleted: false }));
      mockPrisma.reaction.findUnique.mockResolvedValue(null);
      mockPrisma.reaction.create.mockResolvedValue({});

      const result = await service.toggleReaction('msg-1', 'user-1', ReactionType.LIKE);

      expect(result.reacted).toBe(true);
      expect(mockPrisma.reaction.create).toHaveBeenCalled();
    });

    it('removes a reaction when one already exists', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ isDeleted: false }));
      mockPrisma.reaction.findUnique.mockResolvedValue({ id: 'reaction-1' });
      mockPrisma.reaction.delete.mockResolvedValue({});

      const result = await service.toggleReaction('msg-1', 'user-1', ReactionType.LIKE);

      expect(result.reacted).toBe(false);
      expect(mockPrisma.reaction.delete).toHaveBeenCalledWith({ where: { id: 'reaction-1' } });
    });

    it('throws NotFoundException when message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleReaction('bad-id', 'user-1', ReactionType.LIKE),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when trying to react to a deleted message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(makeMessage({ isDeleted: true }));

      await expect(
        service.toggleReaction('msg-1', 'user-1', ReactionType.FIRE),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
