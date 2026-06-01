import { ethers } from "hardhat";

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    throw new Error("USDC_ADDRESS env var is required");
  }

  console.log("Deploying CampaignFactory...");
  console.log("  USDC address:", usdcAddress);

  const [deployer] = await ethers.getSigners();
  console.log("  Deployer:", deployer.address);
  console.log(
    "  Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
  const factory = await CampaignFactory.deploy(usdcAddress, ethers.ZeroAddress);
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  const deployTx = factory.deploymentTransaction();
  const receipt = deployTx ? await deployTx.wait() : null;
  const deployBlock = receipt?.blockNumber ?? 0;

  console.log("\nCampaignFactory deployed to:", address);
  console.log("Deploy block:", deployBlock);
  // Machine-parseable markers for tooling
  console.log("DEPLOYED_ADDRESS=" + address);
  console.log("DEPLOYED_BLOCK=" + deployBlock);
  console.log(
    "\nAdd to apps/server/.env:\n  CAMPAIGN_FACTORY_ADDRESS=" +
      address +
      "\n  START_BLOCK=" +
      deployBlock
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
