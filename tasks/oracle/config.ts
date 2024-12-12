import { task } from "hardhat/config";
import { TNOracleV1 } from "../../typechain-types";

task("oracle:setDonId", "Sets the DON ID")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("donId", "The new DON ID (hex string)")
  .setAction(async ({ contract, donId }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.setDonId(donId);
    console.log(`DON ID set to ${donId}, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:setSubscriptionId", "Sets the subscription ID")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("subId", "The new subscription ID")
  .setAction(async ({ contract, subId }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.setSubscriptionId(subId);
    console.log(`Subscription ID set to ${subId}, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:setGasLimit", "Sets the gas limit for requests")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("gasLimit", "The new gas limit")
  .setAction(async ({ contract, gasLimit }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.setGasLimit(parseInt(gasLimit, 10));
    console.log(`Gas limit set to ${gasLimit}, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:setStalePeriod", "Sets the stale period for requests")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("period", "The new stale period in seconds")
  .setAction(async ({ contract, period }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.setStalePeriod(parseInt(period, 10));
    console.log(`Stale period set to ${period} seconds, tx: ${tx.hash}`);
    await tx.wait();
  }); 