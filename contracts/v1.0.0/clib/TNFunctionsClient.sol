// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "./TNAccessControl.sol";

/**
 * @title TNFunctionsClient
 * @notice Base contract for managing Chainlink Functions source and request functionality
 */
abstract contract TNFunctionsClient is FunctionsClient, TNAccessControl {
    using FunctionsRequest for FunctionsRequest.Request;
    using Strings for uint256;

    // ======================= CUSTOM ERRORS =======================
    error GasLimitTooHigh(uint32 provided, uint32 maxAllowed);
    error IdenticalSourceUrl(string oldUrl, string newUrl);
    error IdenticalDonId(bytes32 oldDonId, bytes32 newDonId);
    error IdenticalSubscriptionId(uint64 oldSubId, uint64 newSubId);
    error UnexpectedRequestID(bytes32 requestId, bytes32 lastRequestId);
    error RequestTooStale(bytes32 requestId, uint256 createdAt, uint256 currentTime);
    error RequestNotFound(bytes32 requestId);

    // ======================= STATE VARIABLES =======================
    struct PendingRequest {
        bool isPending;
        uint256 createdAt;
    }

    mapping(bytes32 => PendingRequest) private pendingRequests;
    bytes32 public donID;
    uint64 public subscriptionId;
    uint32 private gasLimit = 200000;
    uint32 public constant MAX_GAS_LIMIT = 500000;
    string public sourceUrl;
    uint256 public stalePeriod = 1 hours;

    // ======================= EVENTS =======================
    event GasLimitUpdated(uint32 newGasLimit);
    event SourceUpdated(string newSource);
    event DonIdUpdated(bytes32 newDonId);
    event SubscriptionIdUpdated(uint64 newSubscriptionId);
    event Response(bytes32 indexed requestId, bytes response, bytes err);
    event DecodedResponse(bytes32 indexed requestId, string date, int256 value);
    event StalePeriodUpdated(uint256 newStalePeriod);

    // ======================= ENUMS =======================
    enum RequestType {
        RECORD,
        INDEX,
        INDEX_CHANGE
    }

    // ======================= CONSTRUCTOR =======================
    constructor(address router)
        FunctionsClient(router)
        TNAccessControl(3 days, msg.sender)
    {}

    // ========== SOURCE KEEPER FUNCTIONS ==========

    /**
     * @notice Set the URL where the source code for the Chainlink Function is hosted
     * @param newSourceUrl The URL pointing to the source code
     */
    function setSourceUrl(string calldata newSourceUrl)
        external
        onlyRole(SOURCE_KEEPER_ROLE)
    {
        if (keccak256(bytes(newSourceUrl)) == keccak256(bytes(sourceUrl))) {
            revert IdenticalSourceUrl(sourceUrl, newSourceUrl);
        }
        sourceUrl = newSourceUrl;
        emit SourceUpdated(newSourceUrl);
    }

    /**
     * @notice Set a new gas limit for Chainlink Function requests
     * @param newGasLimit The new gas limit to set
     */
    function setGasLimit(uint32 newGasLimit) external onlyRole(SOURCE_KEEPER_ROLE) {
        if (newGasLimit > MAX_GAS_LIMIT) {
            revert GasLimitTooHigh(newGasLimit, MAX_GAS_LIMIT);
        }
        gasLimit = newGasLimit;
        emit GasLimitUpdated(newGasLimit);
    }

    /**
     * @notice Set a new DON ID
     * @param newDonId The new DON ID to set
     */
    function setDonId(bytes32 newDonId) external onlyRole(SOURCE_KEEPER_ROLE) {
        if (newDonId == donID) {
            revert IdenticalDonId(donID, newDonId);
        }
        donID = newDonId;
        emit DonIdUpdated(newDonId);
    }

    /**
     * @notice Set a new subscription ID
     * @param newSubscriptionId The new subscription ID to set
     */
    function setSubscriptionId(uint64 newSubscriptionId)
        external
        onlyRole(SOURCE_KEEPER_ROLE)
    {
        if (newSubscriptionId == subscriptionId) {
            revert IdenticalSubscriptionId(subscriptionId, newSubscriptionId);
        }
        subscriptionId = newSubscriptionId;
        emit SubscriptionIdUpdated(newSubscriptionId);
    }

    /**
     * @notice Set the stale period for requests (in seconds)
     * @param newStalePeriod The new stale period in seconds
     */
    function setStalePeriod(uint256 newStalePeriod) external onlyRole(SOURCE_KEEPER_ROLE) {
        stalePeriod = newStalePeriod;
        emit StalePeriodUpdated(newStalePeriod);
    }

    /**
     * @notice Send a simple request
     * @param encryptedSecretsUrls Encrypted URLs where to fetch user secrets
     * @param donHostedSecretsSlotID Don hosted secrets slotId
     * @param donHostedSecretsVersion Don hosted secrets version
     * @param args List of arguments accessible from within the source code
     * @param bytesArgs Array of bytes arguments, represented as hex strings
     * @return requestId The ID of the sent request
     */
    function sendRequest(
        bytes memory encryptedSecretsUrls,
        uint8 donHostedSecretsSlotID,
        uint64 donHostedSecretsVersion,
        string[] memory args,
        bytes[] memory bytesArgs
    ) internal returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequest(
            FunctionsRequest.Location.Remote,
            FunctionsRequest.CodeLanguage.JavaScript,
            sourceUrl
        );
        if (encryptedSecretsUrls.length > 0) {
            req.addSecretsReference(encryptedSecretsUrls);
        } else if (donHostedSecretsVersion > 0) {
            req.addDONHostedSecrets(donHostedSecretsSlotID, donHostedSecretsVersion);
        }
        if (args.length > 0) req.setArgs(args);
        if (bytesArgs.length > 0) req.setBytesArgs(bytesArgs);
        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, gasLimit, donID);

        pendingRequests[requestId] = PendingRequest({
            isPending: true,
            createdAt: block.timestamp
        });

        return requestId;
    }

    /**
     * @notice Send a pre-encoded CBOR request
     * @param request CBOR-encoded request data
     * @return requestId The ID of the sent request
     */
    function sendRequestCBOR(bytes memory request) internal returns (bytes32 requestId) {
        requestId = _sendRequest(request, subscriptionId, gasLimit, donID);

        pendingRequests[requestId] = PendingRequest({
            isPending: true,
            createdAt: block.timestamp
        });

        return requestId;
    }

    /**
     * @notice Callback that is invoked once the DON has resolved the request or hit an error
     * @param requestId The request ID, returned by sendRequest()
     * @param response Aggregated response from the user code
     * @param err Aggregated error from the user code or from the execution pipeline
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal virtual override {
        PendingRequest storage req = pendingRequests[requestId];

        if (!req.isPending) {
            revert RequestNotFound(requestId);
        }

        // Check if the request is too old
        if (block.timestamp > req.createdAt + stalePeriod) {
            revert RequestTooStale(requestId, req.createdAt, block.timestamp);
        }

        // Mark as fulfilled by removing from pending
        delete pendingRequests[requestId];

        // Emit events with the response data
        emit Response(requestId, response, err);

        if (response.length > 0) {
            _handleResponse(requestId, response);
        }
    }

    /**
     * @notice Internal function to handle and decode the response
     * @param requestId The request ID
     * @param response The response data to decode
     */
    function _handleResponse(bytes32 requestId, bytes memory response) internal virtual {
        (string memory date, int256 value) = abi.decode(response, (string, int256));
        emit DecodedResponse(requestId, date, value);
    }

    /**
     * @notice Sends a Chainlink Functions request to fetch TN data
     * @param requestType The type of data to fetch
     * @param args Arguments for the request
     * @param encryptedSecretsUrl The encrypted secrets URL to use
     * @return bytes32 The ID of the sent request
     */
    function requestTNData(
        RequestType requestType,
        uint8 decimalsMultiplier,
        string[] memory args,
        bytes memory encryptedSecretsUrl
    ) internal virtual returns (bytes32) {
        // we prepend the request type and decimals multiplier to the args
        string[] memory fnArgs = new string[](2 + args.length);
        fnArgs[0] = requestTypeToString(requestType);
        fnArgs[1] = Strings.toString(decimalsMultiplier);

        // copy the args
        for (uint8 i = 0; i < args.length; i++) {
            // start from 2 because we already prepended arguments
            fnArgs[2 + i] = args[i];
        }
        bytes[] memory bytesArgs = new bytes[](0);
        bytes32 requestId = sendRequest(
            encryptedSecretsUrl,
            0, // no donHostedSecretsSlotID
            0, // no donHostedSecretsVersion
            fnArgs,
            bytesArgs
        );
        return requestId;
    }

    // ======================= UTILITY FUNCTIONS =======================

    /**
     * @dev Saves gas by converting a RequestType to a string, without using a library
     *
     * @notice Convert a RequestType to a string
     * @param requestType The type of data to fetch
     * @return string The string representation of the request type
     */
    function requestTypeToString(RequestType requestType) internal pure returns (string memory) {
        if (requestType == RequestType.RECORD) {
            return "0";
        } else if (requestType == RequestType.INDEX) {
            return "1";
        } else {
            return "2";
        }
    }
}
