import { TNOracleV1 } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Location } from "@chainlink/functions-toolkit";
import { ethers } from "hardhat";
import { TEST_CONSTANTS } from "./constants";

export interface SetupRoles {
  sourceKeeper: HardhatEthersSigner;
  secretsKeeper: HardhatEthersSigner;
}

export interface SetupParams {
  donId?: string;
  subscriptionId?: bigint;
  secretsUrl?: Uint8Array;
  source?: string;
  sourceLocation?: Location;
  gasLimit?: bigint;
}

export async function setupForRequests(
  tnOracle: TNOracleV1,
  roles: SetupRoles,
  params?: SetupParams
) {
  const { sourceKeeper, secretsKeeper } = roles;

  // Set parameters if provided
  if (params?.secretsUrl) {
    await tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(params.secretsUrl);
  }
  if (params?.donId) {
    await tnOracle.connect(sourceKeeper).setDonId(ethers.encodeBytes32String(params.donId));
  }
  if (params?.subscriptionId) {
    await tnOracle.connect(sourceKeeper).setSubscriptionId(params.subscriptionId);
  }
  if (params?.source) {
    await tnOracle.connect(sourceKeeper).setSource(
      params.source, 
      params.sourceLocation || Location.Inline
    );
  }
  if (params?.gasLimit) {
    await tnOracle.connect(sourceKeeper).setGasLimit(params.gasLimit);
  }
}