import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus, MilestoneStatus, UserRole } from '../generated/prisma';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [pending, flagged, rejected, totalRaisedAgg] = await Promise.all([
      this.prisma.campaign.count({ where: { status: CampaignStatus.PENDING } }),
      this.prisma.campaign.count({ where: { status: CampaignStatus.FLAGGED } }),
      this.prisma.campaign.count({ where: { status: CampaignStatus.FAILED } }),
      this.prisma.campaign.aggregate({ _sum: { raisedAmount: true } }),
    ]);
    return {
      pending,
      flagged,
      rejected,
      totalRaised: Number(totalRaisedAgg._sum.raisedAmount ?? 0),
    };
  }

  async getActivity() {
    const [campaigns, milestones] = await Promise.all([
      this.prisma.campaign.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          creator: { select: { walletAddress: true, name: true } },
        },
      }),
      this.prisma.milestone.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          campaign: { select: { id: true, title: true } },
        },
      }),
    ]);

    const activity = [
      ...campaigns.map((c) => ({ type: 'campaign', ...c })),
      ...milestones.map((m) => ({ type: 'milestone', ...m })),
    ].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return activity.slice(0, 20);
  }

  async getTransactions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.contribution.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          campaign: { select: { id: true, title: true, paymentToken: true } },
          contributor: { select: { walletAddress: true, name: true } },
        },
      }),
      this.prisma.contribution.count(),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getVerification(search?: string) {
    const where: any = { status: CampaignStatus.PENDING };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { creator: { walletAddress: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.campaign.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, walletAddress: true } },
        _count: { select: { milestones: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getProjects() {
    const campaigns = await this.prisma.campaign.findMany({
      include: {
        creator: { select: { id: true, name: true, walletAddress: true } },
        _count: { select: { milestones: true, contributions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.sort((a, b) => {
      if (a.status === CampaignStatus.FLAGGED && b.status !== CampaignStatus.FLAGGED) return -1;
      if (b.status === CampaignStatus.FLAGGED && a.status !== CampaignStatus.FLAGGED) return 1;
      return 0;
    });
  }

  async getProject(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        creator: true,
        milestones: { include: { _count: { select: { votes: true } } } },
        contributions: {
          include: {
            contributor: { select: { walletAddress: true, name: true } },
          },
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
        updates: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async getFinancialSummary(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { milestones: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Use the tracked releasedAmount field (incremented by indexer on MilestoneFundsReleased)
    const releasedAmount = Number(campaign.releasedAmount);

    const milestoneBreakdown = campaign.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      amount: Number(m.amount),
      status: m.status,
    }));

    return {
      raisedAmount: Number(campaign.raisedAmount),
      goalAmount: Number(campaign.goalAmount),
      releasedAmount,
      remainingAmount: Number(campaign.raisedAmount) - releasedAmount,
      milestoneBreakdown,
    };
  }

  async approveCampaign(id: string, onChainId: number) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Admin called createCampaign() on-chain and passes back the resulting on-chain ID.
    // Link the DB campaign, mark it approved/active, and promote the creator to CREATOR role
    // so they have a verified-creator badge for future campaigns.
    await this.prisma.$transaction([
      this.prisma.campaign.update({
        where: { id },
        data: { onChainId, isAdminApproved: true, status: CampaignStatus.ACTIVE },
      }),
      this.prisma.user.update({
        where: { id: campaign.creatorId },
        data: { role: UserRole.CREATOR },
      }),
    ]);

    return { success: true, onChainId };
  }

  async rejectCampaign(id: string) {
    await this.ensureExists(id);
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.FAILED },
    });
  }

  async flagCampaign(id: string, reason: string) {
    await this.ensureExists(id);

    // The admin signs flagCampaign() directly from their wallet on the frontend.
    // This endpoint performs the immediate DB update; the indexer also syncs from the CampaignFlagged event.
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.FLAGGED },
    });
  }

  async blockCampaign(id: string) {
    return this.flagCampaign(id, 'blocked');
  }

  /** First admin proposes a refund — signed from their wallet on the frontend */
  async proposeRefund(id: string) {
    const campaign = await this.ensureExists(id);
    if (campaign.onChainId === null) throw new BadRequestException('Campaign is not on-chain');
    return { message: 'Sign proposeRefund() from your admin wallet. The indexer will sync the DB once the transaction confirms.' };
  }

  /** Second admin approves the refund — signed from their wallet on the frontend */
  async approveRefund(id: string) {
    const campaign = await this.ensureExists(id);
    if (campaign.onChainId === null) throw new BadRequestException('Campaign is not on-chain');
    return { message: 'Sign approveRefund() from your admin wallet. Contributors can claim refunds once the transaction confirms.' };
  }

  async getRefundProposals() {
    return this.prisma.refundProposal.findMany({
      orderBy: { proposedAt: 'desc' },
      include: {
        campaign: { select: { id: true, title: true, onChainId: true } },
      },
    });
  }

  async getRefundProposalForCampaign(campaignId: string) {
    const proposal = await this.prisma.refundProposal.findFirst({
      where: { campaignId, executed: false },
      orderBy: { proposedAt: 'desc' },
    });
    // Fallback to most recent (including executed) so admins can see history
    if (proposal) return proposal;
    return this.prisma.refundProposal.findFirst({
      where: { campaignId },
      orderBy: { proposedAt: 'desc' },
    });
  }

  async getMilestones(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [milestones, total] = await Promise.all([
      this.prisma.milestone.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          campaign: { select: { id: true, title: true } },
          _count: { select: { votes: true } },
        },
      }),
      this.prisma.milestone.count(),
    ]);

    const ids = milestones.map((m) => m.id);
    const groups = ids.length
      ? await this.prisma.vote.groupBy({
          by: ['milestoneId', 'choice'],
          where: { milestoneId: { in: ids } },
          _count: { _all: true },
        })
      : [];

    const counts = new Map<string, { for: number; against: number }>();
    for (const g of groups) {
      const entry = counts.get(g.milestoneId) ?? { for: 0, against: 0 };
      if (g.choice) entry.for += g._count._all;
      else entry.against += g._count._all;
      counts.set(g.milestoneId, entry);
    }

    const items = milestones.map((m) => {
      const c = counts.get(m.id) ?? { for: 0, against: 0 };
      return { ...m, votesFor: c.for, votesAgainst: c.against };
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getMilestone(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            creatorId: true,
            creator: { select: { walletAddress: true, name: true } },
          },
        },
        votes: {
          include: {
            voter: { select: { walletAddress: true, name: true } },
          },
        },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    return milestone;
  }

  async notifyMilestoneRelease(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: { campaign: { select: { creator: { select: { walletAddress: true } } } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.status !== MilestoneStatus.APPROVED) {
      throw new BadRequestException('Milestone is not approved');
    }
    return {
      message: 'The campaign creator should call releaseMilestoneFunds() from the Creator Studio.',
      creatorWallet: milestone.campaign.creator.walletAddress,
      milestoneOnChainId: milestone.onChainId,
    };
  }

  async setUserRole(userId: string, role: string, currentUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (
      userId === currentUserId &&
      user.role === UserRole.ADMIN &&
      role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Admins cannot demote themselves');
    }

    return this.prisma.user.update({ where: { id: userId }, data: { role: role as any } });
  }

  async getUsers(search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { walletAddress: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        role: true,
        createdAt: true,
        _count: { select: { createdCampaigns: true, contributions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensureExists(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
