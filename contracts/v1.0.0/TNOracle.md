# TNOracle Documentation

## Lifecycle

### Deployment & Configuration

1. Deploy contract using hardhat ignition and set roles.
  ```bash
  # example for sepolia
  pnpm hardhat ignition deploy ignition/modules/TNOracleV1.ts --parameters ignition/sepolia_parameters.json --network sepolia --verify
  ```
2. Configure parameters (URLs, DON ID, etc.)
  ```bash
  contract=<contract-address>
  network=sepolia
  url=
  proxyUrl=
  secretsUrl=
  myAddress=
  subscriptionId=
  donId=

  pnpm hardhat oracle grantReader --contract $contract --network $network --address $myAddress
  pnpm hardhat oracle setGasLimit --contract $contract --network $network --gas-limit 300000
  pnpm hardhat oracle setDonId --contract $contract --network $network --don-id $donId
  pnpm hardhat oracle setSubscriptionId --contract $contract --network $network --sub-id $subscriptionId
  pnpm hardhat oracle setSecretsUrl --url $secretsUrl --contract $contract --network $network
  ```
3. Build the source code and deploy it. See [Remote Code Integration](#remote-code-integration) for more details.
  ```
  pnpm hardhat build-source --source requestv1
  # or
  pnpm hardhat build-loadable-source --source simpleExample
  ```
4. Upload the source code to a remote URL (e.g. Github Secret Gist, IPFS, etc.)
5. Set the source code
  ```
  pnpm hardhat oracle setSource --url $url --contract $contract --network $network
  # or 
  pnpm hardhat oracle setSourceInline --source requestv1 --contract $contract --network $network
  # or
  pnpm hardhat oracle setProxySource --contract $contract --network $network --url $proxyUrl
  ```
6. Test functionality thoroughly
  ```
  pnpm hardhat oracle requestIndex --contract $contract --network $network --decimals 2 --provider <contract> --stream <stream> --date 2024-09-01
  ```
7. Lock down configuration by renouncing roles as needed

### Upgradability

- Contract is NOT upgradable
- Roles can be updated until Admin role is renounced
- Source code is upgradable until Source Keeper role is renounced
- Core function interfaces are fixed - deploy new contract for interface changes

### Roles

All roles can be granted/revoked by `DEFAULT_ADMIN_ROLE`. All roles can self-renounce.

> [!IMPORTANT]  
> - Roles cannot be transferred between addresses
> - URLs serve as potential attack vectors - use immutable destinations (e.g. IPFS)
> - Renounce roles when no longer needed for maximum security

#### Role Overview

| Role | Purpose | Security Considerations |
|------|---------|------------------------|
| DEFAULT_ADMIN_ROLE | Manages all roles | Renounce after initial setup |
| SECRETS_KEEPER_ROLE | Manages encrypted secrets URL | Renounce after setting final URL |
| SOURCE_KEEPER_ROLE | Manages source code URL and parameters | Renounce after configuration is stable |
| PAUSE_KEEPER_ROLE | Controls contract pause state | Keep only if maintenance needed |
| WHITELIST_KEEPER_ROLE | Manages reader access | Must be retained for operation |
| READER_ROLE | Data access permissions | No special privileges |

#### Role Details

**DEFAULT_ADMIN_ROLE**
- Full role management capabilities
- Set during deployment
- Uses `AccessControlDefaultAdminRules`
  - `initialDelay`: Required delay for admin changes
  - `initialAdmin`: First admin address

**SECRETS_KEEPER_ROLE**
- Controls encrypted secrets URL
- Attack vector: URL changes could break functionality

**SOURCE_KEEPER_ROLE**
- Controls source URL, DON ID, Subscription ID, gas limits
- Attack vectors:
  - Malicious source changes (breaks requests, wrong data, exposed secrets)
  - Parameter manipulation (breaks functionality)

**PAUSE_KEEPER_ROLE**
- Controls contract pause state
- Attack vector: Malicious pausing disrupts service

**WHITELIST_KEEPER_ROLE**
- Controls READER_ROLE assignments
- Must remain active for contract operation
- Attack vector: Unauthorized reader access

**READER_ROLE**
- Basic data access permissions
- No special privileges

### Data

#### Data Lifecycle

Uses Chainlink Functions for data delivery:
1. Request initiated via function call
2. Result delivered via callback, which can call back to the caller contract
3. Secrets encrypted by Subscription Owner
4. Encrypted secrets only valid for associated subscription ID

#### Data Retrieval & Single-Value Return

**Single Value:**
Each Chainlink Functions request returns exactly one value, accompanied by a date.

**Date Flexibility:**
Requesting data for a specific date does not guarantee that day's record. If the exact date is unavailable, the contract returns the closest preceding data point. For example, querying `2024-09-01` may return a value from `2024-08-30` if that is the latest available entry.

**Refer to Trufnetwork Docs:**
For details on how data points are generated and updated — often resulting in a value that might differ from the requested date—consult the [Trufnetwork Documentation](https://docs.truf.network/home).

#### Concurrent Requests

- Multiple simultaneous requests supported
- Uses request mapping instead of single-value storage
- Stale period prevents replay attacks

### Testing and Coverage

Refer to [TESTING.md](../../test/requestv1/TESTING.md) for an overview of our testing strategy, what is currently covered, and known limitations (such as the lack of coverage reporting due to incompatibilities with the local Chainlink Functions environment).

## External Contracts Usage

See [Developer Guide](../../docs/DeveloperGuide.md) for more details on how to use external contracts, including directly interacting with TNOracle using your Externally Owned Account (EOA).

### Remote Code Integration

Chainlink Functions supports supplying source code from a remote location, reducing on-chain storage costs. However, we’ve encountered issues using this feature directly: pointing `setSource` to a hosted file often results in “Invalid code location” errors on public testnets.

**Our Workaround:**  
We introduce a small "Remote Loader" script that you inline into the contract. This loader, when executed by Chainlink Functions, retrieves the main logic from a reliable hosted URL. Since the loader is minimal, it keeps deployment costs low, and because it fetches the real code at runtime, we avoid the known remote loading errors.

**Benefits:**  
- Significantly less gas than inlining all logic.  
- Avoids the “Invalid code location” issue.  
- Maintains flexibility: update the remote code without heavy redeployments.

In short, the Remote Loader acts as a stable bridge between Chainlink Functions and your external logic, enabling remote code usage today despite current limitations.