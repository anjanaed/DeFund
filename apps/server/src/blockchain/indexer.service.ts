import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { CampaignStatus, MilestoneStatus } from '../generated/prisma';

// On-chain CampaignStatus enum (matches Solidity order)
const ON_CHAIN_STATUS: CampaignStatus[] = [
  CampaignStatus.PENDING,   // 0
  CampaignStatus.ACTIVE,    // 1
  CampaignStatus.ACTIVE,    // 2 = Funded → treat as ACTIVE
  CampaignStatus.COMPLETED, // 3
  CampaignStatus.FAILED,    // 4 = Cancelled
  CampaignStatus.FLAGGED,   // 5
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
    // Start polling after a short delay to let the app fully boot
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

    let state = await this.prisma.indexerState.findUnique({
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

    // Upsert IndexerState
    await this.prisma.indexerState.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastBlock: currentBlock },
      update: { lastBlock: currentBlock },
    });

    if (logs.length > 0) {
      this.logger.log(`Indexed ${logs.length} events up to block ${currentBlock}`);
    }
  }

  private async handleEvent(log: ethers.EventLog) {
    const name = log.eventName;

    switch (name) {
      case 'CampaignCreated':
        await this.onCampaignCreated(log);
        break;
      case 'CampaignApproved':
        await this.onCampaignApproved(log);
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
      case 'RefundClaimed':
        await this.onRefundClaimed(log);
        break;
      default:
        // ignore RoleGranted, Paused, etc.
        break;
    }
  }

  private async onCampaignCreated(log: ethers.EventLog) {
    const campaignId = Number(log.args[0] as bigint);
    const creator = (log.args[1] as string).toLowerCase();

    // Find a DB campaign where creator.walletAddress matches, isAdminApproved=true, onChainId is null
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

    const ipfsHash = log.args[5] ? String(log.args[5]) : undefined;

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        onChainId: campaignId,
        ...(ipfsHash && { ipfsHash }),
      },
    });
  }

  private async onCampaignApproved(log: ethers.EventLog) {
    const onChainId = Number(log.args[0] as bigint);
    await this.prisma.campaign.updateMany({
      where: { onChainId },
      data: { status: CampaignStatus.ACTIVE },
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

    const amount =
      token === 0
        ? parseFloat(ethers.formatEther(amountRaw))
        : parseFloat(ethers.formatUnits(amountRaw, 6));

    const txHash = log.transactionHash;

    // Upsert user by wallet address
    const user = await this.prisma.user.upsert({
      where: { walletAddress: contributorAddress },
      create: { walletAddress: contributorAddress },
      update: {},
    });

    const campaign = await this.prisma.campaign.findFirst({
      where: { onChainId: campaignOnChainId },
    });
    if (!campaign) return;

    // Idempotent upsert by transactionHash
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
      // Update campaign raisedAmount
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

    // Idempotent upsert
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
    });
    if (!milestone) return;

    // Decrement campaign raisedAmount to reflect funds leaving the contract
    const amount = parseFloat(ethers.formatEther(amountRaw));
    await this.prisma.campaign.update({
      where: { id: milestone.campaignId },
      data: { raisedAmount: { decrement: amount } },
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
