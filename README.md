# Chainlink Functions - TN

## Description

This directory contains development tools to test and simulate Chainlink Functions. It also contains an example of a contract to test the functions.

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

This will include a list of tasks, which includes tasks to:

- Simulate our functions using [functions-toolkit](https://github.com/smartcontractkit/functions-toolkit#local-functions-simulator). For local development, if you encounter a timeout error, you can adjust the `maxExecutionTimeMs` parameter. Note that it's not possible to do this on a live environment.
- Generate encrypted offchain secrets, to be stored in a private gist
- Encrypt a URL that contains offchain secrets
- Request data from a hardcoded stream
- Set the variables for the `TNConsumerExample` contract


#### Deployment

We also use hardhat ignition to deploy the contract to the network.

Example:

```bash
pnpm hardhat ignition deploy ignition/modules/TSNConsumerExample.ts --network sepolia --verify
```

#### Demonstration

We have an example of a `TNConsumerExample` contract that requests data from a hardcoded stream.

- [Subscription page](https://functions.chain.link/sepolia/4056)
- [Contract](https://sepolia.etherscan.io/address/0xcfc6ec1b1D807BB16f0936257790fE6Aa52F2744#code)

You may test it by running the `set-contract-variables` task.

> [!NOTE]
> The request function is owner-only, so you must use the private key of the wallet that deployed the contract. Ask for the private key to the team if needed.

#### How do I deploy my own contract?

Requirements:

- Have some Sepolia ETH in a wallet (use faucets if needed)
- Have some LINK in the wallet (use faucets if needed)

Steps:

- [Create a Chainlink Subscription](https://functions.chain.link/)
- Deploy the contract
  ```bash
  pnpm hardhat ignition deploy ignition/modules/TSNConsumerExample.ts --network sepolia --verify
  ```
- Set the new Subscription ID in the `constants.ts` file accordingly
- Execute the `set-contract-variables` task. This will set source, donID, etc.
  ```bash
  pnpm hardhat set-contract-variables --network sepolia
  ```
- Fund your contract as a consumer with LINK in your subscription (`https://functions.chain.link/<network>/<subscriptionId>`)
- Request data
  ```bash
  pnpm hardhat request-tn-data --network sepolia
  ```

