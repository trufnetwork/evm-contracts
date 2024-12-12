// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "./TNAccessControl.sol";
import {IOracleCallback} from "../../IOracleCallback.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TNFunctionsClient
 * @notice Base contract for managing Chainlink Functions source and request functionality
 */
abstract contract TNFunctionsClient is FunctionsClient, TNAccessControl, ReentrancyGuard {
    using FunctionsRequest for FunctionsRequest.Request;
    using Strings for uint256;

    // ======================= CUSTOM ERRORS =======================
    error GasLimitTooHigh(uint32 provided, uint32 maxAllowed);
    error IdenticalSource(string oldSource, string newSource);
    error IdenticalDonId(bytes32 oldDonId, bytes32 newDonId);
    error IdenticalSubscriptionId(uint64 oldSubId, uint64 newSubId);
    error UnexpectedRequestID(bytes32 requestId, bytes32 lastRequestId);
    error RequestTooStale(bytes32 requestId, uint256 createdAt, uint256 currentTime);
    error RequestNotFound(bytes32 requestId);
    error TooManyArgs(uint256 argsLength);
    // ======================= STATE VARIABLES =======================
    struct PendingRequest {
        bool isPending;
        uint256 createdAt;
        address caller;
    }

    mapping(bytes32 => PendingRequest) private pendingRequests;
    bytes32 public donID;
    uint64 public subscriptionId;
    uint32 private gasLimit = 200000;
    uint32 public constant MAX_GAS_LIMIT = 500000;
    string public source;
    FunctionsRequest.Location public sourceLocation;
    uint256 public stalePeriod = 1 hours;

    // ======================= EVENTS =======================
    event GasLimitUpdated(uint32 newGasLimit);
    event SourceUpdated(string newSource, FunctionsRequest.Location location);
    event DonIdUpdated(bytes32 newDonId);
    event SubscriptionIdUpdated(uint64 newSubscriptionId);
    event Response(bytes32 indexed requestId, bytes response, bytes err);
    event DecodedResponse(bytes32 indexed requestId, string date, int256 value);
    event DecodedResponseError(bytes32 indexed requestId, string error);
    event StalePeriodUpdated(uint256 newStalePeriod);
    event CallbackFailed(bytes32 indexed requestId, address indexed caller);

    // ======================= CONSTRUCTOR =======================
    constructor(address router)
        FunctionsClient(router)
        TNAccessControl(3 days, msg.sender)
    {}

    // ========== SOURCE KEEPER FUNCTIONS ==========

    /**
     * @notice Set the URL where the source code for the Chainlink Function is hosted
     * @param newSource The source code
     * @param location The location of the source code
     */
    function setSource(string calldata newSource, FunctionsRequest.Location location)
        external
        onlyRole(SOURCE_KEEPER_ROLE)
    {
        // checking the source is enough to mitigate
        if (keccak256(bytes(newSource)) == keccak256(bytes(source))) {
            revert IdenticalSource(source, newSource);
        }
        source = newSource;
        sourceLocation = location;

        emit SourceUpdated(newSource, location);
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
            sourceLocation,
            FunctionsRequest.CodeLanguage.JavaScript,
            source
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
            createdAt: block.timestamp,
            caller: msg.sender
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
            createdAt: block.timestamp,
            caller: msg.sender
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
    ) internal virtual override nonReentrant {
        PendingRequest storage req = pendingRequests[requestId];

        if (!req.isPending) {
            revert RequestNotFound(requestId);
        }

        // Check if the request is too old
        if (block.timestamp > req.createdAt + stalePeriod) {
            revert RequestTooStale(requestId, req.createdAt, block.timestamp);
        }

        // Get caller before deleting the request
        address caller = req.caller;

        // Delete request before external call
        delete pendingRequests[requestId];

        // Emit events with the response data
        emit Response(requestId, response, err);

        string memory date = "";
        int256 value = 0;

        // Only decode response if there's no error
        if (err.length == 0 && response.length > 0) {
            (date, value) = abi.decode(response, (string, int256));
            emit DecodedResponse(requestId, date, value);
        } else {
            emit DecodedResponseError(requestId, string(err));
        }

        // Make the callback to caller
        try IOracleCallback(caller).receiveTNData(requestId, date, value, err) {
            // Callback succeeded
        } catch {
            // Callback failed - we still consider the request fulfilled
            // but we emit an event to log the failure
            emit CallbackFailed(requestId, caller);
        }
    }

    /**
     * @notice Sends a Chainlink Functions request to fetch TN data
     * @param requestType The type of data to fetch (passed as uint8)
     * @param decimalsMultiplier The multiplier for decimal precision
     * @param args Arguments for the request
     * @return bytes32 The ID of the sent request
     */
    function requestTNData(
        uint8 requestType,
        uint8 decimalsMultiplier,
        string[] memory args
    ) external virtual returns (bytes32) {
        // we prepend the request type and decimals multiplier to the args
        string[] memory fnArgs = new string[](2 + args.length);
        fnArgs[0] = Strings.toString(requestType);
        fnArgs[1] = Strings.toString(decimalsMultiplier);

        // let's arbitrary limit the number of args to 20, just to be safe
        if (args.length > 20) {
            revert TooManyArgs(args.length);
        }

        // copy the args
        for (uint8 i = 0; i < args.length; i++) {
            // start from 2 because we already prepended arguments
            fnArgs[2 + i] = args[i];
        }
        bytes32 requestId = sendRequest(
            encryptedSecretsUrl,
            0, // no donHostedSecretsSlotID
            0, // no donHostedSecretsVersion
            fnArgs,
            new bytes[](0)
        );
        return requestId;
    }
}
