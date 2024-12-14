import { scope } from "hardhat/config";
import { registerSetContractVariablesTasks } from "./setContractVariables";
import { registerRequestTNDataTasks } from "./requestTNData";

const exampleScope = scope("example", "Interact with the TNClientExample contract");

// Register all example-related tasks
registerSetContractVariablesTasks(exampleScope);
registerRequestTNDataTasks(exampleScope);

export default exampleScope;
