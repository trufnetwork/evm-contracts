import { ContractTransactionResponse } from "ethers";
import { task } from "hardhat/config";
import { DON_ID, SUBSCRIPTION_ID } from "../constants/index";
import { EnumArgumentType } from "../src/EnumArgumentType";
import { getEncryptedSecretsUrl, getSource, SourceKeys } from "../src/getSource";
import { TNConsumerExample } from "../typechain-types/contracts/TNConsumerExample";

const sourceEnum = new EnumArgumentType(Object.keys(SourceKeys));

task("set-contract-variables", "Sets the current variables for the TNConsumerExample contract")
  .addParam("contractAddress", "The deployed contract address")
  .addParam("source", "The source key to use", SourceKeys.simpleExample, sourceEnum, true)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const contractAddress = taskArgs.contractAddress;


    const ownerAddress =  (await hre.ethers.provider.getSigner()).address.toLowerCase();
    const networkSubscriptions = SUBSCRIPTION_ID[hre.network.name as keyof typeof SUBSCRIPTION_ID];

    if (!(ownerAddress in networkSubscriptions)) {
      throw new Error(`No subscription ID found for ${ownerAddress} on ${hre.network.name}`);
    }
    const subscriptionIdValue = networkSubscriptions[ownerAddress as keyof typeof networkSubscriptions];

    const TNConsumerExampleFactory =
      await ethers.getContractFactory("TNConsumerExample");
    const tnConsumer = TNConsumerExampleFactory.attach(
      contractAddress
    ) as unknown as TNConsumerExample;

    // Example initialization steps
    console.log("Setting gas limit...");
    const gasLimit = await tnConsumer.setGasLimit(200000);
    console.log("Setting source...");
    const source = await setOrSkipIfUnchanged(
      tnConsumer,
      "source",
      "setSource",
      await getSource(taskArgs.source)
    );
    console.log("Setting encrypted secrets URL...");
    const encryptedSecretsUrl = await setOrSkipIfUnchanged(
      tnConsumer,
      "encryptedSecretsUrl",
      "setEncryptedSecretsUrl",
      await getEncryptedSecretsUrl()
    );
    console.log("Setting DON ID...");
    const donId = await setOrSkipIfUnchanged(
      tnConsumer,
      "donID",
      "setDonId",
      hre.ethers.encodeBytes32String(
        DON_ID[hre.network.name as keyof typeof DON_ID]
      )
    );
    console.log("Setting subscription ID...");


    const subscriptionId = await setOrSkipIfUnchanged(
      tnConsumer,
      "subscriptionId",
      "setSubscriptionId",
      subscriptionIdValue
    );

    await Promise.all([
      gasLimit?.wait(),
      source?.wait(),
      encryptedSecretsUrl?.wait(),
      donId?.wait(),
      subscriptionId?.wait(),
    ]);

    console.log("TNConsumerExample initialized.");
  });

const setOrSkipIfUnchanged = async (
  contract: TNConsumerExample,
  getter: keyof TNConsumerExample,
  setter: keyof TNConsumerExample,
  newValue: string | number
): Promise<void | ContractTransactionResponse> => {
  const currentValue = await contract[getter]();
  if (currentValue === newValue) {
    console.log(`${String(getter)} already set.`);
    return Promise.resolve();
  }
  return contract[setter](newValue);
};
