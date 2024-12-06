import { task } from "hardhat/config";
import { TNConsumerExample } from "../typechain-types/contracts/TNConsumerExample";
import { SUBSCRIPTION_ID } from "../constants";

task("request-tn-data", "Sends a request to fetch TN data from a hardcoded stream")
  .addParam("contractAddress", "The deployed TNConsumerExample contract address")
  .addParam("day", "The day for which to fetch data (YYYY-MM-DD)")
  .setAction(async (taskArgs, hre) => {
    const { contractAddress, day } = taskArgs;
    const { ethers } = hre;

    const ownerAddress =  (await hre.ethers.provider.getSigner()).address.toLowerCase();
    const networkSubscriptions = SUBSCRIPTION_ID[hre.network.name as keyof typeof SUBSCRIPTION_ID];

    if (!(ownerAddress in networkSubscriptions)) {
      throw new Error(`No subscription ID found for ${ownerAddress} on ${hre.network.name}`);
    }
    const subscriptionIdValue = networkSubscriptions[ownerAddress as keyof typeof networkSubscriptions];

    // Connect to the TNConsumerExample contract
    const TNConsumerExampleFactory = await ethers.getContractFactory("TNConsumerExample");
    const tnConsumer = TNConsumerExampleFactory.attach(contractAddress) as unknown as TNConsumerExample;

    // Data provider address and streamId (replace with actual values or make them parameters)
    const dataProviderAddress = "0x4710a8d8f0d845da110086812a32de6d90d7ff5c";
    const streamId = "stfcfa66a7c2e9061a6fac8b32027ee8";



    try {
      // Send the TN data request
      const tx = await tnConsumer.requestTNData(dataProviderAddress, streamId, day);
      console.log("Transaction sent. Waiting for confirmation...");

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      if (receipt) {
        const event = receipt.logs[0];
        console.log(`Transaction confirmed. Request ID: ${event.topics[1]}. Transaction hash: ${event.transactionHash}`);
        const chainlinkExplorerUrl = getChainlinkExplorerUrl(hre.network.name, subscriptionIdValue);
        console.log(`See ${chainlinkExplorerUrl} for more details.`);

      } else {
        console.log("No events found in the transaction receipt");
      }
    } catch (error) {
      console.error("Error sending TN data request:", error);
    }
  }); 

const getChainlinkExplorerUrl = (chainName: string, subscriptionId: number) => {
  return `https://functions.chain.link/${chainName}/${subscriptionId}`;
}
