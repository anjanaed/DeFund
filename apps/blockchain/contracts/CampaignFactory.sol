// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CampaignFactory
 * @dev Milestone-based crowdfunding platform for Web3 projects
 * @notice Factory contract managing all campaigns with contribution-weighted voting
 */
contract CampaignFactory is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    enum CampaignStatus {
        Pending, // Legacy — never assigned; createCampaign always sets Active directly
        Active, // Approved and accepting contributions
        Funded, // Goal reached
        Completed, // All milestones completed
        Cancelled, // Cancelled by creator or admin
        Flagged // Flagged by admin for issues
    }

    enum MilestoneStatus {
        Pending, // Not yet submitted for voting
        Voting, // Open for contributor voting
        Approved, // Voting passed, funds can be released
        Rejected, // Voting failed
        Completed // Funds released
    }

    enum PaymentToken {
        ETH,
        USDC
    }

    struct Campaign {
        uint256 campaignId;
        address creator;
        string ipfsHash; // Stores: title, description, images on IPFS
        CampaignStatus status;
        PaymentToken paymentToken; // ETH or USDC
        uint256 fundGoal;
        uint256 raisedAmount;
        uint256 withdrawnAmount;
        uint256 deadline; // Unix timestamp
        uint256 createdAt;
        uint256[] milestoneIds;
        bool fundsReclaimed;
    }

    struct Milestone {
        uint256 milestoneId;
        uint256 campaignId;
        string ipfsHash; // Description and proof on IPFS
        uint256 amountRequired;
        uint256 deadline; // Milestone completion deadline
        MilestoneStatus status;
        uint256 votesFor; // Total contribution amount voting for
        uint256 votesAgainst; // Total contribution amount voting against
        uint256 votingEndTime;
        bool fundsReleased;
        // Snapshot of campaign.raisedAmount at the moment voting starts.
        // Using a snapshot prevents late contributions from raising the quorum
        // threshold mid-vote, which would make existing votes retroactively invalid.
        uint256 raisedAmountAtVotingStart;
        // Tracks how many times this milestone has been submitted for voting.
        // Creators get at most 3 attempts; a third rejection auto-cancels the campaign.
        uint8 submissionCount;
    }

    // [M4] Removed `bool refunded` — the field was never set on-chain and misled
    // off-chain consumers. Use the RefundClaimed event or the hasClaimedRefund
    // mapping for accurate per-contributor refund status.
    struct Contribution {
        uint256 contributionId;
        uint256 campaignId;
        address contributor;
        uint256 amount;
        uint256 timestamp;
    }

    struct RefundProposal {
        uint256 campaignId;
        address proposer; // First admin who proposed
        address confirmer; // [L2] Renamed from `approver` for consistency with FlagProposal/ReleaseProposal
        bool executed;
        uint256 proposedAt;
    }

    struct FlagProposal {
        uint256 campaignId;
        address proposer;
        string reason;
        address confirmer;
        bool executed;
        uint256 proposedAt;
    }

    struct ReleaseProposal {
        uint256 milestoneId;
        address proposer;
        address confirmer;
        bool executed;
        uint256 proposedAt;
    }

    struct Vote {
        uint256 milestoneId;
        address voter;
        bool choice; // true = approve, false = reject
        uint256 voteWeight; // Contribution amount of voter
        uint256 timestamp;
    }

    struct MilestoneData {
        string ipfsHash;
        uint256 amountRequired;
        uint256 deadline;
    }

    uint256 public campaignCounter;
    uint256 public milestoneCounter;
    uint256 public contributionCounter;
    uint256 public refundProposalCounter;
    uint256 public flagProposalCounter;
    uint256 public releaseProposalCounter;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone) public milestones;
    mapping(uint256 => Contribution) public contributions;
    mapping(uint256 => RefundProposal) public refundProposals;
    mapping(uint256 => FlagProposal) public flagProposals;
    mapping(uint256 => ReleaseProposal) public releaseProposals;
    mapping(uint256 => mapping(address => uint256))
        public campaignContributions; // campaignId => contributor => amount
    mapping(uint256 => uint256) public campaignRefundProposal; // campaignId => refundProposalId
    mapping(uint256 => uint256) public campaignFlagProposal;   // campaignId => flagProposalId
    mapping(uint256 => uint256) public milestoneFundProposal;  // milestoneId => releaseProposalId

    // [C1] Epoch-based vote deduplication — tracks the submission round during which each
    // address last voted on a given milestone. Comparing against milestone.submissionCount
    // tells us whether the voter already voted in the *current* round, without storing or
    // clearing a per-voter address array (which could exceed block gas limits at scale).
    //
    // Invariant: _voterRound[milestoneId][voter] < milestone.submissionCount
    //            means the voter has NOT yet voted in the current round.
    //            _voterRound[milestoneId][voter] == milestone.submissionCount
    //            means the voter HAS voted in the current round.
    //
    // Because submissionCount is uint8 (max 3), this approach is safe from overflow.
    mapping(uint256 => mapping(address => uint8)) private _voterRound;

    // [M4] Tracks whether a contributor has claimed their refund for a campaign.
    // This replaces the never-set Contribution.refunded field for clean external querying.
    mapping(uint256 => mapping(address => bool)) public hasClaimedRefund;

    uint256[] public campaignIds;

    IERC20 public immutable usdcToken;

    uint256 public constant REFUND_PERCENTAGE = 95; // 95% refund, 5% protocol fee
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_QUORUM_PERCENTAGE = 30; // 30% of total raised must vote

    // [L1] Minimum contribution thresholds — admin-settable. Prevents single-wei
    // contributions that inflate vote-tracking data structures at negligible cost.
    // Defaults: 0.001 ETH and 1 USDC.
    uint256 public minContributionETH = 1e15;  // 0.001 ETH
    uint256 public minContributionUSDC = 1e6;  // 1 USDC (6 decimals)

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        uint256 fundGoal,
        PaymentToken paymentToken,
        uint256 deadline,
        uint256 milestoneCount
    );

    event CampaignApproved(uint256 indexed campaignId, address indexed admin);
    event CampaignFlagged(
        uint256 indexed campaignId,
        address indexed admin,
        string reason
    );
    event CampaignCancelled(uint256 indexed campaignId, address indexed by);
    event CampaignCompleted(uint256 indexed campaignId);
    event CampaignStatusChanged(
        uint256 indexed campaignId,
        CampaignStatus newStatus
    );

    event ContributionMade(
        uint256 indexed campaignId,
        uint256 indexed contributionId,
        address indexed contributor,
        uint256 amount,
        PaymentToken token
    );

    event MilestoneSubmittedForVoting(
        uint256 indexed milestoneId,
        uint256 indexed campaignId,
        string proofIpfsHash,
        uint256 votingEndTime
    );

    event VoteCast(
        uint256 indexed milestoneId,
        address indexed voter,
        bool approve,
        uint256 voteWeight
    );

    event MilestoneVotingFinalized(
        uint256 indexed milestoneId,
        bool approved,
        uint256 votesFor,
        uint256 votesAgainst
    );

    event MilestoneFundsReleased(
        uint256 indexed milestoneId,
        uint256 indexed campaignId,
        uint256 amount,
        address indexed recipient
    );

    event RefundProposed(
        uint256 indexed proposalId,
        uint256 indexed campaignId,
        address indexed proposer
    );

    event RefundApproved(
        uint256 indexed proposalId,
        uint256 indexed campaignId,
        address indexed confirmer
    );

    event RefundClaimed(
        uint256 indexed campaignId,
        address indexed contributor,
        uint256 amount
    );

    event FlagProposed(
        uint256 indexed proposalId,
        uint256 indexed campaignId,
        address indexed proposer,
        string reason
    );

    event FlagConfirmed(
        uint256 indexed proposalId,
        uint256 indexed campaignId,
        address indexed confirmer
    );

    event ReleaseFundsProposed(
        uint256 indexed proposalId,
        uint256 indexed milestoneId,
        address indexed proposer
    );

    event ReleaseFundsConfirmed(
        uint256 indexed proposalId,
        uint256 indexed milestoneId,
        address indexed confirmer
    );

    modifier onlyCampaignCreator(uint256 _campaignId) {
        require(
            campaigns[_campaignId].creator == msg.sender,
            "Not campaign creator"
        );
        _;
    }

    modifier onlyActiveCampaign(uint256 _campaignId) {
        require(
            campaigns[_campaignId].status == CampaignStatus.Active,
            "Campaign not active"
        );
        _;
    }

    modifier onlyContributor(uint256 _campaignId) {
        require(
            campaignContributions[_campaignId][msg.sender] > 0,
            "Not a contributor"
        );
        _;
    }

    modifier campaignNotEnded(uint256 _campaignId) {
        require(
            block.timestamp < campaigns[_campaignId].deadline,
            "Campaign ended"
        );
        _;
    }

    modifier validCampaign(uint256 _campaignId) {
        require(
            _campaignId > 0 && _campaignId <= campaignCounter,
            "Invalid campaign"
        );
        _;
    }

    modifier validMilestone(uint256 _milestoneId) {
        require(
            _milestoneId > 0 && _milestoneId <= milestoneCounter,
            "Invalid milestone"
        );
        _;
    }

    /**
     * @notice Deploy the CampaignFactory
     * @param _usdcToken  Address of the USDC ERC-20 token
     * @param _secondAdmin A second address to receive DEFAULT_ADMIN_ROLE alongside the
     *                     deployer. Required so that all dual-admin operations
     *                     (flag/release/refund proposals) are operable from day one.
     *                     Pass address(0) to skip — but dual-sig ops will be unusable
     *                     until a second admin is granted the role separately.
     */
    constructor(address _usdcToken, address _secondAdmin) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);

        // Grant admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // [C3] Grant admin role to second admin so dual-sig governance is operable
        // immediately. address(0) is a no-op (no role granted to the zero address).
        if (_secondAdmin != address(0) && _secondAdmin != msg.sender) {
            _grantRole(DEFAULT_ADMIN_ROLE, _secondAdmin);
        }
    }

    /**
     * @notice Create a new crowdfunding campaign
     * @param _creator     The actual project creator's wallet address. This address
     *                     will receive milestone fund releases and can submit milestone
     *                     proofs. Separated from msg.sender (admin) so that the real
     *                     project owner controls their campaign's on-chain lifecycle.
     * @param _ipfsHash    IPFS hash containing campaign details
     * @param _paymentToken Payment token type (ETH or USDC)
     * @param _fundGoal    Target funding amount
     * @param _deadline    Campaign end timestamp
     * @param _milestones  Array of milestone data
     */
    function createCampaign(
        address _creator,
        string memory _ipfsHash,
        PaymentToken _paymentToken,
        uint256 _fundGoal,
        uint256 _deadline,
        MilestoneData[] memory _milestones
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused returns (uint256) {
        require(_creator != address(0), "Creator address required");
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(_fundGoal > 0, "Fund goal must be positive");
        require(_deadline > block.timestamp, "Deadline must be in future");
        require(_milestones.length > 0, "At least one milestone required");
        require(_milestones.length <= 20, "Too many milestones");

        // Validate milestone amounts sum to fund goal
        uint256 totalMilestoneAmount = 0;
        for (uint256 i = 0; i < _milestones.length; i++) {
            require(
                _milestones[i].amountRequired > 0,
                "Milestone amount must be positive"
            );
            require(
                _milestones[i].deadline <= _deadline,
                "Milestone deadline exceeds campaign deadline"
            );
            totalMilestoneAmount += _milestones[i].amountRequired;
        }
        require(
            totalMilestoneAmount == _fundGoal,
            "Milestone amounts must equal fund goal"
        );

        campaignCounter++;
        uint256 newCampaignId = campaignCounter;

        Campaign storage campaign = campaigns[newCampaignId];
        campaign.campaignId = newCampaignId;
        campaign.creator = _creator; // [H2] real project creator, not the admin wallet
        campaign.ipfsHash = _ipfsHash;
        campaign.status = CampaignStatus.Active;
        campaign.paymentToken = _paymentToken;
        campaign.fundGoal = _fundGoal;
        campaign.deadline = _deadline;
        campaign.createdAt = block.timestamp;

        for (uint256 i = 0; i < _milestones.length; i++) {
            milestoneCounter++;
            uint256 newMilestoneId = milestoneCounter;

            Milestone storage milestone = milestones[newMilestoneId];
            milestone.milestoneId = newMilestoneId;
            milestone.campaignId = newCampaignId;
            milestone.ipfsHash = _milestones[i].ipfsHash;
            milestone.amountRequired = _milestones[i].amountRequired;
            milestone.deadline = _milestones[i].deadline;
            milestone.status = MilestoneStatus.Pending;

            campaign.milestoneIds.push(newMilestoneId);
        }

        campaignIds.push(newCampaignId);

        emit CampaignCreated(
            newCampaignId,
            _creator,
            _fundGoal,
            _paymentToken,
            _deadline,
            _milestones.length
        );
        // Admin creating == admin approving — emit approval events so the indexer
        // sets isAdminApproved and status=ACTIVE in the database.
        emit CampaignApproved(newCampaignId, msg.sender);
        emit CampaignStatusChanged(newCampaignId, CampaignStatus.Active);

        return newCampaignId;
    }

    /**
     * @notice First admin proposes flagging a campaign
     * @param _campaignId Campaign ID to flag
     * @param _reason Reason for flagging
     */
    function proposeFlagCampaign(
        uint256 _campaignId,
        string memory _reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validCampaign(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        require(
            campaign.status == CampaignStatus.Active ||
                campaign.status == CampaignStatus.Funded,
            "Cannot flag this campaign"
        );
        // Allow re-proposing only if no proposal exists OR the previous one was already executed.
        // This prevents the slot from being permanently occupied after a flag is confirmed.
        require(
            campaignFlagProposal[_campaignId] == 0 ||
            flagProposals[campaignFlagProposal[_campaignId]].executed,
            "Flag already proposed"
        );

        flagProposalCounter++;
        uint256 proposalId = flagProposalCounter;

        FlagProposal storage proposal = flagProposals[proposalId];
        proposal.campaignId = _campaignId;
        proposal.proposer = msg.sender;
        proposal.reason = _reason;
        proposal.proposedAt = block.timestamp;

        campaignFlagProposal[_campaignId] = proposalId;

        emit FlagProposed(proposalId, _campaignId, msg.sender, _reason);
    }

    /**
     * @notice Second admin confirms flagging proposal — executes the flag
     * @param _campaignId Campaign ID
     */
    function confirmFlagCampaign(
        uint256 _campaignId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validCampaign(_campaignId) {
        uint256 proposalId = campaignFlagProposal[_campaignId];
        require(proposalId > 0, "No flag proposal");

        FlagProposal storage proposal = flagProposals[proposalId];
        require(proposal.proposer != msg.sender, "Cannot confirm own proposal");
        require(!proposal.executed, "Proposal already executed");

        Campaign storage campaign = campaigns[_campaignId];
        require(
            campaign.status == CampaignStatus.Active ||
                campaign.status == CampaignStatus.Funded,
            "Campaign no longer flaggable"
        );

        proposal.confirmer = msg.sender;
        proposal.executed = true;
        campaign.status = CampaignStatus.Flagged;

        emit FlagConfirmed(proposalId, _campaignId, msg.sender);
        emit CampaignFlagged(_campaignId, msg.sender, proposal.reason);
        emit CampaignStatusChanged(_campaignId, CampaignStatus.Flagged);
    }

    /**
     * @notice Get flag proposal for a campaign
     * @param _campaignId Campaign ID
     */
    function getFlagProposal(
        uint256 _campaignId
    ) external view validCampaign(_campaignId) returns (FlagProposal memory) {
        uint256 proposalId = campaignFlagProposal[_campaignId];
        require(proposalId > 0, "No flag proposal");
        return flagProposals[proposalId];
    }

    /**
     * @notice Cancel campaign (creator or admin)
     * @param _campaignId Campaign ID to cancel
     */
    function cancelCampaign(
        uint256 _campaignId
    ) external validCampaign(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        // Only creator or admin can cancel
        require(
            campaign.creator == msg.sender ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );

        // [M5/L3] Removed CampaignStatus.Pending branch — Pending is never assigned,
        // so that check was dead code. Only Active campaigns can be cancelled by
        // creator/admin; Funded campaigns must go through expireCampaign or the
        // admin refund flow.
        require(
            campaign.status == CampaignStatus.Active,
            "Cannot cancel this campaign"
        );

        campaign.status = CampaignStatus.Cancelled;

        emit CampaignCancelled(_campaignId, msg.sender);
        emit CampaignStatusChanged(_campaignId, CampaignStatus.Cancelled);
    }

    /**
     * @notice Permissionless deadline check — transitions Active campaigns past
     *         their deadline to Funded (goal met) or Cancelled (goal unmet).
     *         Contributors can then propose a refund if goal was unmet.
     * @param _campaignId Campaign ID to check
     */
    function checkCampaignDeadline(
        uint256 _campaignId
    ) external validCampaign(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Active,
            "Campaign not active"
        );
        require(
            block.timestamp >= campaign.deadline,
            "Deadline not reached"
        );

        if (campaign.raisedAmount >= campaign.fundGoal) {
            campaign.status = CampaignStatus.Funded;
            emit CampaignStatusChanged(_campaignId, CampaignStatus.Funded);
        } else {
            campaign.status = CampaignStatus.Cancelled;
            emit CampaignCancelled(_campaignId, msg.sender);
            emit CampaignStatusChanged(_campaignId, CampaignStatus.Cancelled);
        }
    }

    /**
     * @notice Permissionless expiry for Funded campaigns whose creator has abandoned
     *         execution. Callable by anyone once the campaign deadline has passed.
     *
     * @dev [H3] The previous implementation required at least one milestone with
     *      submissionCount == 0 before expiry was allowed. This meant a creator who
     *      submitted (but never completed) all milestones — putting the campaign in
     *      a permanent partial-abandonment state — could prevent contributors from
     *      ever triggering a refund. The new implementation allows expiry for any
     *      Funded campaign past its deadline, since:
     *        • All milestone deadlines are enforced <= campaign.deadline at creation.
     *        • A campaign stays Funded (not Completed) only if some milestone is still
     *          non-terminal, which implies the creator has not finished their work.
     *        • If all milestones were terminal the contract would have transitioned to
     *          Completed already via finalizeMilestoneVoting / confirmReleaseFunds.
     *
     *      On success the campaign transitions to Cancelled with fundsReclaimed = true
     *      so contributors can immediately call claimRefund() without admin action.
     *
     * @param _campaignId Campaign ID to expire
     */
    function expireCampaign(
        uint256 _campaignId
    ) external validCampaign(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Funded,
            "Campaign not funded"
        );
        require(
            block.timestamp > campaign.deadline,
            "Campaign deadline not reached"
        );

        campaign.status = CampaignStatus.Cancelled;
        campaign.fundsReclaimed = true;

        emit CampaignCancelled(_campaignId, address(this));
        emit CampaignStatusChanged(_campaignId, CampaignStatus.Cancelled);
    }

    /**
     * @notice Contribute ETH to a campaign
     * @param _campaignId Campaign ID to contribute to
     */
    function contributeETH(
        uint256 _campaignId
    )
        external
        payable
        nonReentrant
        whenNotPaused
        validCampaign(_campaignId)
        onlyActiveCampaign(_campaignId)
        campaignNotEnded(_campaignId)
    {
        Campaign storage campaign = campaigns[_campaignId];
        require(
            campaign.paymentToken == PaymentToken.ETH,
            "Campaign accepts USDC only"
        );
        // [L1] Enforce minimum contribution to prevent cheap _voterRound inflation
        require(msg.value >= minContributionETH, "Below minimum contribution");

        contributionCounter++;
        uint256 newContributionId = contributionCounter;

        Contribution storage contribution = contributions[newContributionId];
        contribution.contributionId = newContributionId;
        contribution.campaignId = _campaignId;
        contribution.contributor = msg.sender;
        contribution.amount = msg.value;
        contribution.timestamp = block.timestamp;

        campaignContributions[_campaignId][msg.sender] += msg.value;
        campaign.raisedAmount += msg.value;

        if (
            campaign.raisedAmount >= campaign.fundGoal &&
            campaign.status == CampaignStatus.Active
        ) {
            campaign.status = CampaignStatus.Funded;
            emit CampaignStatusChanged(_campaignId, CampaignStatus.Funded);
        }

        emit ContributionMade(
            _campaignId,
            newContributionId,
            msg.sender,
            msg.value,
            PaymentToken.ETH
        );
    }

    /**
     * @notice Contribute USDC to a campaign
     * @param _campaignId Campaign ID to contribute to
     * @param _amount Amount of USDC to contribute
     */
    function contributeUSDC(
        uint256 _campaignId,
        uint256 _amount
    )
        external
        nonReentrant
        whenNotPaused
        validCampaign(_campaignId)
        onlyActiveCampaign(_campaignId)
        campaignNotEnded(_campaignId)
    {
        Campaign storage campaign = campaigns[_campaignId];
        require(
            campaign.paymentToken == PaymentToken.USDC,
            "Campaign accepts ETH only"
        );
        // [L1] Enforce minimum contribution to prevent cheap _voterRound inflation
        require(_amount >= minContributionUSDC, "Below minimum contribution");

        usdcToken.safeTransferFrom(msg.sender, address(this), _amount);

        contributionCounter++;
        uint256 newContributionId = contributionCounter;

        Contribution storage contribution = contributions[newContributionId];
        contribution.contributionId = newContributionId;
        contribution.campaignId = _campaignId;
        contribution.contributor = msg.sender;
        contribution.amount = _amount;
        contribution.timestamp = block.timestamp;

        campaignContributions[_campaignId][msg.sender] += _amount;
        campaign.raisedAmount += _amount;

        if (
            campaign.raisedAmount >= campaign.fundGoal &&
            campaign.status == CampaignStatus.Active
        ) {
            campaign.status = CampaignStatus.Funded;
            emit CampaignStatusChanged(_campaignId, CampaignStatus.Funded);
        }

        emit ContributionMade(
            _campaignId,
            newContributionId,
            msg.sender,
            _amount,
            PaymentToken.USDC
        );
    }

    /**
     * @notice Creator submits milestone for voting (sequential)
     * @param _milestoneId Milestone ID
     * @param _proofIpfsHash IPFS hash containing proof of completion
     */
    function submitMilestoneForVoting(
        uint256 _milestoneId,
        string memory _proofIpfsHash
    )
        external
        validMilestone(_milestoneId)
        onlyCampaignCreator(milestones[_milestoneId].campaignId)
    {
        Milestone storage milestone = milestones[_milestoneId];
        Campaign storage campaign = campaigns[milestone.campaignId];

        // [M1] Guard against submissions on dead campaigns.
        require(
            campaign.status == CampaignStatus.Active ||
                campaign.status == CampaignStatus.Funded,
            "Campaign not active"
        );
        require(
            milestone.status == MilestoneStatus.Pending ||
                milestone.status == MilestoneStatus.Rejected,
            "Milestone not eligible for submission"
        );
        require(
            milestone.submissionCount < 3,
            "Maximum 3 submission attempts reached"
        );
        require(bytes(_proofIpfsHash).length > 0, "Proof required");
        require(campaign.raisedAmount > 0, "No contributions yet");

        // Sequential milestone check: previous milestone must be completed
        uint256[] memory campaignMilestones = campaign.milestoneIds;
        for (uint256 i = 0; i < campaignMilestones.length; i++) {
            if (campaignMilestones[i] == _milestoneId) {
                if (i > 0) {
                    uint256 previousMilestoneId = campaignMilestones[i - 1];
                    require(
                        milestones[previousMilestoneId].status ==
                            MilestoneStatus.Completed,
                        "Previous milestone not completed"
                    );
                }
                break;
            }
        }

        // [C1] Epoch-based round tracking: incrementing submissionCount is enough to
        // invalidate all previous-round votes. No voter array to clear — O(1) reset.
        // Reset vote tallies for the new submission round.
        milestone.votesFor = 0;
        milestone.votesAgainst = 0;
        milestone.ipfsHash = _proofIpfsHash;
        milestone.status = MilestoneStatus.Voting;
        milestone.votingEndTime = block.timestamp + VOTING_PERIOD;
        milestone.submissionCount += 1;
        // Snapshot raised amount so quorum threshold stays fixed during the voting window
        milestone.raisedAmountAtVotingStart = campaign.raisedAmount;

        emit MilestoneSubmittedForVoting(
            _milestoneId,
            milestone.campaignId,
            _proofIpfsHash,
            milestone.votingEndTime
        );
    }

    /**
     * @notice Contributors vote on milestone
     * @param _milestoneId Milestone ID
     * @param _approve true to approve, false to reject
     */
    function voteOnMilestone(
        uint256 _milestoneId,
        bool _approve
    )
        external
        validMilestone(_milestoneId)
        onlyContributor(milestones[_milestoneId].campaignId)
    {
        Milestone storage milestone = milestones[_milestoneId];
        Campaign storage campaign = campaigns[milestone.campaignId];

        // [M2] Prevent votes on cancelled/flagged campaigns
        require(
            campaign.status == CampaignStatus.Active ||
                campaign.status == CampaignStatus.Funded,
            "Campaign not active"
        );
        require(
            milestone.status == MilestoneStatus.Voting,
            "Milestone not open for voting"
        );
        require(
            block.timestamp < milestone.votingEndTime,
            "Voting period ended"
        );
        // [C1] Epoch-based duplicate-vote check: voter's last voted round must be
        // less than the current submission count.
        require(
            _voterRound[_milestoneId][msg.sender] < milestone.submissionCount,
            "Already voted"
        );

        uint256 voteWeight = campaignContributions[milestone.campaignId][
            msg.sender
        ];
        require(voteWeight > 0, "No contribution found");

        // Record the round the voter voted in (= current submissionCount)
        _voterRound[_milestoneId][msg.sender] = milestone.submissionCount;

        if (_approve) {
            milestone.votesFor += voteWeight;
        } else {
            milestone.votesAgainst += voteWeight;
        }

        emit VoteCast(_milestoneId, msg.sender, _approve, voteWeight);
    }

    /**
     * @notice Returns true if `_voter` has already voted on `_milestoneId` in the
     *         current submission round. Replaces the previous `hasVoted` public
     *         mapping getter (which was incompatible with the epoch approach).
     */
    function hasVoted(uint256 _milestoneId, address _voter) external view returns (bool) {
        Milestone storage milestone = milestones[_milestoneId];
        // submissionCount == 0 means voting hasn't started yet — no one has voted
        if (milestone.submissionCount == 0) return false;
        return _voterRound[_milestoneId][_voter] == milestone.submissionCount;
    }

    /**
     * @notice Finalize milestone voting after voting period
     * @param _milestoneId Milestone ID
     */
    function finalizeMilestoneVoting(
        uint256 _milestoneId
    ) external validMilestone(_milestoneId) {
        Milestone storage milestone = milestones[_milestoneId];

        require(
            milestone.status == MilestoneStatus.Voting,
            "Milestone not in voting"
        );
        require(
            block.timestamp >= milestone.votingEndTime,
            "Voting period not ended"
        );

        uint256 totalVotes = milestone.votesFor + milestone.votesAgainst;
        // Use the snapshotted raised amount so contributions made after voting
        // started do not raise the quorum bar for already-cast votes.
        uint256 quorumRequired = (milestone.raisedAmountAtVotingStart *
            MIN_QUORUM_PERCENTAGE) / 100;

        bool quorumMet = totalVotes >= quorumRequired;

        // Simple majority of votes cast (weighted by contribution)
        bool approved = quorumMet &&
            (milestone.votesFor > milestone.votesAgainst);

        if (approved) {
            milestone.status = MilestoneStatus.Approved;
        } else {
            milestone.status = MilestoneStatus.Rejected;
        }

        emit MilestoneVotingFinalized(
            _milestoneId,
            approved,
            milestone.votesFor,
            milestone.votesAgainst
        );

        uint256 campaignId = milestone.campaignId;
        Campaign storage campaign = campaigns[campaignId];

        // L2: after the 3rd rejection auto-cancel the campaign so contributors
        // can immediately claim refunds rather than having funds locked forever.
        // [M2/L4] Only override campaign status if it is not already in a
        // terminal/governed state (Flagged or Cancelled). A Flagged campaign
        // has active admin governance in progress — bypassing it via 3rd rejection
        // would circumvent the dual-admin refund approval requirement.
        if (!approved && milestone.submissionCount >= 3) {
            if (
                campaign.status != CampaignStatus.Flagged &&
                campaign.status != CampaignStatus.Cancelled
            ) {
                campaign.status = CampaignStatus.Cancelled;
                campaign.fundsReclaimed = true;
                emit CampaignCancelled(campaignId, address(this));
                emit CampaignStatusChanged(campaignId, CampaignStatus.Cancelled);
            }
            return;
        }

        // L4: once every milestone has reached a terminal state (no more voting
        // rounds possible), auto-transition the campaign to Completed so creators
        // cannot delay indefinitely by withholding the releaseMilestoneFunds call.
        if (campaign.status == CampaignStatus.Funded) {
            bool allTerminal = true;
            for (uint256 i = 0; i < campaign.milestoneIds.length; i++) {
                Milestone storage ms = milestones[campaign.milestoneIds[i]];
                bool terminal = (
                    ms.status == MilestoneStatus.Approved ||
                    ms.status == MilestoneStatus.Completed ||
                    (ms.status == MilestoneStatus.Rejected && ms.submissionCount >= 3)
                );
                if (!terminal) {
                    allTerminal = false;
                    break;
                }
            }
            if (allTerminal) {
                campaign.status = CampaignStatus.Completed;
                emit CampaignCompleted(campaignId);
                emit CampaignStatusChanged(campaignId, CampaignStatus.Completed);
            }
        }
    }

    /**
     * @notice First admin proposes releasing funds for an approved milestone
     * @param _milestoneId Milestone ID
     */
    function proposeReleaseFunds(
        uint256 _milestoneId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validMilestone(_milestoneId) {
        Milestone storage milestone = milestones[_milestoneId];
        Campaign storage campaign = campaigns[milestone.campaignId];

        require(
            milestone.status == MilestoneStatus.Approved,
            "Milestone not approved"
        );
        // [H1] Removed CampaignStatus.Flagged from eligibility. A Flagged campaign
        // is under active admin review for potential fraud or misuse — releasing
        // creator funds while it is flagged contradicts the purpose of the flag and
        // could be used to drain contributor funds before the refund path is executed.
        require(
            campaign.status == CampaignStatus.Active   ||
            campaign.status == CampaignStatus.Funded   ||
            campaign.status == CampaignStatus.Completed,
            "Campaign not eligible for release"
        );
        require(!milestone.fundsReleased, "Funds already released");
        // Allow re-proposing only if no proposal exists OR the previous one was already executed.
        require(
            milestoneFundProposal[_milestoneId] == 0 ||
            releaseProposals[milestoneFundProposal[_milestoneId]].executed,
            "Release already proposed"
        );

        releaseProposalCounter++;
        uint256 proposalId = releaseProposalCounter;

        ReleaseProposal storage proposal = releaseProposals[proposalId];
        proposal.milestoneId = _milestoneId;
        proposal.proposer = msg.sender;
        proposal.proposedAt = block.timestamp;

        milestoneFundProposal[_milestoneId] = proposalId;

        emit ReleaseFundsProposed(proposalId, _milestoneId, msg.sender);
    }

    /**
     * @notice Second admin confirms release proposal — executes the fund transfer
     * @param _milestoneId Milestone ID
     */
    function confirmReleaseFunds(
        uint256 _milestoneId
    ) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) validMilestone(_milestoneId) {
        uint256 proposalId = milestoneFundProposal[_milestoneId];
        require(proposalId > 0, "No release proposal");

        ReleaseProposal storage proposal = releaseProposals[proposalId];
        require(proposal.proposer != msg.sender, "Cannot confirm own proposal");
        require(!proposal.executed, "Proposal already executed");

        Milestone storage milestone = milestones[_milestoneId];
        Campaign storage campaign = campaigns[milestone.campaignId];

        require(
            milestone.status == MilestoneStatus.Approved,
            "Milestone not approved"
        );
        require(!milestone.fundsReleased, "Funds already released");
        // [H1] Block fund release if a refund has already been approved. A confirmed
        // refund (fundsReclaimed = true) means contributors are entitled to the
        // remaining contract balance. Releasing to the creator would reduce that pool.
        require(!campaign.fundsReclaimed, "Refund already approved for this campaign");
        require(
            campaign.withdrawnAmount + milestone.amountRequired <=
                campaign.raisedAmount,
            "Insufficient funds"
        );

        proposal.confirmer = msg.sender;
        proposal.executed = true;
        milestone.fundsReleased = true;
        milestone.status = MilestoneStatus.Completed;
        campaign.withdrawnAmount += milestone.amountRequired;

        // L4 guard: campaign may already be Completed via auto-complete in
        // finalizeMilestoneVoting; only emit the event once.
        bool allCompleted = true;
        for (uint256 i = 0; i < campaign.milestoneIds.length; i++) {
            if (
                milestones[campaign.milestoneIds[i]].status !=
                MilestoneStatus.Completed
            ) {
                allCompleted = false;
                break;
            }
        }
        if (allCompleted && campaign.status != CampaignStatus.Completed) {
            campaign.status = CampaignStatus.Completed;
            emit CampaignCompleted(milestone.campaignId);
            emit CampaignStatusChanged(milestone.campaignId, CampaignStatus.Completed);
        }

        // CEI: state updates complete before external call
        if (campaign.paymentToken == PaymentToken.ETH) {
            (bool success, ) = payable(campaign.creator).call{
                value: milestone.amountRequired
            }("");
            require(success, "ETH transfer failed");
        } else {
            usdcToken.safeTransfer(campaign.creator, milestone.amountRequired);
        }

        emit ReleaseFundsConfirmed(proposalId, _milestoneId, msg.sender);
        emit MilestoneFundsReleased(
            _milestoneId,
            milestone.campaignId,
            milestone.amountRequired,
            campaign.creator
        );
    }

    /**
     * @notice Get release proposal for a milestone
     * @param _milestoneId Milestone ID
     */
    function getReleaseProposal(
        uint256 _milestoneId
    ) external view validMilestone(_milestoneId) returns (ReleaseProposal memory) {
        uint256 proposalId = milestoneFundProposal[_milestoneId];
        require(proposalId > 0, "No release proposal");
        return releaseProposals[proposalId];
    }

    /**
     * @notice First admin proposes refund for campaign
     * @param _campaignId Campaign ID
     */
    function proposeRefund(
        uint256 _campaignId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validCampaign(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Flagged ||
                campaign.status == CampaignStatus.Cancelled ||
                (campaign.status == CampaignStatus.Active &&
                    block.timestamp >= campaign.deadline),
            "Campaign not eligible for refund"
        );

        // Allow re-proposing only if no proposal exists OR the previous one was already executed.
        require(
            campaignRefundProposal[_campaignId] == 0 ||
            refundProposals[campaignRefundProposal[_campaignId]].executed,
            "Refund already proposed"
        );
        require(
            campaign.raisedAmount > campaign.withdrawnAmount,
            "No funds to refund"
        );

        refundProposalCounter++;
        uint256 proposalId = refundProposalCounter;

        RefundProposal storage proposal = refundProposals[proposalId];
        proposal.campaignId = _campaignId;
        proposal.proposer = msg.sender;
        proposal.proposedAt = block.timestamp;

        campaignRefundProposal[_campaignId] = proposalId;

        emit RefundProposed(proposalId, _campaignId, msg.sender);
    }

    /**
     * @notice Second admin approves refund proposal
     * @param _campaignId Campaign ID
     */
    function approveRefund(
        uint256 _campaignId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validCampaign(_campaignId) {
        uint256 proposalId = campaignRefundProposal[_campaignId];
        require(proposalId > 0, "No refund proposal");

        RefundProposal storage proposal = refundProposals[proposalId];

        require(proposal.proposer != msg.sender, "Cannot approve own proposal");
        require(!proposal.executed, "Proposal already executed");

        proposal.confirmer = msg.sender; // [L2] field renamed from `approver`
        proposal.executed = true;

        Campaign storage campaign = campaigns[_campaignId];
        campaign.fundsReclaimed = true;

        emit RefundApproved(proposalId, _campaignId, msg.sender);
    }

    /**
     * @notice Contributors claim refund after admin approval
     * @param _campaignId Campaign ID
     */
    function claimRefund(
        uint256 _campaignId
    )
        external
        nonReentrant
        validCampaign(_campaignId)
        onlyContributor(_campaignId)
    {
        Campaign storage campaign = campaigns[_campaignId];

        require(campaign.fundsReclaimed, "Refund not approved");

        uint256 contributorAmount = campaignContributions[_campaignId][
            msg.sender
        ];
        require(contributorAmount > 0, "No contribution to refund");

        // CEI: zero out contribution before external call
        campaignContributions[_campaignId][msg.sender] = 0;
        hasClaimedRefund[_campaignId][msg.sender] = true; // [M4]

        // L6: pro-rate against available funds. If milestone funds were already
        // released (withdrawnAmount > 0), only the remaining pool is distributable.
        // Without this, early claimers get paid in full while late claimers revert.
        //
        // Precision note (C3): Solidity integer division truncates toward zero.
        // The rounding error per claim is at most 1 wei (ETH) or 1 token-unit (USDC).
        // For ETH at wei-level precision this is economically negligible (<$0.000001).
        // For USDC (6 decimals), the error is at most $0.000001 per claim.
        // Contributions smaller than ~1e-7% of the raised amount may round to zero
        // refund, which is an accepted limitation of fixed-point arithmetic.
        uint256 availableForRefund = campaign.raisedAmount - campaign.withdrawnAmount;
        uint256 refundAmount = (contributorAmount * availableForRefund * REFUND_PERCENTAGE)
            / (campaign.raisedAmount * 100);

        // [M3] Guard against zero refund — this happens when all funds have already
        // been released to the creator (withdrawnAmount == raisedAmount). Without
        // this guard, the contributor's campaignContributions slot would be zeroed
        // permanently while they receive nothing, preventing any retry.
        require(refundAmount > 0, "No funds remain to refund");

        if (campaign.paymentToken == PaymentToken.ETH) {
            (bool success, ) = payable(msg.sender).call{value: refundAmount}(
                ""
            );
            require(success, "ETH refund failed");
        } else {
            usdcToken.safeTransfer(msg.sender, refundAmount);
        }

        emit RefundClaimed(_campaignId, msg.sender, refundAmount);
    }

    /**
     * @notice Get campaign details
     * @param _campaignId Campaign ID
     */
    function getCampaign(
        uint256 _campaignId
    ) external view validCampaign(_campaignId) returns (Campaign memory) {
        return campaigns[_campaignId];
    }

    /**
     * @notice Get milestone details
     * @param _milestoneId Milestone ID
     */
    function getMilestone(
        uint256 _milestoneId
    ) external view validMilestone(_milestoneId) returns (Milestone memory) {
        return milestones[_milestoneId];
    }

    /**
     * @notice Get all milestone IDs for a campaign
     * @param _campaignId Campaign ID
     */
    function getCampaignMilestones(
        uint256 _campaignId
    ) external view validCampaign(_campaignId) returns (uint256[] memory) {
        return campaigns[_campaignId].milestoneIds;
    }

    /**
     * @notice Get contributor's total contribution to a campaign
     * @param _campaignId Campaign ID
     * @param _contributor Contributor address
     */
    function getContributorAmount(
        uint256 _campaignId,
        address _contributor
    ) external view returns (uint256) {
        return campaignContributions[_campaignId][_contributor];
    }

    /**
     * @notice Get all active campaign IDs
     * @dev WARNING: This function iterates the entire campaignIds array twice and is
     *      O(n) in the number of campaigns ever created. It is intended for off-chain
     *      use (scripts, tests, explorers) only. Do NOT call this on-chain or from a
     *      contract — it will exceed the block gas limit once the platform has more
     *      than ~500 campaigns. All production campaign listings should use the
     *      backend API (PostgreSQL) instead of this getter.
     */
    function getActiveCampaigns() external view returns (uint256[] memory) {
        uint256 activeCount = 0;

        // Count active campaigns
        for (uint256 i = 0; i < campaignIds.length; i++) {
            if (campaigns[campaignIds[i]].status == CampaignStatus.Active) {
                activeCount++;
            }
        }

        // Build array
        uint256[] memory activeCampaigns = new uint256[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < campaignIds.length; i++) {
            if (campaigns[campaignIds[i]].status == CampaignStatus.Active) {
                activeCampaigns[index] = campaignIds[i];
                index++;
            }
        }

        return activeCampaigns;
    }

    /**
     * @notice Get refund proposal for campaign
     * @param _campaignId Campaign ID
     */
    function getRefundProposal(
        uint256 _campaignId
    ) external view validCampaign(_campaignId) returns (RefundProposal memory) {
        uint256 proposalId = campaignRefundProposal[_campaignId];
        require(proposalId > 0, "No refund proposal");
        return refundProposals[proposalId];
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────────

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Withdraw accumulated protocol fees (5% retained from refunds)
     * @param _recipient Address to receive the fees
     * @param _token     Which token to withdraw (ETH or USDC)
     * @param _amount    Amount to withdraw (in wei for ETH, token units for USDC)
     */
    function withdrawFees(
        address _recipient,
        PaymentToken _token,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be positive");
        if (_token == PaymentToken.ETH) {
            (bool ok, ) = payable(_recipient).call{value: _amount}("");
            require(ok, "ETH fee withdrawal failed");
        } else {
            usdcToken.safeTransfer(_recipient, _amount);
        }
    }

    /**
     * @notice Update minimum contribution thresholds
     * @param _minETH  New minimum for ETH campaigns (in wei). 0 = no minimum.
     * @param _minUSDC New minimum for USDC campaigns (in token units). 0 = no minimum.
     */
    function setMinContribution(uint256 _minETH, uint256 _minUSDC)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        minContributionETH = _minETH;
        minContributionUSDC = _minUSDC;
    }
}
