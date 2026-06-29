import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CampaignStatus, MilestoneStatus, NotificationType } from '../generated/prisma';

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
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.poll(), 5_000);
    this.timer = setInterval(() => this.poll(), 12_000);
    // Run keeper every 5 minutes to finalize expired milestone voting,
    // transition deadline-expired campaigns to Funded/Cancelled, and
    // expire Funded campaigns whose deadline has passed with unsubmitted milestones (C1/M1).
    setInterval(() => this.finalizeExpiredVoting(), 5 * 60 * 1_000);
    setInterval(() => this.checkExpiredDeadlines(), 5 * 60 * 1_000);
    setInterval(() => this.checkAbandonedFundedCampaigns(), 5 * 60 * 1_000);
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
      case 'CampaignUnflagged':
        await this.onStatusChange(log.args[0] as bigint, CampaignStatus.ACTIVE);
        break;
      case 'CampaignCancelled':
        await this.onCampaignCancelled(log);
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
      case 'FlagProposed':
        await this.onFlagProposed(log);
        break;
      case 'FlagConfirmed':
        await this.onFlagConfirmed(log);
        break;
      case 'ReleaseFundsProposed':
        await this.onReleaseFundsProposed(log);
        break;
      case 'ReleaseFundsConfirmed':
        await this.onReleaseFundsConfirmed(log);
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

    if (dbStatus === CampaignStatus.FUNDED) {
      const campaign = await this.prisma.campaign.findFirst({ where: { onChainId } });
      if (campaign) {
        this.notifications.createForContributors(
          campaign.id,
          NotificationType.CAMPAIGN_FULLY_FUNDED,
          'Campaign Fully Funded',
          `"${campaign.title}" has reached its funding goal!`,
          { campaignId: campaign.id, campaignTitle: campaign.title },
          `CAMPAIGN_FULLY_FUNDED:${campaign.id}`,
        ).catch((err) => this.logger.error('Failed to create CAMPAIGN_FULLY_FUNDED notification', err));

        this.notifications.createForCampaignCreator(
          campaign.id,
          NotificationType.CAMPAIGN_FULLY_FUNDED,
          'Your Campaign is Fully Funded!',
          `Congratulations! "${campaign.title}" has reached its funding goal. You can now submit milestone proofs.`,
          { campaignId: campaign.id, campaignTitle: campaign.title },
          `CREATOR:CAMPAIGN_FULLY_FUNDED:${campaign.id}`,
        ).catch((err) => this.logger.error('Failed to create creator CAMPAIGN_FULLY_FUNDED notification', err));
      }
    }
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

    const milestone = await this.prisma.milestone.findFirst({
      where: { onChainId: milestoneOnChainId },
      include: { campaign: { select: { id: true, title: true } } },
    });
    if (milestone) {
      this.notifications.createForContributors(
        milestone.campaignId,
        NotificationType.MILESTONE_VOTING_STARTED,
        'Vote Now',
        `Voting has started for '${milestone.title}' on "${milestone.campaign.title}"`,
        {
          campaignId: milestone.campaignId,
          campaignTitle: milestone.campaign.title,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
        `MILESTONE_VOTING_STARTED:${milestone.id}`,
      ).catch((err) => this.logger.error('Failed to create MILESTONE_VOTING_STARTED notification', err));

      this.notifications.createForCampaignCreator(
        milestone.campaignId,
        NotificationType.MILESTONE_VOTING_STARTED,
        'Your Milestone is Being Voted On',
        `Voting has started for '${milestone.title}'. Results will be available after the voting period ends.`,
        {
          campaignId: milestone.campaignId,
          campaignTitle: milestone.campaign.title,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
        `CREATOR:MILESTONE_VOTING_STARTED:${milestone.id}`,
      ).catch((err) => this.logger.error('Failed to create creator MILESTONE_VOTING_STARTED notification', err));
    }
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

    const milestone = await this.prisma.milestone.findFirst({
      where: { onChainId: milestoneOnChainId },
      include: { campaign: { select: { id: true, title: true } } },
    });
    if (milestone) {
      const type = approved ? NotificationType.MILESTONE_APPROVED : NotificationType.MILESTONE_REJECTED;
      const title = approved ? 'Milestone Approved' : 'Milestone Rejected';
      const body = approved
        ? `'${milestone.title}' on "${milestone.campaign.title}" was approved`
        : `'${milestone.title}' on "${milestone.campaign.title}" was rejected`;
      this.notifications.createForContributors(
        milestone.campaignId, type, title, body,
        {
          campaignId: milestone.campaignId,
          campaignTitle: milestone.campaign.title,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
        `${type}:${milestone.id}`,
      ).catch((err) => this.logger.error('Failed to create milestone vote result notification', err));

      const creatorTitle = approved ? 'Milestone Approved' : 'Milestone Rejected';
      const creatorBody = approved
        ? `Your milestone '${milestone.title}' was approved by voters. Await admin fund release.`
        : `Your milestone '${milestone.title}' was rejected by voters. You may resubmit up to 3 times.`;
      this.notifications.createForCampaignCreator(
        milestone.campaignId, type, creatorTitle, creatorBody,
        {
          campaignId: milestone.campaignId,
          campaignTitle: milestone.campaign.title,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
        `CREATOR:${type}:${milestone.id}`,
      ).catch((err) => this.logger.error('Failed to create creator milestone vote result notification', err));
    }
  }

  private async onFundsReleased(log: ethers.EventLog) {
    const milestoneOnChainId = Number(log.args[0] as bigint);
    const amountRaw = log.args[2] as bigint;

    const milestone = await this.prisma.milestone.findFirst({
      where: { onChainId: milestoneOnChainId },
      include: {
        campaign: {
          select: { id: true, paymentToken: true },
        },
      },
    });
    if (!milestone) return;

    const isUsdc = milestone.campaign.paymentToken === 'USDC';
    const amount = isUsdc
      ? parseFloat(ethers.formatUnits(amountRaw, 6))
      : parseFloat(ethers.formatEther(amountRaw));

    // Mark milestone as COMPLETED and update campaign releasedAmount
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

    // Unlock the next NOT_STARTED milestone in sequence
    const campaignMilestones = await this.prisma.milestone.findMany({
      where: { campaignId: milestone.campaignId },
      orderBy: { order: 'asc' },
      select: { id: true, status: true },
    });
    const idx = campaignMilestones.findIndex(m => m.id === milestone.id);
    const next = campaignMilestones[idx + 1];
    if (next && next.status === MilestoneStatus.NOT_STARTED) {
      await this.prisma.milestone.update({
        where: { id: next.id },
        data: { status: MilestoneStatus.ONGOING },
      });
    }
  }

  private async onCampaignCancelled(log: ethers.EventLog) {
    const onChainId = Number(log.args[0] as bigint);
    // expireCampaign() and 3rd-rejection auto-cancel both set fundsReclaimed = true
    // on-chain without emitting RefundApproved, so we must read it from the contract
    // here to keep the DB in sync — otherwise contributors never see the Reclaim tab.
    const onChainCampaign = await this.blockchain.getContract().campaigns(BigInt(onChainId));
    await this.prisma.campaign.updateMany({
      where: { onChainId },
      data: {
        status: CampaignStatus.FAILED,
        fundsReclaimed: (onChainCampaign as any).fundsReclaimed ?? false,
      },
    });
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

    await this.prisma.refundProposal.upsert({
      where: { onChainId: proposalOnChainId },
      create: {
        onChainId: proposalOnChainId,
        proposer,
        proposedAt,
        campaignId: campaign.id,
      },
      update: {},
    });

    this.notifications.createForContributors(
      campaign.id,
      NotificationType.REFUND_PROPOSED,
      'Refund Proposed',
      `A refund has been proposed for "${campaign.title}"`,
      { campaignId: campaign.id, campaignTitle: campaign.title },
      `REFUND_PROPOSED:${proposalOnChainId}`,
    ).catch((err) => this.logger.error('Failed to create REFUND_PROPOSED notification', err));
  }

  private async onRefundApproved(log: ethers.EventLog) {
    // args: (proposalId, campaignId, confirmer)
    const proposalOnChainId = Number(log.args[0] as bigint);
    const campaignOnChainId = Number(log.args[1] as bigint);
    const confirmer = (log.args[2] as string).toLowerCase();

    await Promise.all([
      this.prisma.campaign.updateMany({
        where: { onChainId: campaignOnChainId },
        data: { fundsReclaimed: true },
      }),
      // [L2] field renamed from `approver` to `confirmer` to match other proposal models
      this.prisma.refundProposal.updateMany({
        where: { onChainId: proposalOnChainId },
        data: { confirmer, executed: true },
      }),
    ]);

    const campaign = await this.prisma.campaign.findFirst({ where: { onChainId: campaignOnChainId } });
    if (campaign) {
      this.notifications.createForContributors(
        campaign.id,
        NotificationType.REFUND_APPROVED,
        'Refund Available',
        `Your refund for "${campaign.title}" is now available`,
        { campaignId: campaign.id, campaignTitle: campaign.title },
        `REFUND_APPROVED:${proposalOnChainId}`,
      ).catch((err) => this.logger.error('Failed to create REFUND_APPROVED notification', err));
    }
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

    this.logger.log(`[P1] Finalizing ${expired.length} expired voting milestone(s)`);

    const contract = this.blockchain.getContractWithSigner(privateKey);
    const succeeded: number[] = [];
    const failed: number[] = [];

    for (const milestone of expired) {
      if (milestone.onChainId === null) continue;
      try {
        const tx = await contract.finalizeMilestoneVoting(milestone.onChainId);
        const receipt = await tx.wait();
        this.logger.log(
          `[P1] Finalized milestone onChainId=${milestone.onChainId} txHash=${receipt?.hash ?? 'unknown'}`,
        );
        succeeded.push(milestone.onChainId);
      } catch (err: any) {
        this.logger.error(
          `[P1] FAILED to finalize milestone onChainId=${milestone.onChainId}: ${err.message}`,
        );
        failed.push(milestone.onChainId);
      }
    }

    if (succeeded.length > 0) {
      this.logger.log(`[P1] Finalization complete: ${succeeded.length} succeeded, ${failed.length} failed`);
    }

    // P1 — Verification: after 20s, check that successfully-finalized milestones are no longer VOTING
    if (succeeded.length > 0) {
      setTimeout(async () => {
        const stillVoting = await this.prisma.milestone.findMany({
          where: {
            onChainId: { in: succeeded },
            status: MilestoneStatus.VOTING,
          },
          select: { onChainId: true, id: true },
        });
        if (stillVoting.length > 0) {
          this.logger.error(
            `[P1] ALERT: ${stillVoting.length} milestone(s) still in VOTING status after finalization tx confirmed. ` +
            `Indexer may have missed the VotingFinalized event. onChainIds: ${stillVoting.map((m) => m.onChainId).join(', ')}`,
          );
        }
      }, 20_000);
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

  /**
   * [H3] Call expireCampaign() on-chain for ALL Funded campaigns past their deadline.
   *
   * The old filter (only campaigns with unsubmitted milestones) left contributors stranded
   * when creators submitted milestones, got rejections, and then abandoned — the campaign
   * would stay Funded with no refund path. The contract's expireCampaign() now accepts
   * any Funded campaign past its deadline, so we no longer pre-filter by submissionCount.
   */
  private async checkAbandonedFundedCampaigns() {
    const privateKey = this.config.get<string>('operatorPrivateKey');
    if (!privateKey) return;

    const now = new Date();
    const abandoned = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.FUNDED,
        deadline: { lte: now },
        onChainId: { not: null },
      },
      select: { onChainId: true, id: true },
    });

    if (abandoned.length === 0) return;

    const contract = this.blockchain.getContractWithSigner(privateKey);
    for (const campaign of abandoned) {
      if (campaign.onChainId === null) continue;
      try {
        const tx = await (contract as any).expireCampaign(campaign.onChainId);
        await tx.wait();
        this.logger.log(`Expired abandoned funded campaign onChainId=${campaign.onChainId}`);
      } catch (err: any) {
        this.logger.warn(
          `Failed to expire abandoned funded campaign onChainId=${campaign.onChainId}: ${err.message}`,
        );
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

  // args: (proposalId, campaignId, proposer, reason)
  private async onFlagProposed(log: ethers.EventLog) {
    const proposalOnChainId = Number(log.args[0] as bigint);
    const campaignOnChainId = Number(log.args[1] as bigint);
    const proposer = (log.args[2] as string).toLowerCase();
    const reason = String(log.args[3]);

    const campaign = await this.prisma.campaign.findFirst({
      where: { onChainId: campaignOnChainId },
    });
    if (!campaign) return;

    const block = await this.blockchain.getProvider().getBlock(log.blockNumber);
    const proposedAt = block ? new Date(block.timestamp * 1000) : new Date();

    await this.prisma.flagProposal.upsert({
      where: { onChainId: proposalOnChainId },
      create: { onChainId: proposalOnChainId, proposer, reason, proposedAt, campaignId: campaign.id },
      update: {},
    });

    this.notifications.notifyAdmins(
      NotificationType.FLAG_PROPOSED,
      'Flag Proposal Awaiting Confirmation',
      `A flag proposal for "${campaign.title}" needs a second admin to confirm`,
      { campaignId: campaign.id, campaignTitle: campaign.title, reason },
      `FLAG_PROPOSED:${proposalOnChainId}`,
    ).catch((err) => this.logger.error('Failed to create FLAG_PROPOSED notification', err));
  }

  // args: (proposalId, campaignId, confirmer)
  private async onFlagConfirmed(log: ethers.EventLog) {
    const proposalOnChainId = Number(log.args[0] as bigint);
    const confirmer = (log.args[2] as string).toLowerCase();

    await this.prisma.flagProposal.updateMany({
      where: { onChainId: proposalOnChainId },
      data: { confirmer, executed: true },
    });
  }

  // args: (proposalId, milestoneId, proposer)
  private async onReleaseFundsProposed(log: ethers.EventLog) {
    const proposalOnChainId = Number(log.args[0] as bigint);
    const milestoneOnChainId = Number(log.args[1] as bigint);
    const proposer = (log.args[2] as string).toLowerCase();

    const milestone = await this.prisma.milestone.findFirst({
      where: { onChainId: milestoneOnChainId },
      include: { campaign: { select: { id: true, title: true } } },
    });
    if (!milestone) return;

    const block = await this.blockchain.getProvider().getBlock(log.blockNumber);
    const proposedAt = block ? new Date(block.timestamp * 1000) : new Date();

    await this.prisma.releaseFundsProposal.upsert({
      where: { onChainId: proposalOnChainId },
      create: { onChainId: proposalOnChainId, proposer, proposedAt, milestoneId: milestone.id },
      update: {},
    });

    this.notifications.notifyAdmins(
      NotificationType.RELEASE_FUNDS_PROPOSED,
      'Release Funds Proposal Awaiting Confirmation',
      `Milestone "${milestone.title}" on "${milestone.campaign.title}" needs a second admin to confirm fund release`,
      {
        campaignId: milestone.campaignId,
        campaignTitle: milestone.campaign.title,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
      },
      `RELEASE_FUNDS_PROPOSED:${proposalOnChainId}`,
    ).catch((err) => this.logger.error('Failed to create RELEASE_FUNDS_PROPOSED notification', err));
  }

  // args: (proposalId, milestoneId, confirmer)
  // Actual milestone/campaign state is updated by the MilestoneFundsReleased event handler
  private async onReleaseFundsConfirmed(log: ethers.EventLog) {
    const proposalOnChainId = Number(log.args[0] as bigint);
    const confirmer = (log.args[2] as string).toLowerCase();

    await this.prisma.releaseFundsProposal.updateMany({
      where: { onChainId: proposalOnChainId },
      data: { confirmer, executed: true },
    });
  }
}
