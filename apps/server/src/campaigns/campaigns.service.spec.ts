import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus } from '../generated/prisma';

const makeCampaign = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'campaign-1',
  title: 'Test Campaign',
  description: 'A test',
  category: 'Tech',
  goalAmount: 1000,
  raisedAmount: 0,
  status: CampaignStatus.ACTIVE,
  creatorId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  creator: { id: 'user-1', name: 'Alice', walletAddress: '0xabc', avatar: null },
  _count: { milestones: 2, contributions: 5 },
  ...overrides,
});

const mockPrisma = {
  campaign: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  milestone: {
    findMany: jest.fn(),
  },
  update: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
};

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  describe('findAll', () => {
    it('returns paginated campaigns with default sort', async () => {
      const campaigns = [makeCampaign()];
      mockPrisma.campaign.findMany.mockResolvedValue(campaigns);
      mockPrisma.campaign.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toEqual(campaigns);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(12);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter with case-insensitive OR on title and description', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.findAll({ search: 'defi' });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'defi', mode: 'insensitive' } },
              { description: { contains: 'defi', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('applies category filter', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.findAll({ category: 'DeFi' });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'DeFi' }),
        }),
      );
    });

    it('sorts by most_funded using raisedAmount desc', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.findAll({ sort: 'most_funded' });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { raisedAmount: 'desc' } }),
      );
    });

    it('handles trending sort: fetches only ACTIVE/FUNDED, sorts by ratio, paginates in memory', async () => {
      const low = makeCampaign({ id: 'c1', raisedAmount: 100, goalAmount: 1000 });
      const high = makeCampaign({ id: 'c2', raisedAmount: 900, goalAmount: 1000 });
      mockPrisma.campaign.findMany.mockResolvedValue([low, high]);

      const result = await service.findAll({ sort: 'trending', page: 1, limit: 12 });

      expect(result.items[0].id).toBe('c2');
      expect(result.items[1].id).toBe('c1');
    });

    it('calculates correct totalPages with custom limit', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });

    it('applies skip for page 2', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10 });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findTrending', () => {
    it('returns the top 3 campaigns sorted by raisedAmount/goalAmount ratio', async () => {
      const c1 = makeCampaign({ id: 'c1', raisedAmount: 10, goalAmount: 100 });
      const c2 = makeCampaign({ id: 'c2', raisedAmount: 80, goalAmount: 100 });
      const c3 = makeCampaign({ id: 'c3', raisedAmount: 50, goalAmount: 100 });
      const c4 = makeCampaign({ id: 'c4', raisedAmount: 60, goalAmount: 100 });
      mockPrisma.campaign.findMany.mockResolvedValue([c1, c2, c3, c4]);

      const result = await service.findTrending();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('c2');
      expect(result[1].id).toBe('c4');
      expect(result[2].id).toBe('c3');
    });

    it('only queries ACTIVE and FUNDED campaigns', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);

      await service.findTrending();

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.FUNDED] } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns campaign when found', async () => {
      const campaign = makeCampaign();
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);

      const result = await service.findOne('campaign-1');

      expect(result).toEqual(campaign);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMilestones', () => {
    it('returns milestones ordered by createdAt asc', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign());
      const milestones = [{ id: 'm1', title: 'Milestone 1' }];
      mockPrisma.milestone.findMany.mockResolvedValue(milestones);

      const result = await service.findMilestones('campaign-1');

      expect(result).toEqual(milestones);
      expect(mockPrisma.milestone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
      );
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.findMilestones('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findUpdates', () => {
    it('returns updates ordered by createdAt desc', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign());
      const updates = [{ id: 'u1', title: 'Update 1' }];
      mockPrisma.update.findMany.mockResolvedValue(updates);

      const result = await service.findUpdates('campaign-1');

      expect(result).toEqual(updates);
      expect(mockPrisma.update.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.findUpdates('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createUpdate', () => {
    it('creates an update for the campaign owner', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign({ creatorId: 'user-1' }));
      const update = { id: 'u1', title: 'Progress', content: 'Done half' };
      mockPrisma.update.create.mockResolvedValue(update);

      const result = await service.createUpdate('campaign-1', 'user-1', { title: 'Progress', content: 'Done half' });

      expect(result).toEqual(update);
    });

    it('throws ForbiddenException when caller is not the campaign creator', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign({ creatorId: 'owner-user' }));

      await expect(
        service.createUpdate('campaign-1', 'other-user', { title: 'x', content: 'y' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.createUpdate('bad-id', 'user-1', { title: 'x', content: 'y' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCampaign', () => {
    it('creates campaign with PENDING status and creator set', async () => {
      const dto = {
        title: 'My Campaign',
        description: 'Desc',
        category: 'Art',
        goalAmount: 5000,
        milestones: [{ title: 'M1', description: 'First', amount: 5000 }],
      };
      const created = { id: 'new-camp', ...dto, status: CampaignStatus.PENDING, milestones: [] };
      mockPrisma.campaign.create.mockResolvedValue(created);

      const result = await service.createCampaign('user-1', dto as any);

      expect(result.status).toBe(CampaignStatus.PENDING);
      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CampaignStatus.PENDING,
            creatorId: 'user-1',
          }),
        }),
      );
    });

    it('parses deadline string to Date when provided', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const dto = {
        title: 'Camp',
        description: 'D',
        category: 'Tech',
        goalAmount: 100,
        deadline: futureDate,
        milestones: [{ title: 'M1', description: 'd', amount: 100 }],
      };
      mockPrisma.campaign.create.mockResolvedValue({ id: 'c1', milestones: [] });

      await service.createCampaign('user-1', dto as any);

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deadline: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('updateCampaign', () => {
    it('updates a PENDING campaign for its creator', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({ creatorId: 'user-1', status: CampaignStatus.PENDING }),
      );
      const updated = makeCampaign({ title: 'Updated' });
      mockPrisma.campaign.update.mockResolvedValue(updated);

      const result = await service.updateCampaign('campaign-1', 'user-1', { title: 'Updated' });

      expect(result).toEqual(updated);
    });

    it('throws ForbiddenException when caller is not the creator', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({ creatorId: 'owner', status: CampaignStatus.PENDING }),
      );

      await expect(
        service.updateCampaign('campaign-1', 'not-owner', { title: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when campaign is not PENDING', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({ creatorId: 'user-1', status: CampaignStatus.ACTIVE }),
      );

      await expect(
        service.updateCampaign('campaign-1', 'user-1', { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when deadline is in the past', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({ creatorId: 'user-1', status: CampaignStatus.PENDING }),
      );

      await expect(
        service.updateCampaign('campaign-1', 'user-1', { deadline: '2000-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCampaign('bad-id', 'user-1', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCreatorProjects', () => {
    it('returns campaigns belonging to the creator', async () => {
      const campaigns = [makeCampaign({ creatorId: 'user-1' })];
      mockPrisma.campaign.findMany.mockResolvedValue(campaigns);

      const result = await service.findCreatorProjects('user-1');

      expect(result).toEqual(campaigns);
      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creatorId: 'user-1' },
        }),
      );
    });
  });

  describe('getPublicStats', () => {
    it('computes stats from aggregate and count queries', async () => {
      mockPrisma.campaign.aggregate.mockResolvedValue({ _sum: { raisedAmount: 50000 } });
      mockPrisma.campaign.count
        .mockResolvedValueOnce(10)  // activeCampaigns
        .mockResolvedValueOnce(5)   // completedCampaigns
        .mockResolvedValueOnce(8);  // finishedCampaigns (completed + failed + flagged)
      mockPrisma.user.count.mockResolvedValue(200);

      const result = await service.getPublicStats();

      expect(result.totalRaised).toBe(50000);
      expect(result.activeCampaigns).toBe(10);
      expect(result.totalContributors).toBe(200);
      expect(result.successRate).toBe(Math.round((5 / 8) * 100));
    });

    it('returns 0 successRate when no campaigns have finished', async () => {
      mockPrisma.campaign.aggregate.mockResolvedValue({ _sum: { raisedAmount: null } });
      mockPrisma.campaign.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.getPublicStats();

      expect(result.totalRaised).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });
});
