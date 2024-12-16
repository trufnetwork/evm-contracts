# Developer Guide

## About our contracts

### TNOracle

The `TNOracle` contract is designed to retrieve data from Trufnetwork (TN) streams via Chainlink Functions. It acts as a bridge between off-chain TN data and on-chain smart contracts, providing a secure and decentralized way to access TN data.

Key features:
- Role-based access control for data requests
- Configurable Chainlink Functions parameters
- Prevention of stale data requests
- Standardized callback interface for data delivery

#### Usage: Developing a TNConsumer

To integrate TN data into your smart contracts, follow these steps:

1. **Get Whitelisted**
   Contact our team to whitelist your consumer contract address. Your contract needs the `READER_ROLE` to make requests.

2. **Implement the Interface**
    ```solidity
    import "./IOracleCallback.sol";

    contract YourConsumer is IOracleCallback {
        function receiveTNData(
            uint256 date,
            int256 value,
            bytes memory error
        ) external override {
            // Handle the received data
        }
    }   
    ```

3. **Make Requests**
    ```solidity
    // From your consumer contract
    function requestData(
        uint256 decimalsMultiplier,
        address dataProviderAddress,
        bytes32 streamId,
        uint256 date
    ) external {
        tnOracle.requestRecord(
            decimalsMultiplier,
            dataProviderAddress,
            streamId,
            date
        );
    }   
    ```

### TNClientExample

The TNClientExample contract serves as a reference implementation demonstrating how to interact with Chainlink Functions. While our TNOracle provides a standardized interface for single-value queries, you could create your own implementation using Chainlink Functions for custom data retrieval patterns.

Key differences from TNOracle:
- Simplified, hardcoded example
- Direct Chainlink Functions integration
- No role-based access control
- Single stream focus

For custom implementations, we recommend reviewing the [Chainlink Functions documentation](https://docs.chain.link/chainlink-functions).

## Tasks Overview

Our Hardhat tasks are organized into three main categories:

### Oracle Tasks (`pnpm hardhat oracle`)
Tasks for managing the TNOracle contract:
- Admin operations (pause/unpause, roles management)
- Configuration (DON ID, subscription ID, gas limits)
- Request functions (record, index, index change)

### Example Tasks (`pnpm hardhat example`)
Tasks for interacting with the TNClientExample contract:
- Set contract variables
- Request TN data

### Utility Tasks (`pnpm hardhat utils`)
Development and configuration utilities:
- Build source code
- Encrypt secrets and URLs

For detailed information about available tasks and their arguments, use the `--help` flag:
```bash
pnpm hardhat oracle --help
pnpm hardhat example --help
pnpm hardhat utils --help
```

## Deploying Contracts

### TNOracle Deployment
For deploying and configuring the TNOracle contract, see [TNOracle deployment guide](contracts/v1.0.0/TNOracle.md). This includes:
- Setting up roles
- Configuring Chainlink Functions parameters
- Managing subscriptions
- Setting source code references

### TNClientExample Deployment
For deploying the example consumer contract, refer to [TNClientExample guide](contracts/example/README.md). This covers:
- Basic deployment steps
- Testing data requests
- Subscription management
- Example configurations

## Best Practices

1. **Testing**
   - Always test on testnets (e.g., Sepolia) before mainnet
   - Use the provided simulation tools
   - Verify callback handling for both success and error cases

2. **Security**
   - Carefully manage role assignments
   - Implement proper access control in your consumer
   - Validate received data before use
   - Consider implementing request rate limiting

3. **Gas Optimization**
   - Batch requests when possible
   - Store only essential data on-chain
   - Consider using events for data logging

4. **Error Handling**
   - Always check the error parameter in callbacks
   - Implement proper fallback mechanisms
   - Log significant errors for monitoring

## Support

For technical support or questions about integration:
- Review our documentation
- Join our developer community
- Contact our team for whitelisting and advanced support

Remember that while TNOracle provides a standardized way to access TN data, you can also create custom implementations using Chainlink Functions directly if you need different data formats or computation patterns.

You can also interact directly with the TNOracle contract using your Externally Owned Account (EOA). This could be useful for testing or for making requests from a script.