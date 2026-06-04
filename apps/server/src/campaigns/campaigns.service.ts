import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueryCampaignsDto } from './dto/query-campaigns.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignStatus, NotificationType, Prisma } from '../generated/prisma';

const creatorSelect = {
  id: true,
  name: true,
  walletAddress: true,
  avatar: true,
};

const campaignInclude = {
  creator: { select: creatorSelect },
  _count: { select: { milestones: true, contributions: true } },
};

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ipfs: IpfsService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: QueryCampaignsDto) {
    const { category, status, sort, search, page = 1, limit = 12 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (sort === 'trending') {
      // Trending = active/funded campaigns sorted by raisedAmount desc (highest absolute
      // funding correlates strongly with high funding ratio and contributor engagement).
      // Doing this in the DB avoids loading all campaigns into memory.
      const trendingWhere: any = {
        ...where,
        ...(status ? {} : { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.FUNDED] } }),
      };
      const [items, total] = await Promise.all([
        this.prisma.campaign.findMany({
          where: trendingWhere,
          orderBy: { raisedAmount: 'desc' },
          skip,
          take: limit,
          include: campaignInclude,
        }),
        this.prisma.campaign.count({ where: trendingWhere }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const orderBy: any =
      sort === 'most_funded' ? { raisedAmount: 'desc' } : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: campaignInclude,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findTrending() {
    return this.prisma.campaign.findMany({
      where: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.FUNDED] } },
      include: campaignInclude,
      orderBy: { raisedAmount: 'desc' },
      take: 3,
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        creator: { select: creatorSelect },
        _count: { select: { milestones: true, contributions: true } },
        flagProposals: {
          where: { executed: true },
          select: { reason: true },
          orderBy: { proposedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async findMilestones(id: string) {
    await this.ensureExists(id);
    return this.prisma.milestone.findMany({
      where: { campaignId: id },
      include: { _count: { select: { votes: true } } },
      orderBy: [
        { onChainId: { sort: 'asc', nulls: 'last' } },
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async findUpdates(id: string) {
    await this.ensureExists(id);
    return this.prisma.update.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUpdate(campaignId: string, userId: string, dto: { title: string; content: string }) {
    const campaign = await this.ensureExists(campaignId);
    if (campaign.creatorId !== userId) throw new ForbiddenException();
    return this.prisma.update.create({
      data: { title: dto.title, content: dto.content, campaignId },
    });
  }

  async createCampaign(userId: string, dto: CreateCampaignDto) {
    const {
      milestones,
      deadline,
      onChainId,
      transactionHash,
      paymentToken,
      ipfsHash,
      images,
      documents,
      ...rest
    } = dto;

    // Pin a metadata JSON to IPFS so the on-chain ipfsHash points at a real,
    // content-addressed record of the campaign (title, description, media). When
    // Pinata is not configured we keep any client-provided hash so local dev and
    // the existing approve flow still work; media columns persist either way.
    let metadataCid = ipfsHash ?? null;
    if (this.ipfs.isConfigured()) {
      try {
        metadataCid = await this.ipfs.pinJSON(
          {
            name: rest.title,
            description: rest.description,
            category: rest.category,
            images: images ?? [],
            documents: documents ?? [],
            website: rest.website ?? null,
            repository: rest.repositoryUrl ?? null,
          },
          `campaign:${rest.title}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to pin campaign metadata: ${(err as Error).message}`,
        );
      }
    }

    return this.prisma.campaign.create({
      data: {
        ...rest,
        deadline: deadline ? new Date(deadline) : undefined,
        creatorId: userId,
        status: CampaignStatus.PENDING,
        onChainId: onChainId ?? null,
        transactionHash: transactionHash ?? null,
        paymentToken: paymentToken ?? 'ETH',
        ipfsHash: metadataCid,
        images: images ?? [],
        documents: (documents ?? []) as unknown as Prisma.InputJsonValue,
        milestones: {
          create: milestones.map((m, idx) => ({
            ...m,
            order: idx,
            deadline: m.deadline ? new Date(m.deadline) : undefined,
          })),
        },
        forum: { create: {} },
      },
      include: { milestones: true },
    });
  }

  async updateCampaign(id: string, userId: string, dto: UpdateCampaignDto) {
    const campaign = await this.ensureExists(id);
    if (campaign.creatorId !== userId) throw new ForbiddenException();
    if (campaign.status !== CampaignStatus.PENDING && campaign.status !== CampaignStatus.CHANGES_REQUESTED) {
      throw new ForbiddenException('Can only edit campaigns that are PENDING or awaiting changes');
    }
    const { deadline, ...rest } = dto;
    if (deadline !== undefined) {
      const newDeadline = new Date(deadline);
      if (newDeadline <= new Date()) {
        throw new BadRequestException('Deadline must be in the future');
      }
    }
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...rest,
        ...(deadline !== undefined && { deadline: new Date(deadline) }),
      },
    });
  }

  async resubmitCampaign(id: string, userId: string): Promise<void> {
    const campaign = await this.ensureExists(id);
    if (campaign.creatorId !== userId) throw new ForbiddenException();
    if (campaign.status !== CampaignStatus.CHANGES_REQUESTED) {
      throw new ForbiddenException('Campaign is not awaiting changes');
    }
    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PENDING, reviewMessage: null },
    });
    await this.notifications.notifyAdmins(
      NotificationType.CAMPAIGN_APPROVAL_PROPOSED,
      'Campaign Resubmitted for Review',
      `"${campaign.title}" has been updated by the creator and is ready for re-review.`,
      { campaignId: id, campaignTitle: campaign.title },
      `RESUBMITTED:${id}:${Date.now()}`,
    );
  }

  async findCreatorProjects(userId: string) {
    return this.prisma.campaign.findMany({
      where: { creatorId: userId },
      include: {
        _count: { select: { milestones: true, contributions: true } },
        milestones: {
          select: { id: true, title: true, status: true, amount: true, onChainId: true, proofUrl: true, submissionCount: true },
          orderBy: { order: 'asc' as const },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublicStats() {
    const [totalRaisedAgg, activeCampaigns, completedCampaigns, finishedCampaigns, totalContributors] =
      await Promise.all([
        this.prisma.campaign.aggregate({ _sum: { raisedAmount: true } }),
        this.prisma.campaign.count({
          where: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.FUNDED] } },
        }),
        this.prisma.campaign.count({ where: { status: CampaignStatus.COMPLETED } }),
        this.prisma.campaign.count({
          where: {
            status: { in: [CampaignStatus.COMPLETED, CampaignStatus.FAILED, CampaignStatus.FLAGGED] },
          },
        }),
        this.prisma.user.count({ where: { contributions: { some: {} } } }),
      ]);

    return {
      totalRaised: Number(totalRaisedAgg._sum.raisedAmount ?? 0),
      activeCampaigns,
      totalContributors,
      successRate: finishedCampaigns > 0 ? Math.round((completedCampaigns / finishedCampaigns) * 100) : 0,
    };
  }

  async exportContributions(campaignId: string, userId: string) {
    const campaign = await this.ensureExists(campaignId);
    if (campaign.creatorId !== userId) throw new ForbiddenException();

    const contributions = await this.prisma.contribution.findMany({
      where: { campaignId },
      select: {
        id: true,
        amount: true,
        transactionHash: true,
        timestamp: true,
        refunded: true,
        contributor: { select: { walletAddress: true, name: true } },
      },
      orderBy: { timestamp: 'asc' },
    });

    return { paymentToken: campaign.paymentToken, contributions };
  }

  private async ensureExists(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
