import { ethers } from "ethers";

export const TEST_CONSTANTS = {
  PROVIDER: "0x4710a8d8f0d845da110086812a32de6d90d7ff5c",
  STREAM: "stfcfa66a7c2e9061a6fac8b32027ee8",
  DATE: "2024-09-01",
  BASE_DATE: "2024-01-01",
  DAYS_INTERVAL: "30",
  SECRETS_URL: ethers.toUtf8Bytes("thissecreturlshouldbeencoded"),
  GAS_LIMIT: 300000n,
  MOCK_RESPONSE: {
    DATE: "2024-08-30",
    VALUE: 228750000000000000000n
  }
}; 