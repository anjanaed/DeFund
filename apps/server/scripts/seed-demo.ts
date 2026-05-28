/**
 * seed-demo.ts
 *
 * Populates the database AND the deployed Sepolia contract with realistic demo data.
 *
 * Flow (mirrors the actual admin approval flow):
 *   1. Create User records in DB (creators + contributors)
 *   2. Create Campaign + Milestone records in DB (status: PENDING)
 *   3. Call createCampaign() on-chain → capture onChainId from CampaignCreated event
 *   4. Update DB campaign: set onChainId + ACTIVE
 *   5. Call contributeETH() on-chain for each campaign
 *   6. For the fully-funded campaign: call submitMilestoneForVoting()
 *
 * Run:
 *   npx ts-node scripts/seed-demo.ts
 *
 * Requirements:
 *   - OPERATOR_PRIVATE_KEY must be set in apps/server/.env
 *   - SEPOLIA_RPC_URL must be set
 *   - CAMPAIGN_FACTORY_ADDRESS must be set
 *   - The wallet must have enough Sepolia ETH (at least ~0.6 ETH + gas)
 */

import 'dotenv/config'
import { ethers } from 'ethers'
import { PrismaClient, CampaignStatus, MilestoneStatus } from '../src/generated/prisma'

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = process.env.SEPOLIA_RPC_URL!
const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY!
const CONTRACT_ADDRESS = process.env.CAMPAIGN_FACTORY_ADDRESS!

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error('Missing required env vars: SEPOLIA_RPC_URL, OPERATOR_PRIVATE_KEY, CAMPAIGN_FACTORY_ADDRESS')
  process.exit(1)
}

// ─── Minimal ABI ─────────────────────────────────────────────────────────────

const ABI = [
  {
    name: 'createCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_creator', type: 'address' },
      { name: '_ipfsHash', type: 'string' },
      { name: '_paymentToken', type: 'uint8' },
      { name: '_fundGoal', type: 'uint256' },
      { name: '_deadline', type: 'uint256' },
      {
        name: '_milestones', type: 'tuple[]',
        components: [
          { name: 'ipfsHash', type: 'string' },
          { name: 'amountRequired', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'contributeETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'submitMilestoneForVoting',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_milestoneId', type: 'uint256' },
      { name: '_proofIpfsHash', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'CampaignCreated',
    type: 'event',
    inputs: [
      { name: 'campaignId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'fundGoal', type: 'uint256', indexed: false },
      { name: 'paymentToken', type: 'uint8', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false },
      { name: 'milestoneCount', type: 'uint256', indexed: false },
    ],
  },
] as const

// ─── Demo Data ───────────────────────────────────────────────────────────────

const NOW_SEC = Math.floor(Date.now() / 1000)
const DAY = 24 * 60 * 60

// Fake creator addresses — realistic-looking demo wallets.
// In the real flow, these are actual users who've connected their wallets.
// You can replace these with real wallet addresses you control.
const CREATORS = {
  lena:  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  alex:  '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
  priya: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
}

const CAMPAIGNS = [
  {
    // Campaign A — Active, partially funded (30%)
    creator: CREATORS.lena,
    title: 'Privacy-First Browser Extension',
    description: 'A browser extension that blocks canvas fingerprinting, injects decoy signals into WebGL and AudioContext APIs, and routes DNS over HTTPS. Fully open-source, no telemetry, no subscriptions.',
    category: 'Security & Privacy',
    ipfsHash: 'QmPrivacyBrowserV1Hash000000000000000000000000001',
    goalETH: '1.0',
    deadlineDays: 60,
    milestones: [
      { title: 'Fingerprinting Shield Core', description: 'Canvas, WebGL, and AudioContext spoofing engine', amountETH: '0.4' },
      { title: 'DNS-over-HTTPS Integration', description: 'Encrypted DNS resolver with UI toggle', amountETH: '0.35' },
      { title: 'Audit & Browser Store Release', description: 'Third-party security audit and Chrome/Firefox submission', amountETH: '0.25' },
    ],
    contributeETH: '0.3',  // 30% funded — stays ACTIVE
  },
  {
    // Campaign B — Funded, milestone 1 submitted for voting
    creator: CREATORS.alex,
    title: 'Zero-Knowledge Proof SDK',
    description: 'A TypeScript/Rust SDK for building ZK-powered applications without needing a PhD in cryptography. Ships with circuit templates for common use cases: anonymous voting, private balances, age proofs.',
    category: 'Developer Tools',
    ipfsHash: 'QmZKProofSDKV1Hash000000000000000000000000000002',
    goalETH: '0.5',
    deadlineDays: 45,
    milestones: [
      { title: 'Circuit Template Library', description: 'Groth16 and PLONK circuits for voting, transfers, and identity', amountETH: '0.3' },
      { title: 'TypeScript SDK + CLI', description: 'Proof generation, verification, and contract bindings', amountETH: '0.2' },
    ],
    contributeETH: '0.5',  // 100% funded → FUNDED, then submit milestone 1
  },
  {
    // Campaign C — Active, just started (5% funded)
    creator: CREATORS.priya,
    title: 'Decentralised Git Protocol',
    description: 'Git repositories stored on IPFS with on-chain commit signatures. Pull requests are NFTs, issues are stored in a decentralised forum. Works with the existing git CLI via a custom remote helper.',
    category: 'Infrastructure',
    ipfsHash: 'QmDecentralisedGitV1Hash000000000000000000000003',
    goalETH: '2.0',
    deadlineDays: 90,
    milestones: [
      { title: 'IPFS Remote Helper', description: 'Custom git remote protocol that pushes/pulls from IPFS', amountETH: '0.8' },
      { title: 'On-Chain Commit Signing', description: 'Signed commit graph with EIP-712 typed data', amountETH: '0.8' },
      { title: 'PR & Issue Protocol', description: 'NFT-based pull requests and decentralised issue tracker', amountETH: '0.4' },
    ],
    contributeETH: '0.1',  // ~5% funded — stays ACTIVE
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function milestoneIpfsHash(title: string, description: string): string {
  // Mirrors the frontend: keccak256(title + description)
  return ethers.keccak256(ethers.toUtf8Bytes(title + description))
}

async function waitFor(tx: ethers.TransactionResponse, label: string): Promise<ethers.TransactionReceipt> {
  process.stdout.write(`  ⏳ ${label}... `)
  const receipt = await tx.wait()
  if (!receipt) throw new Error(`No receipt for ${label}`)
  console.log(`✓  (gas: ${receipt.gasUsed.toLocaleString()})`)
  return receipt
}

function parseCampaignCreatedId(receipt: ethers.TransactionReceipt, iface: ethers.Interface): number {
  for (const log of receipt.logs) {
    try {
      const decoded = iface.parseLog({ data: log.data, topics: [...log.topics] })
      if (decoded?.name === 'CampaignCreated') {
        return Number(decoded.args[0] as bigint)
      }
    } catch { /* not this event */ }
  }
  throw new Error('CampaignCreated event not found in receipt')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient()
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const adminWallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, adminWallet)
  const iface = new ethers.Interface(ABI)

  console.log('\n🌱  DeFund Demo Seed Script')
  console.log('─'.repeat(50))
  console.log(`Admin wallet : ${adminWallet.address}`)
  const balance = await provider.getBalance(adminWallet.address)
  console.log(`Balance      : ${ethers.formatEther(balance)} ETH`)

  // Rough estimate of ETH needed for contributions
  const totalContributions = CAMPAIGNS.reduce((sum, c) => sum + parseFloat(c.contributeETH), 0)
  console.log(`Contributions: ~${totalContributions} ETH + gas`)
  if (balance < ethers.parseEther(String(totalContributions + 0.05))) {
    console.error('\n❌  Insufficient balance. Top up from https://faucets.chain.link/sepolia')
    process.exit(1)
  }

  // ── Step 1: Create users ──────────────────────────────────────────────────

  console.log('\n📋  Creating users...')

  const adminUser = await prisma.user.upsert({
    where:  { walletAddress: adminWallet.address.toLowerCase() },
    create: {
      walletAddress: adminWallet.address.toLowerCase(),
      name: 'DeFund Admin',
      role: 'ADMIN',
      isVerified: true,
    },
    update: { name: 'DeFund Admin', role: 'ADMIN' },
  })
  console.log(`  ✓ Admin     ${adminUser.walletAddress}`)

  const creatorUsers: Record<string, any> = {}
  const creatorData = [
    { key: 'lena',  address: CREATORS.lena,  name: 'Lena Fischer',  bio: 'Security researcher & browser extension developer. 8 years in privacy tooling.' },
    { key: 'alex',  address: CREATORS.alex,  name: 'Alex Rivera',   bio: 'ZK researcher, previously at Aztec. Building the ZK dev toolchain from the ground up.' },
    { key: 'priya', address: CREATORS.priya, name: 'Priya Sharma',  bio: 'Distributed systems engineer. Former core contributor to IPFS and Filecoin.' },
  ]
  for (const c of creatorData) {
    creatorUsers[c.key] = await prisma.user.upsert({
      where:  { walletAddress: c.address.toLowerCase() },
      create: { walletAddress: c.address.toLowerCase(), name: c.name, bio: c.bio, isVerified: true },
      update: { name: c.name, bio: c.bio },
    })
    console.log(`  ✓ Creator   ${c.address.slice(0, 10)}… (${c.name})`)
  }

  // ── Step 2–4: Create each campaign ────────────────────────────────────────

  for (const [i, camp] of CAMPAIGNS.entries()) {
    const label = `[${i + 1}/${CAMPAIGNS.length}] ${camp.title}`
    console.log(`\n🚀  ${label}`)

    const creatorKey = Object.keys(CREATORS).find(k => CREATORS[k as keyof typeof CREATORS] === camp.creator)!
    const creatorUser = creatorUsers[creatorKey]
    const deadlineDate = new Date((NOW_SEC + camp.deadlineDays * DAY) * 1000)
    const deadlineTs   = BigInt(NOW_SEC + camp.deadlineDays * DAY)
    const fundGoalWei  = ethers.parseEther(camp.goalETH)

    // Milestone breakdown for on-chain call
    const onChainMilestones = camp.milestones.map(m => ({
      ipfsHash:       milestoneIpfsHash(m.title, m.description),
      amountRequired: ethers.parseEther(m.amountETH),
      deadline:       deadlineTs,
    }))

    // 2a. Create DB campaign record
    const dbCampaign = await prisma.campaign.create({
      data: {
        title:       camp.title,
        description: camp.description,
        category:    camp.category,
        ipfsHash:    camp.ipfsHash,
        goalAmount:  parseFloat(camp.goalETH),
        paymentToken: 'ETH',
        deadline:    deadlineDate,
        status:      CampaignStatus.PENDING,
        creatorId:   creatorUser.id,
        milestones: {
          create: camp.milestones.map(m => ({
            title:       m.title,
            description: m.description,
            amount:      parseFloat(m.amountETH),
            status:      MilestoneStatus.PENDING,
          })),
        },
      },
      include: { milestones: true },
    })
    console.log(`  ✓ DB campaign created  (id: ${dbCampaign.id})`)

    // 2b. Deploy campaign on-chain
    const createTx = await contract.createCampaign(
      camp.creator,
      camp.ipfsHash,
      0, // ETH
      fundGoalWei,
      deadlineTs,
      onChainMilestones,
    )
    const createReceipt = await waitFor(createTx, 'createCampaign()')
    const onChainId = parseCampaignCreatedId(createReceipt, iface)
    console.log(`  ✓ On-chain campaign ID: ${onChainId}`)

    // 2c. Link DB campaign to on-chain ID (mirrors approveCampaign in admin.service.ts)
    await prisma.campaign.update({
      where: { id: dbCampaign.id },
      data: {
        onChainId,
        isAdminApproved: true,
        status: CampaignStatus.ACTIVE,
      },
    })

    // 3. Contribute ETH (admin wallet contributes for demo)
    const contribWei = ethers.parseEther(camp.contributeETH)
    const contribTx = await contract.contributeETH(BigInt(onChainId), { value: contribWei })
    await waitFor(contribTx, `contributeETH(${camp.contributeETH} ETH)`)

    // 4. If fully funded, submit milestone 1 for voting
    if (parseFloat(camp.contributeETH) >= parseFloat(camp.goalETH)) {
      // The campaign is now FUNDED — the indexer will update status via CampaignStatusChanged
      // Wait a moment then submit milestone 1 for voting
      const ms1 = dbCampaign.milestones.sort((a, b) => a.id.localeCompare(b.id))[0]

      // The milestone gets an on-chain ID = contract's milestoneCounter at creation time.
      // We can find it by reading getCampaignMilestones() but for the seed we'll
      // assume sequential IDs. The indexer will link them via events.
      // Use a simple view call to get the milestone IDs for this campaign.
      const getMilestonesAbi = ['function getCampaignMilestones(uint256) view returns (uint256[])']
      const viewContract = new ethers.Contract(CONTRACT_ADDRESS, getMilestonesAbi, provider)
      const milestoneIds: bigint[] = await viewContract.getCampaignMilestones(BigInt(onChainId))

      if (milestoneIds.length > 0) {
        const ms1OnChainId = milestoneIds[0]
        const proofHash = 'QmZKProofMilestone1ProofHash00000000000000000001'
        const submitTx = await contract.submitMilestoneForVoting(ms1OnChainId, proofHash)
        await waitFor(submitTx, `submitMilestoneForVoting(ms1 onChainId=${ms1OnChainId})`)
        console.log(`  ✓ Milestone 1 submitted for voting`)

        // Update the DB milestone too (indexer will also sync this from event)
        await prisma.milestone.updateMany({
          where: { campaignId: dbCampaign.id, title: ms1.title },
          data: { status: MilestoneStatus.VOTING, proofUrl: proofHash },
        })
      }
    }

    console.log(`  ✅  Campaign "${camp.title}" done`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const finalBalance = await provider.getBalance(adminWallet.address)
  console.log('\n' + '─'.repeat(50))
  console.log('✅  Seed complete!')
  console.log(`   Campaigns created : ${CAMPAIGNS.length}`)
  console.log(`   Remaining balance : ${ethers.formatEther(finalBalance)} ETH`)
  console.log('\n💡  Next steps:')
  console.log('   1. Start the backend — the indexer will sync on-chain events to the DB')
  console.log('   2. Run the read script to verify: npx ts-node scripts/read-contract.ts')
  console.log('   3. Connect a funded wallet on the frontend to test contributions + voting')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('\n❌ ', e.message)
  process.exit(1)
})
