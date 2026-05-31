
export const landingStats = [
  { label: 'Total Raised', value: '$24M+' },
  { label: 'Projects', value: '1200+' },
  { label: 'Contributors', value: '45K+' },
  { label: 'Success Rate', value: '98%' }
];

export const landingFeatures = [
    {
      title: 'Smart Contract Security',
      description: 'Funds locked in transparent smart contracts, released only when milestones are met.'
    },
    {
      title: 'Community Voting',
      description: 'Contributors vote to approve milestones, ensuring every project remains accountable.'
    },
    {
      title: 'Verified Projects',
      description: 'Admins verify creators with transparent identities and verified public repositories.'
    },
    {
      title: 'Milestone Tracking',
      description: 'Real-time progress tracking with verifiable proof of project execution.'
    },
    {
      title: 'Fraud Protection',
      description: 'Unspent contributions returned if milestones fail or projects abandon.'
    },
    {
      title: 'Instant Reclaim',
      description: 'Withdraw contributions anytime if milestones are rejected by community.'
    }
];

export const landingSteps = [
    {
      id: '01',
      title: 'Project Verification',
      description: 'Creators submit projects with defined milestones. Admins verify authenticity through wallet signing and repository validation.'
    },
    {
      id: '02',
      title: 'Contribution Phase',
      description: 'Contributors fund projects on-chain. Funds are locked in smart contracts until milestones are approved.'
    },
    {
      id: '03',
      title: 'Community Voting',
      description: 'Project creators submit evidence of milestone completion. Contributors vote to approve fund release.'
    },
    {
      id: '04',
      title: 'Fund Release',
      description: 'Once approved by community voting, funds automatically release to project creators via smart contracts.'
    }
];

export const homeStats = [
  { value: '$247K+', label: 'Total Funds Raised' },
  { value: '6', label: 'Active Projects' },
  { value: '488+', label: 'Community Contributors' }
];

export const trendingProjects = [
  {
    id: 1,
    category: 'DeFi',
    verified: true,
    title: 'DeFi Lending Protocol',
    description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with',
    raised: 75000,
    goal: 100000,
    contributors: 156,
    milestones: 3
  },
  {
    id: 2,
    category: 'Gaming',
    verified: true,
    title: 'Blockchain Gaming Engine',
    description: 'Open-source game engine optimized for blockchain gaming with built-in NFT and token',
    raised: 45000,
    goal: 120000,
    contributors: 103,
    milestones: 1
  },
  {
    id: 3,
    category: 'NFT',
    verified: true,
    title: 'NFT Marketplace Platform',
    description: 'A next-generation NFT marketplace with advanced features for creators and',
    raised: 35000,
    goal: 80000,
    contributors: 67,
    milestones: 3
  }
];

export const exploreCategories = ['All', 'DeFi', 'DAO', 'NFT', 'Open Source', 'Infrastructure', 'Gaming'];

export const exploreTabs = [
  { id: 'all', label: 'All Projects', count: 6 },
  { id: 'trending', label: 'Trending', count: null },
  { id: 'new', label: 'New', count: null }
];

export const projects = [
  {
    id: 1,
    category: 'Infrastructure',
    verified: true,
    active: true,
    title: 'Decentralized Storage Network',
    description: 'Building a secure and efficient decentralized storage solution for Web3',
    raised: 12000,
    goal: 150000,
    contributors: 28,
    milestones: 1
  },
  {
    id: 2,
    category: 'Gaming',
    verified: true,
    active: true,
    title: 'Blockchain Gaming Engine',
    description: 'Open-source game engine optimized for blockchain gaming with built-in NFT and token',
    raised: 45000,
    goal: 120000,
    contributors: 103,
    milestones: 1
  },
  {
    id: 3,
    category: 'NFT',
    verified: true,
    active: true,
    title: 'NFT Marketplace Platform',
    description: 'A next-generation NFT marketplace with advanced features for creators and',
    raised: 35000,
    goal: 80000,
    contributors: 67,
    milestones: 3
  },
  {
    id: 4,
    category: 'Open Source',
    verified: true,
    active: true,
    title: 'Open Source Analytics Tools',
    description: 'Privacy-focused analytics platform for Web3 applications.',
    raised: 28000,
    goal: 30000,
    contributors: 45,
    milestones: 2
  },
  {
    id: 5,
    category: 'DeFi',
    verified: true,
    active: true,
    title: 'DeFi Lending Protocol',
    description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with',
    raised: 75000,
    goal: 100000,
    contributors: 156,
    milestones: 3
  },
  {
    id: 6,
    category: 'DAO',
    verified: true,
    active: false,
    title: 'Community DAO Governance',
    description: 'Building a transparent and efficient DAO governance system for community-driven',
    raised: 52000,
    goal: 50000,
    contributors: 89,
    milestones: 2
  }
];
