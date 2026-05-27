import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReactionType, UserRole } from '../generated/prisma';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

const messageInclude = {
  user: {
    select: { id: true, name: true, walletAddress: true, avatar: true },
  },
  reactions: {
    select: { id: true, type: true, userId: true },
  },
  _count: { select: { replies: true } },
};


const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  /** Strip all HTML tags to prevent XSS. Preserves plain text including special chars. */
  private stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '').trim();
  }

  private applyContributorFlags<T extends { userId: string; user: Record<string, unknown> }>(
    messages: T[],
    contributorIds: Set<string>,
    creatorId: string,
  ): (T & { user: T['user'] & { isContributor: boolean; isCreator: boolean } })[] {
    return messages.map((m) => ({
      ...m,
      user: { ...m.user, isContributor: contributorIds.has(m.userId), isCreator: m.userId === creatorId },
    })) as any;
  }

  async getForumByProjectId(
    campaignId: string,
    cursor?: string,
    limit = DEFAULT_PAGE_SIZE,
  ) {
    const take = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let forum = await this.prisma.forum.findUnique({
      where: { campaignId },
    });
    if (!forum) {
      forum = await this.prisma.forum.create({ data: { campaignId } });
    }

    const topLevel = await this.prisma.message.findMany({
      where: { forumId: forum.id, parentId: null },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = topLevel.length > take;
    const items = hasMore ? topLevel.slice(0, take) : topLevel;

    const ids = items.map((m) => m.id);
    const replies = ids.length
      ? await this.prisma.message.findMany({
          where: { parentId: { in: ids } },
          include: messageInclude,
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Single query covers all unique authors across both items and replies
    const allMessages = [...items, ...replies];
    const allUserIds = [...new Set(allMessages.map((m) => m.userId))];
    const contributorSet = new Set<string>();
    if (allUserIds.length > 0) {
      const contributors = await this.prisma.contribution.findMany({
        where: { campaignId, contributorId: { in: allUserIds } },
        select: { contributorId: true },
      });
      contributors.forEach((c) => contributorSet.add(c.contributorId));
    }

    const annotatedItems = this.applyContributorFlags(items, contributorSet, campaign.creatorId);
    const annotatedReplies = this.applyContributorFlags(replies, contributorSet, campaign.creatorId);

    const repliesByParent = new Map<string, typeof annotatedReplies>();
    for (const r of annotatedReplies) {
      const arr = repliesByParent.get(r.parentId!) ?? [];
      arr.push(r);
      repliesByParent.set(r.parentId!, arr);
    }

    return {
      id: forum.id,
      messages: annotatedItems.map((m) => ({
        ...m,
        replies: repliesByParent.get(m.id) ?? [],
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async createMessage(
    campaignId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let forum = await this.prisma.forum.findUnique({
      where: { campaignId },
    });
    if (!forum) {
      forum = await this.prisma.forum.create({ data: { campaignId } });
    }

    if (dto.parentId) {
      const parent = await this.prisma.message.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.forumId !== forum.id) {
        throw new BadRequestException('Parent message not found in this forum');
      }
      if (parent.parentId) {
        throw new BadRequestException('Replies are limited to one level deep');
      }
      if (parent.isDeleted) {
        throw new BadRequestException('Cannot reply to a deleted message');
      }
    }

    const msg = await this.prisma.message.create({
      data: {
        content: this.stripHtml(dto.content),
        forumId: forum.id,
        userId,
        parentId: dto.parentId ?? null,
      },
      include: messageInclude,
    });

    const isCreator = campaign.creatorId === userId;
    const contribution = await this.prisma.contribution.findFirst({
      where: { campaignId, contributorId: userId },
    });

    return {
      ...msg,
      user: { ...msg.user, isContributor: !!contribution, isCreator },
    };
  }

  async updateMessage(
    messageId: string,
    user: { userId: string; role: UserRole },
    dto: UpdateMessageDto,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit a deleted message');
    }
    if (message.userId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: this.stripHtml(dto.content) },
      include: messageInclude,
    });
  }

  async deleteMessage(messageId: string, user: { userId: string; role: UserRole }) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.userId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    // Soft delete — preserves replies and thread structure
    return this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: '' },
      include: messageInclude,
    });
  }

  async toggleReaction(messageId: string, userId: string, type: ReactionType) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.isDeleted) {
      throw new BadRequestException('Cannot react to a deleted message');
    }

    const existing = await this.prisma.reaction.findUnique({
      where: { messageId_userId_type: { messageId, userId, type } },
    });

    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return { messageId, type, reacted: false };
    }

    await this.prisma.reaction.create({
      data: { messageId, userId, type },
    });
    return { messageId, type, reacted: true };
  }
}
