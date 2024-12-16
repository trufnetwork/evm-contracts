// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {TNFunctionsClient} from "./clib/TNFunctionsClient.sol";
import { ITNOracleV1 } from "./ITNOracleV1.sol";

/**
 * @title TNOracleV1
 * @notice This contract manages Chainlink Functions requests with role-based access control
 *
 * @dev Role Structure:
 * - SOURCE_KEEPER_ROLE: Manages core functionality (source code, gas limits, DON settings)
 * - SECRETS_KEEPER_ROLE: Manages sensitive data and secrets
 * - PAUSE_KEEPER_ROLE: Controls contract pause state
 * - WHITELIST_KEEPER_ROLE: Manages whitelist of addresses with READER_ROLE
 * - READER_ROLE: Access to request functions, read responses and errors
 *
 * This contract may be paused. Pausing means that the contract will not be able to send any new requests.
 */
contract TNOracleV1 is TNFunctionsClient, ITNOracleV1 {
    // ======================= ENUMS =======================
    /**
     * @dev RequestType is used to specify the type of data to fetch.
     * The requestTNData function from TNFunctionsClient can be called directly with custom 
     * request types if the deployed source code supports them. The following enum values
     * represent the standard request types, but are not exhaustive.
     */
    enum RequestType {
        RECORD,
        INDEX,
        INDEX_CHANGE
    }

    // ======================= CONSTRUCTOR =======================
    constructor(address router) TNFunctionsClient(router) {}



    // ========== READER FUNCTIONS ==========
    /**
     * @notice Request a record from TN
     * @param decimalsMultiplier The decimals multiplier. TN provides decimals, so we normalize with Result * 10^decimals
     * @param dataProviderAddress The address of the data provider
     * @param streamId The ID of the data stream
     * @param date The date to fetch data for
     * @return bytes32 The ID of the sent request
     */
    function requestRecord(
        uint8 decimalsMultiplier,
        string calldata dataProviderAddress,
        string calldata streamId,
        string calldata date
    ) external onlyRole(READER_ROLE) whenNotPaused returns (bytes32) {
        string[] memory args = new string[](3);
        args[0] = dataProviderAddress;
        args[1] = streamId;
        args[2] = date;
        return requestTNData(uint8(RequestType.RECORD), decimalsMultiplier, args);
    }

    /**
     * @notice Request an index from TN
     * @param decimalsMultiplier The decimals multiplier. TN provides decimals, so we normalize with Result * 10^decimals
     * @param dataProviderAddress The address of the data provider
     * @param streamId The ID of the data stream
     * @param date The date to fetch data for
     * @param frozen_at The frozen at block number
     * @param base_date The base date
     * @return bytes32 The ID of the sent request
     */
    function requestIndex(
        uint8 decimalsMultiplier,
        string calldata dataProviderAddress,
        string calldata streamId,
        string calldata date,
        string calldata frozen_at, // string so it can be empty
        string calldata base_date
    ) external onlyRole(READER_ROLE) whenNotPaused returns (bytes32) {
        string[] memory args = new string[](5);
        args[0] = dataProviderAddress;
        args[1] = streamId;
        args[2] = date;
        args[3] = frozen_at;
        args[4] = base_date;
        return requestTNData(uint8(RequestType.INDEX), decimalsMultiplier, args);
    }

    /**
     * @notice Request an index change over time from TN
     * @param decimalsMultiplier The decimals multiplier. TN provides decimals, so we normalize with Result * 10^decimals
     * @param dataProviderAddress The address of the data provider
     * @param streamId The ID of the data stream
     * @param date The date to fetch data for
     * @param frozen_at The frozen at block number (can be empty)
     * @param base_date The base date (can be empty)
     * @param days_interval The days interval
     * @return bytes32 The ID of the sent request
     */
    function requestIndexChange(
        uint8 decimalsMultiplier,
        string calldata dataProviderAddress,
        string calldata streamId,
        string calldata date,
        string calldata frozen_at,
        string calldata base_date,
        string calldata days_interval
    ) external onlyRole(READER_ROLE) whenNotPaused returns (bytes32) {
        string[] memory args = new string[](6);
        args[0] = dataProviderAddress;
        args[1] = streamId;
        args[2] = date;
        args[3] = frozen_at;
        args[4] = base_date;
        args[5] = days_interval;
        return requestTNData(uint8(RequestType.INDEX_CHANGE), decimalsMultiplier, args);
    }
}
