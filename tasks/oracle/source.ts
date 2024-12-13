import { Location } from "@chainlink/functions-toolkit";
import { task, types } from "hardhat/config";
import { EnumArgumentType } from "../../src/EnumArgumentType";
import { getMinifiedSource, getProxifiableSource, getProxySource, getSource, SourceKeys } from "../../src/getSource";
import { TNOracleV1 } from "../../typechain-types";

const sourceEnum = new EnumArgumentType(Object.keys(SourceKeys));

task("oracle:setSourceInline", "Sets the source code for Chainlink Functions")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("minified", "Whether to use the minified source code", true, types.boolean)
  .addParam("source", "The source key to use", "simpleExample", sourceEnum, true)
  .setAction(async ({ contract, source, minified }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const newSource = minified ? await getMinifiedSource(source) : getSource(source);
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

task("oracle:setProxySource", "Sets the source code for Chainlink Functions")
  .addParam("contract", "The TNOracleV1 contract address")
  .addParam("source", "The source key to use", "simpleExample", sourceEnum, true)
  .addParam("proxyUrl", "The URL of the proxy source code")
  .setAction(async ({ contract, source, proxyUrl }, hre) => {
    const tnOracle = await hre.ethers.getContractAt("TNOracleV1", contract) as TNOracleV1;
    const { importStatements} = await getProxifiableSource(source);
    const proxySource = await getProxySource(proxyUrl, importStatements);
    const tx = await tnOracle.setSource(proxySource, Location.Inline);
    console.log(`Source code set for ${proxyUrl}, tx: ${tx.hash}`);
    await tx.wait();
  });