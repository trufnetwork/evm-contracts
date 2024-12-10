import { LocalFunctionsTestnet, startLocalFunctionsTestnet, SubscriptionManager } from "@chainlink/functions-toolkit";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import path from "path";
import { ether5Signer } from "../../src/lib";
import { TNOracleV1 } from "../../typechain-types";
import { MockTNConsumer } from "../../typechain-types/contracts/v1.0.0/mocks/MockTNConsumer";

export interface Fixture {
    tnOracle: TNOracleV1;
    admin: HardhatEthersSigner;
    sourceKeeper: HardhatEthersSigner;
    secretsKeeper: HardhatEthersSigner;
    pauseKeeper: HardhatEthersSigner;
    whitelistKeeper: HardhatEthersSigner;
    reader: HardhatEthersSigner;
    nonAuthorized: HardhatEthersSigner;
    localFunctionsTestnet: Awaited<ReturnType<typeof startLocalFunctionsTestnet>>;
    subscriptionManager: SubscriptionManager;
    subscriptionId: bigint;
    mockConsumer: MockTNConsumer;
}

const simulationConfigPath = path.join(__dirname, 'simulationConfig.js');

const DEFAULT_FUND_AMOUNT = ethers.parseEther("10");
const DEFAULT_SUBSCRIPTION_FUND = ethers.parseEther("0.1");

async function fundWallet(
    localFunctionsTestnet: LocalFunctionsTestnet, 
    wallet: HardhatEthersSigner, 
    amount: bigint = DEFAULT_FUND_AMOUNT
) {
    await localFunctionsTestnet.getFunds(wallet.address, { 
        juelsAmount: amount, 
        weiAmount: amount 
    });
}

export async function deployFixture(useLocalTestnet = false): Promise<Fixture> {
    let localFunctionsTestnet;

    if (useLocalTestnet) {
        localFunctionsTestnet = await startLocalFunctionsTestnet(simulationConfigPath, {
            logging: {
                debug: false,
                verbose: false,
                quiet: true
            }
        });
    }

    // Get signers
    const [admin, sourceKeeper, secretsKeeper, pauseKeeper, whitelistKeeper, reader, nonAuthorized] = 
        await ethers.getSigners();

    if (!localFunctionsTestnet) {
        throw new Error("Local Functions testnet is not available");
    }

    const subscriptionManager = new SubscriptionManager({
        signer: ether5Signer(admin),
        linkTokenAddress: localFunctionsTestnet.linkTokenContract.address,
        functionsRouterAddress: localFunctionsTestnet.functionsRouterContract.address
    });

    // Fund all relevant wallets
    const walletsToFund = [admin, sourceKeeper, secretsKeeper, pauseKeeper, whitelistKeeper, reader];
    await resolveInSequence(walletsToFund, (wallet) => fundWallet(localFunctionsTestnet, wallet));

    // Set up subscription
    await subscriptionManager.initialize();
    const subId = await subscriptionManager.createSubscription();
    const subscriptionId = BigInt(subId);
    await subscriptionManager.fundSubscription({ 
        subscriptionId: subId,
        juelsAmount: DEFAULT_SUBSCRIPTION_FUND 
    });

    // Deploy TNOracleV1
    const TNOracle = await ethers.getContractFactory("TNOracleV1");
    const tnOracle = await TNOracle.deploy(localFunctionsTestnet.functionsRouterContract.address);
    await tnOracle.waitForDeployment();

    await subscriptionManager.addConsumer({ 
        subscriptionId: subId,
        consumerAddress: await tnOracle.getAddress() 
    });

    // Set up roles
    const SOURCE_KEEPER_ROLE = await tnOracle.SOURCE_KEEPER_ROLE();
    const SECRETS_KEEPER_ROLE = await tnOracle.SECRETS_KEEPER_ROLE();
    const PAUSE_KEEPER_ROLE = await tnOracle.PAUSE_KEEPER_ROLE();
    const WHITELIST_KEEPER_ROLE = await tnOracle.WHITELIST_KEEPER_ROLE();
    const READER_ROLE = await tnOracle.READER_ROLE();

    await tnOracle.grantRole(SOURCE_KEEPER_ROLE, sourceKeeper.address);
    await tnOracle.grantRole(SECRETS_KEEPER_ROLE, secretsKeeper.address);
    await tnOracle.grantRole(PAUSE_KEEPER_ROLE, pauseKeeper.address);
    await tnOracle.grantRole(WHITELIST_KEEPER_ROLE, whitelistKeeper.address);
    await tnOracle.connect(whitelistKeeper).grantRole(READER_ROLE, reader.address);

    // Deploy MockTNConsumer
    const MockTNConsumer = await ethers.getContractFactory("MockTNConsumer");
    const mockConsumer = await MockTNConsumer.deploy(await tnOracle.getAddress());
    await mockConsumer.waitForDeployment();

    // Grant READER_ROLE to mockConsumer
    await tnOracle.connect(whitelistKeeper).grantRole(READER_ROLE, await mockConsumer.getAddress());

    // Add mockConsumer to subscription
    if (useLocalTestnet) {
        await subscriptionManager.addConsumer({
            subscriptionId,
            consumerAddress: await mockConsumer.getAddress()
        });
    }

    return {
        tnOracle,
        admin,
        sourceKeeper,
        secretsKeeper,
        pauseKeeper,
        whitelistKeeper,
        reader,
        nonAuthorized,
        localFunctionsTestnet,
        subscriptionManager,
        subscriptionId,
        mockConsumer,
    };
} 

const resolveInSequence = async <T>(itemList: T[], promiseFn: (item: T) => Promise<any>) => {
    for (const item of itemList) {
        await promiseFn(item);
    }
}