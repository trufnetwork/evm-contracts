import { expect } from "chai";
import { ethers } from "ethers";
import { deployFixture, Fixture } from "./helpers/fixtures";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { describe, it, beforeEach } from "vitest";

describe("TNOracleV1", function () {
    let fixture: Fixture;
    
    beforeEach(async function () {
        fixture = await deployFixture();
    });

    describe("Deployment & Role Setup", function () {
        it("Should set the right admin", async function () {
            const { tnOracle, admin } = fixture;
            const DEFAULT_ADMIN_ROLE = await tnOracle.DEFAULT_ADMIN_ROLE();
            expect(await tnOracle.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
        });

        it("Should set up role hierarchy correctly", async function () {
            const { tnOracle, sourceKeeper, secretsKeeper, pauseKeeper, whitelistKeeper, reader } = fixture;
            
            expect(await tnOracle.hasRole(await tnOracle.SOURCE_KEEPER_ROLE(), sourceKeeper.address)).to.be.true;
            expect(await tnOracle.hasRole(await tnOracle.SECRETS_KEEPER_ROLE(), secretsKeeper.address)).to.be.true;
            expect(await tnOracle.hasRole(await tnOracle.PAUSE_KEEPER_ROLE(), pauseKeeper.address)).to.be.true;
            expect(await tnOracle.hasRole(await tnOracle.WHITELIST_KEEPER_ROLE(), whitelistKeeper.address)).to.be.true;
            expect(await tnOracle.hasRole(await tnOracle.READER_ROLE(), reader.address)).to.be.true;
        });
    });

    describe("Access Control", function () {
        it("Should prevent non-secrets keeper from setting encrypted secrets URL", async function () {
            const { tnOracle, nonAuthorized } = fixture;
            const newUrl = ethers.toUtf8Bytes("https://example.com/secrets");
            await expect(
                tnOracle.connect(nonAuthorized).setEncryptedSecretsUrl(newUrl)
            ).to.be.revertedWith(
                `AccessControl: account ${nonAuthorized.address.toLowerCase()} is missing role ${await tnOracle.SECRETS_KEEPER_ROLE()}`
            );
        });

        it("Should prevent non-pause keeper from pausing", async function () {
            const { tnOracle, nonAuthorized } = fixture;
            await expect(
                tnOracle.connect(nonAuthorized).pause()
            ).to.be.revertedWith(
                `AccessControl: account ${nonAuthorized.address.toLowerCase()} is missing role ${await tnOracle.PAUSE_KEEPER_ROLE()}`
            );
        });
    });

    describe("Encrypted Secrets Management", function () {
        it("Should allow secrets keeper to set encrypted secrets URL", async function () {
            const { tnOracle, secretsKeeper } = fixture;
            const newUrl = ethers.toUtf8Bytes("https://example.com/secrets");
            
            await expect(tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(newUrl))
                .to.emit(tnOracle, "EncryptedSecretsUrlUpdated");
            
            const storedUrl = await tnOracle.encryptedSecretsUrl();
            expect(storedUrl).to.deep.equal(newUrl);
        });

        it("Should prevent setting identical encrypted secrets URL", async function () {
            const { tnOracle, secretsKeeper } = fixture;
            const url = ethers.toUtf8Bytes("https://example.com/secrets");
            
            await tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(url);
            
            await expect(
                tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(url)
            ).to.be.revertedWithCustomError(tnOracle, "IdenticalEncryptedSecretsUrl");
        });
    });

    describe("Pause Functionality", function () {
        it("Should allow pause keeper to pause and unpause", async function () {
            const { tnOracle, pauseKeeper } = fixture;
            
            await expect(tnOracle.connect(pauseKeeper).pause())
                .not.to.be.reverted;
            expect(await tnOracle.paused()).to.be.true;

            await expect(tnOracle.connect(pauseKeeper).unpause())
                .not.to.be.reverted;
            expect(await tnOracle.paused()).to.be.false;
        });

        it("Should prevent requests when paused", async function () {
            const { tnOracle, pauseKeeper, reader } = fixture;
            
            await tnOracle.connect(pauseKeeper).pause();
            
            await expect(
                tnOracle.connect(reader).requestRecord(
                    18,
                    "provider1",
                    "stream1",
                    "2024-03-14"
                )
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Parameter Management", function () {
        it("Should allow source keeper to set gas limit", async function () {
            const { tnOracle, sourceKeeper } = fixture;
            const newGasLimit = 300000;

            await expect(tnOracle.connect(sourceKeeper).setGasLimit(newGasLimit))
                .to.emit(tnOracle, "GasLimitUpdated")
                .withArgs(newGasLimit);
        });

        it("Should prevent setting gas limit above maximum", async function () {
            const { tnOracle, sourceKeeper } = fixture;
            const maxGasLimit = await tnOracle.MAX_GAS_LIMIT();
            const tooHighGasLimit = maxGasLimit + 1;

            await expect(
                tnOracle.connect(sourceKeeper).setGasLimit(tooHighGasLimit)
            ).to.be.revertedWithCustomError(tnOracle, "GasLimitTooHigh")
            .withArgs(tooHighGasLimit, maxGasLimit);
        });

        it("Should allow source keeper to set DON ID", async function () {
            const { tnOracle, sourceKeeper } = fixture;
            const newDonId = ethers.encodeBytes32String("NEW_DON_ID");

            await expect(tnOracle.connect(sourceKeeper).setDonId(newDonId))
                .to.emit(tnOracle, "DonIdUpdated")
                .withArgs(newDonId);

            expect(await tnOracle.donID()).to.equal(newDonId);
        });

        it("Should allow source keeper to set subscription ID", async function () {
            const { tnOracle, sourceKeeper } = fixture;
            const newSubId = 12345n;

            await expect(tnOracle.connect(sourceKeeper).setSubscriptionId(newSubId))
                .to.emit(tnOracle, "SubscriptionIdUpdated")
                .withArgs(newSubId);

            expect(await tnOracle.subscriptionId()).to.equal(newSubId);
        });
    });

    describe("Request Functionality", function () {
        beforeEach(async function () {
            const { tnOracle, secretsKeeper, sourceKeeper } = fixture;
            
            // Set up necessary parameters
            const secretsUrl = ethers.toUtf8Bytes("https://example.com/secrets");
            await tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(secretsUrl);
            
            const donId = ethers.encodeBytes32String("TEST_DON_ID");
            await tnOracle.connect(sourceKeeper).setDonId(donId);
            
            const subId = 1n;
            await tnOracle.connect(sourceKeeper).setSubscriptionId(subId);
        });

        it("Should allow reader to request record", async function () {
            const { tnOracle, reader } = fixture;
            
            await expect(
                tnOracle.connect(reader).requestRecord(
                    18,
                    "provider1",
                    "stream1",
                    "2024-03-14"
                )
            ).not.to.be.reverted;
        });

        it("Should allow reader to request index", async function () {
            const { tnOracle, reader } = fixture;
            
            await expect(
                tnOracle.connect(reader).requestIndex(
                    18,
                    "provider1",
                    "stream1",
                    "2024-03-14",
                    "", // frozen_at
                    "2024-01-01" // base_date
                )
            ).not.to.be.reverted;
        });

        it("Should allow reader to request index change", async function () {
            const { tnOracle, reader } = fixture;
            
            await expect(
                tnOracle.connect(reader).requestIndexChange(
                    18,
                    "provider1",
                    "stream1",
                    "2024-03-14",
                    "", // frozen_at
                    "2024-01-01", // base_date
                    "30" // days_interval
                )
            ).not.to.be.reverted;
        });

        it("Should prevent non-reader from making requests", async function () {
            const { tnOracle, nonAuthorized } = fixture;
            
            await expect(
                tnOracle.connect(nonAuthorized).requestRecord(
                    18,
                    "provider1",
                    "stream1",
                    "2024-03-14"
                )
            ).to.be.revertedWith(
                `AccessControl: account ${nonAuthorized.address.toLowerCase()} is missing role ${await tnOracle.READER_ROLE()}`
            );
        });
    });
}); 