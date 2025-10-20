# Chainlink Functions - TN

## Description

This directory contains development tools to test and simulate Chainlink Functions, an example consumer, and the Solidity attestation verification library used by TrufNetwork contracts.

## Requirements

- Node.js
- Deno

See chainlink-functions-toolkit [prerequisites](https://github.com/smartcontractkit/functions-toolkit#prerequisites) for minimum versions.

## Setup

Install dependencies

```bash
pnpm install
```

## Usage

### Run the Deno script directly

To test the Deno script directly, run

```bash
pnpm run run:direct
```

> [!NOTE]
> You may encounter a timeout error. If so, you can uncomment the `timeout` option inside the `simpleExample.ts` file. Note that it's not possible to do this on a live environment.

### Hardhat

#### Tasks

To see available hardhat tasks and their arguments, run

```bash
pnpm hardhat
```

This will include a list of tasks to interact with our contracts. For a comprehensive overview of available tasks and their functionalities, refer to the **Tasks Overview** section in the [Developer Guide](docs/DeveloperGuide.md#tasks-overview).

#### Deployment

We use Hardhat Ignition to deploy our contracts to the network.

**For detailed deployment instructions, refer to:**

-   [TNOracle Deployment](contracts/v1.0.0/TNOracle.md#deployment--configuration)
-   [TNClientExample Deployment](contracts/example/README.md#deployment)

#### Demonstration

We have an example of a  `TNClientExample`  contract that requests data from a hardcoded stream. See  [contracts/example/README.md](contracts/example/README.md)  for more information.

#### TNOracle

The TNOracle contract is deployed by the team and is used to request data using the  `request`  function. You may call it from your own contract, or directly from your EOA.

**For detailed information about TNOracle, including:**

-   Lifecycle (deployment, configuration, upgradability)
-   Roles and permissions
-   Data handling
-   External contract usage
-   Remote code integration

See  [TNOracle Documentation](contracts/v1.0.0/TNOracle.md).

**For developers integrating with TNOracle:**

-   Developing a TNConsumer
-   Best practices (testing, security, gas optimization, error handling)
-   Support

Refer to the  [Developer Guide](docs/DeveloperGuide.md).

#### Attestation Library

Smart contracts that ingest signed attestations can import `contracts/attestation/TrufAttestation.sol` to parse payloads, recover signer addresses, and decode datapoints. Start with the [Attestation Library guide](docs/AttestationLibrary.md) for payload format, usage snippets, and TypeScript helpers that mirror the canonical encoder maintained in `github.com/trufnetwork/node` (`extensions/tn_attestation/canonical.go`).
