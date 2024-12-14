# TN Example Contract

This contract serves the purpose of demonstrating how to integrate the TN SDK into a contract, as simple as possible. But our main contracts are intended to make this process more easily accessible, where you can just reference the `TNClient` contract and use the `request` function.

> [!NOTE]
> The request function is owner-only, so you must use the private key of the wallet that deployed the contract. Ask for the private key to the team if needed.


## How do I deploy my own contract?

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

