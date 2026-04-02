import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

const messageInclude = {
  user: {
    select: { id: true, name: true, walletAddress: true, avatar: true },
  },
};

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  async getForumByProjectId(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let forum = await this.prisma.forum.findUnique({
      where: { campaignId },
      include: {
        messages: {
          include: messageInclude,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!forum) {
      forum = await this.prisma.forum.create({
        data: { campaignId },
        include: {
          messages: {
            include: messageInclude,
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return forum;
  }

  async createMessage(
    campaignId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    let forum = await this.prisma.forum.findUnique({
      where: { campaignId },
    });
    if (!forum) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) throw new NotFoundException('Campaign not found');
      forum = await this.prisma.forum.create({ data: { campaignId } });
    }

    return this.prisma.message.create({
      data: { content: dto.content, forumId: forum.id, userId },
      include: messageInclude,
    });
  }
}
