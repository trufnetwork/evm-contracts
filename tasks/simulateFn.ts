import { simulateScript } from "@chainlink/functions-toolkit";
import { task, types } from "hardhat/config";
import { EnumArgumentType } from "../src/EnumArgumentType";
import { getSource, SourceKeys } from "../src/getSource";
import { Buffer } from "node:buffer";

const sourceEnum = new EnumArgumentType(Object.keys(SourceKeys));

task("simulate-fn", "Simulates the Chainlink Function. Possible sources: " + sourceEnum.enumValues.join(", "))
  .addParam("source", "The source key to simulate", "simpleExample", sourceEnum, true)
  .addParam("maxExecutionTimeMs", "The maximum execution time in milliseconds. Only for testing purposes. We can't increase this on a live environment.", 10000, types.int)
  .setAction(async (args) => {
    const result = await simulateScript({
      source: getSource(args.source),
      maxMemoryUsageMb: 128,
      args: ["0x4710a8d8f0d845da110086812a32de6d90d7ff5c", "stfcfa66a7c2e9061a6fac8b32027ee8", "2024-09-01"],
      maxExecutionTimeMs: args.maxExecutionTimeMs,
      secrets: {
        // hardcoded private key with access to data
        PRIVATE_KEY: "0x0000000000000000000000000000000000000000000000000000000000000001",
      },
    });

    const hexString = result.responseBytesHexstring;
    console.log({ result, hexString })
    if (!hexString) {
      throw new Error("No response bytes hexstring found");
    }
    const decodedString = Buffer.from(hexString.slice(2), 'hex').toString();
    console.log({ decodedString });
  }); 