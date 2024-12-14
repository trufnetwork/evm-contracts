import { task } from "hardhat/config";
import { DON_ID, ROUTER_ADDRESS } from "../../constants";
import { getSecretsManager, loadEnv } from "../../src/lib";
import { ethers } from "ethers";
import { ConfigurableScopeDefinition } from "hardhat/types";

/**
 * Outputs the encrypted secrets object, to be stored offchain
 * 
 * See https://docs.chain.link/chainlink-functions/tutorials/api-use-secrets-gist for more details
 * 
 * Note: You must use the same wallet that was used to create the Chainlink Functions subscription to encrypt the secrets
 */
export const registerGenOffchainSecretsTasks = (
  scope: ConfigurableScopeDefinition
) => {
  scope.task("gen-offchain-secrets", "Outputs the encrypted secrets object, to be stored offchain")
    .addParam("privateKey", "The private key to use for encryption")
    .setAction(async (taskArgs, hre) => {
      // ensure private key starts with 0x
      const privateKey = taskArgs.privateKey.startsWith("0x") ? taskArgs.privateKey : `0x${taskArgs.privateKey}`;
      // ensure it's a valid private key
      if (!ethers.isHexString(privateKey)) {
        throw new Error("Invalid private key");
      }
      const secrets = { PRIVATE_KEY: privateKey };
      // Encrypt secrets
      const secretsManager = await getSecretsManager({
        signer: await hre.ethers.provider.getSigner(),
        routerAddress:
          ROUTER_ADDRESS[hre.network.name as keyof typeof ROUTER_ADDRESS],
        donId: DON_ID[hre.network.name as keyof typeof DON_ID],
      });
      const encryptedSecretsObj = await secretsManager.encryptSecrets(
        secrets as Record<string, string>
      );

      // log response
      console.log(JSON.stringify(encryptedSecretsObj, null, 2));
    });
}
