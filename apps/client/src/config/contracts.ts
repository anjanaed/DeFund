if (!import.meta.env.VITE_CONTRACT_ADDRESS) throw new Error('VITE_CONTRACT_ADDRESS is required')
if (!import.meta.env.VITE_USDC_ADDRESS) throw new Error('VITE_USDC_ADDRESS is required')

export const CAMPAIGN_FACTORY_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`
export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`

export const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Minimal ABI — only the functions the frontend needs to call directly
export const CAMPAIGN_FACTORY_ABI = [
  // createCampaign(ipfsHash, paymentToken, fundGoal, deadline, milestones[])
  {
    name: 'createCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_ipfsHash', type: 'string' },
      { name: '_paymentToken', type: 'uint8' },
      { name: '_fundGoal', type: 'uint256' },
      { name: '_deadline', type: 'uint256' },
      {
        name: '_milestones',
        type: 'tuple[]',
        components: [
          { name: 'ipfsHash', type: 'string' },
          { name: 'amountRequired', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // cancelCampaign(campaignId) — creator or admin
  {
    name: 'cancelCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
    outputs: [],
  },

  // voteOnMilestone(milestoneId, approve)
  {
    name: 'voteOnMilestone',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_milestoneId', type: 'uint256' },
      { name: '_approve', type: 'bool' },
    ],
    outputs: [],
  },

  // releaseMilestoneFunds(milestoneId)  — creator only
  {
    name: 'releaseMilestoneFunds',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
  },

  // submitMilestoneForVoting(milestoneId, proofIpfsHash)  — creator only
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

  // contributeETH(campaignId) — payable
  {
    name: 'contributeETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
    outputs: [],
  },

  // contributeUSDC(campaignId, amount)
  {
    name: 'contributeUSDC',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_campaignId', type: 'uint256' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },

  // claimRefund(campaignId)
  {
    name: 'claimRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
    outputs: [],
  },

  // finalizeMilestoneVoting(milestoneId) — callable by anyone after voting period ends
  {
    name: 'finalizeMilestoneVoting',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
  },

  // flagCampaign(campaignId, reason) — admin only
  {
    name: 'flagCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_campaignId', type: 'uint256' },
      { name: '_reason', type: 'string' },
    ],
    outputs: [],
  },

  // proposeRefund(campaignId) — admin only, first step of two-admin refund
  {
    name: 'proposeRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
    outputs: [],
  },

  // approveRefund(campaignId) — admin only, second step (different admin)
  {
    name: 'approveRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
    outputs: [],
  },

  // milestones(uint256) — public getter for the milestones mapping (used by MilestoneVotingStatus)
  {
    name: 'milestones',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'milestoneId', type: 'uint256' },
      { name: 'campaignId', type: 'uint256' },
      { name: 'ipfsHash', type: 'string' },
      { name: 'amountRequired', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'votesFor', type: 'uint256' },
      { name: 'votesAgainst', type: 'uint256' },
      { name: 'votingEndTime', type: 'uint256' },
      { name: 'fundsReleased', type: 'bool' },
      { name: 'raisedAmountAtVotingStart', type: 'uint256' },
      { name: 'submissionCount', type: 'uint8' },
    ],
  },

  // hasVoted(milestoneId, voter) — public getter used by MilestoneVotingStatus
  {
    name: 'hasVoted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },

  // CampaignCreated event — used to extract on-chain campaign ID from receipt
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
