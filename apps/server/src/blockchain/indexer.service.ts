import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { CampaignStatus, MilestoneStatus } from '../generated/prisma';

// Maps on-chain CampaignStatus enum (Solidity order) to DB enum
const ON_CHAIN_STATUS: CampaignStatus[] = [
  CampaignStatus.PENDING,   // 0 – Pending
  CampaignStatus.ACTIVE,    // 1 – Active
  CampaignStatus.FUNDED,    // 2 – Funded (goal reached, not yet completed)
  CampaignStatus.COMPLETED, // 3 – Completed
  CampaignStatus.FAILED,    // 4 – Cancelled
  CampaignStatus.FLAGGED,   // 5 – Flagged
];

@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.poll(), 5_000);
    this.timer = setInterval(() => this.poll(), 12_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.processEvents();
    } catch (err) {
      this.logger.error('Indexer poll error', err);
    } finally {
      this.processing = false;
    }
  }

  private async processEvents() {
    const startBlock = this.config.get<number>('startBlock') ?? 0;

    const state = await this.prisma.indexerState.findUnique({
      where: { id: 'singleton' },
    });

    const fromBlock = state ? state.lastBlock + 1 : startBlock;
    const currentBlock = await this.blockchain.getCurrentBlock();

    if (fromBlock > currentBlock) return;

    const contract = this.blockchain.getContract();
    const logs = await contract.queryFilter('*' as any, fromBlock, currentBlock);

    for (const log of logs) {
      try {
        await this.handleEvent(log as ethers.EventLog);
      } catch (err) {
        this.logger.warn(`Failed to handle event ${(log as ethers.EventLog).eventName}`, err);
      }
    }

    await this.prisma.indexerState.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastBlock: currentBlock },
      update: { lastBlock: currentBlock },
    });

    if (logs.length > 0) {
      this.logger.log(`Indexed ${logs.length} events up to block ${currentBlock}`);
    }

    // Auto-finalize any milestones whose voting period has expired on-chain
    await this.finalizeExpiredVoting();
  }

  private async finalizeExpiredVoting() {
    const privateKey = this.config.get<string>('adminPrivateKey');
    if (!privateKey) return;

    const expired = await this.prisma.milestone.findMany({
      where: {
        status: MilestoneStatus.VOTING,
        votingEndTime: { lt: new Date() },
        onChainId: { not: null },
      },
      select: { id: true, onChainId: true },
    });

    if (expired.length === 0) return;

    const contract = this.blockchain.getContractWithSigner(privateKey);
    for (const m of expired) {
      try {
        const tx = await contract.finalizeMilestoneVoting(m.onChainId);
        await tx.wait();
        this.logger.log(`Finalized voting for milestone onChainId=${m.onChainId}`);
      } catch (err) {
        this.logger.warn(`Could not finalize milestone onChainId=${m.onChainId}`, err);
      }
    }
  }

  private async handleEvent(log: ethers.EventLog) {
    switch (log.eventName) {
      case 'CampaignCreated':
        await this.onCampaignCreated(log);
        break;
      case 'CampaignApproved':
        await this.onCampaignApproved(log);
        break;
      case 'CampaignStatusChanged':
        await this.onCampaignStatusChanged(log);
        break;
      case 'CampaignFlagged':
        await this.onStatusChange(log.args[0] as bigint, CampaignStatus.FLAGGED);
        break;
      case 'CampaignCancelled':
        await this.onStatusChange(log.args[0] as bigint, CampaignStatus.FAILED);
        break;
      case 'CampaignCompleted':
        await this.onStatusChange(log.args[0] as bigint, CampaignStatus.COMPLETED);
        break;
      case 'ContributionMade':
        await this.onContributionMade(log);
        break;
      case 'MilestoneSubmittedForVoting':
        await this.onMilestoneSubmitted(log);
        break;
      case 'VoteCast':
        await this.onVoteCast(log);
        break;
      case 'MilestoneVotingFinalized':
        await this.onVotingFinalized(log);
        break;
      case 'MilestoneFundsReleased':
        await this.onFundsReleased(log);
        break;
      case 'RefundApproved':
        await this.onRefundApproved(log);
        break;
      case 'RefundClaimed':
        await this.onRefundClaimed(log);
        break;
      default:
        break;
    }
  }

  private async onCampaignCreated(log: ethers.EventLog) {
    const campaignId = Number(log.args[0] as bigint);
    const creator = (log.args[1] as string).toLowerCase();

    // If the campaign was already registered in DB with this onChainId, skip
    const existing = await this.prisma.campaign.findFirst({
      where: { onChainId: campaignId },
    });
    if (existing) return;

    // Try to link to an approved-but-not-yet-deployed DB campaign for this creator
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        onChainId: null,
        isAdminApproved: true,
        creator: { walletAddress: creator },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!campaign) {
      this.logger.warn(
        `CampaignCreated onChainId=${campaignId} — no matching DB campaign for creator ${creator}`,
      );
      return;
    }

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { onChainId: campaignId },
    });
  }

  private async onCampaignApproved(log: ethers.EventLog) {
    const onChainId = Number(log.args[0] as bigint);
    // Only activate campaigns that are still PENDING — don't override an admin rejection
    await this.prisma.campaign.updateMany({
      where: { onChainId, status: CampaignStatus.PENDING },
      data: { status: CampaignStatus.ACTIVE, isAdminApproved: true },
    });
  }

  /** Handles the generic CampaignStatusChanged event emitted for all transitions */
  private async onCampaignStatusChanged(log: ethers.EventLog) {
    const onChainId = Number(log.args[0] as bigint);
    const onChainStatusIndex = Number(log.args[1] as bigint);
    const dbStatus = ON_CHAIN_STATUS[onChainStatusIndex];
    if (!dbStatus) return;

    // Don't overwrite an admin-rejected campaign (FAILED with isAdminApproved=false)
    const campaign = await this.prisma.campaign.findFirst({ where: { onChainId } });
    if (
      campaign &&
      campaign.status === CampaignStatus.FAILED &&
      !campaign.isAdminApproved
    ) {
      return;
    }

    await this.prisma.campaign.updateMany({ where: { onChainId }, data: { status: dbStatus } });
  }

  private async onStatusChange(onChainIdBig: bigint, status: CampaignStatus) {
    const onChainId = Number(onChainIdBig);
    await this.prisma.campaign.updateMany({ where: { onChainId }, data: { status } });
  }

  private async onContributionMade(log: ethers.EventLog) {
    const campaignOnChainId = Number(log.args[0] as bigint);
    const contributorAddress = (log.args[2] as string).toLowerCase();
    const amountRaw = log.args[3] as bigint;
    const token = Number(log.args[4]); // 0=ETH, 1=USDC
    const txHash = log.transactionHash;

    const amount =
      token === 0
        ? parseFloat(ethers.formatEther(amountRaw))
        : parseFloat(ethers.formatUnits(amountRaw, 6));

    const user = await this.prisma.user.upsert({
      where: { walletAddress: contributorAddress },
      create: { walletAddress: contributorAddress },
      update: {},
    });

    const campaign = await this.prisma.campaign.findFirst({
      where: { onChainId: campaignOnChainId },
    });
    if (!campaign) return;

    const existing = await this.prisma.contribution.findUnique({
      where: { transactionHash: txHash },
    });
    if (!existing) {
      await this.prisma.contribution.create({
        data: {
          amount,
          transactionHash: txHash,
          contributorId: user.id,
          campaignId: campaign.id,
        },
      });
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { raisedAmount: { increment: amount } },
      });
    }
  }

  private async onMilestoneSubmitted(log: ethers.EventLog) {
    const milestoneOnChainId = Number(log.args[0] as bigint);
    const proofHash = String(log.args[2]);
    const votingEndTimestamp = Number(log.args[3] as bigint);

    await this.prisma.milestone.updateMany({
      where: { onChainId: milestoneOnChainId },
      data: {
        status: MilestoneStatus.VOTING,
        proofUrl: proofHash,
        votingEndTime: new Date(votingEndTimestamp * 1000),
        submissionCount: { increment: 1 },
      },
    });
  }

  private async onVoteCast(log: ethers.EventLog) {
    const milestoneOnChainId = Number(log.args[0] as bigint);
    const voterAddress = (log.args[1] as string).toLowerCase();
    const approve = Boolean(log.args[2]);

    const [voter, milestone] = await Promise.all([
      this.prisma.user.upsert({
        where: { walletAddress: voterAddress },
        create: { walletAddress: voterAddress },
        update: {},
      }),
      this.prisma.milestone.findFirst({ where: { onChainId: milestoneOnChainId } }),
    ]);

    if (!milestone) return;

    await this.prisma.vote.upsert({
      where: { voterId_milestoneId: { voterId: voter.id, milestoneId: milestone.id } },
      create: { choice: approve, voterId: voter.id, milestoneId: milestone.id },
      update: { choice: approve },
    });
  }

  private async onVotingFinalized(log: ethers.EventLog) {
    const milestoneOnChainId = Number(log.args[0] as bigint);
    const approved = Boolean(log.args[1]);

    await this.prisma.milestone.updateMany({
      where: { onChainId: milestoneOnChainId },
      data: { status: approved ? MilestoneStatus.APPROVED : MilestoneStatus.REJECTED },
    });
  }

  private async onFundsReleased(log: ethers.EventLog) {
    const milestoneOnChainId = Number(log.args[0] as bigint);
    const amountRaw = log.args[2] as bigint;

    const milestone = await this.prisma.milestone.findFirst({
      where: { onChainId: milestoneOnChainId },
      include: { campaign: { select: { id: true, paymentToken: true } } },
    });
    if (!milestone) return;

    // Format amount according to campaign payment token
    const isUsdc = milestone.campaign.paymentToken === 'USDC';
    const amount = isUsdc
      ? parseFloat(ethers.formatUnits(amountRaw, 6))
      : parseFloat(ethers.formatEther(amountRaw));

    // Mark milestone as COMPLETED (funds have been released to creator)
    // Increment campaign's releasedAmount — do NOT touch raisedAmount
    await Promise.all([
      this.prisma.milestone.update({
        where: { id: milestone.id },
        data: { status: MilestoneStatus.COMPLETED },
      }),
      this.prisma.campaign.update({
        where: { id: milestone.campaignId },
        data: { releasedAmount: { increment: amount } },
      }),
    ]);
  }

  private async onRefundApproved(log: ethers.EventLog) {
    // args: (proposalId, campaignId, approver)
    const campaignOnChainId = Number(log.args[1] as bigint);
    await this.prisma.campaign.updateMany({
      where: { onChainId: campaignOnChainId },
      data: { fundsReclaimed: true },
    });
  }

  private async onRefundClaimed(log: ethers.EventLog) {
    const campaignOnChainId = Number(log.args[0] as bigint);
    const contributorAddress = (log.args[1] as string).toLowerCase();

    const [campaign, contributor] = await Promise.all([
      this.prisma.campaign.findFirst({ where: { onChainId: campaignOnChainId } }),
      this.prisma.user.findUnique({ where: { walletAddress: contributorAddress } }),
    ]);

    if (!campaign || !contributor) return;

    await this.prisma.contribution.updateMany({
      where: {
        campaignId: campaign.id,
        contributorId: contributor.id,
        refunded: false,
      },
      data: { refunded: true },
    });
  }
}
