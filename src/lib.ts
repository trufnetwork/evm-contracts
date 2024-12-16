import { SecretsManager } from "@chainlink/functions-toolkit";
import dotenv from 'dotenv';
import { ethers, TransactionRequest, ContractTransactionResponse, TransactionReceipt, Interface } from "ethers";
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
    sendTransaction: (transaction: Deferrable<TransactionRequest>) => signer.sendTransaction({ ...transaction } as TransactionRequest),
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

/**
 * Waits for a transaction and returns the request ID from the logs
 * @param tx The transaction response
 * @returns The request ID
 * @throws Error if the transaction fails or request ID cannot be found
 */
export async function getRequestId(tx: ContractTransactionResponse): Promise<string> {
  try {
    const receipt = await tx.wait();
    if (!receipt?.logs?.[0]?.topics?.[1]) {
      throw new Error("Failed to get request ID from transaction receipt");
    }
    return receipt.logs[0].topics[1];
  } catch (e: any) {
    // Check if it's a revert
    if (e.data) {
      // Get the revert reason if available
      const reason = e.data;
      throw new Error(`Transaction reverted: ${reason}`);
    }
    throw e;
  }
}

/**
 * Handles a contract transaction and extracts revert reasons if any
 * @param action Promise returning a contract transaction
 * @param contractInterface The contract interface (ABI)
 * @returns The transaction response
 * @throws Error with decoded revert reason if transaction fails
 */
export async function handleContractTransaction<T>(
  action: () => Promise<T>,
  contractInterface?: Interface
): Promise<T> {
  try {
    return await action();
  } catch (e: any) {
    // Check for revert data
    if (e.data && e.data !== "0x") {
      // Try to decode the revert reason
      let decodedError = `Transaction reverted: ${e.data}`; // Default message
      if (contractInterface) {
        try {
          // Attempt to decode custom errors using the ABI
          const decoded = contractInterface.parseError(e.data);
          if (decoded) {
            decodedError = `Transaction reverted with custom error: ${decoded.name}(${decoded.args.join(", ")})`;
          }
        } catch (decodeError) {
          // Fallback to default message if decoding fails
          console.warn("Failed to decode custom error:", decodeError);
        }
      } else {
        // Try to decode the revert reason using ethers
        try {
          const decoded = ethers.toUtf8String(e.data);
          decodedError = `Transaction reverted: ${decoded}`;
        } catch (decodeError) {
          // Fallback to default message if decoding fails
          console.warn("Failed to decode revert reason:", decodeError);
        }
      }
      throw new Error(decodedError);
    }
    // If it's a user rejected transaction
    if (e.code === 'ACTION_REJECTED') {
      throw new Error('Transaction was rejected by user');
    }
    // For other errors, preserve the original error
    throw e;
  }
}