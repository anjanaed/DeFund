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
    // Run keeper every 5 minutes to finalize expired milestone voting
    // and transition deadline-expired campaigns to Funded/Cancelled.
    setInterval(() => this.finalizeExpiredVoting(), 5 * 60 * 1_000);
    setInterval(() => this.checkExpiredDeadlines(), 5 * 60 * 1_000);
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

  private static readonly CHUNK_SIZE = 10_000;

  private async processEvents() {
    const startBlock = this.config.get<number>('startBlock') ?? 0;

    const state = await this.prisma.indexerState.findUnique({
      where: { id: 'singleton' },
    });

    const fromBlock = state ? state.lastBlock + 1 : startBlock;
    const currentBlock = await this.blockchain.getCurrentBlock();

    if (fromBlock > currentBlock) return;

    const contract = this.blockchain.getContract();
    let totalEvents = 0;

    // Walk the range in 10k-block chunks so a long catch-up doesn't exceed RPC limits,
    // and so we only advance lastBlock once a chunk is fully written.
    for (
      let chunkStart = fromBlock;
      chunkStart <= currentBlock;
      chunkStart += IndexerService.CHUNK_SIZE
    ) {
      const chunkEnd = Math.min(
        chunkStart + IndexerService.CHUNK_SIZE - 1,
        currentBlock,
      );

      const logs = await contract.queryFilter('*' as any, chunkStart, chunkEnd);

      // Event handlers are idempotent (upsert / updateMany / existence-checked create),
      // so a crash mid-chunk is safe: the chunk will replay on restart without advancing
      // lastBlock, and individual handler errors are caught per-event so one bad log
      // doesn't abort the whole chunk.
      await this.prisma.$transaction(async () => {
        for (const log of logs) {
          try {
            await this.handleEvent(log as ethers.EventLog);
          } catch (err) {
            this.logger.warn(
              `Failed to handle event ${(log as ethers.EventLog).eventName}`,
              err,
            );
          }
        }

        await this.prisma.indexerState.upsert({
          where: { id: 'singleton' },
          create: { id: 'singleton', lastBlock: chunkEnd },
          update: { lastBlock: chunkEnd },
        });
      });

      totalEvents += logs.length;
    }

    if (totalEvents > 0) {
      this.logger.log(`Indexed ${totalEvents} events up to block ${currentBlock}`);
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
      case 'RefundProposed':
        await this.onRefundProposed(log);
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

    // If the campaign was already linked in DB (e.g. by the admin approval page), skip
    const existing = await this.prisma.campaign.findFirst({
      where: { onChainId: campaignId },
    });
    if (existing) return;

    // Read the ipfsHash from the on-chain campaign struct so we can match it to the
    // DB campaign — the admin wallet called createCampaign(), so msg.sender is the
    // admin (not the creator), making creator-address matching unreliable.
    const contract = this.blockchain.getContract();
    const onChainCampaign = await contract.campaigns(campaignId);
    const ipfsHash = onChainCampaign.ipfsHash as string;

    const campaign = await this.prisma.campaign.findFirst({
      where: { onChainId: null, ipfsHash },
      orderBy: { createdAt: 'desc' },
    });

    if (!campaign) {
      this.logger.warn(
        `CampaignCreated onChainId=${campaignId} — no matching DB campaign for ipfsHash=${ipfsHash}`,
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

    // Atomic conditional update: never overwrite an admin-rejected campaign
    // (FAILED with isAdminApproved=false). The NOT filter makes this a single
    // DB round-trip and avoids the read-then-write race.
    await this.prisma.campaign.updateMany({
      where: {
        onChainId,
        NOT: { AND: [{ status: CampaignStatus.FAILED }, { isAdminApproved: false }] },
      },
      data: { status: dbStatus },
    });
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
    const weight = (log.args[3] as bigint).toString();

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
      create: { choice: approve, weight, voterId: voter.id, milestoneId: milestone.id },
      update: { choice: approve, weight },
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

  private async onRefundProposed(log: ethers.EventLog) {
    // args: (proposalId, campaignId, proposer)
    const proposalOnChainId = Number(log.args[0] as bigint);
    const campaignOnChainId = Number(log.args[1] as bigint);
    const proposer = (log.args[2] as string).toLowerCase();

    const campaign = await this.prisma.campaign.findFirst({
      where: { onChainId: campaignOnChainId },
    });
    if (!campaign) return;

    const block = await this.blockchain.getProvider().getBlock(log.blockNumber);
    const proposedAt = block ? new Date(block.timestamp * 1000) : new Date();
    const expiresAt = new Date(proposedAt.getTime() + 3 * 24 * 60 * 60 * 1000);

    await this.prisma.refundProposal.upsert({
      where: { onChainId: proposalOnChainId },
      create: {
        onChainId: proposalOnChainId,
        proposer,
        proposedAt,
        expiresAt,
        campaignId: campaign.id,
      },
      update: {},
    });
  }

  private async onRefundApproved(log: ethers.EventLog) {
    // args: (proposalId, campaignId, approver)
    const proposalOnChainId = Number(log.args[0] as bigint);
    const campaignOnChainId = Number(log.args[1] as bigint);
    const approver = (log.args[2] as string).toLowerCase();

    await Promise.all([
      this.prisma.campaign.updateMany({
        where: { onChainId: campaignOnChainId },
        data: { fundsReclaimed: true },
      }),
      this.prisma.refundProposal.updateMany({
        where: { onChainId: proposalOnChainId },
        data: { approver, executed: true },
      }),
    ]);
  }

  private async finalizeExpiredVoting() {
    const privateKey = this.config.get<string>('operatorPrivateKey');
    if (!privateKey) return;

    const now = new Date();
    const expired = await this.prisma.milestone.findMany({
      where: { status: MilestoneStatus.VOTING, votingEndTime: { lte: now } },
      select: { onChainId: true, id: true },
    });

    if (expired.length === 0) return;

    const contract = this.blockchain.getContractWithSigner(privateKey);
    for (const milestone of expired) {
      if (milestone.onChainId === null) continue;
      try {
        const tx = await contract.finalizeMilestoneVoting(milestone.onChainId);
        await tx.wait();
        this.logger.log(`Finalized voting for milestone onChainId=${milestone.onChainId}`);
      } catch (err: any) {
        this.logger.warn(`Failed to finalize milestone onChainId=${milestone.onChainId}: ${err.message}`);
      }
    }
  }

  private async checkExpiredDeadlines() {
    const privateKey = this.config.get<string>('operatorPrivateKey');
    if (!privateKey) return;

    const now = new Date();
    const expired = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.ACTIVE,
        deadline: { lte: now },
        onChainId: { not: null },
      },
      select: { onChainId: true, id: true },
    });

    if (expired.length === 0) return;

    const contract = this.blockchain.getContractWithSigner(privateKey);
    for (const campaign of expired) {
      if (campaign.onChainId === null) continue;
      try {
        const tx = await contract.checkCampaignDeadline(campaign.onChainId);
        await tx.wait();
        this.logger.log(`Checked deadline for campaign onChainId=${campaign.onChainId}`);
      } catch (err: any) {
        this.logger.warn(`Failed to check deadline for campaign onChainId=${campaign.onChainId}: ${err.message}`);
      }
    }
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
