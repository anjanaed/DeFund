# DeFund

A decentralized, milestone-based crowdfunding platform built on Ethereum. Contributors fund campaigns in ETH or USDC; funds are held in a smart contract and released to creators only when each milestone is completed and approved by contributors through on-chain voting.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Smart Contract](#smart-contract)
- [Database Schema](#database-schema)
- [Running Tests](#running-tests)
- [Key Design Constraints](#key-design-constraints)

---

## How It Works

### Campaign Lifecycle

Campaigns move through the following states:

```
ACTIVE --> FUNDED --> COMPLETED
  |           |
  |           +--> CANCELLED  (deadline passed + goal unmet, or creator abandoned)
  |
  +--> CANCELLED  (cancelled by creator or admin before goal is reached)
  +--> FLAGGED    (flagged by dual-admin approval for suspected fraud)
```

1. **Creation.** An admin calls `createCampaign` on the smart contract, specifying the creator wallet address, IPFS metadata hash, payment token (ETH or USDC), funding goal, deadline, and an array of milestones. Milestone amounts must sum exactly to the fund goal. The campaign is set to Active immediately.

2. **Funding.** Contributors call `contributeETH` (payable) or `contributeUSDC` directly on the contract. A minimum of 0.001 ETH or 1 USDC is enforced to prevent low-cost vote-weight inflation. When cumulative contributions reach the fund goal, the campaign transitions automatically to Funded.

3. **Milestone execution.** Milestones are sequential. The creator may only submit a milestone for voting once the previous one is in Completed status. The creator calls `submitMilestoneForVoting` with an IPFS hash containing their proof of completion.

4. **Voting.** A 7-day voting period opens. Any contributor may cast one vote per submission round, weighted by their total contribution to the campaign. Votes are tracked using an epoch-based approach: each new submission increments `submissionCount`, which invalidates all prior-round votes without iterating over a voter list.

5. **Finalization.** After 7 days, anyone may call `finalizeMilestoneVoting`. A milestone is approved when at least 30% of the total raised amount at voting-start has voted (quorum), and `votesFor > votesAgainst`. If quorum is not met or the vote fails, the milestone is Rejected and the creator may resubmit up to a total of 3 attempts.

6. **Fund release.** Two different admins must both sign off on releasing funds for an approved milestone. The first calls `proposeReleaseFunds`, the second calls `confirmReleaseFunds`. Funds transfer directly to the creator wallet in the same transaction.

7. **Completion.** When all milestones reach a terminal state (Completed, Approved, or exhausted-rejection), the campaign automatically transitions to Completed.

### Refunds

Refunds may be triggered through three paths:

- **Automatic expiry.** If a campaign is Funded and its deadline passes with work unfinished, anyone can call `expireCampaign` to transition it to Cancelled and set `fundsReclaimed = true`, unlocking refunds immediately without admin involvement.

- **Third-rejection auto-cancel.** A milestone that fails voting three consecutive times automatically cancels the campaign and sets `fundsReclaimed = true`.

- **Admin-initiated.** Two different admins can jointly approve a refund via `proposeRefund` and `approveRefund` for Flagged, Cancelled, or deadline-expired Active campaigns.

Once `fundsReclaimed` is true, each contributor calls `claimRefund` themselves. The refund amount is calculated as:

```
refundAmount = contributorAmount * availableForRefund * 95 / (raisedAmount * 100)
```

The 95% factor is the protocol fee retention (5% kept). `availableForRefund` equals `raisedAmount - withdrawnAmount`, ensuring pro-rata distribution when some milestone funds have already been released to the creator.

### Dual-Admin Governance

All consequential admin actions require two separate admin wallets to agree. Neither admin can confirm their own proposal. This applies to:

- Flagging a campaign for suspected fraud or misuse
- Releasing funds for an approved milestone
- Approving a contributor refund on flagged or cancelled campaigns

### Authentication

Authentication uses Sign-In with Ethereum (SIWE):

1. The client requests a one-time nonce from `POST /api/auth/nonce` with the wallet address.
2. The user signs the nonce string using their wallet.
3. The client submits the address and signature to `POST /api/auth/verify`.
4. The server recovers the signer address from the signature using `ethers.verifyMessage`, confirms it matches, and issues a JWT stored in an HttpOnly cookie.
5. Subsequent requests carry the cookie; the server validates the JWT and attaches the user to the request context.

Users are created automatically on first sign-in with the `USER` role. Admins and creators must be promoted by an existing admin.

### Blockchain Indexer

The backend runs an indexer that polls for on-chain events every 12 seconds and persists state to PostgreSQL. It maintains a single `IndexerState` record tracking the last processed block number, ensuring no events are missed across restarts.

Events processed by the indexer:

- `CampaignCreated`, `CampaignApproved`, `CampaignStatusChanged`, `CampaignCancelled`, `CampaignCompleted`
- `ContributionMade`
- `MilestoneSubmittedForVoting`, `VoteCast`, `MilestoneVotingFinalized`, `MilestoneFundsReleased`
- `RefundProposed`, `RefundApproved`, `RefundClaimed`
- `FlagProposed`, `FlagConfirmed`
- `ReleaseFundsProposed`, `ReleaseFundsConfirmed`

Three keeper jobs also run every 5 minutes to handle time-based transitions that produce no new events:

| Keeper | Action |
|--------|--------|
| `finalizeExpiredVoting` | Calls `finalizeMilestoneVoting` for milestones in Voting status whose `votingEndTime` has passed |
| `checkExpiredDeadlines` | Calls `checkCampaignDeadline` for Active campaigns past their deadline |
| `checkAbandonedFundedCampaigns` | Calls `expireCampaign` for Funded campaigns whose deadline has passed |

---

## Architecture

```
DeFund/
├── apps/
│   ├── client/          # React 19 + Vite frontend  (port 5173)
│   ├── server/          # NestJS API backend         (port 3000)
│   └── blockchain/      # Hardhat — Solidity contracts + scripts
└── package.json         # npm workspaces root
```

### Frontend (`apps/client/`)

- React 19 with React Router 7 for client-side routing
- Wagmi + Viem for contract reads and writes; Web3Modal for wallet connection UI
- TanStack React Query for server-state caching and mutation
- The full contract ABI and address configuration lives in `src/config/contracts.ts`
- The Wagmi config (Sepolia chain, connectors) lives in `src/config/wagmi.ts`
- Auth state is managed by `AuthContext`, which reads the JWT from the cookie and exposes the current user throughout the app

### Backend (`apps/server/`)

Standard NestJS module structure. Core modules:

| Module | Responsibility |
|--------|----------------|
| `auth` | SIWE nonce generation, signature verification, JWT issuance |
| `campaigns` | Campaign CRUD, creation submission, status queries |
| `milestones` | Milestone queries, proof submission relay |
| `admin` | Admin-only actions: campaign approval, flagging, fund release |
| `blockchain` | `ethers.js` provider wrapper, signature verification helper |
| `indexer` | On-chain event polling and database sync |
| `notifications` | In-app notification creation and delivery |
| `forum` | Per-campaign threaded discussion with reactions |
| `health` | `GET /api/health` liveness probe |

Prisma ORM targets PostgreSQL via Supabase. The generated client is output to `src/generated/prisma/`.

### Smart Contracts (`apps/blockchain/`)

A single `CampaignFactory.sol` contract manages all campaigns and milestones. Key properties:

- Inherits OpenZeppelin `AccessControl`, `ReentrancyGuard`, and `Pausable`
- All campaigns and milestones are stored in mappings keyed by incrementing `uint256` IDs
- The USDC token address is set at deploy time as an `immutable`
- The contract can be paused by any admin in an emergency, disabling contributions and campaign creation

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router 7, Wagmi, Viem, TanStack Query |
| Backend | NestJS, Prisma 7, JWT via HttpOnly cookies |
| Database | PostgreSQL via Supabase |
| Smart Contracts | Solidity 0.8.28, Hardhat, OpenZeppelin 5 |
| Network | Ethereum Sepolia testnet |
| Wallet support | Web3Modal, MetaMask, any EIP-1193 wallet |
| Package management | npm workspaces (monorepo) |

---

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- A PostgreSQL database (Supabase free tier works)
- A Sepolia JSON-RPC URL (Alchemy or Infura free tier)
- A Sepolia wallet with enough testnet ETH to cover deployment gas

---

## Getting Started

### 1. Install dependencies

Run once from the repository root. npm workspaces installs dependencies for all three packages.

```bash
npm install
```

### 2. Configure environment variables

```bash
cp apps/blockchain/.env.example apps/blockchain/.env
# Edit apps/blockchain/.env

cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env

# Create apps/client/.env manually — see Environment Variables below
```

### 3. Set up the database

```bash
cd apps/server
npx prisma migrate dev
npx prisma generate
```

### 4. Deploy the smart contract

```bash
cd apps/blockchain
npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
```

Copy the printed contract address into:
- `apps/blockchain/.env` as `CAMPAIGN_FACTORY_ADDRESS`
- `apps/server/.env` as `CAMPAIGN_FACTORY_ADDRESS`
- `apps/client/.env` as `VITE_CONTRACT_ADDRESS`

Also update `START_BLOCK` in `apps/server/.env` to the block number printed during deployment. This prevents the indexer from scanning from genesis on first run.

### 5. Start the development servers

Open three terminal sessions:

```bash
# Backend
cd apps/server && npm run start:dev

# Frontend
cd apps/client && npm run dev

# (Optional) Local Hardhat node for offline development
cd apps/blockchain && npx hardhat node
```

The frontend is available at `http://localhost:5173`. The API is at `http://localhost:3000/api`.

---

## Environment Variables

### `apps/blockchain/.env`

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Deployer wallet private key, without the `0x` prefix |
| `SEPOLIA_RPC_URL` | Sepolia JSON-RPC endpoint |
| `USDC_ADDRESS` | USDC token address on Sepolia |
| `CAMPAIGN_FACTORY_ADDRESS` | Populated after running the deploy script |
| `ETHERSCAN_API_KEY` | Optional — required only for `hardhat verify` |

### `apps/server/.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled PostgreSQL connection string (used at runtime) |
| `DIRECT_URL` | Direct PostgreSQL connection string (used by Prisma migrations) |
| `JWT_SECRET` | Secret used to sign and verify JWT tokens |
| `SEPOLIA_RPC_URL` | Sepolia JSON-RPC endpoint used by the indexer |
| `CAMPAIGN_FACTORY_ADDRESS` | Deployed contract address |
| `USDC_ADDRESS` | USDC token address on Sepolia |
| `OPERATOR_PRIVATE_KEY` | Admin wallet private key for keeper transactions |
| `START_BLOCK` | Sepolia block at which the contract was deployed |
| `IPFS_GATEWAY` | IPFS HTTP gateway base URL, e.g. `https://ipfs.io/ipfs/` |
| `FRONTEND_URL` | Frontend origin used for CORS, e.g. `http://localhost:5173` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID (optional — social verification) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_REDIRECT_URI` | GitHub OAuth callback URL |
| `TWITTER_CLIENT_ID` | Twitter OAuth 2.0 client ID (optional) |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth 2.0 client secret |
| `TWITTER_REDIRECT_URI` | Twitter OAuth callback URL |
| `DISCORD_CLIENT_ID` | Discord OAuth2 client ID (optional) |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 client secret |
| `DISCORD_REDIRECT_URI` | Discord OAuth callback URL |

### `apps/client/.env`

| Variable | Description |
|----------|-------------|
| `VITE_CONTRACT_ADDRESS` | Deployed `CampaignFactory` contract address |
| `VITE_USDC_ADDRESS` | USDC token address on Sepolia |
| `VITE_API_URL` | Backend API base URL, e.g. `http://localhost:3000/api` |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |

---

## Smart Contract

**Network:** Ethereum Sepolia testnet

**CampaignFactory:** `0x6DBc11007EF0CB56BAE89347b5Bf99597BE7a945`

**Deployed at block:** 10968726

**USDC (Sepolia):** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

### Contract Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `VOTING_PERIOD` | 7 days | Duration of each milestone vote |
| `MIN_QUORUM_PERCENTAGE` | 30% | Minimum fraction of `raisedAmountAtVotingStart` that must participate for a result to be valid |
| `REFUND_PERCENTAGE` | 95% | Fraction of contribution returned on refund; 5% is retained as protocol fee |
| `minContributionETH` | 0.001 ETH | Minimum ETH contribution per transaction (admin-adjustable) |
| `minContributionUSDC` | 1 USDC | Minimum USDC contribution per transaction (admin-adjustable) |

### Hardhat Commands

```bash
# Compile contracts and generate TypeChain bindings
npx hardhat compile

# Run all contract tests
npx hardhat test

# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Grant admin role to a second wallet
npx hardhat run scripts/grant-admin.ts --network sepolia
```

---

## Database Schema

Core entities and their relationships:

```
User
  walletAddress  (unique identifier)
  role           USER | ADMIN | CREATOR
  |
  +-- Campaign
  |     status      PENDING | ACTIVE | FUNDED | COMPLETED | FAILED | FLAGGED
  |     onChainId   maps to the contract's campaignId
  |     |
  |     +-- Milestone
  |     |     status          PENDING | VOTING | APPROVED | REJECTED | COMPLETED
  |     |     onChainId       maps to the contract's milestoneId
  |     |     submissionCount max 3; third rejection auto-cancels the campaign
  |     |     |
  |     |     +-- Vote              (voter + choice + weight)
  |     |     +-- ReleaseFundsProposal
  |     |
  |     +-- Contribution     (contributor + amount + transaction hash)
  |     +-- Update           (creator-posted progress updates)
  |     +-- Forum
  |     |     +-- Message    (threaded, with Reaction support)
  |     +-- RefundProposal
  |     +-- FlagProposal
  |
  +-- Notification

IndexerState             (singleton row — tracks last processed block)
AdminAuditLog            (records all admin actions for accountability)
```

---

## Running Tests

### Backend unit tests

```bash
cd apps/server
npm run test          # all unit tests
npm run test:watch    # watch mode
npm run test:cov      # with coverage report
npm run test:e2e      # end-to-end tests
```

### Smart contract tests

```bash
cd apps/blockchain
npx hardhat test
```

---

## Key Design Constraints

**Milestone amounts must sum to the fund goal.** The contract enforces `sum(milestones[i].amountRequired) == fundGoal` at creation time. Every wei contributed maps to a specific deliverable; there are no unallocated funds.

**Milestones are sequential.** A creator cannot submit milestone N for voting until milestone N-1 has been Completed (funds released). This prevents a creator from submitting multiple easy milestones simultaneously to collect early payments while deferring harder work.

**Voting weight equals contribution amount.** There are no governance tokens. Voting influence is proportional to financial stake. A contributor with a large position cannot be outvoted by many small contributors if the weighted totals disagree.

**Quorum uses a snapshot, not the live raised amount.** When a milestone enters voting, `raisedAmountAtVotingStart` is recorded. Contributions made during the voting window do not retroactively raise the quorum threshold, preventing an attacker from invalidating already-cast votes by contributing just before finalization.

**Epoch-based vote deduplication.** Rather than storing a `hasVoted` boolean per address and clearing it on each new submission round (O(n) gas), the contract stores the round number each voter last voted in. Incrementing `submissionCount` at the start of a new round is an O(1) invalidation of all prior votes.

**Dual-admin fund release prevents unilateral control.** No single admin wallet can move funds to a creator. The confirming admin must be a different address from the proposer. The same principle applies to campaign flagging and refund approvals.

**Refunds are pro-rated against available funds.** If some milestone funds have already been released before a refund is approved, contributors receive a proportional share of the remaining pool. This prevents a race condition where the first claimants drain the contract while later claimants receive nothing.

**The backend treats PostgreSQL as a cache, not a source of truth.** All authoritative state (contribution amounts, vote weights, campaign status, refund eligibility) is derived from indexed on-chain events. The database exists to serve fast queries to the UI; it does not drive any business logic.
