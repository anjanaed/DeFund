// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CampaignFactory
 * @dev Milestone-based crowdfunding platform for Web3 projects
 * @notice Factory contract managing all campaigns with contribution-weighted voting
 */
contract CampaignFactory is AccessControl, ReentrancyGuard, Pausable {
    enum CampaignStatus {
        Pending, // Awaiting admin approval
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
    }

    struct Contribution {
        uint256 contributionId;
        uint256 campaignId;
        address contributor;
        uint256 amount;
        uint256 timestamp;
        bool refunded;
    }

    struct RefundProposal {
        uint256 campaignId;
        address proposer; // First admin who proposed
        address approver; // Second admin who approved
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

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone) public milestones;
    mapping(uint256 => Contribution) public contributions;
    mapping(uint256 => RefundProposal) public refundProposals;
    mapping(uint256 => mapping(address => uint256))
        public campaignContributions; // campaignId => contributor => amount
    mapping(uint256 => mapping(address => bool)) public hasVoted; // milestoneId => voter => hasVoted
    mapping(uint256 => uint256) public campaignRefundProposal; // campaignId => refundProposalId

    uint256[] public campaignIds;

    IERC20 public immutable usdcToken;

    uint256 public constant REFUND_PERCENTAGE = 95; // 95% refund, 5% for gas
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_QUORUM_PERCENTAGE = 30; // 30% of total raised must vote
    uint256 public constant REFUND_PROPOSAL_EXPIRY = 3 days;

    bytes32 public constant CAMPAIGN_CREATOR_ROLE =
        keccak256("CAMPAIGN_CREATOR_ROLE");

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
        address indexed approver
    );

    event RefundClaimed(
        uint256 indexed campaignId,
        address indexed contributor,
        uint256 amount
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

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);

        // Grant admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Create a new crowdfunding campaign
     * @param _ipfsHash IPFS hash containing campaign details
     * @param _paymentToken Payment token type (ETH or USDC)
     * @param _fundGoal Target funding amount
     * @param _deadline Campaign end timestamp
     * @param _milestones Array of milestone data
     */
    function createCampaign(
        string memory _ipfsHash,
        PaymentToken _paymentToken,
        uint256 _fundGoal,
        uint256 _deadline,
        MilestoneData[] memory _milestones
    ) external whenNotPaused returns (uint256) {
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
        campaign.creator = msg.sender;
        campaign.ipfsHash = _ipfsHash;
        campaign.status = CampaignStatus.Pending;
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
            msg.sender,
            _fundGoal,
            _paymentToken,
            _deadline,
            _milestones.length
        );

        return newCampaignId;
    }

    /**
     * @notice Admin approves pending campaign
     * @param _campaignId Campaign ID to approve
     */
    function approveCampaign(
        uint256 _campaignId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validCampaign(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        require(
            campaign.status == CampaignStatus.Pending,
            "Campaign not pending"
        );

        campaign.status = CampaignStatus.Active;

        emit CampaignApproved(_campaignId, msg.sender);
        emit CampaignStatusChanged(_campaignId, CampaignStatus.Active);
    }

    /**
     * @notice Admin flags campaign for issues
     * @param _campaignId Campaign ID to flag
     * @param _reason Reason for flagging
     */
    function flagCampaign(
        uint256 _campaignId,
        string memory _reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validCampaign(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        require(
            campaign.status == CampaignStatus.Active ||
                campaign.status == CampaignStatus.Funded,
            "Cannot flag this campaign"
        );

        campaign.status = CampaignStatus.Flagged;

        emit CampaignFlagged(_campaignId, msg.sender, _reason);
        emit CampaignStatusChanged(_campaignId, CampaignStatus.Flagged);
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

        require(
            campaign.status == CampaignStatus.Pending ||
                campaign.status == CampaignStatus.Active,
            "Cannot cancel this campaign"
        );

        campaign.status = CampaignStatus.Cancelled;

        emit CampaignCancelled(_campaignId, msg.sender);
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
        require(msg.value > 0, "Contribution must be positive");

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
        require(_amount > 0, "Contribution must be positive");

        require(
            usdcToken.transferFrom(msg.sender, address(this), _amount),
            "USDC transfer failed"
        );

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

        require(
            milestone.status == MilestoneStatus.Pending,
            "Milestone not in pending status"
        );
        require(bytes(_proofIpfsHash).length > 0, "Proof required");

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

        milestone.ipfsHash = _proofIpfsHash;
        milestone.status = MilestoneStatus.Voting;
        milestone.votingEndTime = block.timestamp + VOTING_PERIOD;

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

        require(
            milestone.status == MilestoneStatus.Voting,
            "Milestone not open for voting"
        );
        require(
            block.timestamp < milestone.votingEndTime,
            "Voting period ended"
        );
        require(!hasVoted[_milestoneId][msg.sender], "Already voted");

        uint256 voteWeight = campaignContributions[milestone.campaignId][
            msg.sender
        ];
        require(voteWeight > 0, "No contribution found");

        hasVoted[_milestoneId][msg.sender] = true;

        if (_approve) {
            milestone.votesFor += voteWeight;
        } else {
            milestone.votesAgainst += voteWeight;
        }

        emit VoteCast(_milestoneId, msg.sender, _approve, voteWeight);
    }

    /**
     * @notice Finalize milestone voting after voting period
     * @param _milestoneId Milestone ID
     */
    function finalizeMilestoneVoting(
        uint256 _milestoneId
    ) external validMilestone(_milestoneId) {
        Milestone storage milestone = milestones[_milestoneId];
        Campaign storage campaign = campaigns[milestone.campaignId];

        require(
            milestone.status == MilestoneStatus.Voting,
            "Milestone not in voting"
        );
        require(
            block.timestamp >= milestone.votingEndTime,
            "Voting period not ended"
        );

        uint256 totalVotes = milestone.votesFor + milestone.votesAgainst;
        uint256 quorumRequired = (campaign.raisedAmount *
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
    }

    /**
     * @notice Release funds for approved milestone
     * @param _milestoneId Milestone ID
     */
    function releaseMilestoneFunds(
        uint256 _milestoneId
    )
        external
        nonReentrant
        validMilestone(_milestoneId)
        onlyCampaignCreator(milestones[_milestoneId].campaignId)
    {
        Milestone storage milestone = milestones[_milestoneId];
        Campaign storage campaign = campaigns[milestone.campaignId];

        require(
            milestone.status == MilestoneStatus.Approved,
            "Milestone not approved"
        );
        require(!milestone.fundsReleased, "Funds already released");
        require(
            campaign.withdrawnAmount + milestone.amountRequired <=
                campaign.raisedAmount,
            "Insufficient funds"
        );

        milestone.fundsReleased = true;
        milestone.status = MilestoneStatus.Completed;
        campaign.withdrawnAmount += milestone.amountRequired;

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

        if (allCompleted) {
            campaign.status = CampaignStatus.Completed;
            emit CampaignCompleted(milestone.campaignId);
            emit CampaignStatusChanged(
                milestone.campaignId,
                CampaignStatus.Completed
            );
        }

        if (campaign.paymentToken == PaymentToken.ETH) {
            (bool success, ) = payable(campaign.creator).call{
                value: milestone.amountRequired
            }("");
            require(success, "ETH transfer failed");
        } else {
            require(
                usdcToken.transfer(campaign.creator, milestone.amountRequired),
                "USDC transfer failed"
            );
        }

        emit MilestoneFundsReleased(
            _milestoneId,
            milestone.campaignId,
            milestone.amountRequired,
            campaign.creator
        );
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
                    block.timestamp > campaign.deadline),
            "Campaign not eligible for refund"
        );

        require(
            campaignRefundProposal[_campaignId] == 0,
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
        require(
            block.timestamp <= proposal.proposedAt + REFUND_PROPOSAL_EXPIRY,
            "Proposal expired"
        );

        proposal.approver = msg.sender;
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

        campaignContributions[_campaignId][msg.sender] = 0;

        uint256 refundAmount = (contributorAmount * REFUND_PERCENTAGE) / 100;

        if (campaign.paymentToken == PaymentToken.ETH) {
            (bool success, ) = payable(msg.sender).call{value: refundAmount}(
                ""
            );
            require(success, "ETH refund failed");
        } else {
            require(
                usdcToken.transfer(msg.sender, refundAmount),
                "USDC refund failed"
            );
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
     * @notice Get all active campaigns
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

    // Admin Functions 

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
     * @notice Grant campaign creator role to address
     * @param _account Address to grant role
     */
    function grantCreatorRole(
        address _account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(CAMPAIGN_CREATOR_ROLE, _account);
    }

    /**
     * @notice Revoke campaign creator role from address
     * @param _account Address to revoke role
     */
    function revokeCreatorRole(
        address _account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(CAMPAIGN_CREATOR_ROLE, _account);
    }
}
