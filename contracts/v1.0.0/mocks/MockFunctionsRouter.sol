// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IFunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsClient.sol";

contract MockFunctionsRouter {
    event RequestSimulated(bytes32 indexed id);

    function mockFulfill(
        IFunctionsClient client,
        bytes32 requestId,
        bytes calldata response,
        bytes calldata err
    ) external {
        client.handleOracleFulfillment(requestId, response, err);
    }

    function sendRequest(
        uint64 subscriptionId,
        bytes calldata data,
        uint16 dataVersion,
        uint32 callbackGasLimit,
        bytes32 donId
    ) external returns (bytes32) {
        bytes32 requestId = keccak256(abi.encodePacked(subscriptionId, data, block.timestamp));
        emit RequestSimulated(requestId);
        return requestId;
    }
} 