const CONTRACT_ERROR_MAP: Record<string, string> = {
  // Voting
  'Voting period not ended': 'Voting is still in progress — wait until the voting period ends.',
  'Voting period ended': 'The voting period for this milestone has already ended.',
  'Already voted': 'You have already voted on this milestone.',
  'Not a contributor': 'Only contributors to this campaign can vote on milestones.',
  'No voting power': 'You must contribute to the campaign before you can vote.',

  // Milestone submission
  'Not campaign creator': 'Only the campaign creator can submit milestone proofs.',
  'Milestone not pending': 'This milestone is not in a state that accepts proof submissions.',
  'Max submissions reached': 'This milestone has reached the maximum number of resubmissions (3).',
  'Milestone not approved': 'This milestone has not been approved by voters yet.',
  'Funds already released': 'The funds for this milestone have already been released.',

  // Campaign state
  'Campaign not active': 'This campaign is not active. It may have been cancelled or completed.',
  'Campaign goal already reached': 'This campaign has already reached its funding goal.',
  'Campaign deadline passed': 'The contribution deadline for this campaign has passed.',
  'Campaign already cancelled': 'This campaign has already been cancelled.',
  'Campaign not on-chain': 'This campaign has not been confirmed on-chain yet.',

  // Refund
  'No contribution found': 'No contribution was found for your wallet address on this campaign.',
  'Refund not available': 'Refunds are not yet available for this campaign.',
  'Already refunded': 'You have already claimed your refund for this campaign.',
  'Funds not reclaimed': 'The campaign funds have not been reclaimed yet — refunds are not available.',

  // Two-admin multisig
  'Cannot confirm own proposal': 'A different admin must confirm this action — you cannot confirm your own proposal.',
  'Proposal already executed': 'This proposal has already been executed.',
  'No pending proposal': 'No pending proposal was found for this action.',
  'Not an admin': 'You must be an admin to perform this action.',

  // Access control (string reverts + OZ v5 decoded custom errors)
  'Pausable: paused': 'The contract is currently paused. Please try again later.',
  'AccessControl': 'You do not have permission to perform this action.',
  'AccessControlUnauthorizedAccount': 'You do not have the required on-chain role. Ask the contract owner to run grant-admin for your wallet.',

  // Expire campaign
  'Campaign not funded': 'This campaign is not in the Funded state (must be Funded to expire).',
  'Campaign deadline not reached': 'The campaign deadline has not passed yet.',
  'All milestones have been submitted': 'All milestones have been submitted — this campaign cannot be expired.',

  // Generic wallet / gas
  'user rejected': 'Transaction was rejected in your wallet.',
  'User rejected': 'Transaction was rejected in your wallet.',
  'denied transaction': 'Transaction was rejected in your wallet.',
  'nonce too high': "Transaction nonce mismatch — please reset your wallet's nonce in MetaMask (Settings → Advanced).",
  'nonce too low': "Transaction nonce mismatch — please reset your wallet's nonce in MetaMask (Settings → Advanced).",
  'insufficient funds': 'Insufficient funds in your wallet to cover this transaction and gas fees.',
  'gas required exceeds': 'This transaction would exceed the gas limit. Please try again.',
  'gas limit too high': 'Gas estimation failed — the transaction may revert. Check inputs and try again.',
  'exceeds block gas limit': 'This transaction exceeds the block gas limit.',
  'intrinsic gas too low': 'Gas estimate was too low — please try again.',
};

/** Collect every string field from the error and its full cause chain. */
function collectMessages(err: unknown, depth = 0): string[] {
  if (!err || depth > 6) return [];
  const obj = err as Record<string, any>;
  const parts: string[] = [];
  for (const key of ['shortMessage', 'message', 'reason', 'details', 'data']) {
    if (typeof obj[key] === 'string' && obj[key]) parts.push(obj[key]);
  }
  if (obj.cause) parts.push(...collectMessages(obj.cause, depth + 1));
  return parts;
}

/**
 * Extracts a human-readable error message from a viem/wagmi error.
 * Walks the full cause chain so nested revert reasons are always found.
 */
export function parseContractError(err: unknown): string {
  if (!err) return 'An unknown error occurred.';

  if (import.meta.env.DEV) console.error('[contract error]', err);

  const messages = collectMessages(err);
  const combined = messages.join('\n');

  // 1. Check the error map against the combined text
  for (const [key, friendly] of Object.entries(CONTRACT_ERROR_MAP)) {
    if (combined.includes(key)) return friendly;
  }

  // 2. Extract the revert reason from common viem/RPC formats:
  //    "reverted with the following reason:\n<reason>"
  //    "execution reverted: <reason>"
  //    "reverted: <reason>"
  const revertPatterns = [
    /reverted with the following reason:\s*\n?(.+)/i,
    /execution reverted:?\s*"?([^"\n]+)"?/i,
    /reverted:\s*"?([^"\n]+)"?/i,
    /Error: ([^\n]+)/,
  ];

  for (const pattern of revertPatterns) {
    const match = combined.match(pattern);
    if (match) {
      const reason = match[1].trim();
      // Check map with extracted reason
      for (const [key, friendly] of Object.entries(CONTRACT_ERROR_MAP)) {
        if (reason.includes(key)) return friendly;
      }
      // Show raw reason if it looks like a business rule (short, no stack trace)
      if (reason.length < 120 && !reason.includes(' at ') && !reason.includes('(0x')) {
        return `Transaction failed: ${reason}`;
      }
    }
  }

  // Last-resort: check for known error selectors that couldn't be decoded from ABI
  if (combined.includes('0xe2517d3f')) {
    return 'You do not have the required on-chain role. Ask the contract owner to run grant-admin for your wallet.';
  }

  return 'Transaction failed — please check your wallet and try again.';
}
