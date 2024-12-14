import { ConfigurableScopeDefinition } from "hardhat/types";
import { TNOracleV1 } from "../../typechain-types";
import { encryptUrl, getSecretsManager } from "../../src/lib";
import { DON_ID, ROUTER_ADDRESS } from "../../constants";

export const registerSecretsTasks = (scope: ConfigurableScopeDefinition) => {
  scope
    .task("setSecretsUrl", "Sets the encrypted secrets URL for the TNOracleV1 contract")
    .addParam("contract", "The TNOracleV1 contract address")
    .addParam("url", "The URL containing the secrets")
    .setAction(async ({ contract, url }, hre) => {
      // First encrypt the URL
      const signer = await hre.ethers.provider.getSigner();
      const routerAddress = ROUTER_ADDRESS[hre.network.name as keyof typeof ROUTER_ADDRESS];
      const donId = DON_ID[hre.network.name as keyof typeof DON_ID];

      const secretsManager = await getSecretsManager({ 
        signer: signer.connect(hre.ethers.provider), 
        routerAddress, 
        donId 
      });

      console.log("Encrypting URL...");
      const encryptedUrl = await encryptUrl(url, { secretsManager });
      
      // Verify the URL is valid
      console.log("Verifying URL...");
      const verified = await secretsManager.verifyOffchainSecrets([url]);
      if (!verified) {
        throw new Error("Failed to verify URL");
      }

      // Set the encrypted URL on the contract
      console.log("Setting encrypted URL on contract...");
      const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
      const tx = await tnOracle.setEncryptedSecretsUrl(encryptedUrl);
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("✅ Encrypted secrets URL successfully set");
    });

  scope
    .task("clearSecretsUrl", "Clears the encrypted secrets URL from the TNOracleV1 contract")
    .addParam("contract", "The TNOracleV1 contract address")
    .setAction(async ({ contract }, hre) => {
      const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
      const tx = await tnOracle.setEncryptedSecretsUrl("0x");
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("✅ Encrypted secrets URL successfully cleared");
    });
}; 