// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LandRegistry
 * @author Decentralized Land Registry project
 * @notice Tamper-resistant registry of property ownership with a permanent,
 *         transparent transfer history. Deed documents live on IPFS; only the
 *         content identifier (CID) and a keccak256 hash of the file bytes are
 *         stored on-chain so records can be verified against the original file.
 *
 * @dev HONESTY NOTE (encoded in behaviour, not marketing): this contract does
 *      NOT verify real-world identity, does NOT judge whether an initial
 *      ownership claim is genuine, and does NOT grant legal recognition. A
 *      trusted Registrar (REGISTRAR_ROLE) must approve every initial
 *      registration precisely because a blockchain cannot tell a real deed from
 *      a forged one ("garbage in, garbage out"). What the contract guarantees
 *      is rule-based transfers, an append-only history, and detection of
 *      on-chain duplicates — it reduces and flags fraud rather than eliminating
 *      it. Security model and accepted trust assumptions are documented in
 *      docs/SECURITY.md and docs/LIMITATIONS.md.
 *
 *      Design is gas-conscious: calldata for external string inputs, packed
 *      structs, uint64 timestamps, and custom errors instead of revert strings.
 *      The source is dependency-pinned to OpenZeppelin v5 and compiles cleanly
 *      in Remix IDE (single-file flattening not required when the OZ remapping
 *      is available).
 */
contract LandRegistry is AccessControl, ReentrancyGuard, Pausable {
    // ----------------------------------------------------------------------
    //  Roles
    // ----------------------------------------------------------------------

    /// @notice Role allowed to approve/reject registrations and pause the system.
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    // ----------------------------------------------------------------------
    //  Types
    // ----------------------------------------------------------------------

    /// @notice Lifecycle state of a property record.
    enum Status {
        Pending,
        Registered,
        Rejected
    }

    /**
     * @notice A single property record. Field order is chosen so that
     *         `owner` (20B) + `status` (1B) + `submittedAt` (8B) share one
     *         storage slot, and `registeredAt` + `areaSqm` pack efficiently.
     * @param id Unique, auto-incrementing identifier (starts at 1).
     * @param owner Current on-chain owner (the wallet that controls transfers).
     * @param status Current lifecycle status.
     * @param submittedAt Unix time the property was submitted.
     * @param registeredAt Unix time the Registrar approved it (0 if not yet).
     * @param areaSqm Area in square metres.
     * @param location Human-readable location / address string.
     * @param surveyNumber Government survey number.
     * @param propertyType E.g. "Residential", "Agricultural", "Commercial".
     * @param documentCID IPFS CID of the deed document.
     * @param documentHash keccak256 of the raw deed file bytes.
     * @param rejectionReason Registrar's reason when status == Rejected.
     */
    struct Property {
        uint256 id;
        address owner;
        Status status;
        uint64 submittedAt;
        uint64 registeredAt;
        uint256 areaSqm;
        string location;
        string surveyNumber;
        string propertyType;
        string documentCID;
        bytes32 documentHash;
        string rejectionReason;
    }

    /// @notice One immutable entry in a property's ownership history.
    struct TransferRecord {
        uint256 propertyId;
        address from;
        address to;
        uint64 timestamp;
    }

    /// @notice A transfer that has been initiated by the owner but not yet accepted.
    struct PendingTransfer {
        address buyer;
        uint64 initiatedAt;
        bool active;
    }

    // ----------------------------------------------------------------------
    //  Storage
    // ----------------------------------------------------------------------

    uint256 private _nextId = 1;

    // Running counts by status, for cheap getStats().
    uint256 private _pendingCount;
    uint256 private _registeredCount;
    uint256 private _rejectedCount;

    mapping(uint256 => Property) private _properties;
    mapping(uint256 => TransferRecord[]) private _history;
    mapping(uint256 => PendingTransfer) private _pendingTransfers;

    // owner => list of property ids currently owned (swap-and-pop maintained).
    mapping(address => uint256[]) private _ownerProperties;
    mapping(uint256 => uint256) private _ownerIndex; // propertyId => index in owner array

    // buyer => property ids for which they were ever named as incoming buyer.
    mapping(address => uint256[]) private _incoming;

    // Duplicate guards.
    mapping(bytes32 => bool) private _documentHashUsed;
    mapping(bytes32 => uint256) private _surveyLocationToId; // keccak(survey+location) => id (0 = free)

    // Global list of ids for pagination.
    uint256[] private _allIds;

    // Anti-spam: rolling 24h submission timestamps per wallet.
    mapping(address => uint64[]) private _submissionTimes;

    /// @notice Submissions allowed per wallet within SUBMISSION_WINDOW before flagging.
    uint256 public constant SUBMISSION_LIMIT = 3;
    /// @notice Rolling window used for the spam/flag heuristic.
    uint64 public constant SUBMISSION_WINDOW = 24 hours;

    // ----------------------------------------------------------------------
    //  Events
    // ----------------------------------------------------------------------

    event PropertySubmitted(
        uint256 indexed id,
        address indexed owner,
        string surveyNumber,
        bytes32 documentHash
    );
    event PropertyApproved(uint256 indexed id, address indexed registrar);
    event PropertyRejected(uint256 indexed id, address indexed registrar, string reason);
    event TransferInitiated(uint256 indexed id, address indexed from, address indexed to);
    event TransferCompleted(uint256 indexed id, address indexed from, address indexed to);
    event TransferCancelled(uint256 indexed id, address indexed owner);
    event FlaggedForReview(uint256 indexed id, string reason);
    event RegistrarGranted(address indexed account, address indexed by);
    event RegistrarRevoked(address indexed account, address indexed by);

    // ----------------------------------------------------------------------
    //  Custom errors
    // ----------------------------------------------------------------------

    error EmptyField(string field);
    error ZeroArea();
    error DuplicateDocumentHash(bytes32 documentHash);
    error DuplicateSurveyLocation(uint256 existingId);
    error PropertyNotFound(uint256 id);
    error NotPropertyOwner(uint256 id, address caller);
    error PropertyNotRegistered(uint256 id, Status status);
    error PropertyNotPending(uint256 id, Status status);
    error InvalidBuyer(address buyer);
    error TransferAlreadyPending(uint256 id);
    error NoActivePendingTransfer(uint256 id);
    error NotDesignatedBuyer(uint256 id, address caller);
    error ZeroAddressAccount();

    // ----------------------------------------------------------------------
    //  Construction
    // ----------------------------------------------------------------------

    /**
     * @notice Deploys the registry and makes the deployer both the admin and
     *         the first Registrar.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    // ----------------------------------------------------------------------
    //  Registration
    // ----------------------------------------------------------------------

    /**
     * @notice Submit a new property for Registrar approval. Caller becomes the
     *         claimed owner and the record enters the `Pending` state.
     * @dev Reverts on empty strings, zero area, a document hash already on file,
     *      or a (surveyNumber, location) pair already on file. Emits
     *      {FlaggedForReview} when this is the caller's 4th+ submission inside a
     *      rolling 24h window.
     * @param location Human-readable location / address.
     * @param surveyNumber Government survey number.
     * @param areaSqm Area in square metres (must be > 0).
     * @param propertyType Property category string.
     * @param documentCID IPFS CID of the deed document.
     * @param documentHash keccak256 of the raw deed file bytes.
     * @return id The new property's unique id.
     */
    function submitProperty(
        string calldata location,
        string calldata surveyNumber,
        uint256 areaSqm,
        string calldata propertyType,
        string calldata documentCID,
        bytes32 documentHash
    ) external whenNotPaused returns (uint256 id) {
        if (bytes(location).length == 0) revert EmptyField("location");
        if (bytes(surveyNumber).length == 0) revert EmptyField("surveyNumber");
        if (bytes(propertyType).length == 0) revert EmptyField("propertyType");
        if (bytes(documentCID).length == 0) revert EmptyField("documentCID");
        if (documentHash == bytes32(0)) revert EmptyField("documentHash");
        if (areaSqm == 0) revert ZeroArea();

        if (_documentHashUsed[documentHash]) revert DuplicateDocumentHash(documentHash);

        bytes32 surveyKey = keccak256(abi.encodePacked(surveyNumber, "|", location));
        uint256 existing = _surveyLocationToId[surveyKey];
        if (existing != 0) revert DuplicateSurveyLocation(existing);

        id = _nextId++;

        _properties[id] = Property({
            id: id,
            owner: msg.sender,
            status: Status.Pending,
            submittedAt: uint64(block.timestamp),
            registeredAt: 0,
            areaSqm: areaSqm,
            location: location,
            surveyNumber: surveyNumber,
            propertyType: propertyType,
            documentCID: documentCID,
            documentHash: documentHash,
            rejectionReason: ""
        });

        _documentHashUsed[documentHash] = true;
        _surveyLocationToId[surveyKey] = id;
        _allIds.push(id);
        _addToOwner(msg.sender, id);
        _pendingCount++;

        emit PropertySubmitted(id, msg.sender, surveyNumber, documentHash);

        _recordSubmissionAndMaybeFlag(msg.sender, id);
    }

    /**
     * @notice Registrar approves a pending property, moving it to `Registered`.
     * @param id Property id. Must currently be `Pending`.
     */
    function approveProperty(uint256 id) external onlyRole(REGISTRAR_ROLE) whenNotPaused {
        Property storage p = _mustExist(id);
        if (p.status != Status.Pending) revert PropertyNotPending(id, p.status);

        p.status = Status.Registered;
        p.registeredAt = uint64(block.timestamp);
        _pendingCount--;
        _registeredCount++;

        emit PropertyApproved(id, msg.sender);
    }

    /**
     * @notice Registrar rejects a pending property with a human-readable reason.
     * @param id Property id. Must currently be `Pending`.
     * @param reason Non-empty explanation shown in the UI and history.
     */
    function rejectProperty(uint256 id, string calldata reason)
        external
        onlyRole(REGISTRAR_ROLE)
        whenNotPaused
    {
        if (bytes(reason).length == 0) revert EmptyField("reason");
        Property storage p = _mustExist(id);
        if (p.status != Status.Pending) revert PropertyNotPending(id, p.status);

        p.status = Status.Rejected;
        p.rejectionReason = reason;
        _pendingCount--;
        _rejectedCount++;

        emit PropertyRejected(id, msg.sender, reason);
    }

    // ----------------------------------------------------------------------
    //  Transfers
    // ----------------------------------------------------------------------

    /**
     * @notice Owner initiates a transfer of a registered property to `buyer`.
     *         The buyer must later call {acceptTransfer} to complete it, so both
     *         parties authorize with their own wallets.
     * @param id Property id. Must be `Registered` and owned by the caller.
     * @param buyer Recipient wallet. Cannot be zero or the current owner.
     */
    function initiateTransfer(uint256 id, address buyer)
        external
        whenNotPaused
    {
        Property storage p = _mustExist(id);
        if (p.owner != msg.sender) revert NotPropertyOwner(id, msg.sender);
        if (p.status != Status.Registered) revert PropertyNotRegistered(id, p.status);
        if (buyer == address(0) || buyer == msg.sender) revert InvalidBuyer(buyer);
        if (_pendingTransfers[id].active) revert TransferAlreadyPending(id);

        _pendingTransfers[id] =
            PendingTransfer({buyer: buyer, initiatedAt: uint64(block.timestamp), active: true});
        _incoming[buyer].push(id);

        emit TransferInitiated(id, msg.sender, buyer);
    }

    /**
     * @notice Named buyer accepts a pending transfer, becoming the new owner.
     *         Appends an immutable record to the property's history.
     * @dev nonReentrant as defence-in-depth even though no external calls are
     *      made; keeps the pattern safe against future changes.
     * @param id Property id with an active pending transfer naming the caller.
     */
    function acceptTransfer(uint256 id) external nonReentrant whenNotPaused {
        Property storage p = _mustExist(id);
        PendingTransfer storage pt = _pendingTransfers[id];
        if (!pt.active) revert NoActivePendingTransfer(id);
        if (pt.buyer != msg.sender) revert NotDesignatedBuyer(id, msg.sender);

        address from = p.owner;
        address to = msg.sender;

        // Move ownership and indexes.
        _removeFromOwner(from, id);
        p.owner = to;
        _addToOwner(to, id);

        // Clear pending transfer.
        delete _pendingTransfers[id];

        // Append permanent history entry.
        _history[id].push(
            TransferRecord({propertyId: id, from: from, to: to, timestamp: uint64(block.timestamp)})
        );

        emit TransferCompleted(id, from, to);
    }

    /**
     * @notice Owner cancels an outstanding pending transfer.
     * @param id Property id with an active pending transfer.
     */
    function cancelTransfer(uint256 id) external whenNotPaused {
        Property storage p = _mustExist(id);
        if (p.owner != msg.sender) revert NotPropertyOwner(id, msg.sender);
        if (!_pendingTransfers[id].active) revert NoActivePendingTransfer(id);

        delete _pendingTransfers[id];
        emit TransferCancelled(id, msg.sender);
    }

    // ----------------------------------------------------------------------
    //  Views
    // ----------------------------------------------------------------------

    /// @notice Returns the full property record. Reverts if the id does not exist.
    function getProperty(uint256 id) external view returns (Property memory) {
        return _mustExistView(id);
    }

    /// @notice Returns the ordered ownership-transfer history for a property.
    function getHistory(uint256 id) external view returns (TransferRecord[] memory) {
        _mustExistView(id);
        return _history[id];
    }

    /// @notice Returns all property ids currently owned by `owner`.
    function getPropertiesByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerProperties[owner];
    }

    /// @notice Returns the pending transfer struct for a property (active flag included).
    function getPendingTransfer(uint256 id) external view returns (PendingTransfer memory) {
        return _pendingTransfers[id];
    }

    /**
     * @notice Returns property ids for which `buyer` has an active incoming
     *         transfer request that still names them as the buyer.
     */
    function getIncomingTransfers(address buyer) external view returns (uint256[] memory) {
        uint256[] storage all = _incoming[buyer];
        uint256 n = all.length;

        uint256 count;
        for (uint256 i; i < n; ++i) {
            PendingTransfer storage pt = _pendingTransfers[all[i]];
            if (pt.active && pt.buyer == buyer) count++;
        }

        uint256[] memory out = new uint256[](count);
        uint256 j;
        for (uint256 i; i < n; ++i) {
            PendingTransfer storage pt = _pendingTransfers[all[i]];
            if (pt.active && pt.buyer == buyer) out[j++] = all[i];
        }
        return out;
    }

    /// @notice True if `account` is the current owner of property `id`.
    function verifyOwner(uint256 id, address account) external view returns (bool) {
        return _properties[id].id != 0 && _properties[id].owner == account;
    }

    /**
     * @notice Verifies a document hash against the one stored on-chain.
     * @return match_ True when `documentHash` matches the stored hash exactly.
     */
    function verifyDocument(uint256 id, bytes32 documentHash)
        external
        view
        returns (bool match_)
    {
        Property storage p = _properties[id];
        if (p.id == 0) revert PropertyNotFound(id);
        return p.documentHash == documentHash;
    }

    /// @notice Total number of properties ever submitted (any status).
    function totalProperties() external view returns (uint256) {
        return _allIds.length;
    }

    /**
     * @notice Paginated list of all property ids ever submitted.
     * @param offset Starting index into the global id array.
     * @param limit Maximum number of ids to return.
     * @return page The requested slice of ids.
     * @return total The total number of ids available.
     */
    function getAllPropertyIds(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory page, uint256 total)
    {
        total = _allIds.length;
        if (offset >= total) {
            return (new uint256[](0), total);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 size = end - offset;
        page = new uint256[](size);
        for (uint256 i; i < size; ++i) {
            page[i] = _allIds[offset + i];
        }
    }

    /// @notice Counts of properties by status.
    function getStats()
        external
        view
        returns (uint256 pending, uint256 registered, uint256 rejected, uint256 total)
    {
        return (_pendingCount, _registeredCount, _rejectedCount, _allIds.length);
    }

    /// @notice Number of submissions `wallet` has made within the rolling 24h window.
    function recentSubmissionCount(address wallet) external view returns (uint256 count) {
        uint64[] storage times = _submissionTimes[wallet];
        uint64 cutoff = block.timestamp > SUBMISSION_WINDOW
            ? uint64(block.timestamp) - SUBMISSION_WINDOW
            : 0;
        for (uint256 i; i < times.length; ++i) {
            if (times[i] >= cutoff) count++;
        }
    }

    // ----------------------------------------------------------------------
    //  Registrar / admin tools
    // ----------------------------------------------------------------------

    /// @notice Admin grants REGISTRAR_ROLE to an account.
    function grantRegistrar(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddressAccount();
        _grantRole(REGISTRAR_ROLE, account);
        emit RegistrarGranted(account, msg.sender);
    }

    /// @notice Admin revokes REGISTRAR_ROLE from an account.
    function revokeRegistrar(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(REGISTRAR_ROLE, account);
        emit RegistrarRevoked(account, msg.sender);
    }

    /// @notice Registrar pauses state-changing user operations (circuit breaker).
    function pause() external onlyRole(REGISTRAR_ROLE) {
        _pause();
    }

    /// @notice Registrar unpauses the system.
    function unpause() external onlyRole(REGISTRAR_ROLE) {
        _unpause();
    }

    // ----------------------------------------------------------------------
    //  Internal helpers
    // ----------------------------------------------------------------------

    function _mustExist(uint256 id) private view returns (Property storage p) {
        p = _properties[id];
        if (p.id == 0) revert PropertyNotFound(id);
    }

    function _mustExistView(uint256 id) private view returns (Property memory p) {
        p = _properties[id];
        if (p.id == 0) revert PropertyNotFound(id);
    }

    function _addToOwner(address owner, uint256 id) private {
        _ownerIndex[id] = _ownerProperties[owner].length;
        _ownerProperties[owner].push(id);
    }

    function _removeFromOwner(address owner, uint256 id) private {
        uint256[] storage arr = _ownerProperties[owner];
        uint256 idx = _ownerIndex[id];
        uint256 lastIdx = arr.length - 1;
        if (idx != lastIdx) {
            uint256 lastId = arr[lastIdx];
            arr[idx] = lastId;
            _ownerIndex[lastId] = idx;
        }
        arr.pop();
        delete _ownerIndex[id];
    }

    /**
     * @dev Records a submission timestamp for `wallet`, prunes entries older than
     *      the rolling window (bounds array growth → DoS consideration), and
     *      emits {FlaggedForReview} when the window count exceeds SUBMISSION_LIMIT.
     */
    function _recordSubmissionAndMaybeFlag(address wallet, uint256 id) private {
        uint64[] storage times = _submissionTimes[wallet];
        uint64 nowTs = uint64(block.timestamp);
        uint64 cutoff = nowTs > SUBMISSION_WINDOW ? nowTs - SUBMISSION_WINDOW : 0;

        // Compact: keep only timestamps within the window, then append now.
        uint256 write;
        uint256 len = times.length;
        for (uint256 i; i < len; ++i) {
            if (times[i] >= cutoff) {
                times[write++] = times[i];
            }
        }
        while (times.length > write) {
            times.pop();
        }
        times.push(nowTs);

        if (times.length > SUBMISSION_LIMIT) {
            emit FlaggedForReview(
                id,
                "Wallet exceeded 3 submissions within 24h window (possible bulk spam)"
            );
        }
    }
}
