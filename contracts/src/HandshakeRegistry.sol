// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HandshakeRegistry
/// @notice A payment-reputation registry for informal gig work. A freelancer
///         proposes an agreement (scope hash, fiat amount, deadline); the
///         client co-signs it onchain. After the deadline the outcome —
///         paid, defaulted, disputed, or silent — becomes a permanent,
///         queryable record against both wallets.
///
///         This contract is a registry, NOT an escrow: no funds ever move
///         through it. Payments happen in fiat off-chain; the chain records
///         behavior on mutually signed commitments. Nobody can appear in the
///         registry without their own signature on the original agreement.
///
///         Reputation is computed off-chain from events — the contract
///         stores no aggregate counters.
contract HandshakeRegistry {
    enum Status {
        Proposed, // created by freelancer, awaiting client co-signature
        Active, // co-signed by client, work in progress
        Paid, // client confirmed payment (terminal, good mark)
        Defaulted, // freelancer flagged non-payment after deadline
        Disputed // client disputed the default flag in time (terminal)
    }

    struct Agreement {
        address freelancer;
        address client;
        uint256 amountCents; // fiat amount in cents (CAD), informational only
        uint64 deadline; // unix timestamp payment is due by
        uint64 createdAt;
        uint64 cosignedAt;
        uint64 resolvedAt; // when Paid was confirmed or the default was flagged
        uint64 disputedAt;
        bytes32 scopeHash; // keccak256 of the scope-of-work text (stored off-chain)
        bytes32 disputeHash; // keccak256 of the client's dispute reason, if any
        Status status;
    }
    // Full lifecycle timestamps live in the struct so the entire history is
    // reconstructable from state alone — Monad's public RPC caps eth_getLogs
    // at a 100-block range, so clients must not depend on log scans.

    /// @notice How long after a default flag the client can still dispute it.
    ///         A default left undisputed past this window is a "silent default".
    uint256 public constant DISPUTE_WINDOW = 14 days;

    Agreement[] private _agreements;

    event AgreementCreated(
        uint256 indexed id,
        address indexed freelancer,
        address indexed client,
        uint256 amountCents,
        uint64 deadline,
        bytes32 scopeHash
    );
    event AgreementCosigned(uint256 indexed id, address indexed freelancer, address indexed client);
    event PaymentConfirmed(uint256 indexed id, address indexed freelancer, address indexed client);
    event DefaultFlagged(uint256 indexed id, address indexed freelancer, address indexed client);
    event DefaultDisputed(
        uint256 indexed id, address indexed freelancer, address indexed client, bytes32 reasonHash
    );

    error UnknownAgreement();
    error NotClient();
    error NotFreelancer();
    error WrongStatus();
    error ClientIsZero();
    error ClientIsSelf();
    error DeadlineNotInFuture();
    error ProposalExpired();
    error DeadlineNotPassed();
    error DisputeWindowClosed();

    /// @notice Freelancer proposes an agreement. It counts for nothing until
    ///         the client co-signs; an un-cosigned proposal past its deadline
    ///         simply expires.
    function createAgreement(address client, uint256 amountCents, uint64 deadline, bytes32 scopeHash)
        external
        returns (uint256 id)
    {
        if (client == address(0)) revert ClientIsZero();
        if (client == msg.sender) revert ClientIsSelf();
        if (deadline <= block.timestamp) revert DeadlineNotInFuture();

        id = _agreements.length;
        _agreements.push(
            Agreement({
                freelancer: msg.sender,
                client: client,
                amountCents: amountCents,
                deadline: deadline,
                createdAt: uint64(block.timestamp),
                cosignedAt: 0,
                resolvedAt: 0,
                disputedAt: 0,
                scopeHash: scopeHash,
                disputeHash: bytes32(0),
                status: Status.Proposed
            })
        );

        emit AgreementCreated(id, msg.sender, client, amountCents, deadline, scopeHash);
    }

    /// @notice Client co-signs the proposal, activating the agreement. Only
    ///         possible before the deadline — a stale proposal can't be
    ///         activated straight into default territory.
    function cosign(uint256 id) external {
        Agreement storage a = _get(id);
        if (msg.sender != a.client) revert NotClient();
        if (a.status != Status.Proposed) revert WrongStatus();
        if (block.timestamp > a.deadline) revert ProposalExpired();

        a.status = Status.Active;
        a.cosignedAt = uint64(block.timestamp);

        emit AgreementCosigned(id, a.freelancer, a.client);
    }

    /// @notice Client confirms they paid. Terminal good mark — confirming is
    ///         in the client's own interest.
    function confirmPaid(uint256 id) external {
        Agreement storage a = _get(id);
        if (msg.sender != a.client) revert NotClient();
        if (a.status != Status.Active) revert WrongStatus();

        a.status = Status.Paid;
        a.resolvedAt = uint64(block.timestamp);

        emit PaymentConfirmed(id, a.freelancer, a.client);
    }

    /// @notice Freelancer flags non-payment once the deadline has passed.
    ///         Starts the client's DISPUTE_WINDOW.
    function flagDefault(uint256 id) external {
        Agreement storage a = _get(id);
        if (msg.sender != a.freelancer) revert NotFreelancer();
        if (a.status != Status.Active) revert WrongStatus();
        if (block.timestamp <= a.deadline) revert DeadlineNotPassed();

        a.status = Status.Defaulted;
        a.resolvedAt = uint64(block.timestamp);

        emit DefaultFlagged(id, a.freelancer, a.client);
    }

    /// @notice Client contests a default flag within the dispute window. The
    ///         registry doesn't rule on who's right — both claims stay visible.
    ///         Staying silent past the window leaves a silent default, the
    ///         worst mark.
    function dispute(uint256 id, bytes32 reasonHash) external {
        Agreement storage a = _get(id);
        if (msg.sender != a.client) revert NotClient();
        if (a.status != Status.Defaulted) revert WrongStatus();
        if (block.timestamp > uint256(a.resolvedAt) + DISPUTE_WINDOW) revert DisputeWindowClosed();

        a.status = Status.Disputed;
        a.disputedAt = uint64(block.timestamp);
        a.disputeHash = reasonHash;

        emit DefaultDisputed(id, a.freelancer, a.client, reasonHash);
    }

    function getAgreement(uint256 id) external view returns (Agreement memory) {
        return _get(id);
    }

    /// @notice Batch read [fromId, toId) so reputation can be computed from
    ///         state in one call — no log scans, no indexer.
    function getAgreements(uint256 fromId, uint256 toId)
        external
        view
        returns (Agreement[] memory page)
    {
        if (toId > _agreements.length) toId = _agreements.length;
        if (fromId >= toId) return new Agreement[](0);

        page = new Agreement[](toId - fromId);
        for (uint256 i = fromId; i < toId; ++i) {
            page[i - fromId] = _agreements[i];
        }
    }

    function agreementCount() external view returns (uint256) {
        return _agreements.length;
    }

    function _get(uint256 id) private view returns (Agreement storage) {
        if (id >= _agreements.length) revert UnknownAgreement();
        return _agreements[id];
    }
}
