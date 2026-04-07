export const CAMPAIGN_FACTORY_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`) || '0x0000000000000000000000000000000000000000'

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
