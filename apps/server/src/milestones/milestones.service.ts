import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitProofDto } from './dto/submit-proof.dto';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

    return this.prisma.milestone.update({
      where: { id },
      data: { proofUrl: dto.proofUrl },
    });
  }
}
