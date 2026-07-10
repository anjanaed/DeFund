import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, CampaignStatus, MilestoneStatus } from '../src/generated/prisma';

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const CREATOR = '0xd4e8f2a6b91c3d7e5f0a2b8c4d6e1f3a5b7c9d2e';

const CONTRIBUTORS = [
  { wallet: '0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d', name: 'Elena Vasquez', bio: 'Solar engineer, off-grid systems.' },
  { wallet: '0xb2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e', name: 'Tomasz Kowalski', bio: 'Energy policy researcher.' },
  { wallet: '0xc3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f', name: 'Naledi Dlamini', bio: 'Rural electrification advocate.' },
  { wallet: '0xd4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60', name: 'Hiro Sato', bio: 'Embedded systems hobbyist.' },
  { wallet: '0xe5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071', name: 'Camila Ferreira', bio: 'Climate finance analyst.' },
  { wallet: '0xf60718293a4b5c6d7e8f90a1b2c3d4e5f607182', name: 'Owen Fitzgerald', bio: 'DIY solar builder.' },
  { wallet: '0x0718293a4b5c6d7e8f90a1b2c3d4e5f60718293', name: 'Grace Mensah', bio: 'Community organiser, Ghana.' },
];

const ADMIN = '0xe2b42646cf1158659490a865ed475156e15cb676';

let seq = 9000;
const tx = () => `0x${(seq++).toString(16).padStart(8, '0')}d3f6a9b2c5e8d1f4a7b0c3e6d9f2b5c8e1a4d7f0`;
const ago = (d: number) => new Date(Date.now() - d * 86400000);
const from = (d: number) => new Date(Date.now() + d * 86400000);

const DESCRIPTION = `SolarMesh is an open-source micro-grid platform that lets small communities pool solar panels, batteries, and inverters into a single resilient power network without relying on a centralized utility. Most existing micro-grid controllers are proprietary, expensive, and impossible to repair without vendor support. SolarMesh replaces that with commodity hardware, an open firmware stack, and a peer-to-peer energy accounting protocol so neighbors can share surplus power and settle balances automatically.

The core problem we are solving is reliability in regions with unstable or nonexistent grid access. A single household solar setup fails the moment its own panel is shaded or its battery degrades, even if the house next door has surplus capacity sitting unused. By meshing inverters together over a lightweight mesh radio and a small coordinator board, SolarMesh allows excess generation to flow to whoever needs it in real time, with every kilowatt-hour logged and reconciled on-chain so nobody has to trust a middleman to keep the books straight.

Funds raised here cover four concrete milestones: building and testing the mesh firmware that lets inverters discover each other and negotiate power sharing; designing the coordinator hardware and getting a small manufacturing run certified; building the energy accounting and settlement layer that turns raw telemetry into fair, auditable balances; and finally running a real pilot with twelve households so we can publish honest performance numbers instead of lab benchmarks.

We have already validated the core mesh protocol in simulation across fifty virtual nodes and bench-tested power negotiation between three physical inverters in a lab setting, so this is not a cold start — it is the jump from prototype to something a real community can depend on. Every milestone proof will include firmware source, hardware schematics, and raw test logs, all published under an open license so the design can be replicated anywhere, not just wherever we happen to run the pilot.

Contributors get early access to the firmware repository, a say in the pilot site selection through the campaign forum, and — once the pilot concludes — a full technical writeup covering what worked, what broke, and the actual cost-per-household of running a self-organizing solar micro-grid instead of a traditional single-home installation. We believe decentralized energy infrastructure should be as inspectable and forkable as the code that runs it, and this campaign is the first step toward proving that out in the field rather than just on paper.`;

async function main() {
  console.log('seeding demo project...');

  const creator = await prisma.user.upsert({
    where: { walletAddress: CREATOR },
    create: { walletAddress: CREATOR, name: 'Renata Silva', bio: 'Embedded + power electronics engineer building community-owned energy infrastructure.', githubHandle: 'renatasilva-hw', isVerified: true },
    update: {},
  });

  const contributors = await Promise.all(
    CONTRIBUTORS.map(c =>
      prisma.user.upsert({
        where: { walletAddress: c.wallet },
        create: { walletAddress: c.wallet, name: c.name, bio: c.bio },
        update: {},
      }),
    ),
  );

  const campaign = await prisma.campaign.create({
    data: {
      title: 'Demo : SolarMesh — Community-Owned Micro-Grid Platform',
      category: 'Clean Energy',
      paymentToken: 'ETH',
      description: DESCRIPTION,
      goalAmount: 2.50,
      raisedAmount: 1.85,
      releasedAmount: 0.65,
      status: CampaignStatus.ACTIVE,
      deadline: from(40),
      isAdminApproved: true,
      license: 'MIT',
      repositoryUrl: 'https://github.com/defund-demo/solarmesh',
      website: 'https://solarmesh.example.org',
      ipfsHash: '0xa4c7e0b3d6f9c2e5b8a1d4f7c0e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a1c4e7',
      creatorId: creator.id,
      milestones: {
        create: [
          { title: 'Mesh Firmware Core', description: 'Inverter discovery, power negotiation protocol, bench-tested across three physical nodes.', amount: 0.65, status: MilestoneStatus.COMPLETED, order: 0, deadline: ago(15), proofUrl: 'QmSolarMeshFirmwareProof0001' },
          { title: 'Coordinator Hardware', description: 'Coordinator board schematics, small certified manufacturing run.', amount: 0.60, status: MilestoneStatus.APPROVED, order: 1, deadline: from(5), proofUrl: 'QmSolarMeshHardwareProof0002' },
          { title: 'Energy Accounting Layer', description: 'On-chain settlement turning telemetry into auditable per-household balances.', amount: 0.65, status: MilestoneStatus.VOTING, order: 2, deadline: from(20), votingEndTime: from(4), proofUrl: 'QmSolarMeshAccountingProof0003', submissionCount: 1 },
          { title: 'Twelve-Household Pilot', description: 'Real-world pilot deployment with published performance numbers.', amount: 0.60, status: MilestoneStatus.NOT_STARTED, order: 3, deadline: from(40) },
        ],
      },
    },
    include: { milestones: true },
  });

  const m3 = campaign.milestones.find(m => m.order === 2)!;

  await prisma.contribution.createMany({
    data: [
      { amount: 0.40, transactionHash: tx(), contributorId: contributors[0].id, campaignId: campaign.id, timestamp: ago(28) },
      { amount: 0.30, transactionHash: tx(), contributorId: contributors[1].id, campaignId: campaign.id, timestamp: ago(25) },
      { amount: 0.25, transactionHash: tx(), contributorId: contributors[2].id, campaignId: campaign.id, timestamp: ago(21) },
      { amount: 0.20, transactionHash: tx(), contributorId: contributors[3].id, campaignId: campaign.id, timestamp: ago(17) },
      { amount: 0.25, transactionHash: tx(), contributorId: contributors[4].id, campaignId: campaign.id, timestamp: ago(12) },
      { amount: 0.20, transactionHash: tx(), contributorId: contributors[5].id, campaignId: campaign.id, timestamp: ago(7) },
      { amount: 0.15, transactionHash: tx(), contributorId: contributors[6].id, campaignId: campaign.id, timestamp: ago(3) },
      { amount: 0.10, transactionHash: tx(), contributorId: contributors[0].id, campaignId: campaign.id, timestamp: ago(1) },
    ],
  });

  await prisma.vote.createMany({
    data: [
      { choice: true, weight: '400000000000000000', voterId: contributors[0].id, milestoneId: m3.id, timestamp: ago(1) },
      { choice: true, weight: '300000000000000000', voterId: contributors[1].id, milestoneId: m3.id, timestamp: ago(1) },
      { choice: true, weight: '250000000000000000', voterId: contributors[2].id, milestoneId: m3.id, timestamp: ago(0) },
      { choice: false, weight: '200000000000000000', voterId: contributors[3].id, milestoneId: m3.id, timestamp: ago(0) },
    ],
  });

  const forum = await prisma.forum.create({ data: { campaignId: campaign.id } });
  const rootMsg = await prisma.message.create({ data: { forumId: forum.id, userId: contributors[0].id, content: 'Bench test numbers on the firmware milestone look great — 3-node negotiation settling in under 200ms. When does the coordinator board hit fab?', createdAt: ago(20) } });
  await prisma.message.create({ data: { forumId: forum.id, userId: creator.id, content: 'Gerbers are with the fab house now, small batch of 25 boards. Should have bring-up photos next week.', createdAt: ago(19), parentId: rootMsg.id } });
  await prisma.message.create({ data: { forumId: forum.id, userId: contributors[4].id, content: 'Voting yes on the accounting milestone — settlement math checked out against my own spreadsheet model.', createdAt: ago(1) } });
  await prisma.message.create({ data: { forumId: forum.id, userId: contributors[3].id, content: 'Voting no for now — rounding on sub-Wh balances needs a documented policy before I trust the ledger long-term.', createdAt: ago(0) } });

  await prisma.update.createMany({
    data: [
      { campaignId: campaign.id, title: 'Firmware milestone complete', content: 'Mesh discovery and power negotiation protocol passed bench testing across three physical inverters. Full source and test logs published.', createdAt: ago(16) },
      { campaignId: campaign.id, title: 'Coordinator boards back from fab', content: '25-unit batch assembled and bringing up now. Certification paperwork submitted.', createdAt: ago(6) },
      { campaignId: campaign.id, title: 'Accounting layer open for voting', content: 'Settlement logic converts raw telemetry into per-household balances, reconciled on-chain. Voting closes in 4 days.', createdAt: ago(1) },
    ],
  });

  await prisma.adminAuditLog.create({
    data: { adminWallet: ADMIN, action: 'APPROVE_CAMPAIGN', entityType: 'campaign', entityId: campaign.id, entityTitle: campaign.title, metadata: { demo: true }, createdAt: ago(30) },
  });

  console.log(`done — campaign ${campaign.id} created for creator ${CREATOR}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect().then(() => pool.end()));
