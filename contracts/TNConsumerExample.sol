// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";


/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES HARDCODED VALUES FOR CLARITY.
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract TNConsumerExample is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    error UnexpectedRequestID(bytes32 requestId);

    event Response(bytes32 indexed requestId, bytes response, bytes err);

    bytes public encryptedSecretsUrl;

    string public source = "";

    bytes32 public donID;
    uint64 public subscriptionId;

    // State variable for gasLimit
    uint32 private gasLimit = 200000;

    // Maximum allowed gas limit
    uint32 public constant MAX_GAS_LIMIT = 500000;

    event GasLimitUpdated(uint32 newGasLimit);
    event SourceUpdated(string newSource);
    event EncryptedSecretsUrlUpdated();
    event DonIdUpdated(bytes32 newDonId);
    event SubscriptionIdUpdated(uint64 newSubscriptionId);


    constructor(
        address router
    ) FunctionsClient(router) ConfirmedOwner(msg.sender) {}


    /**
     * @notice Allows the owner to update the gas limit within predefined bounds
     * @param newGasLimit The new gas limit to set
     */
    function setGasLimit(uint32 newGasLimit) external onlyOwner {
        require(newGasLimit <= MAX_GAS_LIMIT, "Gas limit exceeds maximum allowed");
        gasLimit = newGasLimit;
        emit GasLimitUpdated(newGasLimit);
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
    ) private returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        if (encryptedSecretsUrls.length > 0)
            req.addSecretsReference(encryptedSecretsUrls);
        else if (donHostedSecretsVersion > 0) {
            req.addDONHostedSecrets(
                donHostedSecretsSlotID,
                donHostedSecretsVersion
            );
        }
        if (args.length > 0) req.setArgs(args);
        if (bytesArgs.length > 0) req.setBytesArgs(bytesArgs);
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donID
        );
        return s_lastRequestId;
    }

    /**
     * @notice Send a pre-encoded CBOR request
     * @param request CBOR-encoded request data
     * @return requestId The ID of the sent request
     */
    function sendRequestCBOR(
        bytes memory request
    ) private returns (bytes32 requestId) {
        s_lastRequestId = _sendRequest(
            request,
            subscriptionId,
            gasLimit,
            donID
        );
        return s_lastRequestId;
    }

    /**
     * @notice Callback that is invoked once the DON has resolved the request or hit an error
     *
     * @param requestId The request ID, returned by sendRequest()
     * @param response Aggregated response from the user code
     * @param err Aggregated error from the user code or from the execution pipeline
     * Either response or error parameter will be set, but never both
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId);
        }
        s_lastResponse = response;
        s_lastError = err;
        emit Response(requestId, s_lastResponse, s_lastError);
    }

    /**
     * @notice Sends a Chainlink Functions request to fetch TN data
     * @param dataProviderAddress The address of the data provider
     * @param streamId The ID of the data stream
     * @param date The date to fetch data for
     * @return bytes32 The ID of the sent request
     */
    function requestTNData(
        string calldata dataProviderAddress,
        string calldata streamId, 
        string calldata date
    ) external onlyOwner returns (bytes32) {
        string[] memory args = new string[](3);
        args[0] = dataProviderAddress;
        args[1] = streamId;
        args[2] = date;

        bytes[] memory bytesArgs = new bytes[](0); // Adjust as needed

        // Send the request using the now-private sendRequest function
        bytes32 requestId = sendRequest(
            encryptedSecretsUrl, 
            0,  // donHostedSecretsSlotID if any
            0,  // donHostedSecretsVersion if any
            args,
            bytesArgs
        );
        s_lastRequestId = requestId;
        return requestId;
    }

    /**
     * @notice Get the latest response
     * @return bytes Latest response received
     */
    function getLatestResponse() public view returns (bytes memory) {
        return s_lastResponse;
    }

    /**
     * @notice Get the latest error
     * @return bytes Latest error received
     */
    function getLatestError() public view returns (bytes memory) {
        return s_lastError;
    }

    /**
     * @notice Set the source code for the Chainlink Function
     * @param newSource Updated source code
     */
    function setSource(string calldata newSource) external onlyOwner {
        source = newSource;
        emit SourceUpdated(newSource);
    }

    /**
     * @notice Set the encrypted secrets URL
     * @param newEncryptedSecretsUrl The encrypted secrets URL
     */
    function setEncryptedSecretsUrl(bytes calldata newEncryptedSecretsUrl) external onlyOwner {
        encryptedSecretsUrl = newEncryptedSecretsUrl;
        emit EncryptedSecretsUrlUpdated();
    }

    function setDonId(bytes32 newDonId) external onlyOwner {
        donID = newDonId;
        emit DonIdUpdated(newDonId);
    }

    function setSubscriptionId(uint64 newSubscriptionId) external onlyOwner {
        subscriptionId = newSubscriptionId;
        emit SubscriptionIdUpdated(newSubscriptionId);
    }
}
