const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HEX_PRIVKEY = /^(0x)?[a-fA-F0-9]{64}$/;

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function requireMatching(name: string, value: string | undefined, pattern: RegExp): string {
  const v = requireEnv(name, value);
  if (!pattern.test(v)) {
    throw new Error(`Env var ${name} does not match required format`);
  }
  return v;
}

function requirePrivKey(name: string, value: string | undefined): string {
  const v = requireMatching(name, value, HEX_PRIVKEY);
  return v.startsWith('0x') ? v : `0x${v}`;
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: requireEnv('JWT_SECRET', process.env.JWT_SECRET),
  jwtExpiresIn: '7d',
  sepoliaRpcUrl: requireEnv('SEPOLIA_RPC_URL', process.env.SEPOLIA_RPC_URL),
  campaignFactoryAddress: requireMatching(
    'CAMPAIGN_FACTORY_ADDRESS',
    process.env.CAMPAIGN_FACTORY_ADDRESS,
    HEX_ADDRESS,
  ),
  usdcAddress: requireMatching(
    'USDC_ADDRESS',
    process.env.USDC_ADDRESS,
    HEX_ADDRESS,
  ),
  startBlock: parseInt(process.env.START_BLOCK ?? '0', 10) || 0,
  ipfsGateway: process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  operatorPrivateKey: requirePrivKey('OPERATOR_PRIVATE_KEY', process.env.OPERATOR_PRIVATE_KEY),
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY
    ? requirePrivKey('ADMIN_PRIVATE_KEY', process.env.ADMIN_PRIVATE_KEY)
    : '',
  databaseUrl: requireEnv('DATABASE_URL', process.env.DATABASE_URL),
  directUrl: requireEnv('DIRECT_URL', process.env.DIRECT_URL),
});
