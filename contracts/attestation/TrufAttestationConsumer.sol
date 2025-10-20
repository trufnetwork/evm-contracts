// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {TrufAttestation} from "./TrufAttestation.sol";

/// @title TrufAttestationConsumer
/// @notice Example contract that verifies TrufNetwork attestations and stores the latest datapoint.
contract TrufAttestationConsumer {
    using TrufAttestation for bytes;
    using TrufAttestation for TrufAttestation.Attestation;

    error AttestationConsumerInvalidSigner(address expected);
    error AttestationConsumerEmptyResult();
    error AttestationConsumerOnlyOwner();
    error AttestationConsumerLeaderNotSet();

    address public owner;
    address public leader;
    address public lastValidator;
    uint64 public lastBlockHeight;
    bytes32 public lastStreamId;
    uint8 public lastActionId;
    uint256 public lastTimestamp;
    int256 public lastValue;

    event AttestationConsumed(
        address indexed validator,
        uint64 blockHeight,
        bytes32 indexed streamId,
        uint8 actionId,
        uint256 timestamp,
        int256 value
    );

    event LeaderUpdated(address indexed leader);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Set the expected validator address. Example only; wire into governance in production.
    function setLeader(address newLeader) external {
        if (msg.sender != owner) revert AttestationConsumerOnlyOwner();
        leader = newLeader;
        emit LeaderUpdated(newLeader);
    }

    /// @notice Verify an attestation payload against the stored leader and persist the latest datapoint.
    /// @param payload Signed attestation bytes produced by the TrufNetwork node.
    function consume(bytes calldata payload) external {
        address expectedValidator = leader;
        if (expectedValidator == address(0)) revert AttestationConsumerLeaderNotSet();

        TrufAttestation.Attestation memory att = payload.parse();

        if (!att.verify(expectedValidator)) {
            revert AttestationConsumerInvalidSigner(expectedValidator);
        }

        TrufAttestation.DataPoint[] memory points = TrufAttestation.decodeDataPoints(att);
        if (points.length == 0) revert AttestationConsumerEmptyResult();

        TrufAttestation.DataPoint memory latest = points[points.length - 1];

        lastValidator = expectedValidator;
        lastBlockHeight = att.blockHeight;
        lastStreamId = att.streamId;
        lastActionId = att.actionId;
        lastTimestamp = latest.timestamp;
        lastValue = latest.value;

        emit AttestationConsumed(expectedValidator, att.blockHeight, att.streamId, att.actionId, latest.timestamp, latest.value);
    }
}
