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
  // createCampaign(creator, ipfsHash, paymentToken, fundGoal, deadline, milestones[])
  // [H2] _creator is the actual project creator's wallet (receives milestone payouts
  //      and can submit milestone proofs). Separated from msg.sender (admin).
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

  // proposeReleaseFunds(milestoneId) — admin only, first step of two-admin fund release
  {
    name: 'proposeReleaseFunds',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
  },

  // confirmReleaseFunds(milestoneId) — admin only, second step (different admin)
  {
    name: 'confirmReleaseFunds',
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

  // proposeFlagCampaign(campaignId, reason) — admin only, first step of two-admin flag
  {
    name: 'proposeFlagCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_campaignId', type: 'uint256' },
      { name: '_reason', type: 'string' },
    ],
    outputs: [],
  },

  // confirmFlagCampaign(campaignId) — admin only, second step (different admin)
  {
    name: 'confirmFlagCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
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

  // expireCampaign(campaignId) — permissionless; cancels any Funded campaign whose
  // deadline has passed (H3: no longer requires unsubmitted milestone)
  {
    name: 'expireCampaign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_campaignId', type: 'uint256' }],
    outputs: [],
  },

  // withdrawFees(recipient, token, amount) — admin only; extracts accumulated protocol fees
  {
    name: 'withdrawFees',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_recipient', type: 'address' },
      { name: '_token', type: 'uint8' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },

  // setMinContribution(minETH, minUSDC) — admin only
  {
    name: 'setMinContribution',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_minETH', type: 'uint256' },
      { name: '_minUSDC', type: 'uint256' },
    ],
    outputs: [],
  },

  // minContributionETH() — public getter
  {
    name: 'minContributionETH',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // minContributionUSDC() — public getter
  {
    name: 'minContributionUSDC',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // hasClaimedRefund(campaignId, contributor) — check if refund already claimed
  {
    name: 'hasClaimedRefund',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
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

  // OpenZeppelin AccessControl custom errors — required for viem to decode them
  {
    name: 'AccessControlUnauthorizedAccount',
    type: 'error',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'neededRole', type: 'bytes32' },
    ],
  },
  {
    name: 'AccessControlBadConfirmation',
    type: 'error',
    inputs: [],
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
