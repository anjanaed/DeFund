import { ethers } from "hardhat";

const CONTRACT_ADDRESS = process.env.CAMPAIGN_FACTORY_ADDRESS;
const GRANT_TO = "0x67e046683ec00e611c7F3C2a4e6497e6A6069874";
const PRIVATE_KEY = process.env.KEY;

async function main() {
  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const factory = await ethers.getContractAt("CampaignFactory", CONTRACT_ADDRESS, signer);

  const DEFAULT_ADMIN_ROLE = await (factory as any).DEFAULT_ADMIN_ROLE();
  const tx = await (factory as any).grantRole(DEFAULT_ADMIN_ROLE, GRANT_TO);
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("Done. Admin role granted to", GRANT_TO);
}

main().catch((e) => { console.error(e); process.exit(1); });
