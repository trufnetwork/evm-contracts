import { scope } from "hardhat/config";
import { registerAdminTasks } from "./admin";
import { registerConfigTasks } from "./config";
import { registerRequestTasks } from "./request";
import { registerRolesTasks } from "./roles";
import { registerSecretsTasks } from "./secrets";
import { registerSourceTasks } from "./source";

const oracleScope = scope("oracle", "Interact with the TNOracleV1 contract");

// Register all oracle-related tasks
registerAdminTasks(oracleScope);
registerConfigTasks(oracleScope);
registerRequestTasks(oracleScope);
registerRolesTasks(oracleScope);
registerSecretsTasks(oracleScope);
registerSourceTasks(oracleScope);

export default oracleScope; 