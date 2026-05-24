import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

// Enum values matching the contract
const PaymentToken = { ETH: 0, USDC: 1 } as const;
const CampaignStatus = { Pending: 0, Active: 1, Funded: 2, Completed: 3, Cancelled: 4, Flagged: 5 } as const;
const MilestoneStatus = { Pending: 0, Voting: 1, Approved: 2, Rejected: 3, Completed: 4 } as const;

const ONE_ETH = hre.ethers.parseEther("1");
const TEN_ETH = hre.ethers.parseEther("10");
const SEVEN_DAYS = 7 * 24 * 60 * 60;
const THIRTY_DAYS = 30 * 24 * 60 * 60;

async function deployFixture() {
  const [deployer, creator, contributor1, contributor2, admin2, nonAdmin] =
    await hre.ethers.getSigners();

  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("USD Coin", "USDC");

  const Factory = await hre.ethers.getContractFactory("CampaignFactory");
  const factory = await Factory.deploy(await usdc.getAddress());

  // Mint USDC to contributors for USDC-campaign tests
  await usdc.mint(contributor1.address, hre.ethers.parseUnits("10000", 18));
  await usdc.mint(contributor2.address, hre.ethers.parseUnits("10000", 18));

  return { factory, usdc, deployer, creator, contributor1, contributor2, admin2, nonAdmin };
}

async function createEthCampaignFixture() {
  const base = await deployFixture();
  const { factory } = base;

  const now = await time.latest();
  const deadline = now + THIRTY_DAYS;
  const milestones = [
    { ipfsHash: "QmMilestone1", amountRequired: hre.ethers.parseEther("6"), deadline },
    { ipfsHash: "QmMilestone2", amountRequired: hre.ethers.parseEther("4"), deadline },
  ];

  const tx = await factory.createCampaign(
    "QmCampaignHash",
    PaymentToken.ETH,
    TEN_ETH,
    deadline,
    milestones,
  );
  await tx.wait();

  return { ...base, deadline, campaignId: 1n, ms1Id: 1n, ms2Id: 2n };
}

async function createUsdcCampaignFixture() {
  const base = await deployFixture();
  const { factory } = base;

  const now = await time.latest();
  const deadline = now + THIRTY_DAYS;
  const GOAL = hre.ethers.parseUnits("1000", 18);
  const milestones = [
    { ipfsHash: "QmUsdcMS1", amountRequired: hre.ethers.parseUnits("600", 18), deadline },
    { ipfsHash: "QmUsdcMS2", amountRequired: hre.ethers.parseUnits("400", 18), deadline },
  ];

  await factory.createCampaign("QmUsdcCamp", PaymentToken.USDC, GOAL, deadline, milestones);

  return { ...base, deadline, campaignId: 1n, ms1Id: 1n, ms2Id: 2n, GOAL };
}

describe("CampaignFactory", function () {

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("grants DEFAULT_ADMIN_ROLE to the deployer", async function () {
      const { factory, deployer } = await loadFixture(deployFixture);

      const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
      expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
    });

    it("stores the USDC token address", async function () {
      const { factory, usdc } = await loadFixture(deployFixture);

      expect(await factory.usdcToken()).to.equal(await usdc.getAddress());
    });

    it("reverts if USDC address is zero", async function () {
      const Factory = await hre.ethers.getContractFactory("CampaignFactory");

      await expect(Factory.deploy(hre.ethers.ZeroAddress)).to.be.revertedWith(
        "Invalid USDC address",
      );
    });
  });

  // ─── Campaign Creation ───────────────────────────────────────────────────────

  describe("createCampaign", function () {
    it("creates campaign and immediately sets status to Active", async function () {
      const { factory, campaignId } = await loadFixture(createEthCampaignFixture);

      const campaign = await factory.getCampaign(campaignId);
      expect(campaign.status).to.equal(CampaignStatus.Active);
    });

    it("stores the correct fund goal and IPFS hash", async function () {
      const { factory, campaignId } = await loadFixture(createEthCampaignFixture);

      const campaign = await factory.getCampaign(campaignId);
      expect(campaign.fundGoal).to.equal(TEN_ETH);
      expect(campaign.ipfsHash).to.equal("QmCampaignHash");
    });

    it("increments campaignCounter", async function () {
      const { factory } = await loadFixture(createEthCampaignFixture);

      expect(await factory.campaignCounter()).to.equal(1n);
    });

    it("creates milestones and links them to the campaign", async function () {
      const { factory, campaignId, ms1Id, ms2Id } = await loadFixture(createEthCampaignFixture);

      const milestoneIds = await factory.getCampaignMilestones(campaignId);
      expect(milestoneIds).to.deep.equal([ms1Id, ms2Id]);

      const ms1 = await factory.getMilestone(ms1Id);
      expect(ms1.amountRequired).to.equal(hre.ethers.parseEther("6"));
      expect(ms1.status).to.equal(MilestoneStatus.Pending);
    });

    it("emits CampaignCreated, CampaignApproved, and CampaignStatusChanged events", async function () {
      const { factory, deployer } = await loadFixture(deployFixture);

      const now = await time.latest();
      const deadline = now + THIRTY_DAYS;
      const milestones = [
        { ipfsHash: "QmTest", amountRequired: TEN_ETH, deadline },
      ];

      await expect(
        factory.createCampaign("QmHash", PaymentToken.ETH, TEN_ETH, deadline, milestones),
      )
        .to.emit(factory, "CampaignCreated")
        .and.to.emit(factory, "CampaignApproved")
        .and.to.emit(factory, "CampaignStatusChanged");
    });

    it("reverts when caller does not have DEFAULT_ADMIN_ROLE", async function () {
      const { factory, nonAdmin } = await loadFixture(deployFixture);

      const now = await time.latest();
      const milestones = [{ ipfsHash: "Qm", amountRequired: ONE_ETH, deadline: now + THIRTY_DAYS }];

      await expect(
        factory.connect(nonAdmin).createCampaign("QmHash", PaymentToken.ETH, ONE_ETH, now + THIRTY_DAYS, milestones),
      ).to.be.reverted;
    });

    it("reverts when IPFS hash is empty", async function () {
      const { factory } = await loadFixture(deployFixture);

      const now = await time.latest();
      const milestones = [{ ipfsHash: "", amountRequired: ONE_ETH, deadline: now + THIRTY_DAYS }];

      await expect(
        factory.createCampaign("", PaymentToken.ETH, ONE_ETH, now + THIRTY_DAYS, milestones),
      ).to.be.revertedWith("IPFS hash required");
    });

    it("reverts when fund goal is zero", async function () {
      const { factory } = await loadFixture(deployFixture);

      const now = await time.latest();
      const milestones = [{ ipfsHash: "Qm", amountRequired: 0n, deadline: now + THIRTY_DAYS }];

      await expect(
        factory.createCampaign("QmHash", PaymentToken.ETH, 0n, now + THIRTY_DAYS, milestones),
      ).to.be.revertedWith("Fund goal must be positive");
    });

    it("reverts when deadline is in the past", async function () {
      const { factory } = await loadFixture(deployFixture);

      const past = (await time.latest()) - 1;
      const milestones = [{ ipfsHash: "Qm", amountRequired: ONE_ETH, deadline: past }];

      await expect(
        factory.createCampaign("QmHash", PaymentToken.ETH, ONE_ETH, past, milestones),
      ).to.be.revertedWith("Deadline must be in future");
    });

    it("reverts when milestone amounts do not sum to the fund goal", async function () {
      const { factory } = await loadFixture(deployFixture);

      const now = await time.latest();
      const deadline = now + THIRTY_DAYS;
      const milestones = [
        { ipfsHash: "Qm1", amountRequired: hre.ethers.parseEther("3"), deadline },
        { ipfsHash: "Qm2", amountRequired: hre.ethers.parseEther("3"), deadline },
      ];

      await expect(
        factory.createCampaign("QmHash", PaymentToken.ETH, TEN_ETH, deadline, milestones),
      ).to.be.revertedWith("Milestone amounts must equal fund goal");
    });

    it("reverts when no milestones are provided", async function () {
      const { factory } = await loadFixture(deployFixture);

      const now = await time.latest();
      await expect(
        factory.createCampaign("QmHash", PaymentToken.ETH, TEN_ETH, now + THIRTY_DAYS, []),
      ).to.be.revertedWith("At least one milestone required");
    });
  });

  // ─── ETH Contributions ───────────────────────────────────────────────────────

  describe("contributeETH", function () {
    it("records contribution and updates raisedAmount", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      const campaign = await factory.getCampaign(campaignId);
      expect(campaign.raisedAmount).to.equal(ONE_ETH);
      expect(await factory.getContributorAmount(campaignId, contributor1.address)).to.equal(ONE_ETH);
    });

    it("transitions campaign to Funded when goal is reached", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: TEN_ETH });

      const campaign = await factory.getCampaign(campaignId);
      expect(campaign.status).to.equal(CampaignStatus.Funded);
    });

    it("emits ContributionMade event with correct args", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await expect(
        factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH }),
      )
        .to.emit(factory, "ContributionMade")
        .withArgs(campaignId, 1n, contributor1.address, ONE_ETH, PaymentToken.ETH);
    });

    it("accumulates contributions from the same contributor", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });
      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      expect(await factory.getContributorAmount(campaignId, contributor1.address)).to.equal(
        hre.ethers.parseEther("2"),
      );
    });

    it("reverts on zero-value contribution", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await expect(
        factory.connect(contributor1).contributeETH(campaignId, { value: 0 }),
      ).to.be.revertedWith("Contribution must be positive");
    });

    it("reverts when campaign uses USDC not ETH", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createUsdcCampaignFixture);

      await expect(
        factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH }),
      ).to.be.revertedWith("Campaign accepts USDC only");
    });

    it("reverts after campaign deadline has passed", async function () {
      const { factory, contributor1, campaignId, deadline } = await loadFixture(createEthCampaignFixture);

      await time.increaseTo(deadline + 1);

      await expect(
        factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH }),
      ).to.be.revertedWith("Campaign ended");
    });

    it("reverts when campaign is not Active", async function () {
      const { factory, deployer, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      // Flag the campaign to make it non-Active
      await factory.connect(contributor1).contributeETH(campaignId, { value: TEN_ETH });
      // Campaign is now Funded — still not Active
      await expect(
        factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH }),
      ).to.be.revertedWith("Campaign not active");
    });
  });

  // ─── USDC Contributions ──────────────────────────────────────────────────────

  describe("contributeUSDC", function () {
    it("transfers USDC from contributor and records contribution", async function () {
      const { factory, usdc, contributor1, campaignId, GOAL } = await loadFixture(createUsdcCampaignFixture);
      const amount = hre.ethers.parseUnits("100", 18);

      await usdc.connect(contributor1).approve(await factory.getAddress(), amount);
      await factory.connect(contributor1).contributeUSDC(campaignId, amount);

      expect(await factory.getContributorAmount(campaignId, contributor1.address)).to.equal(amount);
    });

    it("transitions to Funded when USDC goal is met", async function () {
      const { factory, usdc, contributor1, campaignId, GOAL } = await loadFixture(createUsdcCampaignFixture);

      await usdc.connect(contributor1).approve(await factory.getAddress(), GOAL);
      await factory.connect(contributor1).contributeUSDC(campaignId, GOAL);

      const campaign = await factory.getCampaign(campaignId);
      expect(campaign.status).to.equal(CampaignStatus.Funded);
    });

    it("reverts when campaign accepts ETH not USDC", async function () {
      const { factory, usdc, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);
      const amount = hre.ethers.parseUnits("100", 18);

      await usdc.connect(contributor1).approve(await factory.getAddress(), amount);

      await expect(
        factory.connect(contributor1).contributeUSDC(campaignId, amount),
      ).to.be.revertedWith("Campaign accepts ETH only");
    });

    it("reverts on zero-amount USDC contribution", async function () {
      const { factory, campaignId } = await loadFixture(createUsdcCampaignFixture);

      await expect(
        factory.connect((await hre.ethers.getSigners())[2]).contributeUSDC(campaignId, 0n),
      ).to.be.revertedWith("Contribution must be positive");
    });
  });

  // ─── Milestone Voting Flow ───────────────────────────────────────────────────

  describe("submitMilestoneForVoting", function () {
    it("transitions milestone to Voting status and records proof hash", async function () {
      const { factory, contributor1, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });
      await factory.submitMilestoneForVoting(ms1Id, "QmProofHash");

      const ms = await factory.getMilestone(ms1Id);
      expect(ms.status).to.equal(MilestoneStatus.Voting);
      expect(ms.ipfsHash).to.equal("QmProofHash");
    });

    it("sets votingEndTime to now + 7 days", async function () {
      const { factory, contributor1, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });
      const before = await time.latest();
      await factory.submitMilestoneForVoting(ms1Id, "QmProof");
      const after = await time.latest();

      const ms = await factory.getMilestone(ms1Id);
      expect(ms.votingEndTime).to.be.within(before + SEVEN_DAYS, after + SEVEN_DAYS);
    });

    it("snapshots raisedAmount at voting start for quorum calculation", async function () {
      const { factory, contributor1, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("5") });
      await factory.submitMilestoneForVoting(ms1Id, "QmProof");

      const ms = await factory.getMilestone(ms1Id);
      expect(ms.raisedAmountAtVotingStart).to.equal(hre.ethers.parseEther("5"));
    });

    it("emits MilestoneSubmittedForVoting event", async function () {
      const { factory, contributor1, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      await expect(factory.submitMilestoneForVoting(ms1Id, "QmProof"))
        .to.emit(factory, "MilestoneSubmittedForVoting")
        .withArgs(ms1Id, campaignId, "QmProof", anyValue); // any votingEndTime
    });

    it("reverts when non-creator tries to submit", async function () {
      const { factory, contributor1, nonAdmin, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      await expect(
        factory.connect(nonAdmin).submitMilestoneForVoting(ms1Id, "QmProof"),
      ).to.be.revertedWith("Not campaign creator");
    });

    it("reverts when campaign has no contributions yet", async function () {
      const { factory, ms1Id } = await loadFixture(createEthCampaignFixture);

      await expect(factory.submitMilestoneForVoting(ms1Id, "QmProof")).to.be.revertedWith(
        "No contributions yet",
      );
    });

    it("reverts when trying to submit milestone 2 before milestone 1 is completed", async function () {
      const { factory, contributor1, campaignId, ms2Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      await expect(
        factory.submitMilestoneForVoting(ms2Id, "QmProof"),
      ).to.be.revertedWith("Previous milestone not completed");
    });

    it("reverts when proof IPFS hash is empty", async function () {
      const { factory, contributor1, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      await expect(factory.submitMilestoneForVoting(ms1Id, "")).to.be.revertedWith(
        "Proof required",
      );
    });
  });

  describe("voteOnMilestone", function () {
    async function votingSetupFixture() {
      const base = await createEthCampaignFixture();
      const { factory, contributor1, contributor2, campaignId, ms1Id } = base;

      // contributor1: 6 ETH, contributor2: 4 ETH — total 10 ETH (goal met)
      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("6") });
      await factory.connect(contributor2).contributeETH(campaignId, { value: hre.ethers.parseEther("4") });
      await factory.submitMilestoneForVoting(ms1Id, "QmProof");

      return base;
    }

    it("records vote and emits VoteCast with contribution as weight", async function () {
      const { factory, contributor1, ms1Id } = await loadFixture(votingSetupFixture);

      await expect(factory.connect(contributor1).voteOnMilestone(ms1Id, true))
        .to.emit(factory, "VoteCast")
        .withArgs(ms1Id, contributor1.address, true, hre.ethers.parseEther("6"));
    });

    it("accumulates votes correctly", async function () {
      const { factory, contributor1, contributor2, ms1Id } = await loadFixture(votingSetupFixture);

      await factory.connect(contributor1).voteOnMilestone(ms1Id, true);
      await factory.connect(contributor2).voteOnMilestone(ms1Id, false);

      const ms = await factory.getMilestone(ms1Id);
      expect(ms.votesFor).to.equal(hre.ethers.parseEther("6"));
      expect(ms.votesAgainst).to.equal(hre.ethers.parseEther("4"));
    });

    it("reverts when contributor tries to vote twice", async function () {
      const { factory, contributor1, ms1Id } = await loadFixture(votingSetupFixture);

      await factory.connect(contributor1).voteOnMilestone(ms1Id, true);

      await expect(
        factory.connect(contributor1).voteOnMilestone(ms1Id, false),
      ).to.be.revertedWith("Already voted");
    });

    it("reverts when non-contributor tries to vote", async function () {
      const { factory, nonAdmin, ms1Id } = await loadFixture(votingSetupFixture);

      await expect(
        factory.connect(nonAdmin).voteOnMilestone(ms1Id, true),
      ).to.be.revertedWith("Not a contributor");
    });

    it("reverts when voting period has ended", async function () {
      const { factory, contributor1, ms1Id } = await loadFixture(votingSetupFixture);

      const ms = await factory.getMilestone(ms1Id);
      await time.increaseTo(Number(ms.votingEndTime) + 1);

      await expect(
        factory.connect(contributor1).voteOnMilestone(ms1Id, true),
      ).to.be.revertedWith("Voting period ended");
    });
  });

  // ─── Milestone Finalization ──────────────────────────────────────────────────

  describe("finalizeMilestoneVoting", function () {
    async function fundedAndVotedFixture() {
      const base = await createEthCampaignFixture();
      const { factory, contributor1, contributor2, campaignId, ms1Id } = base;

      // 10 ETH total to meet goal; quorum = 30% of 10 = 3 ETH
      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("6") });
      await factory.connect(contributor2).contributeETH(campaignId, { value: hre.ethers.parseEther("4") });
      await factory.submitMilestoneForVoting(ms1Id, "QmProof");

      return base;
    }

    it("approves milestone when quorum met and majority votes for", async function () {
      const { factory, contributor1, ms1Id } = await loadFixture(fundedAndVotedFixture);

      // contributor1 has 6 ETH (60% of 10 ETH) → quorum (30%) met, majority for
      await factory.connect(contributor1).voteOnMilestone(ms1Id, true);
      const ms = await factory.getMilestone(ms1Id);
      await time.increaseTo(Number(ms.votingEndTime) + 1);

      await factory.finalizeMilestoneVoting(ms1Id);

      expect((await factory.getMilestone(ms1Id)).status).to.equal(MilestoneStatus.Approved);
    });

    it("rejects milestone when quorum is not met", async function () {
      const { factory, contributor1, contributor2, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      // Only 2 ETH total → quorum required = 0.6 ETH, but contributor has 2 ETH
      // Let's make a tiny contribution so quorum is not met
      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("9") });
      await factory.connect(contributor2).contributeETH(campaignId, { value: hre.ethers.parseEther("1") });
      await factory.submitMilestoneForVoting(ms1Id, "QmProof");
      // Only contributor2 (1 ETH) votes — quorum = 30% of 10 = 3 ETH, only 1 ETH voted
      await factory.connect(contributor2).voteOnMilestone(ms1Id, true);
      const ms = await factory.getMilestone(ms1Id);
      await time.increaseTo(Number(ms.votingEndTime) + 1);

      await factory.finalizeMilestoneVoting(ms1Id);

      expect((await factory.getMilestone(ms1Id)).status).to.equal(MilestoneStatus.Rejected);
    });

    it("rejects milestone when majority votes against (even if quorum met)", async function () {
      const { factory, contributor1, contributor2, ms1Id } = await loadFixture(fundedAndVotedFixture);

      // contributor2 (4 ETH against) vs contributor1 (6 ETH for) — actually for wins
      // Let's flip: both vote against
      await factory.connect(contributor1).voteOnMilestone(ms1Id, false);
      await factory.connect(contributor2).voteOnMilestone(ms1Id, false);
      const ms = await factory.getMilestone(ms1Id);
      await time.increaseTo(Number(ms.votingEndTime) + 1);

      await factory.finalizeMilestoneVoting(ms1Id);

      expect((await factory.getMilestone(ms1Id)).status).to.equal(MilestoneStatus.Rejected);
    });

    it("emits MilestoneVotingFinalized event", async function () {
      const { factory, contributor1, ms1Id } = await loadFixture(fundedAndVotedFixture);

      await factory.connect(contributor1).voteOnMilestone(ms1Id, true);
      const ms = await factory.getMilestone(ms1Id);
      await time.increaseTo(Number(ms.votingEndTime) + 1);

      await expect(factory.finalizeMilestoneVoting(ms1Id))
        .to.emit(factory, "MilestoneVotingFinalized")
        .withArgs(ms1Id, true, hre.ethers.parseEther("6"), 0n);
    });

    it("reverts when voting period has not ended", async function () {
      const { factory, contributor1, ms1Id } = await loadFixture(fundedAndVotedFixture);

      await factory.connect(contributor1).voteOnMilestone(ms1Id, true);

      await expect(factory.finalizeMilestoneVoting(ms1Id)).to.be.revertedWith(
        "Voting period not ended",
      );
    });
  });

  // ─── Fund Release ────────────────────────────────────────────────────────────

  describe("releaseMilestoneFunds", function () {
    async function approvedMilestoneFixture() {
      const base = await createEthCampaignFixture();
      const { factory, deployer, contributor1, contributor2, campaignId, ms1Id } = base;

      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("6") });
      await factory.connect(contributor2).contributeETH(campaignId, { value: hre.ethers.parseEther("4") });
      await factory.submitMilestoneForVoting(ms1Id, "QmProof");
      await factory.connect(contributor1).voteOnMilestone(ms1Id, true);
      const ms = await factory.getMilestone(ms1Id);
      await time.increaseTo(Number(ms.votingEndTime) + 1);
      await factory.finalizeMilestoneVoting(ms1Id);

      return base;
    }

    it("transfers ETH to campaign creator (deployer) after milestone approval", async function () {
      const { factory, deployer, ms1Id } = await loadFixture(approvedMilestoneFixture);

      const balanceBefore = await hre.ethers.provider.getBalance(deployer.address);
      const tx = await factory.releaseMilestoneFunds(ms1Id);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await hre.ethers.provider.getBalance(deployer.address);

      // Received 6 ETH minus gas
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(hre.ethers.parseEther("6"));
    });

    it("marks milestone as Completed and updates withdrawnAmount", async function () {
      const { factory, ms1Id, campaignId } = await loadFixture(approvedMilestoneFixture);

      await factory.releaseMilestoneFunds(ms1Id);

      expect((await factory.getMilestone(ms1Id)).status).to.equal(MilestoneStatus.Completed);
      expect((await factory.getCampaign(campaignId)).withdrawnAmount).to.equal(hre.ethers.parseEther("6"));
    });

    it("emits MilestoneFundsReleased event", async function () {
      const { factory, deployer, ms1Id, campaignId } = await loadFixture(approvedMilestoneFixture);

      await expect(factory.releaseMilestoneFunds(ms1Id))
        .to.emit(factory, "MilestoneFundsReleased")
        .withArgs(ms1Id, campaignId, hre.ethers.parseEther("6"), deployer.address);
    });

    it("marks campaign Completed and emits CampaignCompleted when all milestones released", async function () {
      const { factory, contributor1, contributor2, campaignId, ms1Id, ms2Id } =
        await loadFixture(approvedMilestoneFixture);

      // Release milestone 1
      await factory.releaseMilestoneFunds(ms1Id);

      // Submit and approve milestone 2
      await factory.submitMilestoneForVoting(ms2Id, "QmProof2");
      await factory.connect(contributor1).voteOnMilestone(ms2Id, true);
      const ms2 = await factory.getMilestone(ms2Id);
      await time.increaseTo(Number(ms2.votingEndTime) + 1);
      await factory.finalizeMilestoneVoting(ms2Id);

      await expect(factory.releaseMilestoneFunds(ms2Id))
        .to.emit(factory, "CampaignCompleted")
        .withArgs(campaignId);

      expect((await factory.getCampaign(campaignId)).status).to.equal(CampaignStatus.Completed);
    });

    it("reverts when milestone is not in Approved status", async function () {
      const { factory, contributor1, campaignId, ms1Id } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      await expect(factory.releaseMilestoneFunds(ms1Id)).to.be.revertedWith("Milestone not approved");
    });

    it("reverts on double-release attempt", async function () {
      const { factory, ms1Id } = await loadFixture(approvedMilestoneFixture);

      await factory.releaseMilestoneFunds(ms1Id);

      // After release, milestone.status = Completed (not Approved), so the first require fails
      await expect(factory.releaseMilestoneFunds(ms1Id)).to.be.revertedWith("Milestone not approved");
    });

    it("reverts when non-creator tries to release funds", async function () {
      const { factory, nonAdmin, ms1Id } = await loadFixture(approvedMilestoneFixture);

      await expect(factory.connect(nonAdmin).releaseMilestoneFunds(ms1Id)).to.be.revertedWith(
        "Not campaign creator",
      );
    });
  });

  // ─── Refund Flow ─────────────────────────────────────────────────────────────

  describe("Refund flow", function () {
    async function flaggedCampaignFixture() {
      const base = await createEthCampaignFixture();
      const { factory, deployer, admin2, contributor1, contributor2, campaignId } = base;

      // Grant admin role to admin2
      const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
      await factory.grantRole(DEFAULT_ADMIN_ROLE, admin2.address);

      // Fund campaign
      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("6") });
      await factory.connect(contributor2).contributeETH(campaignId, { value: hre.ethers.parseEther("4") });

      // Flag campaign (to be eligible for refund)
      await factory.flagCampaign(campaignId, "fraud detected");

      return base;
    }

    it("proposeRefund creates a refund proposal", async function () {
      const { factory, deployer, campaignId } = await loadFixture(flaggedCampaignFixture);

      await expect(factory.proposeRefund(campaignId))
        .to.emit(factory, "RefundProposed")
        .withArgs(1n, campaignId, deployer.address);
    });

    it("approveRefund marks proposal as executed and enables fundsReclaimed", async function () {
      const { factory, deployer, admin2, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);
      await factory.connect(admin2).approveRefund(campaignId);

      expect((await factory.getCampaign(campaignId)).fundsReclaimed).to.be.true;
    });

    it("emits RefundApproved event", async function () {
      const { factory, admin2, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);

      await expect(factory.connect(admin2).approveRefund(campaignId))
        .to.emit(factory, "RefundApproved")
        .withArgs(1n, campaignId, admin2.address);
    });

    it("reverts when same admin tries to approve their own proposal", async function () {
      const { factory, deployer, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);

      await expect(factory.approveRefund(campaignId)).to.be.revertedWith(
        "Cannot approve own proposal",
      );
    });

    it("reverts when proposal has expired (after 3 days)", async function () {
      const { factory, admin2, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);
      await time.increase(3 * 24 * 60 * 60 + 1); // 3 days + 1 second

      await expect(factory.connect(admin2).approveRefund(campaignId)).to.be.revertedWith(
        "Proposal expired",
      );
    });

    it("claimRefund sends 95% of contribution back to contributor", async function () {
      const { factory, admin2, contributor1, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);
      await factory.connect(admin2).approveRefund(campaignId);

      const contribution = hre.ethers.parseEther("6");
      const expectedRefund = (contribution * 95n) / 100n;

      await expect(factory.connect(contributor1).claimRefund(campaignId)).to.changeEtherBalance(
        contributor1,
        expectedRefund,
      );
    });

    it("emits RefundClaimed event", async function () {
      const { factory, admin2, contributor1, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);
      await factory.connect(admin2).approveRefund(campaignId);

      await expect(factory.connect(contributor1).claimRefund(campaignId))
        .to.emit(factory, "RefundClaimed")
        .withArgs(campaignId, contributor1.address, (hre.ethers.parseEther("6") * 95n) / 100n);
    });

    it("reverts on double-claim attempt", async function () {
      const { factory, admin2, contributor1, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);
      await factory.connect(admin2).approveRefund(campaignId);
      await factory.connect(contributor1).claimRefund(campaignId);

      // After claim, campaignContributions is zeroed → onlyContributor modifier reverts
      await expect(factory.connect(contributor1).claimRefund(campaignId)).to.be.revertedWith(
        "Not a contributor",
      );
    });

    it("reverts when refund has not been approved yet", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);

      await expect(factory.connect(contributor1).claimRefund(campaignId)).to.be.revertedWith(
        "Refund not approved",
      );
    });

    it("reverts when non-contributor tries to claim refund", async function () {
      const { factory, admin2, nonAdmin, campaignId } = await loadFixture(flaggedCampaignFixture);

      await factory.proposeRefund(campaignId);
      await factory.connect(admin2).approveRefund(campaignId);

      await expect(factory.connect(nonAdmin).claimRefund(campaignId)).to.be.revertedWith(
        "Not a contributor",
      );
    });
  });

  // ─── Admin Functions ─────────────────────────────────────────────────────────

  describe("pause / unpause", function () {
    it("prevents contributions when paused", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.pause();

      await expect(
        factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH }),
      ).to.be.reverted;
    });

    it("allows contributions after unpausing", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.pause();
      await factory.unpause();

      await expect(
        factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH }),
      ).to.not.be.reverted;
    });

    it("reverts when non-admin tries to pause", async function () {
      const { factory, nonAdmin } = await loadFixture(deployFixture);

      await expect(factory.connect(nonAdmin).pause()).to.be.reverted;
    });
  });

  describe("flagCampaign", function () {
    it("flags an Active campaign", async function () {
      const { factory, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.flagCampaign(campaignId, "suspicious activity");

      expect((await factory.getCampaign(campaignId)).status).to.equal(CampaignStatus.Flagged);
    });

    it("emits CampaignFlagged event with reason", async function () {
      const { factory, deployer, campaignId } = await loadFixture(createEthCampaignFixture);

      await expect(factory.flagCampaign(campaignId, "fraud"))
        .to.emit(factory, "CampaignFlagged")
        .withArgs(campaignId, deployer.address, "fraud");
    });

    it("reverts when non-admin tries to flag", async function () {
      const { factory, nonAdmin, campaignId } = await loadFixture(createEthCampaignFixture);

      await expect(factory.connect(nonAdmin).flagCampaign(campaignId, "x")).to.be.reverted;
    });
  });

  describe("cancelCampaign", function () {
    it("allows creator (deployer) to cancel an Active campaign", async function () {
      const { factory, deployer, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.cancelCampaign(campaignId);

      expect((await factory.getCampaign(campaignId)).status).to.equal(CampaignStatus.Cancelled);
    });

    it("emits CampaignCancelled event", async function () {
      const { factory, deployer, campaignId } = await loadFixture(createEthCampaignFixture);

      await expect(factory.cancelCampaign(campaignId))
        .to.emit(factory, "CampaignCancelled")
        .withArgs(campaignId, deployer.address);
    });

    it("reverts when non-creator non-admin tries to cancel", async function () {
      const { factory, nonAdmin, campaignId } = await loadFixture(createEthCampaignFixture);

      await expect(factory.connect(nonAdmin).cancelCampaign(campaignId)).to.be.revertedWith(
        "Not authorized",
      );
    });
  });

  describe("checkCampaignDeadline", function () {
    it("reverts when campaign is already Funded (goal reached via contributions)", async function () {
      const { factory, contributor1, campaignId, deadline } = await loadFixture(createEthCampaignFixture);

      // Reaching the goal auto-transitions to Funded; the deadline check only works on Active campaigns
      await factory.connect(contributor1).contributeETH(campaignId, { value: TEN_ETH });
      await time.increaseTo(deadline + 1);

      await expect(factory.checkCampaignDeadline(campaignId)).to.be.revertedWith("Campaign not active");
    });

    it("transitions to Cancelled when deadline passed and goal not met", async function () {
      const { factory, contributor1, campaignId, deadline } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH }); // only 1 of 10 ETH
      await time.increaseTo(deadline + 1);

      await factory.checkCampaignDeadline(campaignId);

      expect((await factory.getCampaign(campaignId)).status).to.equal(CampaignStatus.Cancelled);
    });

    it("reverts when deadline has not been reached yet", async function () {
      const { factory, campaignId } = await loadFixture(createEthCampaignFixture);

      await expect(factory.checkCampaignDeadline(campaignId)).to.be.revertedWith(
        "Deadline not reached",
      );
    });
  });

  // ─── Getters ─────────────────────────────────────────────────────────────────

  describe("Getters", function () {
    it("getActiveCampaigns returns only Active campaign IDs", async function () {
      const { factory, deployer, campaignId } = await loadFixture(createEthCampaignFixture);

      // Create a second campaign and flag it
      const now = await time.latest();
      const deadline = now + THIRTY_DAYS;
      await factory.createCampaign("QmCamp2", PaymentToken.ETH, TEN_ETH, deadline, [
        { ipfsHash: "QmMS", amountRequired: TEN_ETH, deadline },
      ]);
      await factory.flagCampaign(2n, "flagged");

      const active = await factory.getActiveCampaigns();

      expect(active).to.deep.equal([1n]);
    });

    it("getContributorAmount returns the total contribution for an address", async function () {
      const { factory, contributor1, campaignId } = await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });
      await factory.connect(contributor1).contributeETH(campaignId, { value: ONE_ETH });

      expect(await factory.getContributorAmount(campaignId, contributor1.address)).to.equal(
        hre.ethers.parseEther("2"),
      );
    });

    it("getCampaign reverts for invalid campaign ID", async function () {
      const { factory } = await loadFixture(deployFixture);

      await expect(factory.getCampaign(999n)).to.be.revertedWith("Invalid campaign");
    });

    it("getMilestone reverts for invalid milestone ID", async function () {
      const { factory } = await loadFixture(deployFixture);

      await expect(factory.getMilestone(999n)).to.be.revertedWith("Invalid milestone");
    });
  });

  // ─── Milestone Resubmission ──────────────────────────────────────────────────

  describe("Milestone resubmission after rejection", function () {
    it("allows resubmission after rejection and resets vote tallies", async function () {
      const { factory, contributor1, contributor2, campaignId, ms1Id } =
        await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("9") });
      await factory.connect(contributor2).contributeETH(campaignId, { value: hre.ethers.parseEther("1") });

      // First submission — rejected (only 1 ETH of 3 ETH quorum votes)
      await factory.submitMilestoneForVoting(ms1Id, "QmFirstProof");
      await factory.connect(contributor2).voteOnMilestone(ms1Id, true); // 1 ETH, below quorum
      let ms = await factory.getMilestone(ms1Id);
      await time.increaseTo(Number(ms.votingEndTime) + 1);
      await factory.finalizeMilestoneVoting(ms1Id);
      expect((await factory.getMilestone(ms1Id)).status).to.equal(MilestoneStatus.Rejected);

      // Second submission — clears votes, increments submissionCount
      await factory.submitMilestoneForVoting(ms1Id, "QmSecondProof");
      ms = await factory.getMilestone(ms1Id);
      expect(ms.votesFor).to.equal(0n);
      expect(ms.votesAgainst).to.equal(0n);
      expect(ms.submissionCount).to.equal(2n);
      // contributor2 can vote again (hasVoted was cleared)
      await expect(factory.connect(contributor2).voteOnMilestone(ms1Id, true)).to.not.be.reverted;
    });

    it("reverts on third submission (max 2 attempts)", async function () {
      const { factory, contributor1, contributor2, campaignId, ms1Id } =
        await loadFixture(createEthCampaignFixture);

      await factory.connect(contributor1).contributeETH(campaignId, { value: hre.ethers.parseEther("9") });
      await factory.connect(contributor2).contributeETH(campaignId, { value: hre.ethers.parseEther("1") });

      for (let i = 0; i < 2; i++) {
        await factory.submitMilestoneForVoting(ms1Id, `QmProof${i}`);
        const ms = await factory.getMilestone(ms1Id);
        await time.increaseTo(Number(ms.votingEndTime) + 1);
        await factory.finalizeMilestoneVoting(ms1Id);
      }

      await expect(factory.submitMilestoneForVoting(ms1Id, "QmThirdProof")).to.be.revertedWith(
        "Maximum submission attempts reached",
      );
    });
  });
});
