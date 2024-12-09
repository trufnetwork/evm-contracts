import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ROUTER_ADDRESS } from "../../constants";

// npx hardhat ignition deploy ignition/modules/TNOracleV1.ts --network sepolia

const TNOracleV1Module = buildModule("TNOracleV1", (m) => {
  const _routerAddress = m.getParameter("_routerAddress", ROUTER_ADDRESS.sepolia);
  const TNOracleV1 = m.contract("TNOracleV1", [
      _routerAddress,
  ] );

  return { TNOracleV1  };
});

export default TNOracleV1Module;
