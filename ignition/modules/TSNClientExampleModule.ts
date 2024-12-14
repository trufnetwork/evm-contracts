import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ROUTER_ADDRESS } from "../../constants";

// npx hardhat ignition deploy ignition/modules/TSNConsumerExample.ts --network sepolia

const TNClientExampleModule = buildModule("TNClientExample", (m) => {
  const _routerAddress = m.getParameter("_routerAddress", ROUTER_ADDRESS.sepolia);
  const TNClientExample = m.contract("TNClientExample", [
      _routerAddress,
  ] );

  return { TNClientExample  };
});

export default TNClientExampleModule;
