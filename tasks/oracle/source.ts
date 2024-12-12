import { task } from "hardhat/config";
import { TNOracleV1 } from "../../typechain-types";
import { getSource, SourceKeys } from "../../src/getSource";
import { EnumArgumentType } from "../../src/EnumArgumentType";
import { Location } from "@chainlink/functions-toolkit";

const sourceEnum = new EnumArgumentType(Object.keys(SourceKeys));

task("oracle:setSourceInline", "Sets the source code for Chainlink Functions")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("source", "The source key to use", "simpleExample", sourceEnum, true)
  .setAction(async ({ contract, source }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const newSource = await getSource(source);
    const tx = await tnOracle.setSource(newSource, Location.Inline);
    console.log(`Source code set for ${source}, tx: ${tx.hash}`);
    await tx.wait();
  }); 

task("oracle:setSourceRemote", "Sets the source code for Chainlink Functions")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("url", "The URL of the source code")
  .setAction(async ({ contract, url }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const tx = await tnOracle.setSource(url, Location.Remote);
    console.log(`Source code set for ${url}, tx: ${tx.hash}`);
    await tx.wait();
  });
