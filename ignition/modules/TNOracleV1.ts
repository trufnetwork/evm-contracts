import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TSNOracleV1", (m) => {
  const routerAddress = m.getParameter("routerAddress");
  const stalePeriod = m.getParameter("stalePeriod", 3600n); // 1 hour

  // Deploy the TNOracleV1 contract
  const tnOracle = m.contract("TNOracleV1", [routerAddress]);

  // Get the roles
  const sourceKeeperRole = m.staticCall(tnOracle, "SOURCE_KEEPER_ROLE", []);
  const secretsKeeperRole = m.staticCall(tnOracle, "SECRETS_KEEPER_ROLE", []);
  const pauseKeeperRole = m.staticCall(tnOracle, "PAUSE_KEEPER_ROLE", []);
  const whitelistKeeperRole = m.staticCall(tnOracle, "WHITELIST_KEEPER_ROLE", []);

  const deployer = m.getAccount(0);

  // Grant all roles to the deployer
  m.call(tnOracle, "grantRole", [sourceKeeperRole, deployer]);
  m.call(tnOracle, "grantRole", [secretsKeeperRole, deployer]);
  m.call(tnOracle, "grantRole", [pauseKeeperRole, deployer]);
  m.call(tnOracle, "grantRole", [whitelistKeeperRole, deployer]);

  // Set initial configuration parameters using contract calls
  m.call(tnOracle, "setStalePeriod", [Number(stalePeriod)]);

  return { tnOracle };
});
