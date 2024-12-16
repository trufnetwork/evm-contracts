import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TNOracleV1", (m) => {
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

  // Grant roles to the deployer
  const sourceKeeperGrant = m.call(tnOracle, "grantRole", [sourceKeeperRole, deployer], { id: "grant_source_keeper_role" });
  m.call(tnOracle, "grantRole", [secretsKeeperRole, deployer], { id: "grant_secrets_keeper_role" });
  m.call(tnOracle, "grantRole", [pauseKeeperRole, deployer], { id: "grant_pause_keeper_role" });
  m.call(tnOracle, "grantRole", [whitelistKeeperRole, deployer], { id: "grant_whitelist_keeper_role" });

  // Set initial configuration parameters AFTER roles are granted
  m.call(tnOracle, "setStalePeriod", [stalePeriod], { 
    id: "set_stale_period",
    after: [sourceKeeperGrant]
  });

  return { tnOracle };
});
