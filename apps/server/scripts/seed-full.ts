import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, CampaignStatus, MilestoneStatus } from '../src/generated/prisma';

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const A1 = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const A2 = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
let seq = 5000;
const tx = () => `0x${(seq++).toString(16).padStart(8,'0')}a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6`;
const ago  = (d: number) => new Date(Date.now() - d * 86400000);
const from = (d: number) => new Date(Date.now() + d * 86400000);

async function main() {
  console.log('seeding...');

  const [a1, a2] = await Promise.all([
    prisma.user.upsert({ where:{walletAddress:A1}, create:{walletAddress:A1,name:'DeFund Admin',role:'ADMIN',isVerified:true}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:A2}, create:{walletAddress:A2,name:'Platform Guardian',role:'ADMIN',isVerified:true}, update:{} }),
  ]);

  const cr = await Promise.all([
    prisma.user.upsert({ where:{walletAddress:'0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'}, create:{walletAddress:'0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',name:'Marcus Chen',bio:'Security researcher, 8 yrs privacy tooling.',githubHandle:'marcuschen-dev',isVerified:true}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0x90f79bf6eb2c4f870365e785982e1f101e93b906'}, create:{walletAddress:'0x90f79bf6eb2c4f870365e785982e1f101e93b906',name:'Aisha Okonkwo',bio:'ZK researcher, previously at Aztec.',githubHandle:'aisha-zk',isVerified:true}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0x15d34aaf54267db7d7c367839aaf71a00a2c6a65'}, create:{walletAddress:'0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',name:'Dmitri Volkov',bio:'Distributed systems engineer, ex-IPFS core.',githubHandle:'dvolkov-ipfs',isVerified:true}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc'}, create:{walletAddress:'0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc',name:'Priya Ramaswamy',bio:'Civic technologist and open data advocate.',githubHandle:'priya-civictech',isVerified:true}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0x976ea74026e726554db657fa54763abd0c3a0aa9'}, create:{walletAddress:'0x976ea74026e726554db657fa54763abd0c3a0aa9',name:'Yuki Tanaka',bio:'Full-stack dev, privacy advocate.',githubHandle:'yukitanaka-oss',isVerified:true}, update:{} }),
  ]);

  const g = await Promise.all([
    prisma.user.upsert({ where:{walletAddress:'0x14dc79964da2c08b23698b3d3cc7ca32193d9955'}, create:{walletAddress:'0x14dc79964da2c08b23698b3d3cc7ca32193d9955',name:'Alex Morgan',bio:'DeFi enthusiast.'}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f'}, create:{walletAddress:'0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f',name:'Sam Wilson',bio:'Crypto investor, public goods.'}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0xa0ee7a142d267c1f36714e4a8f75612f20a79720'}, create:{walletAddress:'0xa0ee7a142d267c1f36714e4a8f75612f20a79720',name:'Taylor Reed',bio:'Privacy advocate.'}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0xbcd4042de499d14e55001ccbb24a551f3b954096'}, create:{walletAddress:'0xbcd4042de499d14e55001ccbb24a551f3b954096',name:'Jordan Lee',bio:'Climate activist.'}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0x71be63f3384f5fb98995898a86b02fb2426c5788'}, create:{walletAddress:'0x71be63f3384f5fb98995898a86b02fb2426c5788',name:'Morgan Quinn',bio:'Web3 developer.'}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0xfabb0ac9d68b0b445fb7357272ff202c5651694a'}, create:{walletAddress:'0xfabb0ac9d68b0b445fb7357272ff202c5651694a',name:'Casey Nguyen',bio:'Security researcher.'}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0x1cbd3b2770909d4e10f157cabc84c7264073c9ec'}, create:{walletAddress:'0x1cbd3b2770909d4e10f157cabc84c7264073c9ec',name:'Riley Park',bio:'Healthcare tech researcher.'}, update:{} }),
    prisma.user.upsert({ where:{walletAddress:'0xdf3e18d64bc0a983567b04dadcc01c4e6d9df7ff'}, create:{walletAddress:'0xdf3e18d64bc0a983567b04dadcc01c4e6d9df7ff',name:'Drew Chen',bio:'Infrastructure engineer.'}, update:{} }),
  ]);

  // ── 1. ACTIVE ~35% ───────────────────────────────────────────────────────
  const c1 = await prisma.campaign.create({ data: {
    title:'Privacy-First Browser Extension', category:'Security & Privacy', paymentToken:'ETH',
    description:'Open-source extension blocking canvas/font fingerprinting, injecting decoy signals into WebGL and AudioContext APIs, routing DNS over HTTPS. Zero telemetry, reproducible builds.',
    goalAmount:0.80, raisedAmount:0.28, status:CampaignStatus.ACTIVE, deadline:from(45),
    onChainId:11, isAdminApproved:true, license:'MIT',
    repositoryUrl:'https://github.com/defund-demo/privacy-shield', website:'https://privacyshield.example.org',
    ipfsHash:'0x7a5c1b2e4f8d3a6b9c0e2f5d8a1b4e7c0d3f6a9b2e5c8d1a4f7b0e3c6d9a2b5', creatorId:cr[0].id,
    milestones:{create:[
      {title:'Fingerprinting Shield Core',description:'Canvas, WebGL, AudioContext spoofing with test harness.',amount:0.30,status:MilestoneStatus.ONGOING,    order:0,deadline:from(20),onChainId:201},
      {title:'DNS-over-HTTPS',            description:'Encrypted DNS resolver, toggle UI, custom upstreams.',  amount:0.30,status:MilestoneStatus.NOT_STARTED,order:1,deadline:from(35),onChainId:202},
      {title:'Audit & Store Release',     description:'Third-party audit, fix findings, Chrome + Firefox stores.',amount:0.20,status:MilestoneStatus.NOT_STARTED,order:2,deadline:from(45),onChainId:203},
    ]},
  }, include:{milestones:true} });
  await prisma.contribution.createMany({data:[
    {amount:0.08,transactionHash:tx(),contributorId:g[0].id,campaignId:c1.id,timestamp:ago(12)},
    {amount:0.07,transactionHash:tx(),contributorId:g[1].id,campaignId:c1.id,timestamp:ago(9)},
    {amount:0.06,transactionHash:tx(),contributorId:g[2].id,campaignId:c1.id,timestamp:ago(5)},
    {amount:0.07,transactionHash:tx(),contributorId:g[4].id,campaignId:c1.id,timestamp:ago(2)},
  ]});
  const f1=await prisma.forum.create({data:{campaignId:c1.id}});
  const m1a=await prisma.message.create({data:{forumId:f1.id,userId:g[0].id,content:"Just contributed. Covers WebGL and AudioContext too — most extensions only block canvas. When's the first milestone build?",createdAt:ago(11)}});
  await prisma.message.create({data:{forumId:f1.id,userId:cr[0].id,content:"Thanks! End of next week. Will post a dev update once the canvas spoofer passes Cover Your Tracks.",createdAt:ago(10),parentId:m1a.id}});
  await prisma.message.create({data:{forumId:f1.id,userId:g[2].id,content:"Will DoH support custom resolvers or just Cloudflare/NextDNS?",createdAt:ago(4)}});
  await prisma.message.create({data:{forumId:f1.id,userId:cr[0].id,content:"Both — curated list plus free-text. Fallback kicks in automatically if resolver times out.",createdAt:ago(3)}});
  await prisma.update.create({data:{campaignId:c1.id,title:'Canvas spoofing prototype working',content:'Canvas readout spoofer passes Cover Your Tracks and AmIUnique. Per-session salt so fingerprint rotates each browser restart. Moving to WebGL next week.',createdAt:ago(6)}});
  await prisma.adminAuditLog.create({data:{adminWallet:A1,action:'APPROVE_CAMPAIGN',entityType:'campaign',entityId:c1.id,entityTitle:c1.title,metadata:{onChainId:11},createdAt:ago(15)}});

  // ── 2. FUNDED, M1 VOTING ─────────────────────────────────────────────────
  const c2 = await prisma.campaign.create({ data: {
    title:'Zero-Knowledge Proof SDK', category:'Developer Tools', paymentToken:'USDC',
    description:'TypeScript + Rust SDK for ZK apps without a cryptography PhD. Audited circuit templates for anonymous voting, private balances, and age proofs.',
    goalAmount:10.00, raisedAmount:10.00, status:CampaignStatus.FUNDED, deadline:from(30),
    onChainId:12, isAdminApproved:true, license:'Apache-2.0',
    repositoryUrl:'https://github.com/defund-demo/zk-proof-sdk', website:'https://zksdk.example.dev',
    ipfsHash:'0x3b8e2f5c9d0a6e1b4f7c3a8d2e5b9f0c4a7e1b8d5f2c6a3e9b0d4f7a1c8e5b2', creatorId:cr[1].id,
    milestones:{create:[
      {title:'Circuit Template Library',description:'Groth16 + PLONK circuits for voting, transfers, identity.',amount:4.00,status:MilestoneStatus.VOTING,      order:0,deadline:from(10),onChainId:204,votingEndTime:from(5),proofUrl:'QmZKCircuitsProofV1Hash0000001',submissionCount:1},
      {title:'TypeScript SDK & CLI',    description:'Proof generation, verification, contract bindings, scaffold CLI.',amount:3.00,status:MilestoneStatus.NOT_STARTED,order:1,deadline:from(20),onChainId:205},
      {title:'Docs & Example Apps',     description:'Full docs site and three end-to-end example apps.',amount:3.00,status:MilestoneStatus.NOT_STARTED,order:2,deadline:from(30),onChainId:206},
    ]},
  }, include:{milestones:true} });
  const c2m1=c2.milestones.find(m=>m.order===0)!;
  await prisma.contribution.createMany({data:[
    {amount:2.00,transactionHash:tx(),contributorId:g[0].id,campaignId:c2.id,timestamp:ago(20)},
    {amount:1.50,transactionHash:tx(),contributorId:g[1].id,campaignId:c2.id,timestamp:ago(18)},
    {amount:1.50,transactionHash:tx(),contributorId:g[2].id,campaignId:c2.id,timestamp:ago(15)},
    {amount:2.00,transactionHash:tx(),contributorId:g[3].id,campaignId:c2.id,timestamp:ago(12)},
    {amount:1.00,transactionHash:tx(),contributorId:g[4].id,campaignId:c2.id,timestamp:ago(10)},
    {amount:1.00,transactionHash:tx(),contributorId:g[5].id,campaignId:c2.id,timestamp:ago(8)},
    {amount:1.00,transactionHash:tx(),contributorId:g[6].id,campaignId:c2.id,timestamp:ago(5)},
  ]});
  await prisma.vote.createMany({data:[
    {choice:true, weight:'2000000',voterId:g[0].id,milestoneId:c2m1.id,timestamp:ago(1)},
    {choice:true, weight:'1500000',voterId:g[1].id,milestoneId:c2m1.id,timestamp:ago(1)},
    {choice:true, weight:'1500000',voterId:g[2].id,milestoneId:c2m1.id,timestamp:ago(0)},
    {choice:false,weight:'2000000',voterId:g[3].id,milestoneId:c2m1.id,timestamp:ago(0)},
    {choice:true, weight:'1000000',voterId:g[4].id,milestoneId:c2m1.id,timestamp:ago(0)},
  ]});
  const f2=await prisma.forum.create({data:{campaignId:c2.id}});
  const m2a=await prisma.message.create({data:{forumId:f2.id,userId:g[2].id,content:"Voting live on M1. Circuits compile cleanly, soundness tests pass. Voting yes.",createdAt:ago(1)}});
  await prisma.message.create({data:{forumId:f2.id,userId:g[3].id,content:"Rejecting — docs don't mention trusted setup ceremony parameters. Not unsafe but it's a gap.",createdAt:ago(1),parentId:m2a.id}});
  await prisma.message.create({data:{forumId:f2.id,userId:cr[1].id,content:"Added detailed README on Groth16 + PLONK setup, entropy sources, verification procedure.",createdAt:ago(0)}});
  await prisma.update.createMany({data:[
    {campaignId:c2.id,title:'M1 open for voting',content:'Circuit Template Library submitted. All three circuit types with passing soundness tests. Voting closes in 5 days.',createdAt:ago(2)},
    {campaignId:c2.id,title:'Campaign fully funded!',content:'10 USDC from 7 contributors. Circuit library work underway.',createdAt:ago(20)},
  ]});
  await prisma.adminAuditLog.createMany({data:[
    {adminWallet:A1,action:'APPROVE_CAMPAIGN',entityType:'campaign',entityId:c2.id,entityTitle:c2.title,metadata:{onChainId:12},createdAt:ago(25)},
    {adminWallet:A1,action:'MILESTONE_VOTING_STARTED',entityType:'milestone',entityId:c2m1.id,entityTitle:c2m1.title,metadata:{campaignId:c2.id},createdAt:ago(2)},
  ]});

  // ── 3. FUNDED, M1 COMPLETED, M2 VOTING ───────────────────────────────────
  const c3 = await prisma.campaign.create({ data: {
    title:'Open Source Climate Data Commons', category:'Climate', paymentToken:'USDC',
    description:'Free open repository of high-resolution climate and air quality data from public sensor networks, satellites, and citizen science. Free API with provenance on every record.',
    goalAmount:10.00, raisedAmount:10.00, releasedAmount:3.00, status:CampaignStatus.FUNDED, deadline:from(90),
    onChainId:13, isAdminApproved:true, license:'MPL-2.0',
    repositoryUrl:'https://github.com/defund-demo/climate-commons', website:'https://climatecommons.example.earth',
    ipfsHash:'0x5f2c8e1b4d7a0e3f6c9b2a5d8e1f4b7c0a3d6f9c2b5e8a1d4f7b0c3e6a9d2f5', creatorId:cr[3].id,
    milestones:{create:[
      {title:'Ingestion Pipelines', description:'NOAA GHCN-D, OpenAQ, ERA5, USGS connectors — auto retry + schema validation.',amount:3.00,status:MilestoneStatus.COMPLETED,  order:0,deadline:from(25),onChainId:207,proofUrl:'QmClimateIngestionProof0001'},
      {title:'Unified Query API',   description:'REST + GraphQL API with rate limiting, pagination, provenance metadata.',    amount:3.00,status:MilestoneStatus.VOTING,     order:1,deadline:from(50),onChainId:208,votingEndTime:from(6),proofUrl:'QmClimateQueryAPIProof0002',submissionCount:1},
      {title:'Reproducible Pipelines',description:'Containerised transforms so results can be independently reproduced.',    amount:2.00,status:MilestoneStatus.NOT_STARTED,order:2,deadline:from(70),onChainId:209},
      {title:'Public Dashboard',    description:'Lightweight dashboard for exploring trends without code.',                    amount:2.00,status:MilestoneStatus.NOT_STARTED,order:3,deadline:from(90),onChainId:210},
    ]},
  }, include:{milestones:true} });
  const c3m1=c3.milestones.find(m=>m.order===0)!;
  const c3m2=c3.milestones.find(m=>m.order===1)!;
  await prisma.contribution.createMany({data:[
    {amount:1.50,transactionHash:tx(),contributorId:g[0].id,campaignId:c3.id,timestamp:ago(40)},
    {amount:1.00,transactionHash:tx(),contributorId:g[1].id,campaignId:c3.id,timestamp:ago(38)},
    {amount:1.00,transactionHash:tx(),contributorId:g[2].id,campaignId:c3.id,timestamp:ago(36)},
    {amount:1.00,transactionHash:tx(),contributorId:g[3].id,campaignId:c3.id,timestamp:ago(34)},
    {amount:1.50,transactionHash:tx(),contributorId:g[4].id,campaignId:c3.id,timestamp:ago(32)},
    {amount:1.00,transactionHash:tx(),contributorId:g[5].id,campaignId:c3.id,timestamp:ago(30)},
    {amount:1.00,transactionHash:tx(),contributorId:g[6].id,campaignId:c3.id,timestamp:ago(28)},
    {amount:0.50,transactionHash:tx(),contributorId:g[7].id,campaignId:c3.id,timestamp:ago(26)},
    {amount:0.75,transactionHash:tx(),contributorId:a1.id,  campaignId:c3.id,timestamp:ago(24)},
    {amount:0.75,transactionHash:tx(),contributorId:a2.id,  campaignId:c3.id,timestamp:ago(22)},
  ]});
  await prisma.vote.createMany({data:[
    {choice:true, weight:'1500000',voterId:g[0].id,milestoneId:c3m2.id,timestamp:ago(0)},
    {choice:true, weight:'1000000',voterId:g[1].id,milestoneId:c3m2.id,timestamp:ago(0)},
    {choice:true, weight:'1000000',voterId:g[2].id,milestoneId:c3m2.id,timestamp:ago(0)},
    {choice:true, weight:'1000000',voterId:g[3].id,milestoneId:c3m2.id,timestamp:ago(0)},
    {choice:false,weight:'1500000',voterId:g[4].id,milestoneId:c3m2.id,timestamp:ago(0)},
    {choice:true, weight:'1000000',voterId:g[5].id,milestoneId:c3m2.id,timestamp:ago(0)},
  ]});
  await prisma.releaseFundsProposal.create({data:{onChainId:1001,proposer:A1,confirmer:A2,executed:true,proposedAt:ago(10),milestoneId:c3m1.id}});
  const f3=await prisma.forum.create({data:{campaignId:c3.id}});
  const m3a=await prisma.message.create({data:{forumId:f3.id,userId:g[3].id,content:'NOAA GHCN-D ingestion solid — 3 years of records, no missing days, all checksums valid.',createdAt:ago(20)}});
  await prisma.message.create({data:{forumId:f3.id,userId:cr[3].id,content:'Thanks! ERA5 reanalysis next — GRIB2 reprojection slower than expected but landing end of week.',createdAt:ago(19),parentId:m3a.id}});
  await prisma.message.create({data:{forumId:f3.id,userId:g[4].id,content:"Rate limits aren't in the OpenAPI spec. Consumer can't discover them without trial and error.",createdAt:ago(1)}});
  await prisma.message.create({data:{forumId:f3.id,userId:cr[3].id,content:'Added X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After to spec and live API.',createdAt:ago(0)}});
  await prisma.update.createMany({data:[
    {campaignId:c3.id,title:'M1 complete — ingestion pipelines released',content:'Four connectors live: NOAA GHCN-D, OpenAQ v2, ERA5, USGS. Hourly schedules, auto retry, schema validation. Funds released.',createdAt:ago(12)},
    {campaignId:c3.id,title:'Voting open: Unified Query API',content:'M2 live — REST + GraphQL, provenance on every record, rate limiting, OpenAPI 3.1. Closes in 6 days.',createdAt:ago(1)},
  ]});
  await prisma.adminAuditLog.createMany({data:[
    {adminWallet:A1,action:'APPROVE_CAMPAIGN',      entityType:'campaign', entityId:c3.id,   entityTitle:c3.title,   metadata:{onChainId:13},   createdAt:ago(45)},
    {adminWallet:A1,action:'PROPOSE_RELEASE_FUNDS', entityType:'milestone',entityId:c3m1.id, entityTitle:c3m1.title, metadata:{onChainId:1001}, createdAt:ago(11)},
    {adminWallet:A2,action:'CONFIRM_RELEASE_FUNDS', entityType:'milestone',entityId:c3m1.id, entityTitle:c3m1.title, metadata:{onChainId:1001}, createdAt:ago(10)},
  ]});

  // ── 4. FUNDED, M1 done, M2 approved, M3 VOTING ───────────────────────────
  const c4 = await prisma.campaign.create({ data: {
    title:'Federated Learning for Small Clinics', category:'Health', paymentToken:'ETH',
    description:'Privacy-preserving ML for small clinics — train diagnostic models without sharing patient data. Local training only, encrypted gradient updates aggregated centrally.',
    goalAmount:0.04, raisedAmount:0.04, releasedAmount:0.01, status:CampaignStatus.FUNDED, deadline:from(60),
    onChainId:14, isAdminApproved:true, license:'Apache-2.0',
    repositoryUrl:'https://github.com/defund-demo/federated-clinics',
    ipfsHash:'0x4c7e0b3d6f9a2e5c8b1d4f7a0c3e6b9d2f5a8c1e4b7d0f3a6c9e2b5d8f1a4c7', creatorId:cr[2].id,
    milestones:{create:[
      {title:'Local Training Runtime',description:'Trains locally, produces encrypted updates for aggregation.',amount:0.01,status:MilestoneStatus.COMPLETED,  order:0,deadline:ago(20),onChainId:211,proofUrl:'QmFederatedMS1Proof001'},
      {title:'Secure Aggregation',    description:'Server learns combined update without seeing individual contributions.',amount:0.01,status:MilestoneStatus.APPROVED,    order:1,deadline:from(10),onChainId:212,proofUrl:'QmFederatedMS2Proof002'},
      {title:'Robustness Controls',   description:'Detect + limit influence of any single participant on shared model.',amount:0.01,status:MilestoneStatus.VOTING,      order:2,deadline:from(30),onChainId:213,votingEndTime:from(6),proofUrl:'QmFederatedMS3Proof003',submissionCount:1},
      {title:'Offline-Friendly Sync', description:'Resumable rounds for intermittent connectivity.',amount:0.01,status:MilestoneStatus.NOT_STARTED,order:3,deadline:from(55),onChainId:214},
    ]},
  }, include:{milestones:true} });
  const c4m1=c4.milestones.find(m=>m.order===0)!;
  const c4m2=c4.milestones.find(m=>m.order===1)!;
  const c4m3=c4.milestones.find(m=>m.order===2)!;
  await prisma.contribution.createMany({data:[
    {amount:0.01, transactionHash:tx(),contributorId:g[0].id,campaignId:c4.id,timestamp:ago(50)},
    {amount:0.01, transactionHash:tx(),contributorId:g[1].id,campaignId:c4.id,timestamp:ago(48)},
    {amount:0.01, transactionHash:tx(),contributorId:g[6].id,campaignId:c4.id,timestamp:ago(46)},
    {amount:0.005,transactionHash:tx(),contributorId:g[7].id,campaignId:c4.id,timestamp:ago(44)},
    {amount:0.005,transactionHash:tx(),contributorId:g[4].id,campaignId:c4.id,timestamp:ago(42)},
  ]});
  await prisma.vote.createMany({data:[
    {choice:true,weight:'10000000000000000',voterId:g[0].id,milestoneId:c4m3.id,timestamp:ago(0)},
    {choice:true,weight:'10000000000000000',voterId:g[1].id,milestoneId:c4m3.id,timestamp:ago(0)},
    {choice:true,weight:'5000000000000000', voterId:g[6].id,milestoneId:c4m3.id,timestamp:ago(0)},
  ]});
  await prisma.releaseFundsProposal.create({data:{onChainId:1002,proposer:A1,confirmer:A2,  executed:true, proposedAt:ago(15),milestoneId:c4m1.id}});
  await prisma.releaseFundsProposal.create({data:{onChainId:1003,proposer:A1,confirmer:null,executed:false,proposedAt:ago(2), milestoneId:c4m2.id}});
  const f4=await prisma.forum.create({data:{campaignId:c4.id}});
  const m4a=await prisma.message.create({data:{forumId:f4.id,userId:g[6].id,content:'M1 excellent. Works with both PyTorch and TF Federated — important for clinics that cannot standardise on one framework.',createdAt:ago(22)}});
  await prisma.message.create({data:{forumId:f4.id,userId:cr[2].id,content:'Intentional — aggregator only sees gradient update format, not training code.',createdAt:ago(21),parentId:m4a.id}});
  await prisma.message.create({data:{forumId:f4.id,userId:g[0].id,content:'Voting yes on M3. Krum aggregation correctly identifies and down-weights the two simulated adversarial nodes.',createdAt:ago(0)}});
  await prisma.update.createMany({data:[
    {campaignId:c4.id,title:'M3 open for voting: Robustness Controls',content:'Krum handles Byzantine adversaries up to 30% of participants. Voting closes in 6 days.',createdAt:ago(1)},
    {campaignId:c4.id,title:'M2 approved — Secure Aggregation',content:'Unanimous vote. Modified Shamir — server learns only summed update. Release proposal in admin multisig.',createdAt:ago(8)},
  ]});
  await prisma.adminAuditLog.createMany({data:[
    {adminWallet:A1,action:'APPROVE_CAMPAIGN',      entityType:'campaign', entityId:c4.id,   entityTitle:c4.title,   metadata:{onChainId:14},   createdAt:ago(55)},
    {adminWallet:A1,action:'PROPOSE_RELEASE_FUNDS', entityType:'milestone',entityId:c4m1.id, entityTitle:c4m1.title, metadata:{onChainId:1002}, createdAt:ago(16)},
    {adminWallet:A2,action:'CONFIRM_RELEASE_FUNDS', entityType:'milestone',entityId:c4m1.id, entityTitle:c4m1.title, metadata:{onChainId:1002}, createdAt:ago(15)},
    {adminWallet:A1,action:'PROPOSE_RELEASE_FUNDS', entityType:'milestone',entityId:c4m2.id, entityTitle:c4m2.title, metadata:{onChainId:1003}, createdAt:ago(2)},
  ]});

  // ── 5. ACTIVE, open refund proposal ──────────────────────────────────────
  const c5 = await prisma.campaign.create({ data: {
    title:'Civic Budget Transparency Portal', category:'Civic Tech', paymentToken:'USDC',
    description:'Open-source portal for local governments to publish budgets residents can understand. Transforms spreadsheets into visual breakdowns, multi-language, drill from summary to line item.',
    goalAmount:10.00, raisedAmount:5.50, status:CampaignStatus.ACTIVE, deadline:from(18),
    onChainId:15, isAdminApproved:true, license:'MIT',
    repositoryUrl:'https://github.com/defund-demo/budget-portal', website:'https://budgets.example.city',
    ipfsHash:'0x6d9f2c5e8b1a4d7f0c3e6b9a2d5f8c1b4e7a0d3f6c9b2e5a8d1f4b7e0c3a6d9',
    refundReason:'Creator communicated 6-week delay. Contributors requested refund given approaching deadline.',
    creatorId:cr[3].id,
    milestones:{create:[
      {title:'Accounting Importer',   description:'Importers for two common accounting export formats.',amount:3.00,status:MilestoneStatus.ONGOING,    order:0,deadline:from(8), onChainId:215},
      {title:'Visual Breakdowns',     description:'Interactive visualisations from summary to line item.',amount:4.00,status:MilestoneStatus.NOT_STARTED,order:1,deadline:from(13),onChainId:216},
      {title:'Localisation & Launch', description:'Multi-language + municipality deployment template.',amount:3.00,status:MilestoneStatus.NOT_STARTED,order:2,deadline:from(18),onChainId:217},
    ]},
  } });
  await prisma.contribution.createMany({data:[
    {amount:2.00,transactionHash:tx(),contributorId:g[3].id,campaignId:c5.id,timestamp:ago(22)},
    {amount:1.50,transactionHash:tx(),contributorId:g[4].id,campaignId:c5.id,timestamp:ago(20)},
    {amount:1.00,transactionHash:tx(),contributorId:g[5].id,campaignId:c5.id,timestamp:ago(17)},
    {amount:0.50,transactionHash:tx(),contributorId:g[7].id,campaignId:c5.id,timestamp:ago(14)},
    {amount:0.50,transactionHash:tx(),contributorId:g[1].id,campaignId:c5.id,timestamp:ago(10)},
  ]});
  await prisma.refundProposal.create({data:{onChainId:1501,proposer:A1,confirmer:null,executed:false,proposedAt:ago(2),campaignId:c5.id}});
  const f5=await prisma.forum.create({data:{campaignId:c5.id}});
  const m5a=await prisma.message.create({data:{forumId:f5.id,userId:g[3].id,content:"Contributed 2 USDC 3 weeks ago — repo has no commits. Requested refund through admin dashboard.",createdAt:ago(4)}});
  await prisma.message.create({data:{forumId:f5.id,userId:cr[3].id,content:"Complications with German HAUSHALTSPLAN XML — wildly inconsistent spec. First working importer this week.",createdAt:ago(3),parentId:m5a.id}});
  await prisma.message.create({data:{forumId:f5.id,userId:g[5].id,content:"Admin has proposed a refund on-chain — waiting on second admin to confirm.",createdAt:ago(2)}});
  await prisma.adminAuditLog.createMany({data:[
    {adminWallet:A1,action:'APPROVE_CAMPAIGN',entityType:'campaign',entityId:c5.id,entityTitle:c5.title,metadata:{onChainId:15},  createdAt:ago(26)},
    {adminWallet:A1,action:'PROPOSE_REFUND',  entityType:'campaign',entityId:c5.id,entityTitle:c5.title,metadata:{onChainId:1501},createdAt:ago(2)},
  ]});

  // ── 6. COMPLETED ─────────────────────────────────────────────────────────
  const c6 = await prisma.campaign.create({ data: {
    title:'Self-Hosted Encrypted Notes', category:'Productivity', paymentToken:'ETH',
    description:'Self-hostable note app with E2E encryption, offline-first sync, markdown editor. Notes encrypted on device. For people who want a modern notes app without surrendering content to third-party cloud.',
    goalAmount:0.05, raisedAmount:0.05, releasedAmount:0.05, status:CampaignStatus.COMPLETED, deadline:from(10),
    onChainId:16, isAdminApproved:true, license:'AGPL-3.0',
    repositoryUrl:'https://github.com/defund-demo/encrypted-notes',
    ipfsHash:'0x2e5a8d1f4b7e0c3a6d9f2b5e8c1a4d7f0b3e6a9c2d5f8b1e4a7d0c3f6b9e2a5', creatorId:cr[4].id,
    milestones:{create:[
      {title:'E2E Encryption Core',  description:'Client-side encryption, key derivation, secure backup and recovery.',amount:0.01,status:MilestoneStatus.COMPLETED,order:0,deadline:ago(60),onChainId:218,proofUrl:'QmEncNotesMS1Proof01'},
      {title:'Offline-First Sync',   description:'CRDT sync — offline edits merge cleanly on reconnect.',             amount:0.01,status:MilestoneStatus.COMPLETED,order:1,deadline:ago(45),onChainId:219,proofUrl:'QmEncNotesMS2Proof02'},
      {title:'Rich Editor',          description:'Markdown editor with code highlighting, attachments, full-text search.',amount:0.01,status:MilestoneStatus.COMPLETED,order:2,deadline:ago(30),onChainId:220,proofUrl:'QmEncNotesMS3Proof03'},
      {title:'One-Command Deploy',   description:'Single Docker deployment, sensible defaults, automated backups.',   amount:0.01,status:MilestoneStatus.COMPLETED,order:3,deadline:ago(15),onChainId:221,proofUrl:'QmEncNotesMS4Proof04'},
      {title:'Mobile Companion PWA', description:'PWA with biometric unlock.',                                        amount:0.01,status:MilestoneStatus.COMPLETED,order:4,deadline:ago(5), onChainId:222,proofUrl:'QmEncNotesMS5Proof05'},
    ]},
  }, include:{milestones:true} });
  const c6ms=c6.milestones.sort((a,b)=>a.order-b.order);
  await prisma.contribution.createMany({data:[
    {amount:0.01, transactionHash:tx(),contributorId:g[0].id,campaignId:c6.id,timestamp:ago(95)},
    {amount:0.01, transactionHash:tx(),contributorId:g[1].id,campaignId:c6.id,timestamp:ago(93)},
    {amount:0.01, transactionHash:tx(),contributorId:g[2].id,campaignId:c6.id,timestamp:ago(91)},
    {amount:0.01, transactionHash:tx(),contributorId:g[4].id,campaignId:c6.id,timestamp:ago(89)},
    {amount:0.005,transactionHash:tx(),contributorId:g[5].id,campaignId:c6.id,timestamp:ago(87)},
    {amount:0.005,transactionHash:tx(),contributorId:g[6].id,campaignId:c6.id,timestamp:ago(85)},
  ]});
  await prisma.releaseFundsProposal.createMany({data:c6ms.map((m,i)=>({onChainId:1100+i,proposer:A1,confirmer:A2,executed:true,proposedAt:ago(70-i*12),milestoneId:m.id}))});
  const f6=await prisma.forum.create({data:{campaignId:c6.id}});
  const m6a=await prisma.message.create({data:{forumId:f6.id,userId:g[1].id,content:"Best-executed project I've backed here. Every milestone on time, docs excellent.",createdAt:ago(4)}});
  await prisma.message.create({data:{forumId:f6.id,userId:g[0].id,content:"Agree — one-command deploy, running on a 5€/mo VPS in 10 minutes.",createdAt:ago(3),parentId:m6a.id}});
  await prisma.update.create({data:{campaignId:c6.id,title:'All milestones complete — v1.0 shipped!',content:'v1.0 live. Docker Hub image available. Full changelog in release notes.',createdAt:ago(4)}});
  await prisma.adminAuditLog.createMany({data:[
    {adminWallet:A1,action:'APPROVE_CAMPAIGN',entityType:'campaign',entityId:c6.id,entityTitle:c6.title,metadata:{onChainId:16},createdAt:ago(98)},
    ...c6ms.map((m,i)=>({adminWallet:A1,action:'PROPOSE_RELEASE_FUNDS',entityType:'milestone',entityId:m.id,entityTitle:m.title,metadata:{onChainId:1100+i},createdAt:ago(69-i*12)})),
    ...c6ms.map((m,i)=>({adminWallet:A2,action:'CONFIRM_RELEASE_FUNDS',entityType:'milestone',entityId:m.id,entityTitle:m.title,metadata:{onChainId:1100+i},createdAt:ago(68-i*12)})),
  ]});

  // ── 7. FLAGGED ───────────────────────────────────────────────────────────
  const c7 = await prisma.campaign.create({ data: {
    title:'Community Mesh Networking Kit', category:'Networking', paymentToken:'USDC',
    description:'Hardware + software kit for neighbourhoods to build resilient wireless networks. Flashable firmware, setup wizard, self-healing routing.',
    goalAmount:10.00, raisedAmount:7.50, status:CampaignStatus.FLAGGED, deadline:from(20),
    onChainId:17, isAdminApproved:true, license:'GPL-2.0',
    repositoryUrl:'https://github.com/defund-demo/mesh-kit',
    ipfsHash:'0x8b1e4a7d0f3c6b9e2a5d8f1c4b7e0a3d6c9f2e5b8a1d4f7c0b3e6a9d2f5c8b1',
    refundReason:'Creator misrepresented team affiliation. No working hardware prototype demonstrated. Contributors unable to reach creator.',
    creatorId:cr[1].id,
    milestones:{create:[
      {title:'Self-Healing Firmware',     description:'Flashable firmware with automatic routing.',amount:2.00,status:MilestoneStatus.NOT_STARTED,order:0,onChainId:223},
      {title:'Setup Wizard',              description:'Node configured in <5 min, no CLI.',        amount:2.00,status:MilestoneStatus.NOT_STARTED,order:1,onChainId:224},
      {title:'Captive Portal & BW Share', description:'Captive portal and fair bandwidth sharing.',amount:2.00,status:MilestoneStatus.NOT_STARTED,order:2,onChainId:225},
      {title:'Organiser Docs',            description:'Diagrams and troubleshooting for organisers.',amount:2.00,status:MilestoneStatus.NOT_STARTED,order:3,onChainId:226},
      {title:'Pilot Deployment',          description:'Small pilot with a real community.',         amount:2.00,status:MilestoneStatus.NOT_STARTED,order:4,onChainId:227},
    ]},
  } });
  await prisma.contribution.createMany({data:[
    {amount:2.00,transactionHash:tx(),contributorId:g[0].id,campaignId:c7.id,timestamp:ago(18)},
    {amount:1.50,transactionHash:tx(),contributorId:g[2].id,campaignId:c7.id,timestamp:ago(16)},
    {amount:1.50,transactionHash:tx(),contributorId:g[3].id,campaignId:c7.id,timestamp:ago(14)},
    {amount:1.00,transactionHash:tx(),contributorId:g[5].id,campaignId:c7.id,timestamp:ago(12)},
    {amount:0.75,transactionHash:tx(),contributorId:g[6].id,campaignId:c7.id,timestamp:ago(10)},
    {amount:0.75,transactionHash:tx(),contributorId:g[7].id,campaignId:c7.id,timestamp:ago(8)},
  ]});
  const fp=await prisma.flagProposal.create({data:{onChainId:1301,proposer:A1,confirmer:A2,executed:true,proposedAt:ago(3),reason:'Creator misrepresented team affiliation. No prototype demonstrated. Contributors cannot reach creator.',campaignId:c7.id}});
  const f7=await prisma.forum.create({data:{campaignId:c7.id}});
  await prisma.message.create({data:{forumId:f7.id,userId:g[0].id,content:"Anyone seen a working prototype? Repo empty since launch, creator hasn't replied to DMs in a week.",createdAt:ago(5)}});
  await prisma.message.create({data:{forumId:f7.id,userId:g[3].id,content:"Same — website 404, Discord invite expired. Have serious doubts.",createdAt:ago(5)}});
  await prisma.adminAuditLog.createMany({data:[
    {adminWallet:A1,action:'APPROVE_CAMPAIGN',entityType:'campaign',entityId:c7.id,entityTitle:c7.title,metadata:{onChainId:17},   createdAt:ago(22)},
    {adminWallet:A1,action:'PROPOSE_FLAG',    entityType:'campaign',entityId:c7.id,entityTitle:c7.title,metadata:{reason:fp.reason,onChainId:1301},createdAt:ago(3)},
    {adminWallet:A2,action:'CONFIRM_FLAG',    entityType:'campaign',entityId:c7.id,entityTitle:c7.title,metadata:{onChainId:1301}, createdAt:ago(2)},
  ]});

  // ── 8. ACTIVE ~45% ───────────────────────────────────────────────────────
  const c8 = await prisma.campaign.create({ data: {
    title:'Accessible Maps Toolkit', category:'Accessibility', paymentToken:'USDC',
    description:'Open toolkit making interactive maps usable for screen readers, keyboard navigation, and high-contrast modes. Drop-in components bringing maps to WCAG 2.2 AA.',
    goalAmount:10.00, raisedAmount:4.50, status:CampaignStatus.ACTIVE, deadline:from(50),
    onChainId:18, isAdminApproved:true, license:'BSD-3-Clause',
    repositoryUrl:'https://github.com/defund-demo/accessible-maps', website:'https://a11ymaps.example.app',
    ipfsHash:'0x9a0c3f6e1b4d7a2e5c8f1b4a7d0e3f6c9b2e5a8d1f4c7b0e3a6d9f2c5b8e1a4', creatorId:cr[0].id,
    milestones:{create:[
      {title:'Keyboard Navigation',    description:'Full keyboard control for panning, zooming, markers.',amount:4.00,status:MilestoneStatus.ONGOING,    order:0,deadline:from(20),onChainId:228},
      {title:'Screen Reader Semantics',description:'ARIA descriptions, live regions, textual alternative.',amount:3.00,status:MilestoneStatus.NOT_STARTED,order:1,deadline:from(35),onChainId:229},
      {title:'High Contrast & Audit',  description:'High-contrast themes and WCAG 2.2 AA audit.',          amount:3.00,status:MilestoneStatus.NOT_STARTED,order:2,deadline:from(50),onChainId:230},
    ]},
  } });
  await prisma.contribution.createMany({data:[
    {amount:1.50,transactionHash:tx(),contributorId:g[3].id,campaignId:c8.id,timestamp:ago(8)},
    {amount:1.00,transactionHash:tx(),contributorId:g[6].id,campaignId:c8.id,timestamp:ago(6)},
    {amount:1.00,transactionHash:tx(),contributorId:g[7].id,campaignId:c8.id,timestamp:ago(4)},
    {amount:0.50,transactionHash:tx(),contributorId:g[2].id,campaignId:c8.id,timestamp:ago(2)},
    {amount:0.50,transactionHash:tx(),contributorId:g[1].id,campaignId:c8.id,timestamp:ago(1)},
  ]});
  const f8=await prisma.forum.create({data:{campaignId:c8.id}});
  await prisma.message.create({data:{forumId:f8.id,userId:g[6].id,content:"Daily VoiceOver user — this is genuinely needed. Mapbox and Leaflet are both nightmares with assistive tech.",createdAt:ago(6)}});
  await prisma.message.create({data:{forumId:f8.id,userId:cr[0].id,content:"Which reader + browser combo? Want ARIA live regions working in your environment.",createdAt:ago(5)}});
  await prisma.message.create({data:{forumId:f8.id,userId:g[6].id,content:"VoiceOver macOS Safari and NVDA Chrome Windows. Happy to test early builds.",createdAt:ago(5)}});
  await prisma.update.create({data:{campaignId:c8.id,title:'Keyboard nav prototype ready',content:'Tab order logical, arrow keys pan, +/- zoom, Enter activates marker, Escape returns focus to map.',createdAt:ago(3)}});
  await prisma.adminAuditLog.create({data:{adminWallet:A1,action:'APPROVE_CAMPAIGN',entityType:'campaign',entityId:c8.id,entityTitle:c8.title,metadata:{onChainId:18},createdAt:ago(12)}});

  // ── 9. FUNDED, M1 VOTING ─────────────────────────────────────────────────
  const c9 = await prisma.campaign.create({ data: {
    title:'Decentralised Git Protocol', category:'Infrastructure', paymentToken:'ETH',
    description:'Git on IPFS with on-chain commit signatures. PRs are transferable tokens, issues in a decentralised forum, works with existing git CLI via a custom remote helper.',
    goalAmount:0.04, raisedAmount:0.04, status:CampaignStatus.FUNDED, deadline:from(60),
    onChainId:19, isAdminApproved:true, license:'GPL-3.0',
    repositoryUrl:'https://github.com/defund-demo/decentralised-git',
    ipfsHash:'0x1d4e7a0b3f6c9e2a5d8b1e4f7a0d3c6b9e2a5f8c1b4d7e0a3f6c9b2e5a8d1f4', creatorId:cr[2].id,
    milestones:{create:[
      {title:'IPFS Remote Helper',      description:'Custom git remote — push/pull from IPFS, content-addressed packfiles.',amount:0.01,status:MilestoneStatus.VOTING,      order:0,deadline:from(15),onChainId:231,votingEndTime:from(4),proofUrl:'QmDecGitMS1Proof001',submissionCount:1},
      {title:'On-Chain Commit Signing', description:'EIP-712 signed commit graph.',                                          amount:0.01,status:MilestoneStatus.NOT_STARTED,order:1,deadline:from(30),onChainId:232},
      {title:'PR & Issue Layer',        description:'Token-based PRs and decentralised issue tracker.',                      amount:0.01,status:MilestoneStatus.NOT_STARTED,order:2,deadline:from(45),onChainId:233},
      {title:'CLI Polish & Docs',       description:'Shell completions, migration guide for existing repos.',                amount:0.01,status:MilestoneStatus.NOT_STARTED,order:3,deadline:from(60),onChainId:234},
    ]},
  }, include:{milestones:true} });
  const c9m1=c9.milestones.find(m=>m.order===0)!;
  await prisma.contribution.createMany({data:[
    {amount:0.01, transactionHash:tx(),contributorId:g[0].id,campaignId:c9.id,timestamp:ago(30)},
    {amount:0.01, transactionHash:tx(),contributorId:g[2].id,campaignId:c9.id,timestamp:ago(28)},
    {amount:0.005,transactionHash:tx(),contributorId:g[4].id,campaignId:c9.id,timestamp:ago(25)},
    {amount:0.005,transactionHash:tx(),contributorId:g[5].id,campaignId:c9.id,timestamp:ago(22)},
    {amount:0.01, transactionHash:tx(),contributorId:g[6].id,campaignId:c9.id,timestamp:ago(18)},
    {amount:0.01, transactionHash:tx(),contributorId:g[7].id,campaignId:c9.id,timestamp:ago(14)},
  ]});
  await prisma.vote.createMany({data:[
    {choice:true, weight:'10000000000000000',voterId:g[0].id,milestoneId:c9m1.id,timestamp:ago(2)},
    {choice:true, weight:'10000000000000000',voterId:g[2].id,milestoneId:c9m1.id,timestamp:ago(1)},
    {choice:false,weight:'5000000000000000', voterId:g[4].id,milestoneId:c9m1.id,timestamp:ago(1)},
    {choice:true, weight:'10000000000000000',voterId:g[6].id,milestoneId:c9m1.id,timestamp:ago(0)},
  ]});
  const f9=await prisma.forum.create({data:{campaignId:c9.id}});
  await prisma.message.create({data:{forumId:f9.id,userId:g[0].id,content:"`git push ipfs://QmHash` round-tripped cleanly. Voting yes.",createdAt:ago(2)}});
  await prisma.message.create({data:{forumId:f9.id,userId:g[4].id,content:"Need a bandwidth benchmark — 500 MB repo on IPFS could be very slow.",createdAt:ago(1)}});
  await prisma.message.create({data:{forumId:f9.id,userId:cr[2].id,content:"~40s for 500 MB on residential — comparable to GitHub. Content addressing deduplicates repeated objects at block level.",createdAt:ago(0)}});
  await prisma.adminAuditLog.createMany({data:[
    {adminWallet:A1,action:'APPROVE_CAMPAIGN',         entityType:'campaign', entityId:c9.id,   entityTitle:c9.title,   metadata:{onChainId:19},createdAt:ago(35)},
    {adminWallet:A1,action:'MILESTONE_VOTING_STARTED', entityType:'milestone',entityId:c9m1.id, entityTitle:c9m1.title, metadata:{campaignId:c9.id},createdAt:ago(3)},
  ]});

  // ── 10. FAILED ───────────────────────────────────────────────────────────
  const c10 = await prisma.campaign.create({ data: {
    title:'Lightweight Container Runtime', category:'Infrastructure', paymentToken:'ETH',
    description:"Minimal auditable container runtime for edge devices. Tiny TCB, fast cold starts, predictable resource use. Memory-safe language — a single engineer can read the entire codebase in a weekend.",
    goalAmount:0.04, raisedAmount:0.01, status:CampaignStatus.FAILED, deadline:ago(5),
    onChainId:20, isAdminApproved:true, license:'Apache-2.0',
    repositoryUrl:'https://github.com/defund-demo/tiny-runtime',
    ipfsHash:'0x3f6c9b2e5a8d1f4c7e0b3d6a9f2c5b8e1a4d7f0c3b6e9a2d5f8c1b4e7a0d3f6', creatorId:cr[4].id,
    milestones:{create:[
      {title:'Process Isolation Core',  description:'Namespaces, cgroups, minimal rootfs.',          amount:0.02,status:MilestoneStatus.NOT_STARTED,order:0,onChainId:235},
      {title:'Image Format & Pull',     description:'Content-addressed image layers.',                amount:0.01,status:MilestoneStatus.NOT_STARTED,order:1,onChainId:236},
      {title:'Spec & Conformance Tests',description:'Written spec + conformance test suite.',         amount:0.01,status:MilestoneStatus.NOT_STARTED,order:2,onChainId:237},
    ]},
  } });
  await prisma.contribution.createMany({data:[
    {amount:0.007,transactionHash:tx(),contributorId:g[7].id,campaignId:c10.id,timestamp:ago(30)},
    {amount:0.003,transactionHash:tx(),contributorId:g[5].id,campaignId:c10.id,timestamp:ago(25)},
  ]});
  const f10=await prisma.forum.create({data:{campaignId:c10.id}});
  await prisma.message.create({data:{forumId:f10.id,userId:g[7].id,content:"Shame it didn't reach the goal. Rust approach was compelling. Hope creator resubmits with a revised target.",createdAt:ago(4)}});
  await prisma.adminAuditLog.create({data:{adminWallet:A1,action:'APPROVE_CAMPAIGN',entityType:'campaign',entityId:c10.id,entityTitle:c10.title,metadata:{onChainId:20},createdAt:ago(35)}});

  const [cc,mc,tc,vc,lc]=await Promise.all([prisma.campaign.count(),prisma.milestone.count(),prisma.contribution.count(),prisma.vote.count(),prisma.adminAuditLog.count()]);
  console.log(`done — ${cc} campaigns  ${mc} milestones  ${tc} contributions  ${vc} votes  ${lc} audit logs`);
}

main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect().then(()=>pool.end()));
