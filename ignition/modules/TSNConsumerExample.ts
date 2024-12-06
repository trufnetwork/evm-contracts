// SEPOLIA TSNConsumerExample#TNConsumerExample - 0xcfc6ec1b1D807BB16f0936257790fE6Aa52F2744

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ROUTER_ADDRESS } from "../../constants";

// npx hardhat ignition deploy ignition/modules/TSNConsumerExample.ts --network sepolia

const TSNConsumerExampleModule = buildModule("TSNConsumerExample", (m) => {
  const _routerAddress = m.getParameter("_routerAddress", ROUTER_ADDRESS.sepolia);
  const TNConsumerExample = m.contract("TNConsumerExample", [
      _routerAddress,
  ] );

  return { TNConsumerExample  };
});

export default TSNConsumerExampleModule;
