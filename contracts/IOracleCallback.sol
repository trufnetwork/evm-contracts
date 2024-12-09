// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

interface IOracleCallback {
    /**
     * @notice Callback function that receives TN data
     * @param requestId The ID of the original request
     * @param date The date of the data point
     * @param value The value returned
     * @param err Any error that occurred during the request
     */
    function receiveTNData(
        bytes32 requestId, 
        string calldata date, 
        int256 value,
        bytes calldata err
    ) external;
} 