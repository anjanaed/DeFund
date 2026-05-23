/**
 * Reset the on-chain event indexer's lastBlock cursor.
 *
 * When CAMPAIGN_FACTORY_ADDRESS changes (redeploy), the indexer's stored
 * lastBlock from the previous contract is meaningless. Run this to point it
 * at a new starting block — typically the deploy block of the new factory,
 * or 0 to reindex from genesis.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/reset-indexer.ts <blockNumber>
 *   npx ts-node --project tsconfig.json scripts/reset-indexer.ts 0
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  if (arg === undefined) {
    console.error('Usage: npx ts-node scripts/reset-indexer.ts <blockNumber>');
    process.exit(1);
  }

  const lastBlock = Number(arg);
  if (!Number.isInteger(lastBlock) || lastBlock < 0) {
    console.error('blockNumber must be a non-negative integer');
    process.exit(1);
  }

  const state = await prisma.indexerState.upsert({
    where: { id: 'singleton' },
    update: { lastBlock },
    create: { id: 'singleton', lastBlock },
  });

  console.log(`Indexer cursor set to block ${state.lastBlock} (updatedAt ${state.updatedAt.toISOString()})`);
  console.log('Restart the server to pick up the new cursor.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
