import { task } from "hardhat/config";
import { TNOracleV1, TNOracleV1__factory } from "../../typechain-types";
import { getRequestId } from "../../src/lib";
import { ContractTransactionResponse } from "ethers";
import FunctionsRouter from "@chainlink/contracts/abi/v0.8/FunctionsRouter.json";
import { ethers } from "ethers";

// ------------ Types ------------

interface RequestConfig {
  hre: any;
  requestName: string;
  requestFn: () => Promise<ContractTransactionResponse>;
  contractInterface: ethers.Interface;
  requireStaticCall?: () => Promise<void>;
  skipAccessCheck?: boolean;
}

interface RequestResult {
  requestId: string;
  receipt: any;
  events: any[];
}

interface ContractState {
  isPaused: boolean;
  donID: string;
  subscriptionId: string;
  owner: string;
  network: {
    name: string;
    chainId: number;
  };
}

interface BaseRequestParams {
  contract: string;
  decimals: string;
  provider: string;
  stream: string;
  date: string;
}

interface IndexRequestParams extends BaseRequestParams {
  frozenAt: string | "";
  baseDate: string | "";
}

interface IndexChangeRequestParams extends BaseRequestParams {
  frozenAt: string | "";
  baseDate: string | "";
  daysInterval: string;
}


// ------------ Error Classes ------------

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessError';
  }
}

class TransactionError extends Error {
  public decodedError?: { name: string; args: any[] };
  
  constructor(message: string, decodedError?: { name: string; args: any[] }) {
    super(message);
    this.name = 'TransactionError';
    this.decodedError = decodedError;
  }
}

// ------------ Validation Functions ------------

function validateBaseRequestParams(params: { decimals: string; date: string; provider: string; stream: string; }) {
  const decimals = parseInt(params.decimals);
  if (isNaN(decimals) || decimals < 0) {
    throw new ValidationError(`Invalid decimals value: ${params.decimals}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    throw new ValidationError(`Invalid date format: ${params.date}. Expected YYYY-MM-DD`);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(params.provider)) {
    throw new ValidationError(`Invalid provider address: ${params.provider}`);
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(params.stream)) {
    throw new ValidationError(`Invalid stream ID format: ${params.stream}`);
  }
}

// ------------ Contract Interaction Functions ------------

async function initializeOracle(contractAddress: string, hre: any) {
  const tnOracle = (await hre.ethers.getContractAt("TNOracleV1", contractAddress)) as TNOracleV1;
  return { 
    tnOracle, 
    contractInterface: TNOracleV1__factory.createInterface() 
  };
}

async function checkAccess(tnOracle: TNOracleV1, signer: any) {
  const hasRole = await tnOracle.hasRole(await tnOracle.READER_ROLE(), signer.address);
  if (!hasRole) {
    throw new AccessError("Signer does not have READER_ROLE");
  }
}

async function getContractState(tnOracle: TNOracleV1, hre: any): Promise<ContractState> {
  const [isPaused, donID, subscriptionId, owner] = await Promise.all([
    tnOracle.paused(),
    tnOracle.donID(),
    tnOracle.subscriptionId(),
    tnOracle.owner()
  ]);

  const network = await hre.ethers.provider.getNetwork();
  
  return {
    isPaused,
    donID,
    subscriptionId: subscriptionId.toString(),
    owner,
    network: {
      name: network.name,
      chainId: network.chainId
    }
  };
}

// ------------ Error Handling Functions ------------

function decodeErrorData(errorData: string, contractInterface: ethers.Interface) {
  const routerInterface = new ethers.Interface(FunctionsRouter as any[]);
  const interfaces = [
    { name: 'Oracle', interface: contractInterface },
    { name: 'Router', interface: routerInterface }
  ];

  for (const { name, interface: iface } of interfaces) {
    try {
      const decoded = iface.parseError(errorData);
      if (!decoded) continue;
      return { 
        decoded: true, 
        name: decoded.name, 
        args: decoded.args, 
        source: name 
      };
    } catch {}
  }

  // Try standard revert string
  try {
    const errorSignature = "Error(string)";
    const revertSelector = ethers.id(errorSignature).slice(0,10);
    if (errorData.startsWith(revertSelector)) {
      const encodedString = "0x" + errorData.slice(10);
      const [revertMessage] = new ethers.AbiCoder().decode(["string"], encodedString);
      return { 
        decoded: true, 
        name: "Error", 
        args: [revertMessage], 
        source: 'Standard' 
      };
    }
  } catch {}

  return { decoded: false };
}

// ------------ Transaction Handling ------------

async function handleTransaction(
  tx: ContractTransactionResponse, 
  contractInterface: ethers.Interface
): Promise<RequestResult> {
  const receipt = await tx.wait();
  if (!receipt) {
    throw new TransactionError('Transaction receipt is null');
  }

  const events = receipt.logs
    .map(log => {
      try {
        return contractInterface.parseLog({ topics: log.topics, data: log.data });
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const requestId = await getRequestId(tx);

  return { requestId, receipt, events };
}

// ------------ Main Request Handler ------------

async function performRequest({
  hre,
  requestName,
  requestFn,
  contractInterface,
  requireStaticCall,
  skipAccessCheck = false
}: RequestConfig): Promise<RequestResult> {
  console.log(`\n=== Starting request: ${requestName} ===`);

  try {
    // Perform static call if required
    if (requireStaticCall) {
      await requireStaticCall();
    }

    // Execute transaction
    const tx = await requestFn();
    console.log(`Transaction sent: ${tx.hash}`);

    // Handle transaction result
    const result = await handleTransaction(tx, contractInterface);
    
    // Log success details
    console.log(`Transaction successful:
      Block: ${result.receipt.blockNumber}
      Request ID: ${result.requestId}
      Events: ${result.events.map(e => e.name).join(', ')}
    `);

    return result;

  } catch (error: any) {
    // Handle different error types
    if (error instanceof ValidationError) {
      console.error('Validation Error:', error.message);
      throw error;
    }

    if (error instanceof AccessError) {
      console.error('Access Error:', error.message);
      throw error;
    }

    // Handle transaction errors
    if (error.data) {
      const decoded = decodeErrorData(error.data, contractInterface);
      const errorDetails = decoded.decoded 
        ? `${decoded.source} Error: ${decoded.name} (${decoded.args?.join(', ')})`
        : 'Unknown Error';
        
      throw new TransactionError(
        `Transaction failed: ${errorDetails}`,
        decoded.decoded && decoded.name && decoded.args 
          ? { name: decoded.name, args: decoded.args } 
          : undefined
      );
    }

    // Generic error
    throw new TransactionError(`Request failed: ${error.message}`);
  }
}

// ------------ Task Definitions ------------

task("oracle:requestRecord", "Request a record from TN")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("decimals", "The decimals multiplier", "18")
  .addParam("provider", "The data provider address")
  .addParam("stream", "The stream ID")
  .addParam("date", "The date to fetch data for (YYYY-MM-DD)")
  .setAction(async (params: BaseRequestParams, hre) => {
    validateBaseRequestParams(params);
    const { tnOracle, contractInterface } = await initializeOracle(params.contract, hre);

    return performRequest({
      hre,
      requestName: `record for ${params.date}`,
      requestFn: () => tnOracle.requestRecord(
        parseInt(params.decimals),
        params.provider,
        params.stream,
        params.date
      ),
      contractInterface
    });
  });

  task("oracle:requestIndex", "Request an index from TN")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("decimals", "The decimals multiplier", "18")
  .addParam("provider", "The data provider address")
  .addParam("stream", "The stream ID")
  .addParam("date", "The date to fetch data for (YYYY-MM-DD)")
  .addOptionalParam("frozenAt", "The frozen at block number (optional)", "")
  .addOptionalParam("baseDate", "The base date (YYYY-MM-DD)", "")
  .setAction(async (params: IndexRequestParams, hre) => {
    validateBaseRequestParams(params);
    const { tnOracle, contractInterface } = await initializeOracle(params.contract, hre);
    const signer = await hre.ethers.provider.getSigner();
    await checkAccess(tnOracle, signer);

    await performRequest(
      { 
        hre,
        requestName: `index for ${params.date}`,
        requestFn: () => tnOracle.requestIndex(
          BigInt(params.decimals),
          params.provider,
          params.stream,
          params.date,
          params.frozenAt,
          params.baseDate
        ),
        contractInterface,
      });
  });

task("oracle:requestIndexChange", "Request an index change from TN")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("decimals", "The decimals multiplier", "18")
  .addParam("provider", "The data provider address")
  .addParam("stream", "The stream ID")
  .addParam("date", "The date to fetch data for (YYYY-MM-DD)")
  .addOptionalParam("frozenAt", "The frozen at block number (optional)", "")
  .addOptionalParam("baseDate", "The base date (YYYY-MM-DD) (optional)", "")
  .addParam("daysInterval", "The days interval")
  .setAction(async (params: IndexChangeRequestParams, hre) => {
    validateBaseRequestParams(params);
    const { tnOracle, contractInterface } = await initializeOracle(params.contract, hre);

    await performRequest(
      {
        hre,
        requestName: `index change for ${params.date}`,
        requestFn: () => tnOracle.requestIndexChange(
          parseInt(params.decimals),
          params.provider,
          params.stream,
          params.date,
          params.frozenAt,
          params.baseDate,
          params.daysInterval
        ),
        contractInterface,
      });
  });
