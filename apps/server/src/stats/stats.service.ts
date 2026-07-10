import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus } from '../generated/prisma';
import { EthPriceService } from '../pricing/eth-price.service';

@Injectable()
export class StatsService {
  private cache: { data: any; expiry: number } | null = null;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly ethPrice: EthPriceService,
  ) {}

  async getHomeStats() {
    if (this.cache && Date.now() < this.cache.expiry) {
      return this.cache.data;
    }

    const [raisedByToken, activeProjects, contributorsRaw, completed, resolved] =
      await Promise.all([
        this.prisma.campaign.groupBy({ by: ['paymentToken'], _sum: { raisedAmount: true } }),
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

    // ETH and USDC amounts can't just be added together - convert ETH to its
    // live USD value first so "Total Raised" is an actual dollar figure.
    const ethUsdPrice = this.ethPrice.getUsdPrice();
    const ethRaised = Number(raisedByToken.find((r) => r.paymentToken === 'ETH')?._sum.raisedAmount ?? 0);
    const usdcRaised = Number(raisedByToken.find((r) => r.paymentToken === 'USDC')?._sum.raisedAmount ?? 0);

    const data = {
      totalRaised: ethRaised * ethUsdPrice + usdcRaised,
      ethUsdPrice,
      activeProjects,
      contributors: contributorsRaw.length,
      successRate: resolved > 0 ? Math.round((completed / resolved) * 100) : 0,
    };

    this.cache = { data, expiry: Date.now() + this.TTL_MS };
    return data;
  }
}
