import { ethers } from "hardhat";

const CONTRACT_ADDRESS = process.env.CAMPAIGN_FACTORY_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
  const grantTo = process.env.GRANT_TO;
  if (!grantTo) {
    console.error("Usage: GRANT_TO=0x... npx hardhat run scripts/grant-admin.ts --network sepolia");
    process.exit(1);
  }

  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY!, provider);
  const factory = await ethers.getContractAt("CampaignFactory", CONTRACT_ADDRESS!, signer);

  const DEFAULT_ADMIN_ROLE = await (factory as any).DEFAULT_ADMIN_ROLE();
  console.log(`Granting DEFAULT_ADMIN_ROLE to ${grantTo}...`);
  const tx = await (factory as any).grantRole(DEFAULT_ADMIN_ROLE, grantTo);
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("Done. DEFAULT_ADMIN_ROLE granted to", grantTo);
}

main().catch((e) => { console.error(e); process.exit(1); });
