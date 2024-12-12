// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "../../IOracleCallback.sol";
import "../TNOracleV1.sol";

// Mock TNConsumer for testing
// This is a simple mock implementation of the TNConsumer contract.
// It is used to simulate the fulfillment of requests and the sending of requests.
// It is not meant to be used in production.

contract MockTNConsumer is IOracleCallback {
    TNOracleV1 public oracle;
    
    bytes32 public lastRequestId;
    string public lastDate;
    int256 public lastValue;
    bytes public lastError;
    
    event DataReceived(bytes32 requestId, string date, int256 value, bytes err);

    constructor(address _oracle) {
        oracle = TNOracleV1(_oracle);
    }

    function receiveTNData(
        bytes32 requestId,
        string calldata date,
        int256 value,
        bytes calldata err
    ) external override {
        require(msg.sender == address(oracle), "Only oracle can callback");
        
        lastRequestId = requestId;
        lastDate = date;
        lastValue = value;
        lastError = err;
        
        emit DataReceived(requestId, date, value, err);
    }

    function requestRecord(
        uint8 decimalsMultiplier,
        string calldata dataProviderAddress,
        string calldata streamId,
        string calldata date
    ) external returns (bytes32) {
        return oracle.requestRecord(
            decimalsMultiplier,
            dataProviderAddress,
            streamId,
            date
        );
    }
} 