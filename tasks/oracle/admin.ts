import { task } from "hardhat/config";
import { TNOracleV1 } from "../../typechain-types";

task("oracle:proposeAdmin", "Propose a new default admin for the TNOracleV1")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("newAdmin", "The new admin address")
  .setAction(async ({ contract, newAdmin }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.beginDefaultAdminTransfer(newAdmin);
    console.log(`Proposed new admin: ${newAdmin}, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:acceptAdmin", "Accept the admin role if the delay period has passed")
  .addParam("contract", "The TNOracleV1 contract address")
  .setAction(async ({ contract }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.acceptDefaultAdminTransfer();
    console.log(`Admin role accepted, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:pause", "Pauses the TNOracleV1 contract")
  .addParam("contract", "The TNOracleV1 contract address")
  .setAction(async ({ contract }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.pause();
    console.log(`Contract paused, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:unpause", "Unpauses the TNOracleV1 contract")
  .addParam("contract", "The TNOracleV1 contract address")
  .setAction(async ({ contract }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.unpause();
    console.log(`Contract unpaused, tx: ${tx.hash}`);
    await tx.wait();
  }); 