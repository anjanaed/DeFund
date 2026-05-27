import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../generated/prisma';
import { MilestoneStatus } from '../generated/prisma';
import { SubmitProofDto } from './dto/submit-proof.dto';

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async getProof(id: string) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id } });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const gateway = this.config.get<string>('ipfsGateway') ?? 'https://ipfs.io/ipfs/';
    let proofUrl = milestone.proofUrl ?? null;
    if (
      proofUrl &&
      (proofUrl.startsWith('Qm') || proofUrl.startsWith('bafy'))
    ) {
      proofUrl = `${gateway}${proofUrl}`;
    }
    return { ...milestone, proofUrl };
  }

  async submitProof(id: string, userId: string, dto: SubmitProofDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: { campaign: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.campaign.creatorId !== userId) throw new ForbiddenException();

    // H7 — only allow proof submission when milestone is actionable by the creator
    const submittableStatuses: MilestoneStatus[] = [MilestoneStatus.PENDING, MilestoneStatus.REJECTED];
    if (!submittableStatuses.includes(milestone.status)) {
      throw new BadRequestException(
        `Cannot submit proof for a milestone in '${milestone.status}' status. Proof can only be submitted when the milestone is PENDING or REJECTED.`,
      );
    }

    const updated = await this.prisma.milestone.update({
      where: { id },
      data: { proofUrl: dto.proofUrl },
    });

    this.notifications.createForContributors(
      milestone.campaignId,
      NotificationType.MILESTONE_PROOF_UPLOADED,
      'Proof Submitted',
      `'${milestone.title}' on "${milestone.campaign.title}" has a new proof to review`,
      {
        campaignId: milestone.campaignId,
        campaignTitle: milestone.campaign.title,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
      },
      `MILESTONE_PROOF_UPLOADED:${milestone.id}:${dto.proofUrl}`,
    ).catch((err) => this.logger.warn('Failed to create MILESTONE_PROOF_UPLOADED notification', err));

    return updated;
  }
}
