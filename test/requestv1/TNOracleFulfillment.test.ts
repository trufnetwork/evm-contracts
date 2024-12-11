import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { TNOracleV1, MockFunctionsRouter, MockTNConsumer } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expectRevertedWithCustomError } from "../helpers/errors";
import { TEST_CONSTANTS } from "../helpers/constants";
import { ContractTransactionReceipt, Log } from "ethers";

// Helper function to get requestId from receipt
function getRequestIdFromReceipt(receipt: ContractTransactionReceipt | null, mockRouter: MockFunctionsRouter): string {
    if (!receipt?.logs) {
        throw new Error("Transaction receipt or logs not found");
    }

    const requestEvent = receipt.logs.find(
        (log: Log) => log.topics[0] === mockRouter.interface.getEvent("RequestSimulated")?.topicHash
    );

    if (!requestEvent) {
        throw new Error("Request event not found");
    }

    return requestEvent.topics[1];
}

describe("TNOracle Fulfillment", function () {
    let tnOracle: TNOracleV1;
    let mockRouter: MockFunctionsRouter;
    let mockConsumer: MockTNConsumer;
    let admin: HardhatEthersSigner;
    let sourceKeeper: HardhatEthersSigner;
    let secretsKeeper: HardhatEthersSigner;
    let whitelistKeeper: HardhatEthersSigner;
    let nonRouter: HardhatEthersSigner;

    this.beforeAll(async function () {
        await hre.switchNetwork("hardhat");
    });

    this.afterAll(async function () {
        await hre.switchNetwork(hre.config.defaultNetwork);
    });

    beforeEach(async function () {
        // Get signers
        [admin, sourceKeeper, secretsKeeper, whitelistKeeper, nonRouter] = await ethers.getSigners();

        // Deploy mock router
        const MockRouter = await ethers.getContractFactory("MockFunctionsRouter");
        mockRouter = await MockRouter.deploy() as unknown as MockFunctionsRouter;

        // Deploy TNOracle with mock router
        const TNOracle = await ethers.getContractFactory("TNOracleV1");
        tnOracle = await TNOracle.deploy(await mockRouter.getAddress());

        // Set up roles
        const WHITELIST_KEEPER_ROLE = await tnOracle.WHITELIST_KEEPER_ROLE();
        const SOURCE_KEEPER_ROLE = await tnOracle.SOURCE_KEEPER_ROLE();
        const SECRETS_KEEPER_ROLE = await tnOracle.SECRETS_KEEPER_ROLE();
        await tnOracle.grantRole(WHITELIST_KEEPER_ROLE, whitelistKeeper.address);
        await tnOracle.grantRole(SOURCE_KEEPER_ROLE, sourceKeeper.address);
        await tnOracle.grantRole(SECRETS_KEEPER_ROLE, secretsKeeper.address);

        // Set required parameters with proper source and location
        await tnOracle.connect(sourceKeeper).setSubscriptionId(1n);
        await tnOracle.connect(sourceKeeper).setDonId(ethers.encodeBytes32String("mock-don-id"));
        await tnOracle.connect(sourceKeeper).setSource("console.log('test')", 0n); // Location.Inline = 0
        await tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(
            ethers.toUtf8Bytes("https://example.com/secrets")
        );

        // Deploy mock consumer
        const MockConsumer = await ethers.getContractFactory("MockTNConsumer");
        mockConsumer = await MockConsumer.deploy(await tnOracle.getAddress());

        // Grant READER_ROLE to mockConsumer
        await tnOracle.connect(whitelistKeeper).grantRole(
            await tnOracle.READER_ROLE(),
            await mockConsumer.getAddress()
        );
    });

    describe("Fulfillment Access Control", function () {
        it("Should revert if called by non-router address", async function () {
            const requestId = ethers.randomBytes(32);
            const response = ethers.toUtf8Bytes("test response");
            const err = new Uint8Array();

            const tx = tnOracle.connect(nonRouter).handleOracleFulfillment(
                requestId,
                response,
                err
            );

            expectRevertedWithCustomError(
                await tx.catch((error: unknown) => error),
                tnOracle,
                "OnlyRouterCanFulfill"
            );
        });
    });

    describe("Fulfillment Processing", function () {
        it("Should process successful fulfillment", async function () {
            // Create request through mock consumer
            const tx = await mockConsumer.requestRecord(
                18,
                TEST_CONSTANTS.PROVIDER,
                TEST_CONSTANTS.STREAM,
                TEST_CONSTANTS.DATE
            );
            const receipt = await tx.wait();
            const requestId = getRequestIdFromReceipt(receipt, mockRouter);

            // Mock successful response
            const response = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "int256"],
                [TEST_CONSTANTS.MOCK_RESPONSE.DATE, TEST_CONSTANTS.MOCK_RESPONSE.VALUE]
            );

            // Simulate fulfillment
            await (mockRouter as any).mockFulfill(
                await tnOracle.getAddress(),
                requestId,
                response,
                "0x"
            );

            // Verify consumer received correct data
            expect(await mockConsumer.lastRequestId()).to.equal(requestId);
            expect(await mockConsumer.lastDate()).to.equal(TEST_CONSTANTS.MOCK_RESPONSE.DATE);
            expect(await mockConsumer.lastValue()).to.equal(TEST_CONSTANTS.MOCK_RESPONSE.VALUE);
            expect(await mockConsumer.lastError()).to.equal("0x");
        });

        it("Should handle error fulfillment", async function () {
            // Create request
            const tx = await mockConsumer.requestRecord(
                18,
                TEST_CONSTANTS.PROVIDER,
                TEST_CONSTANTS.STREAM,
                TEST_CONSTANTS.DATE
            );
            const receipt = await tx.wait();
            const requestId = getRequestIdFromReceipt(receipt, mockRouter);

            // Mock error response
            const errorMessage = "Test error message";
            const errorResponse = ethers.toUtf8Bytes(errorMessage);

            // Simulate error fulfillment
            await (mockRouter as any).mockFulfill(
                await tnOracle.getAddress(),
                requestId,
                "0x",
                errorResponse
            );

            // Verify consumer received error
            expect(await mockConsumer.lastRequestId()).to.equal(requestId);
            expect(await mockConsumer.lastDate()).to.equal("");
            expect(await mockConsumer.lastValue()).to.equal(0);
            expect(ethers.toUtf8String(await mockConsumer.lastError())).to.equal(errorMessage);
        });

        it("Should handle stale request fulfillment", async function () {
            // Create request
            const tx = await mockConsumer.requestRecord(
                18,
                TEST_CONSTANTS.PROVIDER,
                TEST_CONSTANTS.STREAM,
                TEST_CONSTANTS.DATE
            );
            const receipt = await tx.wait();
            const requestId = getRequestIdFromReceipt(receipt, mockRouter);

            // Advance time beyond stale period
            await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
            await ethers.provider.send("evm_mine", []);

            // Attempt fulfillment
            const response = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "int256"],
                [TEST_CONSTANTS.MOCK_RESPONSE.DATE, TEST_CONSTANTS.MOCK_RESPONSE.VALUE]
            );

            const fulfillTx = (mockRouter as any).mockFulfill(
                await tnOracle.getAddress(),
                requestId,
                response,
                "0x"
            );

            await expectRevertedWithCustomError(
                await fulfillTx.catch((error: unknown) => error),
                tnOracle,
                "RequestTooStale"
            );
        });

        it("Should handle out-of-order fulfillments correctly", async function () {
            // Create first request
            const tx1 = await mockConsumer.requestRecord(
                18,
                TEST_CONSTANTS.PROVIDER,
                TEST_CONSTANTS.STREAM,
                TEST_CONSTANTS.DATE
            );
            const receipt1 = await tx1.wait();
            const requestId1 = getRequestIdFromReceipt(receipt1, mockRouter);

            // Create second request
            const tx2 = await mockConsumer.requestRecord(
                18,
                TEST_CONSTANTS.PROVIDER,
                TEST_CONSTANTS.STREAM,
                TEST_CONSTANTS.DATE
            );
            const receipt2 = await tx2.wait();
            const requestId2 = getRequestIdFromReceipt(receipt2, mockRouter);

            // Prepare responses
            const response1 = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "int256"],
                ["2024-01-01", 100n]
            );
            const response2 = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "int256"],
                ["2024-01-02", 200n]
            );

            // Fulfill second request first
            await (mockRouter as any).mockFulfill(
                await tnOracle.getAddress(),
                requestId2,
                response2,
                "0x"
            );

            // Verify second request data
            expect(await mockConsumer.lastRequestId()).to.equal(requestId2);
            expect(await mockConsumer.lastDate()).to.equal("2024-01-02");
            expect(await mockConsumer.lastValue()).to.equal(200n);
            expect(await mockConsumer.lastError()).to.equal("0x");

            // Fulfill first request
            await (mockRouter as any).mockFulfill(
                await tnOracle.getAddress(),
                requestId1,
                response1,
                "0x"
            );

            // Verify first request data
            expect(await mockConsumer.lastRequestId()).to.equal(requestId1);
            expect(await mockConsumer.lastDate()).to.equal("2024-01-01");
            expect(await mockConsumer.lastValue()).to.equal(100n);
            expect(await mockConsumer.lastError()).to.equal("0x");
        });
    });
}); 