/**
 * Bootstrap script — sets a wallet address to ADMIN role in the database.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/set-admin.ts 0xYourWalletAddress
 */

import { PrismaClient, UserRole } from '../src/generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const wallet = process.argv[2]?.toLowerCase();
  if (!wallet) {
    console.error('Usage: npx ts-node scripts/set-admin.ts 0xYourWalletAddress');
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { walletAddress: wallet },
    update: { role: UserRole.ADMIN },
    create: { walletAddress: wallet, role: UserRole.ADMIN },
  });

  console.log(`Done. ${user.walletAddress} is now ADMIN (DB id: ${user.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
