export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'changeme',
  jwtExpiresIn: '7d',
  sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL || '',
  campaignFactoryAddress: process.env.CAMPAIGN_FACTORY_ADDRESS || '',
  usdcAddress: process.env.USDC_ADDRESS || '',
  startBlock: parseInt(process.env.START_BLOCK ?? '0', 10) || 0,
  ipfsGateway: process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || '',
});
