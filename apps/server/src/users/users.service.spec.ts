import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus, MilestoneStatus } from '../generated/prisma';

const makeUser = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'user-1',
  walletAddress: '0xabc',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'USER',
  createdAt: new Date(),
  ...overrides,
});

const makeContribution = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'contrib-1',
  amount: 500,
  campaignId: 'campaign-1',
  contributorId: 'user-1',
  timestamp: new Date(),
  transactionHash: '0xhash1',
  refunded: false,
  campaign: { id: 'campaign-1', title: 'Camp', status: CampaignStatus.ACTIVE },
  ...overrides,
});

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  contribution: {
    findMany: jest.fn(),
  },
  vote: {
    findMany: jest.fn(),
  },
  milestone: {
    findMany: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getMe', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe('user-1');

      expect(result).toEqual(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates and returns the user profile', async () => {
      const updated = makeUser({ name: 'Bob' });
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', { name: 'Bob' });

      expect(result.name).toBe('Bob');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Bob' },
      });
    });
  });

  describe('getDashboard', () => {
    it('correctly calculates totalContributed, lockedFunds, and releasedFunds', async () => {
      const contributions = [
        makeContribution({ amount: 300, campaign: { id: 'c1', status: CampaignStatus.ACTIVE } }),
        makeContribution({ amount: 200, campaign: { id: 'c2', status: CampaignStatus.FUNDED } }),
        makeContribution({ amount: 100, campaign: { id: 'c3', status: CampaignStatus.COMPLETED } }),
        makeContribution({ amount: 50, campaign: { id: 'c4', status: CampaignStatus.FAILED } }),
      ];
      mockPrisma.contribution.findMany.mockResolvedValue(contributions);

      const result = await service.getDashboard('user-1');

      expect(result.totalContributed).toBe(650);
      expect(result.lockedFunds).toBe(500);    // ACTIVE (300) + FUNDED (200)
      expect(result.releasedFunds).toBe(100);  // COMPLETED only
    });

    it('returns zeros when user has no contributions', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('user-1');

      expect(result.totalContributed).toBe(0);
      expect(result.lockedFunds).toBe(0);
      expect(result.releasedFunds).toBe(0);
    });
  });

  describe('getContributions', () => {
    it('returns contributions ordered by timestamp descending', async () => {
      const contributions = [makeContribution()];
      mockPrisma.contribution.findMany.mockResolvedValue(contributions);

      const result = await service.getContributions('user-1');

      expect(result).toEqual(contributions);
      expect(mockPrisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contributorId: 'user-1' },
          orderBy: { timestamp: 'desc' },
        }),
      );
    });
  });

  describe('getVotingRequired', () => {
    it('returns VOTING milestones for campaigns the user contributed to, excluding already-voted ones', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([
        { campaignId: 'campaign-1' },
        { campaignId: 'campaign-2' },
      ]);
      mockPrisma.vote.findMany.mockResolvedValue([
        { milestoneId: 'ms-already-voted' },
      ]);
      const pendingMilestone = {
        id: 'ms-pending',
        status: MilestoneStatus.VOTING,
        campaign: { id: 'campaign-1', title: 'Camp', paymentToken: 'ETH' },
      };
      mockPrisma.milestone.findMany.mockResolvedValue([pendingMilestone]);

      const result = await service.getVotingRequired('user-1');

      expect(result).toEqual([pendingMilestone]);
      expect(mockPrisma.milestone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: MilestoneStatus.VOTING,
            campaignId: { in: ['campaign-1', 'campaign-2'] },
            id: { notIn: ['ms-already-voted'] },
          }),
        }),
      );
    });

    it('returns empty array when user has no contributions', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.vote.findMany.mockResolvedValue([]);
      mockPrisma.milestone.findMany.mockResolvedValue([]);

      const result = await service.getVotingRequired('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getTransactions', () => {
    it('maps contributions to transaction objects with correct shape', async () => {
      const contribution = makeContribution({
        id: 'contrib-1',
        amount: 250,
        timestamp: new Date('2024-01-15'),
        transactionHash: '0xhash',
        refunded: false,
        campaign: { id: 'c1', title: 'My Campaign' },
      });
      mockPrisma.contribution.findMany.mockResolvedValue([contribution]);

      const result = await service.getTransactions('user-1');

      expect(result[0]).toMatchObject({
        id: 'contrib-1',
        type: 'contribution',
        amount: 250,
        refunded: false,
        campaign: { id: 'c1', title: 'My Campaign' },
      });
    });

    it('converts Decimal amount to number', async () => {
      const contribution = makeContribution({ amount: { toNumber: () => 999 } as any });
      mockPrisma.contribution.findMany.mockResolvedValue([contribution]);

      const result = await service.getTransactions('user-1');

      expect(typeof result[0].amount).toBe('number');
    });
  });

  describe('getReclaimable', () => {
    it('groups contributions by campaign and sums amounts', async () => {
      const campaign = {
        id: 'camp-1',
        title: 'Refundable',
        status: CampaignStatus.FLAGGED,
        raisedAmount: 1000,
        onChainId: 5,
        fundsReclaimed: true,
      };
      const contributions = [
        makeContribution({ amount: 200, campaignId: 'camp-1', campaign, refunded: false }),
        makeContribution({ id: 'c2', amount: 300, campaignId: 'camp-1', campaign, refunded: false }),
      ];
      mockPrisma.contribution.findMany.mockResolvedValue(contributions);

      const result = await service.getReclaimable('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalContributed).toBe(500);
      expect(result[0].contributions).toHaveLength(2);
    });

    it('queries only unrefunded contributions in FLAGGED or FAILED campaigns with fundsReclaimed=true', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      await service.getReclaimable('user-1');

      expect(mockPrisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contributorId: 'user-1',
            refunded: false,
            campaign: expect.objectContaining({ fundsReclaimed: true }),
          }),
        }),
      );
    });

    it('returns empty array when no reclaimable funds exist', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getReclaimable('user-1');

      expect(result).toEqual([]);
    });
  });
});
