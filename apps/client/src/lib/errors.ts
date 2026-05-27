/**
 * H6 — Maps known Solidity revert strings and wallet errors to human-readable messages.
 *
 * Usage:
 *   import { parseContractError } from '@/lib/errors'
 *   // ...
 *   } catch (err) {
 *     toast.error(parseContractError(err))
 *   }
 */

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
  'Campaign not funded': 'This campaign has not reached its funding goal yet.',
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

  // Access control
  'Pausable: paused': 'The contract is currently paused. Please try again later.',
  'AccessControl': 'You do not have permission to perform this action.',

  // Expire campaign
  'Campaign not funded': 'This campaign is not in the Funded state.',
  'Campaign deadline not reached': 'The campaign deadline has not passed yet.',
  'All milestones have been submitted': 'All milestones have been submitted — this campaign cannot be expired.',

  // Generic wallet
  'user rejected': 'Transaction was rejected in your wallet.',
  'User rejected': 'Transaction was rejected in your wallet.',
  'nonce too high': 'Transaction nonce mismatch — please reset your wallet\'s nonce in MetaMask (Settings → Advanced).',
  'nonce too low': 'Transaction nonce mismatch — please reset your wallet\'s nonce in MetaMask (Settings → Advanced).',
  'insufficient funds': 'Insufficient funds in your wallet to cover this transaction and gas fees.',
  'gas required exceeds': 'This transaction would exceed the gas limit. Please try again.',
};

/**
 * Extracts a human-readable error message from a viem/ethers/wagmi error.
 * Falls back to a generic "Transaction failed" message for unmapped errors.
 */
export function parseContractError(err: unknown): string {
  if (!err) return 'An unknown error occurred.';

  // viem/wagmi error shapes
  const errObj = err as Record<string, any>;

  // Check shortMessage first (viem), then message
  const rawMessage: string =
    errObj.shortMessage ||
    errObj.message ||
    errObj.reason ||
    String(err);

  // Walk the error map
  for (const [key, friendly] of Object.entries(CONTRACT_ERROR_MAP)) {
    if (rawMessage.includes(key)) return friendly;
  }

  // Try to extract the revert reason from "execution reverted: <reason>"
  const revertMatch = rawMessage.match(/execution reverted:?\s*"?([^"]+)"?/i);
  if (revertMatch) {
    const reason = revertMatch[1].trim();
    // Check map again with extracted reason
    for (const [key, friendly] of Object.entries(CONTRACT_ERROR_MAP)) {
      if (reason.includes(key)) return friendly;
    }
    // Show the raw reason if it looks like a business-rule message (short, no stack)
    if (reason.length < 120 && !reason.includes('at ')) return `Transaction failed: ${reason}`;
  }

  return 'Transaction failed — please check your wallet and try again.';
}
