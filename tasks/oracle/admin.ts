import { task } from "hardhat/config";
import { TNOracleV1 } from "../../typechain-types";
import { confirmRenounce } from "./utils";

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

task("oracle:renounceAdmin", "Renounces the admin role from the caller's address")
  .addParam("contract", "The TNOracleV1 contract address") 
  .setAction(async ({ contract }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const signer = await hre.ethers.provider.getSigner();
    const signerAddress = await signer.getAddress();

    if (await confirmRenounce({ 
      type: 'admin', 
      contract, 
      address: signerAddress 
    })) {
      const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const tx = await tnOracle.renounceRole(DEFAULT_ADMIN_ROLE, signerAddress);
      console.log(`\n🔥 Renouncing admin role, tx: ${tx.hash}`);
      await tx.wait();
      console.log("✅ Admin role successfully renounced");
    }
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

