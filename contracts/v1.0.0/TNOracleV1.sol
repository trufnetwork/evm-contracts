// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./clib/TNFunctionsClient.sol";
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
contract TNOracleV1 is TNFunctionsClient, Pausable, ITNOracleV1 {
    // ======================= CUSTOM ERRORS =======================
    error IdenticalEncryptedSecretsUrl();

    // ======================= STATE VARIABLES =======================
    bytes public encryptedSecretsUrl;

    // ======================= EVENTS =======================
    event EncryptedSecretsUrlUpdated();

    // ======================= CONSTRUCTOR =======================
    constructor(address router) TNFunctionsClient(router) {}

    // ========== SECRETS KEEPER FUNCTIONS ==========

    /**
     * @notice Set the encrypted secrets URL
     * @param newEncryptedSecretsUrl The new encrypted secrets URL to set
     */
    function setEncryptedSecretsUrl(bytes memory newEncryptedSecretsUrl)
        external
        onlyRole(SECRETS_KEEPER_ROLE)
    {
        // Optimization: short circuit if the length is the same
        if (newEncryptedSecretsUrl.length == encryptedSecretsUrl.length) {
            if (keccak256(newEncryptedSecretsUrl) == keccak256(encryptedSecretsUrl)) {
                revert IdenticalEncryptedSecretsUrl();
            }
        }
        encryptedSecretsUrl = newEncryptedSecretsUrl;
        emit EncryptedSecretsUrlUpdated();
    }

    // ========== PAUSE KEEPER FUNCTIONS ==========

    /**
     * @notice Pause the contract, disabling new requests
     */
    function pause() external onlyRole(PAUSE_KEEPER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract, enabling new requests
     */
    function unpause() external onlyRole(PAUSE_KEEPER_ROLE) {
        _unpause();
    }

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
        string memory dataProviderAddress,
        string memory streamId,
        string memory date
    ) external onlyRole(READER_ROLE) whenNotPaused returns (bytes32) {
        string[] memory args = new string[](3);
        args[0] = dataProviderAddress;
        args[1] = streamId;
        args[2] = date;
        return requestTNData(RequestType.RECORD, decimalsMultiplier, args, encryptedSecretsUrl);
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
        string memory dataProviderAddress,
        string memory streamId,
        string memory date,
        string memory frozen_at, // string so it can be empty
        string memory base_date
    ) external onlyRole(READER_ROLE) whenNotPaused returns (bytes32) {
        string[] memory args = new string[](5);
        args[0] = dataProviderAddress;
        args[1] = streamId;
        args[2] = date;
        args[3] = frozen_at;
        args[4] = base_date;
        return requestTNData(RequestType.INDEX, decimalsMultiplier, args, encryptedSecretsUrl);
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
        string memory dataProviderAddress,
        string memory streamId,
        string memory date,
        string memory frozen_at, // string so it can be empty
        string memory base_date,
        string memory days_interval
    ) external onlyRole(READER_ROLE) whenNotPaused returns (bytes32) {
        string[] memory args = new string[](6);
        args[0] = dataProviderAddress;
        args[1] = streamId;
        args[2] = date;
        args[3] = frozen_at;
        args[4] = base_date;
        args[5] = days_interval;
        return requestTNData(RequestType.INDEX_CHANGE, decimalsMultiplier, args, encryptedSecretsUrl);
    }
}
