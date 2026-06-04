/**
 * read-contract.ts
 *
 * Reads and displays the full state of the deployed CampaignFactory contract.
 * Pure read-only — no transactions, no gas.
 *
 * Run:
 *   npx hardhat run scripts/read-contract.ts --network sepolia
 *
 * Or against a local node:
 *   npx hardhat run scripts/read-contract.ts --network localhost
 */

import { ethers } from "hardhat";

// ─── Status Maps ─────────────────────────────────────────────────────────────

const CAMPAIGN_STATUS: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Funded",
  3: "Completed",
  4: "Cancelled",
  5: "Flagged",
};

const MILESTONE_STATUS: Record<number, string> = {
  0: "Pending",
  1: "Voting",
  2: "Approved",
  3: "Rejected",
  4: "Completed",
};

const PAYMENT_TOKEN: Record<number, string> = {
  0: "ETH",
  1: "USDC",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (wei: bigint, token: number) =>
  token === 1
    ? `${(Number(wei) / 1e6).toFixed(2)} USDC`
    : `${ethers.formatEther(wei)} ETH`;

const fmtDate = (ts: bigint) =>
  ts === 0n ? "—" : new Date(Number(ts) * 1000).toLocaleString();

const short = (addr: string) =>
  addr === ethers.ZeroAddress ? "—" : `${addr.slice(0, 8)}…${addr.slice(-4)}`;

const bar = (raised: bigint, goal: bigint, width = 20): string => {
  if (goal === 0n) return "─".repeat(width);
  const pct = Number((raised * 100n) / goal);
  const filled = Math.min(Math.round((pct / 100) * width), width);
  return "█".repeat(filled) + "░".repeat(width - filled) + ` ${pct}%`;
};

const divider = (char = "─", len = 60) => char.repeat(len);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const contractAddress = process.env.CAMPAIGN_FACTORY_ADDRESS;
  if (!contractAddress) {
    throw new Error("CAMPAIGN_FACTORY_ADDRESS env var is required");
  }

  const provider = ethers.provider;
  const network = await provider.getNetwork();

  // Use the TypeChain factory for type-safe access
  const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
  const contract = CampaignFactory.attach(contractAddress) as any;

  console.log("\n📊  CampaignFactory State Reader");
  console.log(divider("═"));
  console.log(`Contract  : ${contractAddress}`);
  console.log(`Network   : ${network.name} (chainId ${network.chainId})`);

  const contractBalance = await provider.getBalance(contractAddress);
  console.log(`ETH held  : ${ethers.formatEther(contractBalance)} ETH`);

  const total = await contract.campaignCounter();
  console.log(`Campaigns : ${total.toString()}`);

  if (total === 0n) {
    console.log("\n(no campaigns yet — run seed-demo.ts first)");
    return;
  }

  // ── Per-campaign breakdown ─────────────────────────────────────────────────

  for (let i = 1n; i <= total; i++) {
    let campaign: any;
    try {
      campaign = await contract.getCampaign(i);
    } catch {
      console.log(`\nCampaign #${i}: not found (may have been created differently)`);
      continue;
    }

    const token = Number(campaign.paymentToken);
    const status = CAMPAIGN_STATUS[Number(campaign.status)] ?? `Unknown(${campaign.status})`;

    console.log(`\n${divider()}`);
    console.log(`Campaign #${campaign.campaignId}  ·  ${status.toUpperCase()}`);
    console.log(divider());
    console.log(`Creator   : ${short(campaign.creator)}`);
    console.log(`IPFS Hash : ${campaign.ipfsHash}`);
    console.log(`Token     : ${PAYMENT_TOKEN[token] ?? "Unknown"}`);
    console.log(`Goal      : ${fmt(campaign.fundGoal, token)}`);
    console.log(`Raised    : ${fmt(campaign.raisedAmount, token)}`);
    console.log(`Withdrawn : ${fmt(campaign.withdrawnAmount, token)}`);
    console.log(`Reclaimed : ${campaign.fundsReclaimed}`);
    console.log(`Deadline  : ${fmtDate(campaign.deadline)}`);
    console.log(`Progress  : [${bar(campaign.raisedAmount, campaign.fundGoal)}]`);

    // Milestones
    const milestoneIds: bigint[] = await contract.getCampaignMilestones(i);
    if (milestoneIds.length === 0) {
      console.log(`Milestones: (none)`);
    } else {
      console.log(`\nMilestones (${milestoneIds.length}):`);
      for (const msId of milestoneIds) {
        const ms = await contract.getMilestone(msId);
        const msStatus = MILESTONE_STATUS[Number(ms.status)] ?? `Unknown(${ms.status})`;
        const pct =
          ms.raisedAmountAtVotingStart > 0n
            ? ` | quorum snapshot: ${fmt(ms.raisedAmountAtVotingStart, token)}`
            : "";
        const votes =
          ms.status === 1n // Voting
            ? ` | for: ${fmt(ms.votesFor, token)} · against: ${fmt(ms.votesAgainst, token)}`
            : "";
        const votingEnd =
          ms.votingEndTime > 0n ? ` | voting ends: ${fmtDate(ms.votingEndTime)}` : "";

        console.log(
          `  [${msId}] ${msStatus.padEnd(10)} ${fmt(ms.amountRequired, token).padEnd(14)}` +
          ` | attempts: ${ms.submissionCount}${pct}${votes}${votingEnd}`
        );
        if (ms.ipfsHash && ms.ipfsHash !== ethers.ZeroHash) {
          console.log(`         proof: ${ms.ipfsHash}`);
        }
      }
    }

    // Contributor amount for the admin wallet (useful for testing)
    const [signer] = await ethers.getSigners();
    const adminContrib = await contract.getContributorAmount(i, signer.address);
    if (adminContrib > 0n) {
      console.log(`\nYour contribution: ${fmt(adminContrib, token)} (${short(signer.address)})`);
    }

    // Flag / Refund proposals
    try {
      const flag = await contract.getFlagProposal(i);
      if (flag.proposer !== ethers.ZeroAddress) {
        console.log(
          `\nFlag proposal: proposer=${short(flag.proposer)}` +
          ` | executed=${flag.executed}` +
          ` | reason="${flag.reason}"`
        );
      }
    } catch { /* no flag */ }

    try {
      const refund = await contract.getRefundProposal(i);
      if (refund.proposer !== ethers.ZeroAddress) {
        console.log(
          `Refund proposal: proposer=${short(refund.proposer)}` +
          ` | executed=${refund.executed}`
        );
      }
    } catch { /* no refund */ }
  }

  // ── Contract-level settings ────────────────────────────────────────────────

  console.log(`\n${divider("═")}`);
  console.log("Contract Settings");
  console.log(divider());

  const minETH  = await contract.minContributionETH();
  const minUSDC = await contract.minContributionUSDC();
  console.log(`Min contribution (ETH)  : ${ethers.formatEther(minETH)} ETH`);
  console.log(`Min contribution (USDC) : ${(Number(minUSDC) / 1e6).toFixed(2)} USDC`);

  const paused = await contract.paused();
  console.log(`Paused                  : ${paused}`);

  const [signer] = await ethers.getSigners();
  const adminRole = await contract.DEFAULT_ADMIN_ROLE();
  const isAdmin = await contract.hasRole(adminRole, signer.address);
  console.log(`Your wallet admin role  : ${isAdmin} (${signer.address})`);

  console.log(`\n${divider("═")}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
