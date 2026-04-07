import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
  CampaignStatus,
  MilestoneStatus,
} from '../src/generated/prisma';

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

let txIndex = 0;
function makeTxHash(): string {
  const hex = (txIndex++).toString(16).padStart(4, '0');
  return `0x${hex}${'0'.repeat(60)}`;
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.message.deleteMany();
  await prisma.forum.deleteMany();
  await prisma.update.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();
  await prisma.indexerState.deleteMany();

  console.log('Seeding users...');

  const [
    admin,
    max,
    alex,
    sarah,
    david,
    lisa,
    michael,
    defiUser,
    cryptoWhale,
    secureDev,
    contributor1,
    contributor2,
    contributor3,
    contributor4,
    contributor5,
  ] = await Promise.all([
    prisma.user.create({
      data: {
        walletAddress: '0xA000000000000000000000000000000000000001',
        name: 'Platform Admin',
        role: UserRole.ADMIN,
        isVerified: true,
        bio: 'DeFund platform administrator',
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        name: 'Max Verstappen',
        role: UserRole.CREATOR,
        isVerified: true,
        bio: 'DeFi protocol developer & blockchain engineer',
        githubHandle: 'maxverstappen',
        twitterHandle: 'maxverstappen1',
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0xB100000000000000000000000000000000000001',
        name: 'Alex Chen',
        role: UserRole.CREATOR,
        isVerified: true,
        bio: 'Open-source game engine developer',
        githubHandle: 'alexchen-dev',
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0xC200000000000000000000000000000000000002',
        name: 'Sarah Kim',
        role: UserRole.CREATOR,
        isVerified: true,
        bio: 'NFT platform builder & digital artist',
        githubHandle: 'sarahkim-nft',
        twitterHandle: 'sarahkim_nft',
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0xD300000000000000000000000000000000000003',
        name: 'David Park',
        role: UserRole.CREATOR,
        isVerified: true,
        bio: 'Privacy-focused analytics engineer',
        githubHandle: 'davidpark-oss',
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0xE400000000000000000000000000000000000004',
        name: 'Lisa Thompson',
        role: UserRole.CREATOR,
        isVerified: true,
        bio: 'Distributed systems & storage protocol researcher',
        githubHandle: 'lisathompson',
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0xF500000000000000000000000000000000000005',
        name: 'Michael Ross',
        role: UserRole.CREATOR,
        isVerified: true,
        bio: 'DAO governance architect & community builder',
        githubHandle: 'michaelross-dao',
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x1111111111111111111111111111111111111111',
        name: 'DeFiUser123',
        role: UserRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x2222222222222222222222222222222222222222',
        name: 'CryptoWhale',
        role: UserRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x3333333333333333333333333333333333333333',
        name: 'SecureDev',
        role: UserRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x4444444444444444444444444444444444444444',
        name: 'Contributor Alpha',
        role: UserRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x5555555555555555555555555555555555555555',
        name: 'Contributor Beta',
        role: UserRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x6666666666666666666666666666666666666666',
        name: 'Contributor Gamma',
        role: UserRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x7777777777777777777777777777777777777777',
        name: 'Contributor Delta',
        role: UserRole.USER,
      },
    }),
    prisma.user.create({
      data: {
        walletAddress: '0x8888888888888888888888888888888888888888',
        name: 'Contributor Epsilon',
        role: UserRole.USER,
      },
    }),
  ]);

  console.log('Seeding campaigns and milestones...');

  // ── 1. DeFi Lending Protocol ──────────────────────────────────────────
  const defiCampaign = await prisma.campaign.create({
    data: {
      title: 'DeFi Lending Protocol',
      description: `A comprehensive decentralized lending platform that allows users to lend and borrow cryptocurrencies with minimal fees and maximum security. Our protocol leverages cutting-edge smart contract technology to ensure transparency, security, and efficiency.

Key Features:
• Collateralized lending with dynamic interest rates
• Multi-asset support including major cryptocurrencies
• Automated liquidation protection
• Governance token for protocol decisions
• Audited smart contracts by leading security firms

Our mission is to democratize access to financial services by providing a trustless, permissionless lending platform that anyone can use. We believe in transparency, which is why all our code is open-source and our smart contracts are fully audited.`,
      category: 'DeFi',
      goalAmount: 100000,
      raisedAmount: 75000,
      status: CampaignStatus.ACTIVE,
      isAdminApproved: true,
      deadline: new Date('2026-09-30'),
      website: 'https://defilending.io',
      githubUrl: 'https://github.com/maxverstappen/defi-lending',
      creatorId: max.id,
      milestones: {
        create: [
          {
            title: 'Smart Contract Development',
            description:
              'Complete core smart contract architecture and security audits. This includes developing the lending pool contracts, interest rate models, and collateral management system.',
            amount: 30000,
            status: MilestoneStatus.APPROVED,
            proofUrl:
              'Smart contracts have been deployed to the testnet and verified. The security audit was conducted by CertiK and the report is attached. You can verify the contract addresses on Etherscan: 0x123...abc',
          },
          {
            title: 'Frontend Development',
            description:
              'Build user interface and integrate with smart contracts. Create an intuitive dashboard for users to manage their lending and borrowing positions.',
            amount: 25000,
            status: MilestoneStatus.VOTING,
            votingEndTime: new Date('2026-04-14'),
          },
          {
            title: 'Security Audit & Launch',
            description:
              'Complete third-party security audit and mainnet deployment. Final testing and preparation for public launch.',
            amount: 45000,
            status: MilestoneStatus.PENDING,
          },
        ],
      },
      updates: {
        create: [
          {
            title: 'Milestone 1 Completed!',
            content:
              'We are excited to announce that our smart contracts have been fully developed and audited. The audit report is now available on our GitHub.',
            createdAt: new Date('2026-01-15'),
          },
          {
            title: 'Development Progress Update',
            content:
              'Our team has been working hard on the core smart contracts. We expect to complete the security audit by end of this week.',
            createdAt: new Date('2026-01-08'),
          },
        ],
      },
      forum: { create: {} },
    },
  });

  // ── 2. Blockchain Gaming Engine ───────────────────────────────────────
  const gamingCampaign = await prisma.campaign.create({
    data: {
      title: 'Blockchain Gaming Engine',
      description: `Open-source game engine optimized for blockchain gaming with built-in NFT and token support. Designed to lower the barrier for game developers looking to build on-chain experiences without needing deep blockchain expertise.

Key Features:
• Native NFT asset management and rendering
• On-chain game state synchronization
• Gas-optimized transaction batching for game actions
• Unity and Unreal Engine plugin support
• Extensive SDK for JavaScript, Python, and Rust

This engine will power the next generation of fully on-chain games, enabling true asset ownership and interoperability across game universes.`,
      category: 'Gaming',
      goalAmount: 120000,
      raisedAmount: 45000,
      status: CampaignStatus.ACTIVE,
      isAdminApproved: true,
      deadline: new Date('2026-12-31'),
      githubUrl: 'https://github.com/alexchen-dev/blockchain-game-engine',
      creatorId: alex.id,
      milestones: {
        create: [
          {
            title: 'Core Engine Development',
            description:
              'Build the foundational engine architecture, including the blockchain abstraction layer, asset registry, and game loop integration with on-chain state.',
            amount: 120000,
            status: MilestoneStatus.PENDING,
          },
        ],
      },
      forum: { create: {} },
    },
  });

  // ── 3. NFT Marketplace Platform ───────────────────────────────────────
  const nftCampaign = await prisma.campaign.create({
    data: {
      title: 'NFT Marketplace Platform',
      description: `A next-generation NFT marketplace with advanced features for creators and collectors. Built with a focus on low fees, creator royalties, and a seamless user experience across multiple chains.

Key Features:
• Multi-chain support (Ethereum, Polygon, Arbitrum)
• Creator royalty enforcement via smart contracts
• Lazy minting to reduce upfront gas costs
• Curated collections and discovery engine
• Social features: follows, collections, activity feeds

Our marketplace puts creators first, ensuring royalties are always honoured and creators retain control over their work.`,
      category: 'NFT',
      goalAmount: 80000,
      raisedAmount: 35000,
      status: CampaignStatus.ACTIVE,
      isAdminApproved: true,
      deadline: new Date('2026-10-31'),
      website: 'https://nftmarketplace.example',
      githubUrl: 'https://github.com/sarahkim-nft/nft-marketplace',
      creatorId: sarah.id,
      milestones: {
        create: [
          {
            title: 'Smart Contracts & Backend',
            description:
              'Deploy core marketplace smart contracts including royalty enforcement, auction logic, and multi-chain bridging. Build the indexing backend.',
            amount: 25000,
            status: MilestoneStatus.APPROVED,
            proofUrl:
              'Marketplace contracts deployed to Sepolia testnet. Audit completed by OpenZeppelin. Contract addresses and audit report available on GitHub.',
          },
          {
            title: 'Frontend & UI',
            description:
              'Build the responsive marketplace UI with wallet integration, collection browsing, and listing/buying flows.',
            amount: 30000,
            status: MilestoneStatus.PENDING,
          },
          {
            title: 'Launch & Marketing',
            description:
              'Public mainnet launch, creator onboarding campaign, partnerships with established NFT artists, and community building.',
            amount: 25000,
            status: MilestoneStatus.PENDING,
          },
        ],
      },
      forum: { create: {} },
    },
  });

  // ── 4. Open Source Analytics Tools ───────────────────────────────────
  const analyticsCampaign = await prisma.campaign.create({
    data: {
      title: 'Open Source Analytics Tools',
      description: `Privacy-focused analytics platform for Web3 applications. Unlike traditional analytics that track users without consent, our platform provides powerful insights while respecting user privacy through zero-knowledge proofs and on-chain consent management.

Key Features:
• On-chain event tracking with ZK anonymization
• Dashboard builder for dApp usage metrics
• Wallet cohort analysis without exposing addresses
• Open-source SDK for React, Vue, and vanilla JS
• Self-hostable with one-click Docker deployment

We believe analytics should be a tool that benefits both developers and users, not a surveillance mechanism.`,
      category: 'Open Source',
      goalAmount: 30000,
      raisedAmount: 28000,
      status: CampaignStatus.ACTIVE,
      isAdminApproved: true,
      deadline: new Date('2026-05-31'),
      githubUrl: 'https://github.com/davidpark-oss/web3-analytics',
      creatorId: david.id,
      milestones: {
        create: [
          {
            title: 'Analytics Core Module',
            description:
              'Develop the core event tracking SDK, ZK anonymization layer, and backend data pipeline.',
            amount: 15000,
            status: MilestoneStatus.APPROVED,
            proofUrl:
              'Core SDK published on npm as @web3analytics/sdk. ZK circuit audited and verified. Integration tests passing with 98% coverage.',
          },
          {
            title: 'Web3 Integration & Dashboard',
            description:
              'Build the analytics dashboard, wallet cohort tools, and dApp integration plugins.',
            amount: 15000,
            status: MilestoneStatus.VOTING,
            votingEndTime: new Date('2026-04-10'),
          },
        ],
      },
      updates: {
        create: [
          {
            title: 'SDK v1.0 Published!',
            content:
              'The analytics core SDK has been published to npm. Developers can now integrate privacy-preserving analytics into their dApps with just a few lines of code.',
            createdAt: new Date('2026-02-20'),
          },
        ],
      },
      forum: { create: {} },
    },
  });

  // ── 5. Decentralized Storage Network ─────────────────────────────────
  const storageCampaign = await prisma.campaign.create({
    data: {
      title: 'Decentralized Storage Network',
      description: `Building a secure and efficient decentralized storage solution for Web3. Our network enables developers and users to store data reliably without relying on centralized providers, using cryptographic proofs to guarantee availability and integrity.

Key Features:
• Content-addressed storage with IPFS compatibility
• Erasure coding for redundancy and fault tolerance
• Cryptographic proofs of storage (PoSt)
• Developer API compatible with AWS S3
• Token incentives for storage providers

Our goal is to make decentralized storage as easy to use as cloud storage, while giving users true ownership of their data.`,
      category: 'Infrastructure',
      goalAmount: 150000,
      raisedAmount: 12000,
      status: CampaignStatus.ACTIVE,
      isAdminApproved: true,
      deadline: new Date('2027-03-31'),
      githubUrl: 'https://github.com/lisathompson/decentral-storage',
      creatorId: lisa.id,
      milestones: {
        create: [
          {
            title: 'Protocol Design & MVP',
            description:
              'Design the storage protocol specification, implement the proof-of-storage mechanism, and deliver a working MVP with basic put/get operations.',
            amount: 150000,
            status: MilestoneStatus.PENDING,
          },
        ],
      },
      forum: { create: {} },
    },
  });

  // ── 6. Community DAO Governance ───────────────────────────────────────
  const daoCampaign = await prisma.campaign.create({
    data: {
      title: 'Community DAO Governance',
      description: `Building a transparent and efficient DAO governance system for community-driven decision making. This platform provides the tools DAOs need to run proposals, votes, and treasury management with full on-chain transparency.

Key Features:
• Flexible proposal templates (funding, parameter changes, elections)
• Quadratic voting and conviction voting support
• Multi-sig treasury integration
• Delegation and liquid democracy features
• On-chain execution of approved proposals

Already battle-tested with two DAOs managing over $2M in treasury assets.`,
      category: 'DAO',
      goalAmount: 50000,
      raisedAmount: 52000,
      status: CampaignStatus.COMPLETED,
      isAdminApproved: true,
      deadline: new Date('2026-03-31'),
      website: 'https://daogov.example',
      githubUrl: 'https://github.com/michaelross-dao/dao-governance',
      creatorId: michael.id,
      milestones: {
        create: [
          {
            title: 'Governance Framework',
            description:
              'Implement the core governance smart contracts, proposal system, and voting mechanisms.',
            amount: 25000,
            status: MilestoneStatus.APPROVED,
            proofUrl:
              'Governance contracts live on mainnet. Three DAOs have successfully used the platform to pass 47 proposals. Audit report by Certora attached.',
          },
          {
            title: 'DAO Launch & Treasury Tools',
            description:
              'Build the DAO launch wizard, treasury management dashboard, and on-chain execution engine.',
            amount: 25000,
            status: MilestoneStatus.APPROVED,
            proofUrl:
              'Treasury tools deployed and integrated with Safe multisig. On-chain execution tested with 12 live proposals across partner DAOs.',
          },
        ],
      },
      updates: {
        create: [
          {
            title: 'Project Completed Successfully!',
            content:
              'We are thrilled to announce that all milestones have been completed and the DAO governance platform is live on mainnet. Thank you to our 89 contributors!',
            createdAt: new Date('2026-03-28'),
          },
          {
            title: 'Milestone 2 Approved',
            content:
              'The community has voted to approve milestone 2. Treasury tools are fully deployed and the on-chain execution engine is operational.',
            createdAt: new Date('2026-03-15'),
          },
        ],
      },
      forum: { create: {} },
    },
  });

  console.log('Seeding contributions...');

  // Contributions - representative samples matching raised amounts
  const contributionData = [
    // DeFi Lending Protocol (total: 75,000)
    { campaignId: defiCampaign.id, contributorId: cryptoWhale.id, amount: 20000 },
    { campaignId: defiCampaign.id, contributorId: contributor1.id, amount: 15000 },
    { campaignId: defiCampaign.id, contributorId: defiUser.id, amount: 12000 },
    { campaignId: defiCampaign.id, contributorId: secureDev.id, amount: 10000 },
    { campaignId: defiCampaign.id, contributorId: contributor2.id, amount: 10000 },
    { campaignId: defiCampaign.id, contributorId: contributor3.id, amount: 8000 },
    // Blockchain Gaming Engine (total: 45,000)
    { campaignId: gamingCampaign.id, contributorId: contributor1.id, amount: 15000 },
    { campaignId: gamingCampaign.id, contributorId: contributor4.id, amount: 12000 },
    { campaignId: gamingCampaign.id, contributorId: defiUser.id, amount: 10000 },
    { campaignId: gamingCampaign.id, contributorId: contributor5.id, amount: 8000 },
    // NFT Marketplace Platform (total: 35,000)
    { campaignId: nftCampaign.id, contributorId: cryptoWhale.id, amount: 12000 },
    { campaignId: nftCampaign.id, contributorId: contributor2.id, amount: 10000 },
    { campaignId: nftCampaign.id, contributorId: contributor3.id, amount: 8000 },
    { campaignId: nftCampaign.id, contributorId: secureDev.id, amount: 5000 },
    // Open Source Analytics Tools (total: 28,000)
    { campaignId: analyticsCampaign.id, contributorId: secureDev.id, amount: 10000 },
    { campaignId: analyticsCampaign.id, contributorId: contributor4.id, amount: 10000 },
    { campaignId: analyticsCampaign.id, contributorId: defiUser.id, amount: 8000 },
    // Decentralized Storage Network (total: 12,000)
    { campaignId: storageCampaign.id, contributorId: contributor5.id, amount: 7000 },
    { campaignId: storageCampaign.id, contributorId: contributor1.id, amount: 5000 },
    // Community DAO Governance (total: 52,000)
    { campaignId: daoCampaign.id, contributorId: cryptoWhale.id, amount: 15000 },
    { campaignId: daoCampaign.id, contributorId: contributor2.id, amount: 12000 },
    { campaignId: daoCampaign.id, contributorId: contributor3.id, amount: 10000 },
    { campaignId: daoCampaign.id, contributorId: contributor4.id, amount: 8000 },
    { campaignId: daoCampaign.id, contributorId: contributor5.id, amount: 7000 },
  ];

  for (const data of contributionData) {
    await prisma.contribution.create({
      data: { ...data, transactionHash: makeTxHash() },
    });
  }

  console.log('Seeding votes...');

  // Fetch milestones to get their IDs
  const defiMilestones = await prisma.milestone.findMany({
    where: { campaignId: defiCampaign.id },
    orderBy: { createdAt: 'asc' },
  });
  const nftMilestones = await prisma.milestone.findMany({
    where: { campaignId: nftCampaign.id },
    orderBy: { createdAt: 'asc' },
  });
  const analyticsMilestones = await prisma.milestone.findMany({
    where: { campaignId: analyticsCampaign.id },
    orderBy: { createdAt: 'asc' },
  });
  const daoMilestones = await prisma.milestone.findMany({
    where: { campaignId: daoCampaign.id },
    orderBy: { createdAt: 'asc' },
  });

  const defiM1 = defiMilestones[0]; // APPROVED
  const defiM2 = defiMilestones[1]; // VOTING
  const nftM1 = nftMilestones[0];   // APPROVED
  const analyticsM1 = analyticsMilestones[0]; // APPROVED
  const analyticsM2 = analyticsMilestones[1]; // VOTING
  const daoM1 = daoMilestones[0];   // APPROVED
  const daoM2 = daoMilestones[1];   // APPROVED

  // Votes for DeFi M1 (APPROVED - 142 for, 8 against in mock → representative)
  await prisma.vote.createMany({
    data: [
      { milestoneId: defiM1.id, voterId: cryptoWhale.id, choice: true },
      { milestoneId: defiM1.id, voterId: contributor1.id, choice: true },
      { milestoneId: defiM1.id, voterId: defiUser.id, choice: true },
      { milestoneId: defiM1.id, voterId: secureDev.id, choice: true },
      { milestoneId: defiM1.id, voterId: contributor2.id, choice: false },
    ],
  });

  // Votes for DeFi M2 (VOTING - in progress)
  await prisma.vote.createMany({
    data: [
      { milestoneId: defiM2.id, voterId: cryptoWhale.id, choice: true },
      { milestoneId: defiM2.id, voterId: defiUser.id, choice: true },
    ],
  });

  // Votes for NFT M1 (APPROVED)
  await prisma.vote.createMany({
    data: [
      { milestoneId: nftM1.id, voterId: cryptoWhale.id, choice: true },
      { milestoneId: nftM1.id, voterId: contributor2.id, choice: true },
      { milestoneId: nftM1.id, voterId: contributor3.id, choice: true },
      { milestoneId: nftM1.id, voterId: secureDev.id, choice: false },
    ],
  });

  // Votes for Analytics M1 (APPROVED)
  await prisma.vote.createMany({
    data: [
      { milestoneId: analyticsM1.id, voterId: secureDev.id, choice: true },
      { milestoneId: analyticsM1.id, voterId: contributor4.id, choice: true },
      { milestoneId: analyticsM1.id, voterId: defiUser.id, choice: true },
    ],
  });

  // Votes for Analytics M2 (VOTING - in progress)
  await prisma.vote.createMany({
    data: [
      { milestoneId: analyticsM2.id, voterId: secureDev.id, choice: true },
    ],
  });

  // Votes for DAO M1 & M2 (both APPROVED)
  await prisma.vote.createMany({
    data: [
      { milestoneId: daoM1.id, voterId: cryptoWhale.id, choice: true },
      { milestoneId: daoM1.id, voterId: contributor2.id, choice: true },
      { milestoneId: daoM1.id, voterId: contributor3.id, choice: true },
      { milestoneId: daoM1.id, voterId: contributor4.id, choice: true },
      { milestoneId: daoM1.id, voterId: contributor5.id, choice: false },
      { milestoneId: daoM2.id, voterId: cryptoWhale.id, choice: true },
      { milestoneId: daoM2.id, voterId: contributor2.id, choice: true },
      { milestoneId: daoM2.id, voterId: contributor3.id, choice: true },
      { milestoneId: daoM2.id, voterId: contributor4.id, choice: true },
    ],
  });

  console.log('Seeding forum messages...');

  // Fetch forum IDs
  const [defiForumRec, gamingForumRec, nftForumRec, analyticsForumRec, storageForumRec, daoForumRec] =
    await Promise.all([
      prisma.forum.findUnique({ where: { campaignId: defiCampaign.id } }),
      prisma.forum.findUnique({ where: { campaignId: gamingCampaign.id } }),
      prisma.forum.findUnique({ where: { campaignId: nftCampaign.id } }),
      prisma.forum.findUnique({ where: { campaignId: analyticsCampaign.id } }),
      prisma.forum.findUnique({ where: { campaignId: storageCampaign.id } }),
      prisma.forum.findUnique({ where: { campaignId: daoCampaign.id } }),
    ]);

  // DeFi forum messages (from ProjectDetailPage mock data)
  await prisma.message.createMany({
    data: [
      {
        forumId: defiForumRec!.id,
        userId: defiUser.id,
        content:
          'Can you clarify if the audit report includes the staking contract? I checked the Github repo but couldn\'t find the specific file.',
        createdAt: new Date('2026-04-07T10:00:00Z'),
      },
      {
        forumId: defiForumRec!.id,
        userId: cryptoWhale.id,
        content:
          'The new dashboard looks amazing. Love the dark mode support. Will you be adding mobile support soon?',
        createdAt: new Date('2026-04-06T14:00:00Z'),
      },
      {
        forumId: defiForumRec!.id,
        userId: secureDev.id,
        content:
          'I noticed a potential reentrancy issue in the lending pool contract. Has this been addressed in the latest audit?',
        createdAt: new Date('2026-04-05T09:00:00Z'),
      },
    ],
  });

  // Gaming forum
  await prisma.message.createMany({
    data: [
      {
        forumId: gamingForumRec!.id,
        userId: contributor1.id,
        content:
          'Will the engine support mobile platforms? Would love to see iOS and Android support in the roadmap.',
        createdAt: new Date('2026-04-06T11:00:00Z'),
      },
      {
        forumId: gamingForumRec!.id,
        userId: defiUser.id,
        content:
          'The NFT asset management demo looks great! Any plans to support ERC-1155 multi-tokens?',
        createdAt: new Date('2026-04-05T16:00:00Z'),
      },
    ],
  });

  // NFT forum
  await prisma.message.createMany({
    data: [
      {
        forumId: nftForumRec!.id,
        userId: cryptoWhale.id,
        content:
          'How will you handle royalty enforcement when NFTs are traded on other marketplaces?',
        createdAt: new Date('2026-04-06T13:00:00Z'),
      },
      {
        forumId: nftForumRec!.id,
        userId: contributor3.id,
        content:
          'Really excited about the lazy minting feature. This will make it so much cheaper for new artists to get started!',
        createdAt: new Date('2026-04-04T10:00:00Z'),
      },
    ],
  });

  // Analytics forum
  await prisma.message.createMany({
    data: [
      {
        forumId: analyticsForumRec!.id,
        userId: secureDev.id,
        content:
          'The ZK anonymization approach is solid. Have you considered using Groth16 proofs for better verification performance?',
        createdAt: new Date('2026-04-05T12:00:00Z'),
      },
    ],
  });

  // Storage forum
  await prisma.message.createMany({
    data: [
      {
        forumId: storageForumRec!.id,
        userId: contributor5.id,
        content:
          'How does your proof-of-storage mechanism compare to Filecoin\'s approach? Any benchmarks available?',
        createdAt: new Date('2026-04-03T15:00:00Z'),
      },
    ],
  });

  // DAO forum
  await prisma.message.createMany({
    data: [
      {
        forumId: daoForumRec!.id,
        userId: contributor4.id,
        content:
          'Congratulations on completing the project! The governance framework has been incredibly useful for our DAO.',
        createdAt: new Date('2026-03-29T10:00:00Z'),
      },
      {
        forumId: daoForumRec!.id,
        userId: cryptoWhale.id,
        content:
          'Will you be continuing development? Would love to see snapshot integration and off-chain signaling tools.',
        createdAt: new Date('2026-03-28T14:00:00Z'),
      },
    ],
  });

  // Initialize indexer state
  await prisma.indexerState.create({
    data: { id: 'singleton', lastBlock: 0 },
  });

  console.log('\nSeed complete. Summary:');
  console.log('  Users:         15 (1 admin, 6 creators, 8 contributors)');
  console.log('  Campaigns:      6');
  console.log('  Milestones:    12');
  console.log('  Contributions: 24');
  console.log('  Votes:         23');
  console.log('  Forum posts:   11');
  console.log('  Updates:        5');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
