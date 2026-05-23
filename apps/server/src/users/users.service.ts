import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CampaignStatus, MilestoneStatus } from '../generated/prisma';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  async getDashboard(userId: string) {
    const contributions = await this.prisma.contribution.findMany({
      where: { contributorId: userId },
      include: { campaign: { select: { id: true, status: true } } },
    });

    const totalContributed = contributions.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );
    // Locked = funds in campaigns that are active or fully funded but not yet completed
    const lockedFunds = contributions
      .filter((c) =>
        c.campaign.status === CampaignStatus.ACTIVE ||
        c.campaign.status === CampaignStatus.FUNDED,
      )
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const releasedFunds = contributions
      .filter((c) => c.campaign.status === CampaignStatus.COMPLETED)
      .reduce((sum, c) => sum + Number(c.amount), 0);

    return { totalContributed, lockedFunds, releasedFunds };
  }

  async getContributions(userId: string) {
    return this.prisma.contribution.findMany({
      where: { contributorId: userId },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
            raisedAmount: true,
            goalAmount: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getVotingRequired(userId: string) {
    // Milestones in VOTING state for campaigns this user contributed to,
    // excluding milestones where user already voted
    const contributedCampaignIds = (
      await this.prisma.contribution.findMany({
        where: { contributorId: userId },
        select: { campaignId: true },
        distinct: ['campaignId'],
      })
    ).map((c) => c.campaignId);

    const alreadyVotedMilestoneIds = (
      await this.prisma.vote.findMany({
        where: { voterId: userId },
        select: { milestoneId: true },
      })
    ).map((v) => v.milestoneId);

    return this.prisma.milestone.findMany({
      where: {
        status: MilestoneStatus.VOTING,
        campaignId: { in: contributedCampaignIds },
        id: { notIn: alreadyVotedMilestoneIds },
      },
      include: {
        campaign: { select: { id: true, title: true, paymentToken: true } },
      },
      orderBy: { votingEndTime: 'asc' },
    });
  }

  async getTransactions(userId: string) {
    const contributions = await this.prisma.contribution.findMany({
      where: { contributorId: userId },
      include: {
        campaign: { select: { id: true, title: true } },
      },
      orderBy: { timestamp: 'desc' },
    });

    return contributions.map((c) => ({
      id: c.id,
      type: 'contribution' as const,
      amount: Number(c.amount),
      timestamp: c.timestamp,
      transactionHash: c.transactionHash,
      campaign: c.campaign,
      refunded: c.refunded,
    }));
  }

  async getReclaimable(userId: string) {
    const contributions = await this.prisma.contribution.findMany({
      where: {
        contributorId: userId,
        refunded: false,
        campaign: {
          status: { in: [CampaignStatus.FLAGGED, CampaignStatus.FAILED] },
          fundsReclaimed: true,
        },
      },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
            raisedAmount: true,
            onChainId: true,
          },
        },
      },
    });

    // Group by campaign
    const campaignMap = new Map<string, any>();
    for (const c of contributions) {
      const key = c.campaignId;
      if (!campaignMap.has(key)) {
        campaignMap.set(key, { ...c.campaign, totalContributed: 0, contributions: [] });
      }
      const entry = campaignMap.get(key);
      entry.totalContributed += Number(c.amount);
      entry.contributions.push({ id: c.id, amount: Number(c.amount) });
    }

    return Array.from(campaignMap.values());
  }
}
