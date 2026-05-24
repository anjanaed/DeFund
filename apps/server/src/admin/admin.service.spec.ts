import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus, MilestoneStatus, UserRole } from '../generated/prisma';

const makeCampaign = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'campaign-1',
  title: 'Test Campaign',
  status: CampaignStatus.PENDING,
  creatorId: 'creator-1',
  raisedAmount: 5000,
  goalAmount: 10000,
  releasedAmount: 0,
  onChainId: null,
  updatedAt: new Date(),
  createdAt: new Date(),
  milestones: [],
  ...overrides,
});

const makeMilestone = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'milestone-1',
  title: 'Milestone 1',
  status: MilestoneStatus.PENDING,
  amount: 2000,
  campaignId: 'campaign-1',
  updatedAt: new Date(),
  _count: { votes: 0 },
  campaign: { id: 'campaign-1', title: 'Test Campaign', creator: { walletAddress: '0xabc' } },
  ...overrides,
});

const makeUser = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  walletAddress: '0xabc',
  role: UserRole.USER,
  createdAt: new Date(),
  ...overrides,
});

const mockPrisma = {
  campaign: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
  },
  milestone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  contribution: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  vote: {
    groupBy: jest.fn(),
  },
  refundProposal: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getStats', () => {
    it('returns pending, flagged, rejected counts and totalRaised', async () => {
      mockPrisma.campaign.count
        .mockResolvedValueOnce(3)   // pending
        .mockResolvedValueOnce(2)   // flagged
        .mockResolvedValueOnce(1);  // rejected (FAILED)
      mockPrisma.campaign.aggregate.mockResolvedValue({ _sum: { raisedAmount: 99000 } });

      const result = await service.getStats();

      expect(result.pending).toBe(3);
      expect(result.flagged).toBe(2);
      expect(result.rejected).toBe(1);
      expect(result.totalRaised).toBe(99000);
    });

    it('returns 0 totalRaised when no funds raised', async () => {
      mockPrisma.campaign.count.mockResolvedValue(0);
      mockPrisma.campaign.aggregate.mockResolvedValue({ _sum: { raisedAmount: null } });

      const result = await service.getStats();

      expect(result.totalRaised).toBe(0);
    });
  });

  describe('getActivity', () => {
    it('merges and sorts campaigns and milestones by updatedAt desc', async () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-06-01');
      mockPrisma.campaign.findMany.mockResolvedValue([
        { id: 'c1', title: 'Camp', status: 'ACTIVE', updatedAt: older, creator: {} },
      ]);
      mockPrisma.milestone.findMany.mockResolvedValue([
        { id: 'm1', title: 'MS', status: 'VOTING', updatedAt: newer, campaign: {} },
      ]);

      const result = await service.getActivity();

      expect(result[0].id).toBe('m1');
      expect(result[1].id).toBe('c1');
    });

    it('returns at most 20 items', async () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`, title: `C${i}`, status: 'ACTIVE', updatedAt: new Date(), creator: {},
      }));
      mockPrisma.campaign.findMany.mockResolvedValue(manyItems);
      mockPrisma.milestone.findMany.mockResolvedValue(manyItems);

      const result = await service.getActivity();

      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe('getTransactions', () => {
    it('returns paginated contributions with campaign and contributor info', async () => {
      const contributions = [{ id: 'c1', amount: 100 }];
      mockPrisma.contribution.findMany.mockResolvedValue(contributions);
      mockPrisma.contribution.count.mockResolvedValue(1);

      const result = await service.getTransactions(1, 20);

      expect(result.items).toEqual(contributions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('calculates correct skip for page 2', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.contribution.count.mockResolvedValue(0);

      await service.getTransactions(2, 10);

      expect(mockPrisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('getVerification', () => {
    it('returns all PENDING campaigns without search', async () => {
      const campaigns = [makeCampaign()];
      mockPrisma.campaign.findMany.mockResolvedValue(campaigns);

      const result = await service.getVerification();

      expect(result).toEqual(campaigns);
      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: CampaignStatus.PENDING }),
        }),
      );
    });

    it('applies OR search filter on title and creator wallet', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);

      await service.getVerification('defi');

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'defi', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('getProjects', () => {
    it('sorts FLAGGED campaigns to the top', async () => {
      const flagged = makeCampaign({ id: 'c2', status: CampaignStatus.FLAGGED });
      const active = makeCampaign({ id: 'c1', status: CampaignStatus.ACTIVE });
      mockPrisma.campaign.findMany.mockResolvedValue([active, flagged]);

      const result = await service.getProjects();

      expect(result[0].id).toBe('c2');
      expect(result[1].id).toBe('c1');
    });
  });

  describe('getProject', () => {
    it('returns campaign with creator, milestones, contributions, and updates', async () => {
      const campaign = makeCampaign({ creator: makeUser() });
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);

      const result = await service.getProject('campaign-1');

      expect(result).toEqual(campaign);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.getProject('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFinancialSummary', () => {
    it('returns raised, released, and remaining amounts with milestone breakdown', async () => {
      const campaign = makeCampaign({
        raisedAmount: 8000,
        goalAmount: 10000,
        releasedAmount: 2000,
        milestones: [
          { id: 'm1', title: 'M1', amount: 5000, status: MilestoneStatus.COMPLETED },
          { id: 'm2', title: 'M2', amount: 5000, status: MilestoneStatus.PENDING },
        ],
      });
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);

      const result = await service.getFinancialSummary('campaign-1');

      expect(result.raisedAmount).toBe(8000);
      expect(result.releasedAmount).toBe(2000);
      expect(result.remainingAmount).toBe(6000);
      expect(result.milestoneBreakdown).toHaveLength(2);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.getFinancialSummary('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveCampaign', () => {
    it('updates campaign status to ACTIVE and promotes creator to CREATOR role', async () => {
      const campaign = makeCampaign();
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.approveCampaign('campaign-1', 42);

      expect(result).toEqual({ success: true, onChainId: 42 });
      // $transaction is called once with the two update operations
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // campaign.update and user.update are invoked to build the array passed to $transaction
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'campaign-1' },
          data: expect.objectContaining({ onChainId: 42, status: CampaignStatus.ACTIVE }),
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaign.creatorId },
          data: { role: UserRole.CREATOR },
        }),
      );
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.approveCampaign('bad-id', 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectCampaign', () => {
    it('updates campaign status to FAILED', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign());
      mockPrisma.campaign.update.mockResolvedValue(makeCampaign({ status: CampaignStatus.FAILED }));

      const result = await service.rejectCampaign('campaign-1');

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: CampaignStatus.FAILED },
        }),
      );
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.rejectCampaign('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('flagCampaign', () => {
    it('updates campaign status to FLAGGED', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign());
      mockPrisma.campaign.update.mockResolvedValue(makeCampaign({ status: CampaignStatus.FLAGGED }));

      await service.flagCampaign('campaign-1', 'fraud');

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: CampaignStatus.FLAGGED },
        }),
      );
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.flagCampaign('bad-id', 'fraud')).rejects.toThrow(NotFoundException);
    });
  });

  describe('proposeRefund', () => {
    it('returns guidance message for on-chain campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign({ onChainId: 5 }));

      const result = await service.proposeRefund('campaign-1');

      expect(result.message).toContain('proposeRefund()');
    });

    it('throws BadRequestException when campaign is not on-chain', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign({ onChainId: null }));

      await expect(service.proposeRefund('campaign-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.proposeRefund('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveRefund', () => {
    it('returns guidance message for on-chain campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign({ onChainId: 5 }));

      const result = await service.approveRefund('campaign-1');

      expect(result.message).toContain('approveRefund()');
    });

    it('throws BadRequestException when campaign is not on-chain', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign({ onChainId: null }));

      await expect(service.approveRefund('campaign-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRefundProposals', () => {
    it('returns refund proposals with campaign info', async () => {
      const proposals = [{ id: 'rp1', campaignId: 'c1', campaign: { title: 'Camp' } }];
      mockPrisma.refundProposal.findMany.mockResolvedValue(proposals);

      const result = await service.getRefundProposals();

      expect(result).toEqual(proposals);
    });
  });

  describe('getRefundProposalForCampaign', () => {
    it('returns active (un-executed) proposal when available', async () => {
      const activeProposal = { id: 'rp1', executed: false };
      mockPrisma.refundProposal.findFirst.mockResolvedValueOnce(activeProposal);

      const result = await service.getRefundProposalForCampaign('campaign-1');

      expect(result).toEqual(activeProposal);
      expect(mockPrisma.refundProposal.findFirst).toHaveBeenCalledTimes(1);
    });

    it('falls back to executed proposal when no active proposal exists', async () => {
      const executedProposal = { id: 'rp2', executed: true };
      mockPrisma.refundProposal.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(executedProposal);

      const result = await service.getRefundProposalForCampaign('campaign-1');

      expect(result).toEqual(executedProposal);
      expect(mockPrisma.refundProposal.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMilestones', () => {
    it('returns paginated milestones with vote tallies', async () => {
      const milestones = [makeMilestone({ id: 'm1' })];
      mockPrisma.milestone.findMany.mockResolvedValue(milestones);
      mockPrisma.milestone.count.mockResolvedValue(1);
      mockPrisma.vote.groupBy.mockResolvedValue([
        { milestoneId: 'm1', choice: true, _count: { _all: 3 } },
        { milestoneId: 'm1', choice: false, _count: { _all: 1 } },
      ]);

      const result = await service.getMilestones(1, 20);

      expect(result.items[0].votesFor).toBe(3);
      expect(result.items[0].votesAgainst).toBe(1);
      expect(result.total).toBe(1);
    });

    it('returns zero vote tallies when no votes exist', async () => {
      const milestones = [makeMilestone({ id: 'm1' })];
      mockPrisma.milestone.findMany.mockResolvedValue(milestones);
      mockPrisma.milestone.count.mockResolvedValue(1);
      mockPrisma.vote.groupBy.mockResolvedValue([]);

      const result = await service.getMilestones(1, 20);

      expect(result.items[0].votesFor).toBe(0);
      expect(result.items[0].votesAgainst).toBe(0);
    });
  });

  describe('getMilestone', () => {
    it('returns milestone with campaign and votes', async () => {
      const milestone = makeMilestone({ votes: [] });
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.getMilestone('milestone-1');

      expect(result).toEqual(milestone);
    });

    it('throws NotFoundException when milestone does not exist', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(null);

      await expect(service.getMilestone('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('notifyMilestoneRelease', () => {
    it('returns creator wallet and onChainId for APPROVED milestone', async () => {
      const milestone = {
        ...makeMilestone({ status: MilestoneStatus.APPROVED, onChainId: 3 }),
        campaign: { creator: { walletAddress: '0xCreator' } },
      };
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.notifyMilestoneRelease('milestone-1');

      expect(result.creatorWallet).toBe('0xCreator');
      expect(result.milestoneOnChainId).toBe(3);
    });

    it('throws BadRequestException when milestone is not APPROVED', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({ status: MilestoneStatus.PENDING }),
      );

      await expect(service.notifyMilestoneRelease('milestone-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when milestone does not exist', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(null);

      await expect(service.notifyMilestoneRelease('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setUserRole', () => {
    it('updates user role successfully', async () => {
      const user = makeUser({ id: 'user-2', role: UserRole.USER });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, role: UserRole.CREATOR });

      const result = await service.setUserRole('user-2', UserRole.CREATOR, 'admin-user');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: UserRole.CREATOR },
        }),
      );
    });

    it('throws ForbiddenException when an admin tries to demote themselves', async () => {
      const adminUser = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);

      await expect(
        service.setUserRole('admin-1', UserRole.USER, 'admin-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.setUserRole('bad-id', UserRole.USER, 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUsers', () => {
    it('returns all users when no search provided', async () => {
      const users = [makeUser()];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.getUsers();

      expect(result).toEqual(users);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('applies search filter on name, walletAddress, and email', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.getUsers('alice');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'alice', mode: 'insensitive' } },
              { walletAddress: { contains: 'alice', mode: 'insensitive' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });
});
