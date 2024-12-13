import { task } from "hardhat/config";
import { TNOracleV1 } from "../../typechain-types";

task("oracle:setDonId", "Sets the DON ID")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("donId", "The new DON ID (hex string)")
  .setAction(async ({ contract, donId }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const encodedDonId = hre.ethers.encodeBytes32String(donId);
    const tx = await tnOracle.setDonId(encodedDonId);
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

task("oracle:getState", "Prints all visible states from the TNOracleV1 contract")
  .addParam("contract", "The TNOracleV1 contract address")
  .setAction(async ({ contract }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    
    // Get all state variables
    const [
      isPaused,
      donId,
      subscriptionId,
      gasLimit,
      stalePeriod,
      source,
      sourceLocation,
      encryptedSecretsUrl
    ] = await Promise.all([
      tnOracle.paused(),
      tnOracle.donID(),
      tnOracle.subscriptionId(),
      tnOracle.MAX_GAS_LIMIT(),
      tnOracle.stalePeriod(),
      tnOracle.source(),
      tnOracle.sourceLocation(),
      tnOracle.encryptedSecretsUrl()
    ]);

    // Format the output
    console.log("\n=== TNOracleV1 State ===");
    console.log("\nContract Address:", contract);
    console.log("\nOperational Status:");
    console.log("- Paused:", isPaused);
    
    console.log("\nChainlink Configuration:");
    console.log("- DON ID:", hre.ethers.decodeBytes32String(donId));
    console.log("- Subscription ID:", subscriptionId.toString());
    console.log("- Gas Limit:", gasLimit.toString());
    console.log("- Stale Period:", `${stalePeriod.toString()} seconds`);
    
    console.log("\nSource Configuration:");
    console.log("- Source Location:", sourceLocation);
    console.log("- Source:", source.length > 100 ? `${source.slice(0, 100)}...` : source);
    
    console.log("\nSecrets Configuration:");
    console.log("- Encrypted Secrets URL:", encryptedSecretsUrl.length > 0 ? "Set" : "Not Set");
    if (encryptedSecretsUrl.length > 0) {
      console.log("  Length:", encryptedSecretsUrl.length, "bytes");
    }
  }); 