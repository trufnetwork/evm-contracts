// This file exists for:
// - Testing via Deno directly (faster iteration)
// - Using as source for the Chainlink Functions SDK

// -------- SETUP --------

// This inital block is responsible by setting up a similar environment to the one providded by `simulateScript`

import type { AxiosRequestConfig, AxiosInstance, AxiosResponse } from "npm:axios";

// - Setting up the same environment executed in the Chainlink Functions SDK
const args = [
  "0x4710a8d8f0d845da110086812a32de6d90d7ff5c",
  "stfcfa66a7c2e9061a6fac8b32027ee8",
  "2024-09-01",
]

const secrets = {
  PRIVATE_KEY: "0x0000000000000000000000000000000000000000000000000000000000000001"
}

const { FunctionsModule } = await import("npm:@chainlink/functions-toolkit/dist/simulateScript/Functions.js");

const Functions = new FunctionsModule().buildFunctionsmodule(10)


// This divisor is important to split the code when parsed. Don't edit the message.
// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv

// ----- CHAINLINK FUNCTION START -----

// Define arguments for the function
const dataProviderAddress = args[0];
const streamIdArg = args[1];
const dateArg = args[2];

// Workaround necessary not to throw errors when accessing env variables in constrained environment
// See https://github.com/denoland/deno/issues/20898
Deno.env.get = (prop) => {
  console.log("Skipping env", prop);
  return undefined;
};

// Imports
const { NodeTNClient, StreamId, EthereumAddress } = await import("npm:@trufnetwork/sdk-js@0.2.1");
const { Wallet } = await import("npm:ethers");


// Setup SDK
const signer = new Wallet(secrets.PRIVATE_KEY);
const client = new NodeTNClient({
  endpoint: "https://staging.tsn.truflation.com",
  signerInfo: {
    address: signer.address,
    signer: signer,
  },
  // Uncomment if you encounter timeout issues while developing locally
  // timeout: 20000,
  chainId: "truflation-staging-2024-11-22"
});

/*
 * Workaround title: Accessing Axios under the hood of our SDK dependencies
 * Problem:
 * - On chainlink functions environment, we can't make requests without their makeHttpRequest function.
 * - Our SDK dependencies use Axios under the hood and this axios is not exported to be easily accessible.
 * 
 * Solution:
 * - Build getPrototypeAtDepth to get the underlying Axios instance that isn't exported.
 *    - This is a utility to traverse the prototype chain to get the nth parent of an object. It's hardcoded to get the exact instance, so it's a bit flaky.
 * - Replace the original adapter for one that leverages the Chainlink Functions SDK's makeHttpRequest function.
 */

const getPrototypeAtDepth = (obj: any, depth: number): any => {
  return depth === 0 ? obj : getPrototypeAtDepth(Object.getPrototypeOf(obj), depth - 1)
}

const api = getPrototypeAtDepth(client['kwilClient'], 4)
// get the original request function to be able to replace it while keeping the same instance
const originalRequest = api['request'];

const customAdapter = async (config: AxiosRequestConfig) => {
  const url = new URL(config.url ?? "", config.baseURL).toString()
  const headers = Object.fromEntries(Object.entries(config.headers?? {}).map(([key, value]) => [key, value.toString()])) as Record<string, string>
  const requestOptions = {
    url: url ?? "",
    // it comes as a string, we need an object of it
    data: JSON.parse(config.data),
    headers,
    method: config.method?.toUpperCase() as any,
    params: config.params,
  }
  console.log({requestOptions})
  const response = await Functions.makeHttpRequest(requestOptions)


  return response.error ? Promise.reject(response) : response as unknown as AxiosResponse
}

// replace the request function with our modified version
api['request'] = (...args: any[]) => {
  // apply the original request function to get the same instance
  const request: AxiosInstance = originalRequest.apply(client['kwilClient'], args);

  // replace the adapter with our modified version
  request.defaults.adapter = customAdapter
  // return the modified request instance
  return request
};

// End of workaround

// Fetch data
const owner = EthereumAddress.fromString(dataProviderAddress).throw();
const streamId = StreamId.fromString(streamIdArg).throw();
const streams = client.loadStream({
  dataProvider: owner,
  streamId: streamId
})


let results
try {
  results = await streams.getRecord({
    dateFrom: dateArg,
    dateTo: dateArg
  })
} catch (e) {
  throw new Error("Error fetching data: " + e)
}

  // Check if the expected number of records is returned
if (results.length != 1) {
  throw new Error("Expected 1 record, got " + results.length)
}
const result = results[0];

// more checks could be necessary to fulfil requirements of the contract

// do somehting with date?
// result.date

// or make something to turn this value into a integer
const encodedResult = Functions.encodeString(`${result.value}`)

// once encodedResult is set, we're done. `return encodedResult;` will be apended to the end of the file.

// ----- CHAINLINK FUNCTION END -----

// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
// here we want to make the decoded result useful for debugging. But it won't be used in the contract.

const decodedResult = encodedResult.toString()
console.log({encodedResult, decodedResult})
