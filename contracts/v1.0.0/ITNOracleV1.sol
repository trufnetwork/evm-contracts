// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

/**
 * @title ITNOracleV1
 * @notice Interface for external contracts to interact with TNOracle
 */
interface ITNOracleV1 {
    /**
     * @notice Request a record from TN
     * @param decimalsMultiplier The decimals multiplier. TN provides decimals, so we normalize with Result * 10^decimals
     * @param dataProviderAddress The address of the data provider
     * @param streamId The ID of the data stream
     * @param date The date to fetch data for
     * @return bytes32 The request ID
     */
    function requestRecord(
        uint8 decimalsMultiplier,
        string calldata dataProviderAddress,
        string calldata streamId,
        string calldata date
    ) external returns (bytes32);

    /**
     * @notice Request an index from TN
     * @param decimalsMultiplier The decimals multiplier. TN provides decimals, so we normalize with Result * 10^decimals
     * @param dataProviderAddress The address of the data provider
     * @param streamId The ID of the data stream
     * @param date The date to fetch data for
     * @param frozen_at The frozen at block number
     * @param base_date The base date
     * @return bytes32 The request ID
     */
    function requestIndex(
        uint8 decimalsMultiplier,
        string calldata dataProviderAddress,
        string calldata streamId,
        string calldata date,
        string calldata frozen_at,
        string calldata base_date
    ) external returns (bytes32);

    /**
     * @notice Request an index change over time from TN
     * @param decimalsMultiplier The decimals multiplier. TN provides decimals, so we normalize with Result * 10^decimals
     * @param dataProviderAddress The address of the data provider
     * @param streamId The ID of the data stream
     * @param date The date to fetch data for
     * @param frozen_at The frozen at block number
     * @param base_date The base date
     * @param days_interval The days interval
     * @return bytes32 The request ID
     */
    function requestIndexChange(
        uint8 decimalsMultiplier,
        string calldata dataProviderAddress,
        string calldata streamId,
        string calldata date,
        string calldata frozen_at,
        string calldata base_date,
        string calldata days_interval
    ) external returns (bytes32);
}