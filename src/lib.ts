import { SecretsManager } from "@chainlink/functions-toolkit";
import dotenv from 'dotenv';
import { ethers, TransactionRequest } from "ethers";
import * as ethersv5 from "ethers-v5";
import { Deferrable } from "ethers-v5/lib/utils";
import * as path from 'node:path';

export const loadEnv = () => {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}


/**
 * Converts an ethersv6 signer to an ethersv5 signer to be used by compatible libraries
 * @param signer - The ethersv6 signer
 * @returns The ethersv5 signer
 */
export const ether5Signer = (signer: ethers.Signer): ethersv5.Signer => {
  const provider = signer.provider
  if (!provider) {
    throw new Error("Provider not found");
  }
  // @ts-expect-error not fully compatible
  return {
    ...signer,
    _isSigner: true,
    call: (transaction: Deferrable<TransactionRequest>) => signer.call({ ...transaction } as TransactionRequest),
    getAddress: () => signer.getAddress(),
    signMessage: (message: string | ethers.BytesLike) => signer.signMessage(message),
  } as ethersv5.Signer;
}

export const getSecretsManager = async ({ signer, routerAddress, donId }: { signer: ethers.Signer; routerAddress: string; donId: string; }) => {
  // Initialize SecretsManager instance
  const signerV5 = ether5Signer(signer);
  const secretsManager = new SecretsManager({
    signer: signerV5,
    functionsRouterAddress: routerAddress,
    donId: donId,
  });
  await secretsManager.initialize();
  return secretsManager;
}

type EncryptUrlParams = {
  signer: ethers.Signer;
  routerAddress: string;
  donId: string;
} | {
  secretsManager: SecretsManager;
}

/**
 * Encrypts a URL using the Chainlink Functions
 */
export const encryptUrl = async (url: string, params: EncryptUrlParams) => {
  if ('signer' in params) {
    const secretsManager = await getSecretsManager({ signer: params.signer, routerAddress: params.routerAddress, donId: params.donId });
    return secretsManager.encryptSecretsUrls([ url ]);
  } else {
    return params.secretsManager.encryptSecretsUrls([ url ]);
  }
}