/**
 * clean-seeded-campaigns.ts
 *
 * Deletes the demo campaigns created by seed-campaigns-api.ts (matched by title),
 * so the seeder can be re-run cleanly. Children are removed in FK-safe order;
 * the Forum row cascades automatically on campaign delete.
 *
 * Run (from apps/server):
 *   npx ts-node scripts/clean-seeded-campaigns.ts
 *
 * The title list below MUST match the titles in seed-campaigns-api.ts.
 */

import { PrismaClient } from '../src/generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const TITLES = [
  'Privacy First Browser Extension',
  'Zero Knowledge Proof SDK',
  'Decentralised Git Protocol',
  'Open Source Climate Data Commons',
  'Self Hosted Encrypted Notes',
  'Accessible Maps Toolkit',
  'Lightweight Container Runtime',
  'Community Mesh Networking Kit',
  'Open Hardware Insulin Pump Monitor',
  'Civic Budget Transparency Portal',
  'Federated Learning for Small Clinics',
  'Open Translation Memory for Minority Languages',
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { title: { in: TITLES } },
    select: { id: true },
  });

  if (campaigns.length === 0) {
    console.log('No seeded campaigns found to delete.');
    return;
  }

  const ids = campaigns.map((c) => c.id);

  // Remove FK children before the campaigns (fresh seeds only have milestones +
  // a cascading forum, but the rest are deleted defensively for re-run safety).
  await prisma.contribution.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.update.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.refundProposal.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.flagProposal.deleteMany({ where: { campaignId: { in: ids } } });
  await prisma.campaignApprovalProposal.deleteMany({ where: { campaignId: { in: ids } } });
  const ms = await prisma.milestone.deleteMany({ where: { campaignId: { in: ids } } });
  const camp = await prisma.campaign.deleteMany({ where: { id: { in: ids } } });

  console.log(`Deleted ${camp.count} campaign(s) and ${ms.count} milestone(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
