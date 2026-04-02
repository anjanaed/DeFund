import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { CampaignStatus, MilestoneStatus } from '../generated/prisma';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

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
          campaign: { select: { id: true, title: true } },
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

    // Flagged campaigns first
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

    const withdrawnAmount = campaign.milestones
      .filter((m) => m.status === MilestoneStatus.APPROVED)
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const milestoneBreakdown = campaign.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      amount: Number(m.amount),
      status: m.status,
    }));

    return {
      raisedAmount: Number(campaign.raisedAmount),
      goalAmount: Number(campaign.goalAmount),
      withdrawnAmount,
      remainingAmount: Number(campaign.raisedAmount) - withdrawnAmount,
      milestoneBreakdown,
    };
  }

  async approveCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.onChainId !== null) {
      const privateKey = this.config.get<string>('adminPrivateKey');
      if (!privateKey) throw new BadRequestException('Admin private key not configured');
      const contract = this.blockchain.getContractWithSigner(privateKey);
      await contract.approveCampaign(campaign.onChainId);
      return this.prisma.campaign.update({
        where: { id },
        data: { isAdminApproved: true, status: CampaignStatus.ACTIVE },
      });
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { isAdminApproved: true },
    });
  }

  async rejectCampaign(id: string) {
    await this.ensureExists(id);
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.FAILED },
    });
  }

  async flagCampaign(id: string, reason: string) {
    const campaign = await this.ensureExists(id);

    if (campaign.onChainId !== null) {
      const privateKey = this.config.get<string>('adminPrivateKey');
      if (!privateKey) throw new BadRequestException('Admin private key not configured');
      const contract = this.blockchain.getContractWithSigner(privateKey);
      await contract.flagCampaign(campaign.onChainId, reason);
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.FLAGGED },
    });
  }

  async blockCampaign(id: string) {
    return this.flagCampaign(id, 'blocked');
  }

  async getMilestones(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
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
    // releaseMilestoneFunds is creator-only on the contract — we cannot call it.
    // Return instruction for the creator to call it from the frontend.
    return {
      message: 'Notify the campaign creator to call releaseMilestoneFunds() on-chain.',
      creatorWallet: milestone.campaign.creator.walletAddress,
      milestoneOnChainId: milestone.onChainId,
    };
  }

  private async ensureExists(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
