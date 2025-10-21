import "dotenv/config";
process.env.BCRYPTO_FORCE_FALLBACK ??= "1";

import { subtask } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { join } from "path";
import { writeFile } from "fs/promises";
import { TASK_COMPILE_SOLIDITY } from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-switch-network";


if (process.env.SKIP_HARDHAT_TASKS !== "true") {
  require("./tasks");
}

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
const ETHEREUM_SEPOLIA_RPC_URL = process.env.ETHEREUM_SEPOLIA_RPC_URL;
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337
    },
    chainlinkLocalhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    },
    ...(ETHEREUM_SEPOLIA_RPC_URL && {
      sepolia: {
        url: ETHEREUM_SEPOLIA_RPC_URL,
        accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
      },
    }),
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

export = config;
