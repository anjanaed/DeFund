import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus } from '../generated/prisma';

@Injectable()
export class StatsService {
  private cache: { data: any; expiry: number } | null = null;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  async getHomeStats() {
    if (this.cache && Date.now() < this.cache.expiry) {
      return this.cache.data;
    }

    const [totalRaisedAgg, activeProjects, contributorsRaw, completed, resolved] =
      await Promise.all([
        this.prisma.campaign.aggregate({ _sum: { raisedAmount: true } }),
        this.prisma.campaign.count({ where: { status: CampaignStatus.ACTIVE } }),
        this.prisma.contribution.findMany({
          select: { contributorId: true },
          distinct: ['contributorId'],
        }),
        this.prisma.campaign.count({
          where: { status: CampaignStatus.COMPLETED },
        }),
        this.prisma.campaign.count({
          where: {
            status: {
              in: [CampaignStatus.COMPLETED, CampaignStatus.FAILED],
            },
          },
        }),
      ]);

    const data = {
      totalRaised: Number(totalRaisedAgg._sum.raisedAmount ?? 0),
      activeProjects,
      contributors: contributorsRaw.length,
      successRate: resolved > 0 ? Math.round((completed / resolved) * 100) : 0,
    };

    this.cache = { data, expiry: Date.now() + this.TTL_MS };
    return data;
  }
}
