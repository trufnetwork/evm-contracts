// This file exists for:
// - Testing via Deno directly (faster iteration)
// - Using as source for the Chainlink Functions SDK

// -------- TEST SETUP --------
//
// This initial block sets up a similar environment to the one provided by `simulateScript`
// and imports all necessary dependencies.

import type { AxiosRequestConfig, AxiosInstance, AxiosResponse } from "npm:axios";
import type { Decimal as DecimalType } from "npm:decimal.js-light@2.5.1"


// Arguments passed to this script
// 0: getRecord, 1: getIndex, 2: getIndexChange
// args for getRecord: [requestType, decimalsMultiplier, dataProviderAddress, streamId, date]
const getRecordTestArgs: string[] = [
  "0",
  "18",
  "0x4710a8d8f0d845da110086812a32de6d90d7ff5c",
  "stfcfa66a7c2e9061a6fac8b32027ee8",
  "2024-09-01",
]
// args for getIndex: [requestType, decimalsMultiplier, dataProviderAddress, streamId, date, frozen_at, base_date]
const getIndexTestArgs: string[] = [
  "1",
  "2", // it's a percentage, so we use 2 decimal places
  "0x4710a8d8f0d845da110086812a32de6d90d7ff5c",
  "stfcfa66a7c2e9061a6fac8b32027ee8",
  "2024-09-01",
  "",
  "",
]

// args for getIndexChange: [requestType, decimalsMultiplier, dataProviderAddress, streamId, date, frozen_at, base_date, days_interval]
const getIndexChangeTestArgs: string[] = [
  "2",
  "2", // it's a percentage, so we use 2 decimal places
  "0x4710a8d8f0d845da110086812a32de6d90d7ff5c",
  "stfcfa66a7c2e9061a6fac8b32027ee8",
  "2024-09-01",
  "",
  "",
  "365",
]

const args = getRecordTestArgs

const secrets = {
  PRIVATE_KEY: "VALID_KEY_PLACEHOLDER"
}

const { FunctionsModule } = await import("npm:@chainlink/functions-toolkit/dist/simulateScript/Functions.js");
const Functions = new FunctionsModule().buildFunctionsmodule(10)

// This divisor is important to split the code when parsed. Don't edit the message.
// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv

// ----- CHAINLINK FUNCTION START -----
//
// From here onwards, the code is meant to run inside the Chainlink Functions environment.

// Workaround necessary not to throw errors when accessing env variables in constrained environment
// See https://github.com/denoland/deno/issues/20898
Deno.env.get = (prop) => {
  console.log("Skipping env", prop);
  return undefined;
};

// ---------- IMPORTS ----------
const { NodeTNClient, StreamId, EthereumAddress } = await import("npm:@trufnetwork/sdk-js@0.2.1");
const { ethers, Wallet } = await import("npm:ethers@6.10.0")
const decimalPkg = await import("npm:decimal.js-light@2.5.1")
// workaround to keep typescript happy
const { default: Decimal } = decimalPkg  as unknown as { default: typeof DecimalType }
const z = await import("npm:zod@3.22.4");

// ---------- TYPES & ENUMS ----------
/**
 * Defines the type of request we are making to the streams endpoint.
 */
enum RequestType {
  RECORD = "0",
  INDEX = "1",
  INDEX_CHANGE = "2"
}

type BaseRequestArgs = [dataProviderAddress: string, decimalsMultiplier: string, streamId: string, date: string]
type RecordRequestArgs = [RequestType.RECORD, ...BaseRequestArgs]
type IndexRequestArgs = [RequestType.INDEX, ...BaseRequestArgs, frozen_at: string, base_date: string]
type IndexChangeRequestArgs = [RequestType.INDEX_CHANGE, ...BaseRequestArgs, frozen_at: string, base_date: string, days_interval: string]
type RequestArgs = RecordRequestArgs | IndexRequestArgs | IndexChangeRequestArgs

type NonEmptyString = string & { _brand: "NonEmptyString" }

interface BaseRequestArgsObject {
  requestType: RequestType,
  dataProviderAddress: NonEmptyString,
  decimalsMultiplier: NonEmptyString,
  streamId: NonEmptyString,
  date: NonEmptyString
}
interface RecordRequestArgsObject extends BaseRequestArgsObject {
  requestType: RequestType.RECORD
}
interface IndexRequestArgsObject extends BaseRequestArgsObject {
  requestType: RequestType.INDEX,
  frozen_at: number | null,
  base_date: NonEmptyString | null
}
interface IndexChangeRequestArgsObject extends BaseRequestArgsObject {
  requestType: RequestType.INDEX_CHANGE,
  frozen_at: number | null,
  base_date: NonEmptyString | null,
  days_interval: NonEmptyString
}
type RequestArgsObject = RecordRequestArgsObject | IndexRequestArgsObject | IndexChangeRequestArgsObject

// Add schemas after the existing types & enums
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

// Base schema for common fields
const baseArgsSchema = z.object({
  requestType: z.enum(["0", "1", "2"]),
  decimalsMultiplier: z.string()
    .regex(/^\d+$/, "Must be a non-negative integer")
    .transform(Number)
    .refine(n => n >= 0 && n <= 100, "Decimals multiplier must be between 0 and 100"),
  dataProviderAddress: z.string()
    .regex(ethereumAddressRegex, "Invalid Ethereum address format"),
  streamId: z.string()
    .min(1, "Stream ID cannot be empty"),
  date: z.string()
    .regex(dateRegex, "Date must be in YYYY-MM-DD format")
    .refine(date => !isNaN(new Date(date).getTime()), "Invalid date"),
});

// Record schema (type 0)
const recordSchema = baseArgsSchema.extend({
  requestType: z.literal("0"),
}).strict();

// Index schema (type 1)
const indexSchema = baseArgsSchema.extend({
  requestType: z.literal("1"),
  frozen_at: z.string()
    .regex(/^\d+$/, "frozen_at must be a positive integer (block height)")
    .transform(Number)
    .refine(n => n > 0, "frozen_at must be greater than 0")
    .optional()
    .nullable(),
  base_date: z.string()
    .regex(dateRegex, "base_date must be in YYYY-MM-DD format")
    .refine(date => !isNaN(new Date(date).getTime()), "Invalid base_date")
    .optional()
    .nullable(),
}).strict();

// Index Change schema (type 2)
const indexChangeSchema = baseArgsSchema.extend({
  requestType: z.literal("2"),
  frozen_at: z.string()
    .regex(/^\d+$/, "frozen_at must be a positive integer (block height)")
    .transform(Number)
    .refine(n => n > 0, "frozen_at must be greater than 0")
    .optional()
    .nullable(),
  base_date: z.string()
    .regex(dateRegex, "base_date must be in YYYY-MM-DD format")
    .refine(date => !isNaN(new Date(date).getTime()), "Invalid base_date")
    .optional()
    .nullable(),
  days_interval: z.string()
    .regex(/^\d+$/, "days_interval must be a positive integer")
    .transform(Number)
    .refine(n => n > 0, "days_interval must be greater than 0"),
}).strict();

// Combined schema using discriminated union
const argsSchema = z.discriminatedUnion("requestType", [
  recordSchema,
  indexSchema,
  indexChangeSchema,
]);

// ---------- HELPER FUNCTIONS ----------
/**
 * Converts a string or null to a number or null.
 */
function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Converts the raw arguments into a well-defined RequestArgsObject.
 */
function requestArgsToObject(args: string[]): RequestArgsObject {
  if (args.length < 5) {
    throw new Error(`Insufficient arguments. Received ${args.length}, expected at least 5`);
  }

  const [requestType, decimalsMultiplier, dataProviderAddress, streamId, date, ...rest] = args;
  
  // Prepare the input object based on request type
  const baseInput = {
    requestType,
    decimalsMultiplier,
    dataProviderAddress,
    streamId,
    date,
  };

  let input;
  switch (requestType) {
    case "0":
      input = baseInput;
      break;
    case "1":
      input = {
        ...baseInput,
        frozen_at: rest[0] || null,
        base_date: rest[1] || null,
      };
      break;
    case "2":
      input = {
        ...baseInput,
        frozen_at: rest[0] || null,
        base_date: rest[1] || null,
        days_interval: rest[2],
      };
      break;
    default:
      throw new Error(`Invalid request type: ${requestType}`);
  }

  // Parse and validate using Zod
  const result = argsSchema.safeParse(input);

  
  if (!result.success) {
    const formattedError = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    const ellipsis = formattedError.length > 100 ? "..." : "";
    // we need to truncate, otherwise it just comes empty at response
    throw new Error(`Validation failed:\n${formattedError.slice(0, 100)}${ellipsis}`);
  }

  // Convert the validated data back to the expected type
  const validated = result.data;
  
  // Create base object with NonEmptyString types
  const baseObject = {
    dataProviderAddress: validated.dataProviderAddress as NonEmptyString,
    decimalsMultiplier: validated.decimalsMultiplier.toString() as NonEmptyString,
    streamId: validated.streamId as NonEmptyString,
    date: validated.date as NonEmptyString,
  };
  
  switch (validated.requestType) {
    case "0":
      return {
        ...baseObject,
        requestType: RequestType.RECORD,
      };
    
    case "1":
      return {
        ...baseObject,
        requestType: RequestType.INDEX,
        frozen_at: validated.frozen_at || null,
        base_date: validated.base_date ? (validated.base_date as NonEmptyString) : null,
      };
    
    case "2":
      return {
        ...baseObject,
        requestType: RequestType.INDEX_CHANGE,
        frozen_at: validated.frozen_at || null,
        base_date: validated.base_date ? (validated.base_date as NonEmptyString) : null,
        days_interval: validated.days_interval.toString() as NonEmptyString,
      };
  }
}

// ---------- SETUP SDK & CUSTOM ADAPTER ----------
const signer = new Wallet(secrets.PRIVATE_KEY);
const client = new NodeTNClient({
  endpoint: "https://staging.tsn.truflation.com",
  signerInfo: {
    address: signer.address,
    signer: signer,
  },
  chainId: "truflation-staging-2024-11-22"
});

/**
 * This function deeply traverses the prototype chain of an object to get the nth parent.
 * We use it to access a hidden axios instance in the SDK.
 */
function getPrototypeAtDepth(obj: any, depth: number): any {
  return depth === 0 ? obj : getPrototypeAtDepth(Object.getPrototypeOf(obj), depth - 1)
}

// Access the internal axios instance
const api = getPrototypeAtDepth(client['kwilClient'], 4)
const originalRequest = api['request'];

/**
 * Custom adapter to use Chainlink Functions makeHttpRequest instead of direct Axios calls.
 */
const customAdapter = async (config: AxiosRequestConfig) => {
  const url = new URL(config.url ?? "", config.baseURL).toString()
  const headers = Object.fromEntries(
    Object.entries(config.headers ?? {}).map(([key, value]) => [key, value.toString()])
  ) as Record<string, string>

  const response = await Functions.makeHttpRequest({
    url: url ?? "",
    data: JSON.parse(config.data || "{}"),
    headers,
    method: config.method as 'get' | 'post' | 'put' | 'delete',
    params: config.params,
  })

  return response.error ? Promise.reject(response) : response as unknown as AxiosResponse
}

// Replace the original request function with a custom one that uses our custom adapter
api['request'] = (...args: any[]) => {
  const request: AxiosInstance = originalRequest.apply(client['kwilClient'], args);
  request.defaults.adapter = customAdapter
  return request
};

// ---------- DATA FETCHING ----------
/**
 * Fetches data from the streams API based on the request type.
 */
async function getData(args: RequestArgsObject) {
  const owner = EthereumAddress.fromString(args.dataProviderAddress).throw();
  const sId = StreamId.fromString(args.streamId).throw();
  const streams = client.loadStream({ dataProvider: owner, streamId: sId });

  switch (args.requestType) {
    case RequestType.RECORD:
      return await streams.getRecord({
        dateFrom: args.date,
        dateTo: args.date,
      });

    case RequestType.INDEX:
      return await streams.getIndex({
        dateFrom: args.date,
        dateTo: args.date,
        frozenAt: args.frozen_at ?? undefined,
        baseDate: args.base_date ?? undefined,
      });

    case RequestType.INDEX_CHANGE: {
      const daysInterval = numberOrNull(args.days_interval);
      if (daysInterval === null) {
        throw new Error("Days interval is required");
      }
      return await streams.getIndexChange({
        dateFrom: args.date,
        dateTo: args.date,
        frozenAt: args.frozen_at ?? undefined,
        baseDate: args.base_date ?? undefined,
        daysInterval,
      });
    }
  }
}

// ---------- MAIN EXECUTION ----------

const argsObject = requestArgsToObject(args as RequestArgs);

let results;
try {
  results = await getData(argsObject)
} catch (e) {
  throw new Error("Error fetching data: " + e)
}

// Validate we got exactly one record
if (results.length != 1) {
  throw new Error("Expected 1 record, got " + results.length)
}
const result = results[0];



// Using decimal.js-light to scale the value
const multiplierNum = Number(argsObject.decimalsMultiplier);
if (isNaN(multiplierNum) || multiplierNum < 0) {
  throw new Error(`Invalid multiplier: ${argsObject.decimalsMultiplier}`);
}

// the user provides the multiplier. We need to convert it to the correct big int by multiplying by 10^(multiplier)
// e.g. 10.1532 with multiplier 2 becomes 1015
// Create a Decimal from the result value
const decimalValue = new Decimal(result.value);
// Scale the value by 10^(multiplierNum)
const scaledDecimal = decimalValue.mul(new Decimal(10).pow(multiplierNum));
// Convert to a BigInt
const scaledBigInt = BigInt(scaledDecimal.toFixed(0)); // toFixed(0) returns integer string

// Encode result for the contract: (string, int256)
const abiCoder = ethers.AbiCoder.defaultAbiCoder()
const encoded = abiCoder.encode(["string", "int256"], [result.dateValue, scaledBigInt])
const encodedResult = ethers.getBytes(encoded)

// once encodedResult is set, we're done. `return encodedResult;` will be appended to the end of the file.

// ----- CHAINLINK FUNCTION END -----
//
// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
//
// Debugging/logging directly beyond this point.

console.log({ encodedResult, decodedResult: encodedResult.toString() })

const decoded = abiCoder.decode(["string", "int256"], encodedResult)
console.log({encodedResult, decoded})
