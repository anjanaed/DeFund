import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CampaignStatus, MilestoneStatus, UserRole } from '../generated/prisma';

const makeCampaign = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'campaign-1',
  title: 'Test Campaign',
  status: CampaignStatus.PENDING,
  creatorId: 'creator-1',
  // [H2] approveCampaign now returns creatorWallet — include in base mock
  creator: { walletAddress: '0xdeadbeef' },
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
  flagProposal: {
    findFirst: jest.fn(),
  },
  releaseFundsProposal: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  adminAuditLog: {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  adminRoleProposal: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockNotifications = {
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
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
    it('returns paginated PENDING campaigns without search', async () => {
      const campaigns = [makeCampaign()];
      mockPrisma.campaign.findMany.mockResolvedValue(campaigns);
      mockPrisma.campaign.count.mockResolvedValue(1);

      const result = await service.getVerification();

      expect(result.items).toEqual(campaigns);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: CampaignStatus.PENDING }),
        }),
      );
    });

    it('applies OR search filter on title and creator wallet', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

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

    it('uses correct skip for page 2 with custom limit', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.getVerification(undefined, 2, 10);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('getProjects', () => {
    it('returns paginated campaigns and floats FLAGGED to the top within the page', async () => {
      const flagged = makeCampaign({ id: 'c2', status: CampaignStatus.FLAGGED });
      const active = makeCampaign({ id: 'c1', status: CampaignStatus.ACTIVE });
      mockPrisma.campaign.findMany.mockResolvedValue([active, flagged]);
      mockPrisma.campaign.count.mockResolvedValue(2);

      const result = await service.getProjects();

      expect(result.items[0].id).toBe('c2');
      expect(result.items[1].id).toBe('c1');
      expect(result.total).toBe(2);
    });

    it('filters by status when provided', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.getProjects(1, 20, CampaignStatus.FLAGGED);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: CampaignStatus.FLAGGED },
        }),
      );
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
    it('updates campaign status to ACTIVE and returns creatorWallet', async () => {
      const campaign = makeCampaign();
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);
      mockPrisma.campaign.update.mockResolvedValue({});

      const result = await service.approveCampaign('campaign-1', 42);

      // [H2] creatorWallet is now included so the frontend can pass it to createCampaign
      expect(result).toEqual({ success: true, onChainId: 42, creatorWallet: '0xdeadbeef' });
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'campaign-1' },
          data: expect.objectContaining({ onChainId: 42, status: CampaignStatus.ACTIVE }),
        }),
      );
      // CREATOR role promotion removed — no user.update call
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
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

  describe('proposeFlagCampaign', () => {
    it('returns signing instructions for an on-chain ACTIVE campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({ onChainId: 5, status: CampaignStatus.ACTIVE }),
      );

      const result = await service.proposeFlagCampaign('campaign-1', 'fraud');

      expect(result.message).toContain('proposeFlagCampaign()');
      expect(result.onChainId).toBe(5);
    });

    it('throws BadRequestException when campaign is not on-chain', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(makeCampaign({ onChainId: null, status: CampaignStatus.ACTIVE }));

      await expect(service.proposeFlagCampaign('campaign-1', 'fraud')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when campaign cannot be flagged in current status', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({ onChainId: 5, status: CampaignStatus.PENDING }),
      );

      await expect(service.proposeFlagCampaign('campaign-1', 'fraud')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.proposeFlagCampaign('bad-id', 'fraud')).rejects.toThrow(NotFoundException);
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
    it('returns the current milestone per campaign with vote tallies', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([
        {
          id: 'campaign-1',
          title: 'Test Campaign',
          milestones: [makeMilestone({ id: 'm1' })],
        },
      ]);
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
      mockPrisma.campaign.findMany.mockResolvedValue([
        {
          id: 'campaign-1',
          title: 'Test Campaign',
          milestones: [makeMilestone({ id: 'm1' })],
        },
      ]);
      mockPrisma.vote.groupBy.mockResolvedValue([]);

      const result = await service.getMilestones(1, 20);

      expect(result.items[0].votesFor).toBe(0);
      expect(result.items[0].votesAgainst).toBe(0);
    });

    it('skips campaigns whose milestones are all completed', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([
        { id: 'campaign-1', title: 'Done Campaign', milestones: [] },
        { id: 'campaign-2', title: 'In-Flight', milestones: [makeMilestone({ id: 'm2' })] },
      ]);
      mockPrisma.vote.groupBy.mockResolvedValue([]);

      const result = await service.getMilestones(1, 20);

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('m2');
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

  describe('proposeReleaseFunds', () => {
    it('returns signing instructions for an APPROVED on-chain milestone with no existing proposal', async () => {
      const milestone = {
        ...makeMilestone({ status: MilestoneStatus.APPROVED, onChainId: 3 }),
        campaign: { id: 'campaign-1', onChainId: 5, status: CampaignStatus.FUNDED },
      };
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);
      mockPrisma.releaseFundsProposal.findFirst.mockResolvedValue(null);

      const result = await service.proposeReleaseFunds('milestone-1');

      expect(result.message).toContain('proposeReleaseFunds()');
      expect(result.milestoneOnChainId).toBe(3);
    });

    it('throws BadRequestException when milestone is not APPROVED', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({ status: MilestoneStatus.PENDING, onChainId: 3 }),
      );

      await expect(service.proposeReleaseFunds('milestone-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when milestone is not on-chain', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({ status: MilestoneStatus.APPROVED, onChainId: null }),
      );

      await expect(service.proposeReleaseFunds('milestone-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a pending proposal already exists', async () => {
      const milestone = {
        ...makeMilestone({ status: MilestoneStatus.APPROVED, onChainId: 3 }),
        campaign: { id: 'campaign-1', onChainId: 5, status: CampaignStatus.FUNDED },
      };
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);
      mockPrisma.releaseFundsProposal.findFirst.mockResolvedValue({ id: 'rp1', executed: false });

      await expect(service.proposeReleaseFunds('milestone-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when milestone does not exist', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(null);

      await expect(service.proposeReleaseFunds('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('proposeRoleChange', () => {
    it('creates a proposal and notifies admins', async () => {
      const target = makeUser({ id: 'user-2', walletAddress: '0xtarget' });
      const proposal = { id: 'prop-1', targetUserId: 'user-2', targetRole: UserRole.ADMIN, proposer: '0xadmin', confirmer: null, executed: false, proposedAt: new Date(), targetUser: target };
      mockPrisma.user.findUnique.mockResolvedValue(target);
      mockPrisma.adminRoleProposal.findFirst.mockResolvedValue(null);
      mockPrisma.adminRoleProposal.create.mockResolvedValue(proposal);

      const result = await service.proposeRoleChange('user-2', UserRole.ADMIN, '0xadmin');

      expect(result).toEqual(proposal);
      expect(mockPrisma.adminRoleProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { targetUserId: 'user-2', targetRole: UserRole.ADMIN, proposer: '0xadmin' } }),
      );
      expect(mockNotifications.notifyAdmins).toHaveBeenCalled();
    });

    it('throws ForbiddenException when proposer targets themselves', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ walletAddress: '0xadmin' }));

      await expect(service.proposeRoleChange('user-1', UserRole.ADMIN, '0xadmin')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when a pending proposal already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ walletAddress: '0xtarget' }));
      mockPrisma.adminRoleProposal.findFirst.mockResolvedValue({ id: 'existing', executed: false });

      await expect(service.proposeRoleChange('user-2', UserRole.ADMIN, '0xadmin')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.proposeRoleChange('bad-id', UserRole.ADMIN, '0xadmin')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmRoleChange', () => {
    it('executes the role change and marks proposal as executed', async () => {
      const proposal = { id: 'prop-1', targetUserId: 'user-2', targetRole: UserRole.ADMIN, proposer: '0xadmin1', confirmer: null, executed: false, targetUser: makeUser({ id: 'user-2' }) };
      const updated = { ...proposal, executed: true, confirmer: '0xadmin2' };
      mockPrisma.adminRoleProposal.findUnique.mockResolvedValue(proposal);
      mockPrisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.confirmRoleChange('prop-1', '0xadmin2');

      expect(result).toEqual(updated);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException when the same admin tries to confirm their own proposal', async () => {
      const proposal = { id: 'prop-1', targetUserId: 'user-2', targetRole: UserRole.ADMIN, proposer: '0xadmin', confirmer: null, executed: false, targetUser: makeUser() };
      mockPrisma.adminRoleProposal.findUnique.mockResolvedValue(proposal);

      await expect(service.confirmRoleChange('prop-1', '0xadmin')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when proposal is already executed', async () => {
      mockPrisma.adminRoleProposal.findUnique.mockResolvedValue({ id: 'prop-1', executed: true });

      await expect(service.confirmRoleChange('prop-1', '0xadmin2')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when proposal does not exist', async () => {
      mockPrisma.adminRoleProposal.findUnique.mockResolvedValue(null);

      await expect(service.confirmRoleChange('bad-id', '0xadmin2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelRoleProposal', () => {
    it('deletes the proposal when called by the proposer', async () => {
      const proposal = { id: 'prop-1', proposer: '0xadmin', executed: false };
      mockPrisma.adminRoleProposal.findUnique.mockResolvedValue(proposal);
      mockPrisma.adminRoleProposal.delete.mockResolvedValue(proposal);

      const result = await service.cancelRoleProposal('prop-1', '0xadmin');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.adminRoleProposal.delete).toHaveBeenCalledWith({ where: { id: 'prop-1' } });
    });

    it('throws ForbiddenException when a non-proposer tries to cancel', async () => {
      mockPrisma.adminRoleProposal.findUnique.mockResolvedValue({ id: 'prop-1', proposer: '0xadmin1', executed: false });

      await expect(service.cancelRoleProposal('prop-1', '0xadmin2')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when proposal is already executed', async () => {
      mockPrisma.adminRoleProposal.findUnique.mockResolvedValue({ id: 'prop-1', proposer: '0xadmin', executed: true });

      await expect(service.cancelRoleProposal('prop-1', '0xadmin')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUsers', () => {
    it('returns paginated users when no search provided', async () => {
      const users = [makeUser()];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers();

      expect(result.items).toEqual(users);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('applies search filter on name, walletAddress, and email', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

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

    it('uses correct skip for page 3 with limit 5', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getUsers(undefined, 3, 5);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });
});
