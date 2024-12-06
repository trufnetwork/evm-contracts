import { task } from "hardhat/config";
import { encryptUrl, getSecretsManager } from "../src/lib";
import { ROUTER_ADDRESS } from "../constants";
import { DON_ID } from "../constants";

/**
 * Encrypts a given URL that holds offchain secrets used by the Chainlink Functions
 * 
 * See https://docs.chain.link/chainlink-functions/tutorials/api-use-secrets-gist for more details
 * 
 * Note: You must use the same wallet that was used to create the Chainlink Functions subscription to encrypt the secrets
 */
task("encrypt-url", "Encrypts a given URL that holds offchain secrets used by the Chainlink Functions.")
  .addParam("url", "The URL to encrypt")
  .setAction(async (taskArgs, hre) => {
    const url = taskArgs.url;
    const signer = await hre.ethers.provider.getSigner();
    const routerAddress = ROUTER_ADDRESS[hre.network.name as keyof typeof ROUTER_ADDRESS];
    const donId = DON_ID[hre.network.name as keyof typeof DON_ID];

    const connectedSigner = signer.connect(hre.ethers.provider);

    const secretsManager = await getSecretsManager({ signer: connectedSigner, routerAddress, donId });
    const encryptedUrl = await encryptUrl(url, { secretsManager });
    console.log("Encrypted URL:", encryptedUrl);

    // verify offchain secrets
    const verified = await secretsManager.verifyOffchainSecrets([url]);
    console.log("Verified:", verified);
  }); 
