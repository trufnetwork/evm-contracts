// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IFunctionsClient {
    function handleOracleFulfillment(bytes32 requestId, bytes memory response, bytes memory err) external;
}

contract MockFunctionsRouter {
    // Mock variables to track state
    bytes32 public lastRequestId;
    bytes public lastRequest;
    uint64 public lastSubscriptionId;
    uint32 public lastGasLimit;
    bytes32 public lastDonId;
    bytes public lastDonHostedSecretsSlotID;
    bytes public lastUserHostedSecretsSlotID;
    bytes32[] public lastArgs;
    bytes public lastSecretsUrl;

    // Mock successful response
    function sendRequest(
        uint64 subscriptionId,
        bytes calldata data,
        uint32 gasLimit,
        bytes32 donId
    ) external returns (bytes32) {
        lastRequestId = keccak256(abi.encodePacked(subscriptionId, data, gasLimit, donId));
        lastRequest = data;
        lastSubscriptionId = subscriptionId;
        lastGasLimit = gasLimit;
        lastDonId = donId;
        
        return lastRequestId;
    }

    // Mock successful response with secrets
    function sendRequestWithSecrets(
        uint64 subscriptionId,
        bytes calldata data,
        uint32 gasLimit,
        bytes32 donId,
        bytes calldata donHostedSecretsSlotID,
        bytes calldata userHostedSecretsSlotID,
        bytes32[] calldata args,
        bytes calldata secretsUrl
    ) external returns (bytes32) {
        lastRequestId = keccak256(abi.encodePacked(subscriptionId, data, gasLimit, donId));
        lastRequest = data;
        lastSubscriptionId = subscriptionId;
        lastGasLimit = gasLimit;
        lastDonId = donId;
        lastDonHostedSecretsSlotID = donHostedSecretsSlotID;
        lastUserHostedSecretsSlotID = userHostedSecretsSlotID;
        lastArgs = args;
        lastSecretsUrl = secretsUrl;
        
        return lastRequestId;
    }

    // Function to simulate fulfillment
    function fulfillRequest(
        address consumer,
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external {
        IFunctionsClient(consumer).handleOracleFulfillment(requestId, response, err);
    }
} 