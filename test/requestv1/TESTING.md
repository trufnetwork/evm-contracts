# Testing and Coverage

**Purpose**  
We test to ensure the reliability, security, and correctness of the TNOracle contracts. Our goal is to validate core functionality, role-based controls, configuration management, and data retrieval logic. We also verify that off-chain computations and interactions with the Chainlink Functions local testnet behave as intended.

**What We Test**  
- **Access Control & Roles**: Confirmed that only addresses with proper roles (SOURCE_KEEPER, SECRETS_KEEPER, PAUSE_KEEPER, WHITELIST_KEEPER, READER) can perform sensitive operations.  
- **Configuration Management**: Ensured correct handling of parameters like `gasLimit`, `donID`, and `subscriptionId`, as well as updating encrypted secrets and source code URLs.  
- **Pause/Unpause Logic**: Verified that pausing halts new requests and unpausing restores normal operation.  
- **Data Requests & Callbacks**: Simulated the full lifecycle of data requests using the Chainlink Local Functions testnet. Confirmed that requests are properly routed, responses are decoded, and callbacks to requesters are handled correctly, including error cases.  
- **Off-Chain Logic Simulation**: Used `simulateScript` to test the JavaScript-based off-chain computations. Verified correct date handling, scaling, and error reporting for invalid inputs.

**Known Limitations**  
- **Coverage Reporting**:  
  Currently, we cannot run Hardhat coverage due to incompatibilities with the Chainlink Local Functions testnet (see [this similar issue](https://github.com/smartcontractkit/functions-hardhat-starter-kit/issues/196)).