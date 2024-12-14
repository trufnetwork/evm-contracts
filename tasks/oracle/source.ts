import { Location } from "@chainlink/functions-toolkit";
import { types } from "hardhat/config";
import { ConfigurableScopeDefinition } from "hardhat/types";
import { EnumArgumentType } from "../../src/EnumArgumentType";
import { getLoadableSource, getRemoteLoaderSource, getSource, SourceKeys } from "../../src/getSource";
import { TNOracleV1 } from "../../typechain-types";

const sourceEnum = new EnumArgumentType(Object.keys(SourceKeys));

export const registerSourceTasks = (scope: ConfigurableScopeDefinition) => {
  scope
    .task("setSourceInline", "Sets the source code for Chainlink Functions")
    .addParam("contract", "The TNOracleV1 contract address")
    .addParam("source", "The source key to use", "simpleExample", sourceEnum, true)
    .setAction(async ({ contract, source }, hre) => {
      const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
      const newSource = getSource(source);
      const tx = await tnOracle.setSource(newSource, Location.Inline);
      console.log(`Source code set for ${source}, tx: ${tx.hash}`);
      await tx.wait();
    });

  scope
    .task("setSourceRemote", "Sets the source code for Chainlink Functions")
    .addParam("contract", "The TNOracleV1 contract address")
    .addParam("url", "The URL of the source code")
    .setAction(async ({ contract, url }, hre) => {
      const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
      const tx = await tnOracle.setSource(url, Location.Remote);
      console.log(`Source code set for ${url}, tx: ${tx.hash}`);
      await tx.wait();
    });

  scope
    .task("setLoaderSource", "Sets the source code for Chainlink Functions")
    .addParam("contract", "The TNOracleV1 contract address")
    .addParam("source", "The source key to use", "simpleExample", sourceEnum, true)
    .addParam("url", "The URL of the remote source code")
    .setAction(async ({ contract, source, url }, hre) => {
      const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
      const { importStatements} = await getLoadableSource(source);
      const remoteLoaderSource = getRemoteLoaderSource(url, importStatements);
      const tx = await tnOracle.setSource(remoteLoaderSource, Location.Inline);
      console.log(`Source code set for ${url}, tx: ${tx.hash}`);
      await tx.wait();
    });
};