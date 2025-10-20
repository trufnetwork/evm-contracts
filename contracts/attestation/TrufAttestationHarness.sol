// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {TrufAttestation} from "./TrufAttestation.sol";

contract TrufAttestationHarness {
    using TrufAttestation for bytes;
    using TrufAttestation for TrufAttestation.Attestation;

    function parse(bytes calldata payload) external pure returns (TrufAttestation.Attestation memory) {
        return TrufAttestation.parse(payload);
    }

    function hash(bytes calldata payload) external pure returns (bytes32) {
        return TrufAttestation.hash(payload);
    }

    function verify(bytes calldata payload, address expectedValidator) external pure returns (bool) {
        return TrufAttestation.verify(payload, expectedValidator);
    }

    function decodeDataPoints(bytes calldata payload)
        external
        pure
        returns (TrufAttestation.DataPoint[] memory)
    {
        return TrufAttestation.decodeDataPoints(payload);
    }

    function metadata(bytes calldata payload)
        external
        pure
        returns (uint64, address, bytes32, uint8)
    {
        return TrufAttestation.metadata(payload);
    }

    function body(bytes calldata payload) external pure returns (bytes memory, bytes memory) {
        return TrufAttestation.body(payload);
    }

    function toAction(uint8 actionId) external pure returns (TrufAttestation.Action) {
        return TrufAttestation.toAction(actionId);
    }
}
