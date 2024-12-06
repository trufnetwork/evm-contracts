import { HardhatUserConfig, subtask } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import "./tasks";
import { join } from "path";
import { writeFile } from "fs/promises";
import { TASK_COMPILE_SOLIDITY } from "hardhat/builtin-tasks/task-names";

subtask(TASK_COMPILE_SOLIDITY).setAction(async (_, { config }, runSuper) => {
  const superRes = await runSuper();

  try {
    await writeFile(
      join(config.paths.artifacts, "package.json"),
      '{ "type": "commonjs" }'
    );
  } catch (error) {
    console.error("Error writing package.json: ", error);
  }

  return superRes;
});

subtask(TASK_COMPILE_SOLIDITY).setAction(async (_, { config }, runSuper) => {
  const superRes = await runSuper();

  try {
    await writeFile(
      join(config.paths.root, "typechain-types", "package.json"),
      '{ "type": "commonjs" }'
    );
  } catch (error) {
    console.error("Error writing package.json: ", error);
  }

  return superRes;
});

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY;

const config: HardhatUserConfig = {
 solidity: "0.8.27",
 defaultNetwork: "hardhat",
 networks: {
  sepolia: {
    url: process.env.ETHEREUM_SEPOLIA_RPC_URL,
    accounts: [PRIVATE_KEY!],
  },
 },
 etherscan: {
   apiKey: ETHERSCAN_KEY,
 },
 typechain: {
  outDir: "typechain-types",
  target: "ethers-v6",
  alwaysGenerateOverloads: true,
 },
};

export default config;