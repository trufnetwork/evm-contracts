import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TNOracleV1, MockFunctionsRouter } from "../../typechain-types";

export interface Fixture {
    tnOracle: TNOracleV1;
    mockRouter: MockFunctionsRouter;
    admin: HardhatEthersSigner;
    sourceKeeper: HardhatEthersSigner;
    secretsKeeper: HardhatEthersSigner;
    pauseKeeper: HardhatEthersSigner;
    whitelistKeeper: HardhatEthersSigner;
    reader: HardhatEthersSigner;
    nonAuthorized: HardhatEthersSigner;
}

export async function deployFixture(): Promise<Fixture> {
    // Get signers
    const [admin, sourceKeeper, secretsKeeper, pauseKeeper, whitelistKeeper, reader, nonAuthorized] = 
        await ethers.getSigners();

    // Deploy mock router
    const MockRouter = await ethers.getContractFactory("MockFunctionsRouter");
    const mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();

    // Deploy TNOracleV1
    const TNOracle = await ethers.getContractFactory("TNOracleV1");
    const tnOracle = await TNOracle.deploy(await mockRouter.getAddress());
    await tnOracle.waitForDeployment();

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

    return {
        tnOracle,
        mockRouter,
        admin,
        sourceKeeper,
        secretsKeeper,
        pauseKeeper,
        whitelistKeeper,
        reader,
        nonAuthorized
    };
} 