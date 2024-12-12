import { task } from "hardhat/config";
import { TNOracleV1 } from "../../typechain-types";

// Define valid role names
type RoleName = 
  | "SOURCE_KEEPER_ROLE"
  | "SECRETS_KEEPER_ROLE"
  | "PAUSE_KEEPER_ROLE"
  | "WHITELIST_KEEPER_ROLE"
  | "READER_ROLE"

task("oracle:grantRole", "Grants a role to a specified address")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("role", "The role name (e.g. SOURCE_KEEPER_ROLE)")
  .addParam("address", "The address to grant the role to")
  .setAction(async ({ contract, role, address }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const roleHash = await tnOracle[role as RoleName]();
    const tx = await tnOracle.grantRole(roleHash, address);
    console.log(`Granted ${role} to ${address}, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:revokeRole", "Revokes a role from a specified address")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("role", "The role name")
  .addParam("address", "The address to revoke the role from")
  .setAction(async ({ contract, role, address }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const roleHash = await tnOracle[role as RoleName]();
    const tx = await tnOracle.revokeRole(roleHash, address);
    console.log(`Revoked ${role} from ${address}, tx: ${tx.hash}`);
    await tx.wait();
  });

task("oracle:grantReader", "Grants READER_ROLE to an address")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("address", "The address to grant reader access")
  .setAction(async ({ contract, address }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const readerRole = await tnOracle.READER_ROLE();
    const tx = await tnOracle.grantRole(readerRole, address);
    console.log(`Granted READER_ROLE to ${address}, tx: ${tx.hash}`);
    await tx.wait();
  }); 