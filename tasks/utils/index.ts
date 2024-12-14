import { scope } from "hardhat/config";
import { registerBuildSourceTasks } from "./buildSource";
import { registerEncryptUrlTasks } from "./encryptUrl";
import { registerGenOffchainSecretsTasks } from "./genOffchainSecrets";

const utilsScope = scope("utils", "General utility tasks");

// Register all utility tasks
registerBuildSourceTasks(utilsScope);
registerEncryptUrlTasks(utilsScope);
registerGenOffchainSecretsTasks(utilsScope);

export default utilsScope;