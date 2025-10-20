// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title TrufAttestation
/// @notice Parses and validates attestation payloads produced by the TrufNetwork node.
/// @dev Payloads follow the canonical encoding generated in the node repository. View the
///      Go migration `024-attestation-actions.sql` for the authoritative format.
library TrufAttestation {
    /// @dev Length in bytes of the appended ECDSA signature.
    uint256 private constant SIGNATURE_LENGTH = 65;
    /// @dev Currently supported canonical payload version.
    uint8 public constant VERSION_V1 = 1;
    /// @dev Only secp256k1 signatures are supported in v1 payloads.
    uint8 public constant ALGORITHM_SECP256K1 = 0;

    /// @dev Enumeration of query actions currently allow-listed for attestations.
    enum Action {
        NONE,
        GET_RECORD,
        GET_INDEX,
        GET_CHANGE_OVER_TIME,
        GET_LAST_RECORD,
        GET_FIRST_RECORD
    }

    /// @dev Convenience constants that mirror the `Action` enum.
    uint8 public constant ACTION_GET_RECORD = uint8(Action.GET_RECORD);
    uint8 public constant ACTION_GET_INDEX = uint8(Action.GET_INDEX);
    uint8 public constant ACTION_GET_CHANGE_OVER_TIME = uint8(Action.GET_CHANGE_OVER_TIME);
    uint8 public constant ACTION_GET_LAST_RECORD = uint8(Action.GET_LAST_RECORD);
    uint8 public constant ACTION_GET_FIRST_RECORD = uint8(Action.GET_FIRST_RECORD);

    /// @notice Emitted when the payload structure does not match the canonical encoding.
    error AttestationInvalidLength();
    /// @notice Emitted when the signature appended to the payload is not 65 bytes.
    error AttestationInvalidSignatureLength();
    /// @notice Emitted when the attestation algorithm byte is not recognised.
    error AttestationInvalidAlgorithm(uint8 algorithm);
    /// @notice Emitted when an attestation version is not supported by this library.
    error AttestationUnsupportedVersion(uint8 version);
    /// @notice Emitted when the canonical data provider is not a 20-byte address.
    error AttestationUnexpectedDataProviderLength(uint256 length);
    /// @notice Emitted when the canonical stream identifier is not 32 bytes.
    error AttestationUnexpectedStreamLength(uint256 length);
    /// @notice Emitted when an action identifier falls outside the enum bounds.
    error AttestationUnexpectedActionId(uint16 actionId);
    /// @notice Emitted when decoded datapoint arrays have mismatched lengths.
    error AttestationArrayLengthMismatch();

    /// @notice Structured representation of an attestation payload (canonical bytes + signature).
    /// @dev The `actionId` maps to the `Action` enum; callers can use {toAction} for a safe cast.
    struct Attestation {
        uint8 version;
        uint8 algorithm;
        uint64 blockHeight;
        address dataProvider;
        bytes32 streamId;
        uint8 actionId;
        bytes args;
        bytes result;
        bytes signature;
    }

    /// @notice Canonical output datapoints decoded from `att.result`.
    struct DataPoint {
        uint256 timestamp;
        int256 value;
    }

    /// @notice Parse a raw attestation payload into its structured representation.
    /// @param payload Signed attestation bytes (`canonical || signature`).
    /// @return att Structured attestation.
    function parse(bytes calldata payload) internal pure returns (Attestation memory att) {
        if (payload.length <= SIGNATURE_LENGTH) revert AttestationInvalidLength();

        uint256 canonicalLength = payload.length - SIGNATURE_LENGTH;
        bytes memory canonical = new bytes(canonicalLength);
        bytes memory signature = new bytes(SIGNATURE_LENGTH);
        assembly {
            calldatacopy(add(canonical, 0x20), payload.offset, canonicalLength)
            calldatacopy(add(signature, 0x20), add(payload.offset, canonicalLength), SIGNATURE_LENGTH)
        }

        att.signature = signature;

        uint256 offset;
        att.version = uint8(canonical[offset]);
        offset += 1;
        if (att.version != VERSION_V1) revert AttestationUnsupportedVersion(att.version);

        att.algorithm = uint8(canonical[offset]);
        offset += 1;
        if (att.algorithm != ALGORITHM_SECP256K1) revert AttestationInvalidAlgorithm(att.algorithm);

        att.blockHeight = _readUint64(canonical, offset);
        offset += 8;

        (bytes memory providerBytes, uint256 nextOffset) = _readLengthPrefixed(canonical, offset);
        offset = nextOffset;
        if (providerBytes.length != 20) revert AttestationUnexpectedDataProviderLength(providerBytes.length);
        att.dataProvider = _bytesToAddress(providerBytes);

        bytes memory streamBytes;
        (streamBytes, offset) = _readLengthPrefixed(canonical, offset);
        if (streamBytes.length != 32) revert AttestationUnexpectedStreamLength(streamBytes.length);
        att.streamId = _bytesToBytes32(streamBytes);

        uint16 rawAction = _readUint16(canonical, offset);
        offset += 2;
        att.actionId = _normalizeActionId(rawAction);

        (att.args, offset) = _readLengthPrefixed(canonical, offset);
        (att.result, offset) = _readLengthPrefixed(canonical, offset);

        if (offset != canonical.length) revert AttestationInvalidLength();

        return att;
    }

    /// @notice Verify that an attestation was signed by the expected validator.
    /// @param att Structured attestation.
    /// @param expectedValidator Address the caller trusts as the signer.
    /// @return True if the signature matches `expectedValidator`.
    function verify(Attestation memory att, address expectedValidator) internal pure returns (bool) {
        if (att.signature.length != SIGNATURE_LENGTH) revert AttestationInvalidSignatureLength();
        if (att.algorithm != ALGORITHM_SECP256K1) revert AttestationInvalidAlgorithm(att.algorithm);

        bytes32 digest = hash(att);
        address recovered = ECDSA.recover(digest, att.signature);
        return recovered == expectedValidator;
    }

    /// @notice Parse and verify a raw payload.
    function verify(bytes calldata payload, address expectedValidator) internal pure returns (bool) {
        return verify(parse(payload), expectedValidator);
    }

    /// @notice Compute the canonical hash for an attestation.
    function hash(Attestation memory att) internal pure returns (bytes32) {
        bytes memory canonical = _encodeCanonical(att);
        return sha256(canonical);
    }

    /// @notice Parse and hash a raw payload.
    function hash(bytes calldata payload) internal pure returns (bytes32) {
        return hash(parse(payload));
    }

    /// @notice Decode datapoints from the canonical result bytes.
    function decodeDataPoints(Attestation memory att) internal pure returns (DataPoint[] memory) {
        (uint256[] memory timestamps, int256[] memory values) = abi.decode(att.result, (uint256[], int256[]));
        if (timestamps.length != values.length) revert AttestationArrayLengthMismatch();

        DataPoint[] memory points = new DataPoint[](timestamps.length);
        for (uint256 i = 0; i < timestamps.length; ++i) {
            points[i] = DataPoint({timestamp: timestamps[i], value: values[i]});
        }
        return points;
    }

    /// @notice Parse and decode datapoints from a raw payload.
    function decodeDataPoints(bytes calldata payload) internal pure returns (DataPoint[] memory) {
        return decodeDataPoints(parse(payload));
    }

    /// @notice Extract commonly used metadata fields from an attestation.
    /// @return blockHeight Block height the attestation was produced at.
    /// @return dataProvider 20-byte provider address.
    /// @return streamId 32-byte stream identifier.
    /// @return actionId Raw action identifier.
    function metadata(Attestation memory att)
        internal
        pure
        returns (uint64, address, bytes32, uint8)
    {
        return (att.blockHeight, att.dataProvider, att.streamId, att.actionId);
    }

    /// @notice Parse and extract metadata from a raw payload.
    function metadata(bytes calldata payload)
        internal
        pure
        returns (uint64, address, bytes32, uint8)
    {
        return metadata(parse(payload));
    }

    /// @notice Return the encoded args/result blobs from an attestation.
    function body(Attestation memory att) internal pure returns (bytes memory, bytes memory) {
        return (att.args, att.result);
    }

    /// @notice Parse and return the encoded args/result blobs from a raw payload.
    function body(bytes calldata payload) internal pure returns (bytes memory, bytes memory) {
        return body(parse(payload));
    }

    /// @notice Convert an action identifier to the enum representation.
    /// @dev Reverts if `actionId` is out of range.
    function toAction(uint8 actionId) internal pure returns (Action) {
        return Action(_requireKnownActionId(actionId));
    }

    /// @notice Convert the action identifier from a structured attestation.
    function toAction(Attestation memory att) internal pure returns (Action) {
        return toAction(att.actionId);
    }

    function _encodeCanonical(Attestation memory att) private pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(att.version),
            bytes1(att.algorithm),
            bytes8(att.blockHeight),
            _lengthPrefix(abi.encodePacked(att.dataProvider)),
            _lengthPrefix(abi.encodePacked(att.streamId)),
            bytes2(uint16(att.actionId)),
            _lengthPrefix(att.args),
            _lengthPrefix(att.result)
        );
    }

    function _lengthPrefix(bytes memory data) private pure returns (bytes memory) {
        return abi.encodePacked(bytes4(uint32(data.length)), data);
    }

    function _readLengthPrefixed(bytes memory data, uint256 offset) private pure returns (bytes memory chunk, uint256 next) {
        if (data.length < offset + 4) revert AttestationInvalidLength();
        uint256 length;
        assembly {
            length := shr(224, mload(add(add(data, 0x20), offset)))
        }
        offset += 4;

        if (data.length < offset + length) revert AttestationInvalidLength();
        chunk = new bytes(length);
        for (uint256 i; i < length; ) {
            chunk[i] = data[offset + i];
            unchecked {
                ++i;
            }
        }
        next = offset + length;
    }

    function _readUint16(bytes memory data, uint256 offset) private pure returns (uint16 result) {
        if (data.length < offset + 2) revert AttestationInvalidLength();
        assembly {
            result := shr(240, mload(add(add(data, 0x20), offset)))
        }
    }

    function _readUint64(bytes memory data, uint256 offset) private pure returns (uint64 result) {
        if (data.length < offset + 8) revert AttestationInvalidLength();
        assembly {
            result := shr(192, mload(add(add(data, 0x20), offset)))
        }
    }

    function _bytesToAddress(bytes memory data) private pure returns (address addr) {
        if (data.length != 20) revert AttestationUnexpectedDataProviderLength(data.length);
        assembly {
            addr := shr(96, mload(add(data, 0x20)))
        }
    }

    function _bytesToBytes32(bytes memory data) private pure returns (bytes32 result) {
        if (data.length != 32) revert AttestationUnexpectedStreamLength(data.length);
        assembly {
            result := mload(add(data, 0x20))
        }
    }

    function _normalizeActionId(uint16 raw) private pure returns (uint8) {
        if (raw == 0 || raw > type(uint8).max) revert AttestationUnexpectedActionId(raw);
        return uint8(raw);
    }

    function _requireKnownActionId(uint8 actionId) private pure returns (uint8) {
        if (actionId == 0 || actionId > uint8(type(Action).max)) revert AttestationUnexpectedActionId(uint16(actionId));
        return actionId;
    }
}
