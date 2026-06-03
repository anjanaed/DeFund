/**
 * clean-full-seed.ts
 *
 * Removes all data created by seed-full.ts so the seeder can be re-run cleanly.
 * Deletes in FK-safe order; forum rows cascade on campaign delete.
 *
 * Run (from apps/server/):
 *   npx ts-node scripts/clean-full-seed.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const TITLES = [
  'Privacy-First Browser Extension',
  'Zero-Knowledge Proof SDK',
  'Decentralised Git Protocol',
  'Open Source Climate Data Commons',
  'Accessible Maps Toolkit',
  'Self-Hosted Encrypted Notes',
  'Community Mesh Networking Kit',
  'Federated Learning for Small Clinics',
  'Civic Budget Transparency Portal',
  'Lightweight Container Runtime',
];

const WALLETS = [
  '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
  '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
  '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
  '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc',
  '0x976ea74026e726554db657fa54763abd0c3a0aa9',
  '0x14dc79964da2c08b23698b3d3cc7ca32193d9955',
  '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f',
  '0xa0ee7a142d267c1f36714e4a8f75612f20a79720',
  '0xbcd4042de499d14e55001ccbb24a551f3b954096',
  '0x71be63f3384f5fb98995898a86b02fb2426c5788',
  '0xfabb0ac9d68b0b445fb7357272ff202c5651694a',
  '0x1cbd3b2770909d4e10f157cabc84c7264073c9ec',
  '0xdf3e18d64bc0a983567b04dadcc01c4e6d9df7ff',
];

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { title: { in: TITLES } },
    select: { id: true, title: true },
  });

  if (campaigns.length === 0) {
    console.log('No seed-full campaigns found.');
    return;
  }

  const ids = campaigns.map((c) => c.id);
  console.log(`Found ${ids.length} campaign(s) to remove.`);

  // Delete milestone children first
  const milestones = await prisma.milestone.findMany({ where: { campaignId: { in: ids } }, select: { id: true } });
  const msIds = milestones.map((m) => m.id);

  await prisma.vote.deleteMany({ where: { milestoneId: { in: msIds } } });
  await prisma.releaseFundsProposal.deleteMany({ where: { milestoneId: { in: msIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: await prisma.user.findMany({ where: { walletAddress: { in: WALLETS } }, select: { id: true } }).then((u) => u.map((x) => x.id)) } } });
  await prisma.contribution.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.update.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.refundProposal.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.flagProposal.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.campaignApprovalProposal.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.adminAuditLog.deleteMany({ where: { entityId: { in: [...ids, ...msIds] } } });
  await prisma.milestone.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.campaign.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { walletAddress: { in: WALLETS } } });

  console.log('Clean complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect().then(() => pool.end()));
