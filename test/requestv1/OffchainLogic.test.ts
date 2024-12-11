import { simulateScript } from "@chainlink/functions-toolkit";
import { assert, expect } from "chai";
import { ethers } from "ethers";
import { getSource } from "../../src/getSource";
import { getEnv } from "../helpers/environment";

describe("Off-Chain Logic Simulation", function () {
  // Test setup
  const dataProviderAddress = "0x4710a8d8f0d845da110086812a32de6d90d7ff5c";
  const streamId = "stfcfa66a7c2e9061a6fac8b32027ee8";
  const secrets = {
    PRIVATE_KEY: getEnv("TN_READER_PRIVATE_KEY")
  };
  const source = getSource("requestv1");
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Helper function to simulate and decode response
  async function simulateAndDecode(args: string[]) {
    const result = await simulateScript({
      source,
      args,
      secrets,
      maxMemoryUsageMb: 128,
      maxExecutionTimeMs: 10_000
    });
    
    const error = result.errorString;
    if (error) {
      throw new Error(error);
    }
    
    assert.isDefined(result.responseBytesHexstring, "Response bytes hexstring is undefined");
    return abiCoder.decode(["string", "int256"], result.responseBytesHexstring);
  }

  describe("RECORD Request Type (0)", function () {
    it("Should handle valid date with exact match", async function () {
      const args = [
        "0", // RequestType.RECORD
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01"
      ];

      const [date, value] = await simulateAndDecode(args);
      expect(date).to.equal("2024-08-30"); // not necessary to be 2024-09-01
      expect(value.toString()).to.equal("228750000000000000000");
    });

    it("Should handle different decimal multipliers", async function () {
      // Test with 0 decimals
      const args0 = ["0", "0", dataProviderAddress, streamId, "2024-09-01"];
      const [, value0] = await simulateAndDecode(args0);
      
      // Test with 18 decimals
      const args18 = ["0", "18", dataProviderAddress, streamId, "2024-09-01"];
      const [, value18] = await simulateAndDecode(args18);

      // The value with 18 decimals should be 10^18 times larger
      expect(value18.toString().length - value0.toString().length).to.be.approximately(18, 1);
    });

    describe("Error Handling", function () {
      it("Should fail with invalid date", async function () {
        const args = ["0", "18", dataProviderAddress, streamId, "invalid_date"];
        await expect(simulateAndDecode(args)).to.be.rejectedWith(/Invalid date/);
      });

      it("Should fail with invalid data provider address", async function () {
        const args = ["0", "18", "0xINVALID", streamId, "2024-09-01"];
        await expect(simulateAndDecode(args)).to.be.rejectedWith(/Invalid/);
      });

      it("Should fail with invalid stream id", async function () {
        const args = ["0", "18", dataProviderAddress, "invalid_stream_id", "2024-09-01"];
        await expect(simulateAndDecode(args)).to.be.rejectedWith(/dataset not found/i);
      });
    });
  });

  describe("INDEX Request Type (1)", function () {
    it("Should handle basic INDEX request", async function () {
      const args = [
        "1", // RequestType.INDEX
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01"
      ];

      const [date, value] = await simulateAndDecode(args);
      expect(date).to.be.a("string");
      expect(value.toString()).to.match(/^\d+$/);
    });

    it("Should handle INDEX request with optional parameters", async function () {
      const args = [
        "1",
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "12345678", // frozen_at
        "2024-01-01" // base_date
      ];

      const [date, value] = await simulateAndDecode(args);
      expect(date).to.be.a("string");
      expect(value.toString()).to.match(/^\d+$/);
    });
  });

  describe("Error Handling", function () {
    it("Should fail with invalid request type", async function () {
      const args = [
        "99", // Invalid request type
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01"
      ];

      await expect(simulateAndDecode(args)).to.be.rejectedWith(/Invalid request type/);
    });

    it("Should fail with invalid data provider address", async function () {
      const args = [
        "0",
        "18",
        "0xINVALID", // Invalid address
        streamId,
        "2024-09-01"
      ];

      await expect(simulateAndDecode(args)).to.be.rejectedWith(/Invalid/);
    });

    it("Should fail when secrets are missing", async function () {
      const args = [
        "0",
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01"
      ];

      const result = await simulateScript({
        source,
        args,
        secrets: {}, // Empty secrets
        maxMemoryUsageMb: 128,
        maxExecutionTimeMs: 10_000
      });

      expect(result.errorString).to.match(/invalid private key/i);
    });
  });

  describe("INDEX_CHANGE Request Type (2)", function () {
    it("Should handle valid INDEX_CHANGE request", async function () {
      const args = [
        "2", // RequestType.INDEX_CHANGE
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "", // frozen_at (optional)
        "", // base_date (optional)
        "7" // days_interval
      ];

      const [date, value] = await simulateAndDecode(args);
      expect(date).to.be.a("string");
      expect(value.toString()).to.match(/^\d+$/);
    });

    it("Should handle days_interval = 1 in INDEX_CHANGE request", async function () {
      const args = [
        "2", // RequestType.INDEX_CHANGE
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "", // frozen_at
        "", // base_date
        "1" // minimum days_interval
      ];

      const [date, value] = await simulateAndDecode(args);
      expect(date).to.be.a("string");
      expect(value.toString()).to.match(/^\-?\d+$/);
    });

    it("Should handle large decimals multiplier", async function () {
      const args = [
        "2", // RequestType.INDEX_CHANGE
        "50", // very large decimals
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "",
        "",
        "30"
      ];

      const [date, value] = await simulateAndDecode(args);
      expect(date).to.be.a("string");
      // Value should be much larger due to 36 decimals
      expect(value.toString().length).to.be.greaterThan(36);
    });

    it("Should fail with negative days_interval", async function () {
      const args = [
        "2",
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "",
        "",
        "-1" // negative days_interval
      ];

      await expect(simulateAndDecode(args))
        .to.be.rejectedWith(/days_interval must be a positive integer/i);
    });

    it("Should fail with zero days_interval", async function () {
      const args = [
        "2",
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "",
        "",
        "0" // zero days_interval
      ];

      await expect(simulateAndDecode(args))
        .to.be.rejectedWith(/Validation failed/i);
    });

    it("Should handle maximum allowed days_interval", async function () {
      const args = [
        "2",
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "",
        "",
        "3650" // maximum reasonable interval
      ];

      const [date, value] = await simulateAndDecode(args);
      expect(date).to.be.a("string");
      expect(value.toString()).to.match(/^\d+$/);
    });

    it("Should fail with invalid days_interval", async function () {
      const args = [
        "2",
        "18",
        dataProviderAddress,
        streamId,
        "2024-09-01",
        "",
        "",
        "potato" // Invalid days_interval
      ];

      await expect(simulateAndDecode(args)).to.be.rejectedWith(/days_interval must be a positive integer/i);
    });
  });
});
