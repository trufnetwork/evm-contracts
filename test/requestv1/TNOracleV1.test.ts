import { expect } from "chai";
import { ethers } from "hardhat";
import { getSource } from "../../src/getSource";
import { expectRevertedWithCustomError } from "../helpers/errors";
import { deployFixture, type Fixture } from "../helpers/fixtures";
import { TEST_CONSTANTS } from "../helpers/constants";
import { setupForRequests } from "../helpers/setup";

describe("TNOracleV1", function () {
  let fixture: Fixture;

  this.timeout(30000);

  beforeEach(async function () {
    fixture = await deployFixture(true);
  });

  afterEach(async function () {
    if (fixture.localFunctionsTestnet) {
      await fixture.localFunctionsTestnet.close();
    }
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
      const newUrl = ethers.toUtf8Bytes("thisshouldbeandencodedurl");
      const err = await expect(
        tnOracle.connect(nonAuthorized).setEncryptedSecretsUrl(newUrl)
      ).to.eventually.be.rejected;

      expectRevertedWithCustomError(
        err,
        tnOracle,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("Should prevent non-pause keeper from pausing", async function () {
      const { tnOracle, nonAuthorized } = fixture;
      const err = await expect(tnOracle.connect(nonAuthorized).pause()).to
        .eventually.be.rejected;

      expectRevertedWithCustomError(
        err,
        tnOracle,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Encrypted Secrets Management", function () {
    it("Should allow secrets keeper to set encrypted secrets URL", async function () {
      const { tnOracle, secretsKeeper } = fixture;
      const newUrl = ethers.toUtf8Bytes("thissecreturlshouldbeencoded");

      await expect(
        tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(newUrl)
      ).to.emit(tnOracle, "EncryptedSecretsUrlUpdated");

      const storedUrl = await tnOracle.encryptedSecretsUrl();
      const decodedUrl = ethers.toUtf8String(storedUrl);
      expect(decodedUrl).to.equal("thissecreturlshouldbeencoded");
    });

    it("Should prevent setting identical encrypted secrets URL", async function () {
      const { tnOracle, secretsKeeper } = fixture;
      const url = ethers.toUtf8Bytes("https://example.com/secrets");

      await tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(url);

      const err = await expect(
        tnOracle.connect(secretsKeeper).setEncryptedSecretsUrl(url)
      ).to.be.rejected;

      expectRevertedWithCustomError(
        err,
        tnOracle,
        "IdenticalEncryptedSecretsUrl"
      );
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow pause keeper to pause and unpause", async function () {
      const { tnOracle, pauseKeeper } = fixture;

      await expect(tnOracle.connect(pauseKeeper).pause()).not.to.be.reverted;
      expect(await tnOracle.paused()).to.be.true;

      await expect(tnOracle.connect(pauseKeeper).unpause()).not.to.be.reverted;
      expect(await tnOracle.paused()).to.be.false;
    });

    it("Should prevent requests when paused", async function () {
      const { tnOracle, pauseKeeper, reader } = fixture;

      await tnOracle.connect(pauseKeeper).pause();

      const err = await expect(
        tnOracle
          .connect(reader)
          .requestRecord(18, "provider1", "stream1", "2024-03-14")
      ).to.be.rejected;

      expectRevertedWithCustomError(err, tnOracle, "EnforcedPause");
    });
  });

  describe("Parameter Management", function () {
    it("Should allow source keeper to set gas limit", async function () {
      const { tnOracle, sourceKeeper } = fixture;
      const newGasLimit = TEST_CONSTANTS.GAS_LIMIT;

      await expect(tnOracle.connect(sourceKeeper).setGasLimit(newGasLimit))
        .to.emit(tnOracle, "GasLimitUpdated")
        .withArgs(newGasLimit);
    });

    it("Should prevent setting gas limit above maximum", async function () {
      const { tnOracle, sourceKeeper } = fixture;
      const maxGasLimit = await tnOracle.MAX_GAS_LIMIT();
      const tooHighGasLimit = maxGasLimit + BigInt(1);

      const err = await expect(
        tnOracle.connect(sourceKeeper).setGasLimit(tooHighGasLimit)
      ).to.be.rejected;

      expectRevertedWithCustomError(err, tnOracle, "GasLimitTooHigh", [
        tooHighGasLimit,
        maxGasLimit,
      ]);
    });

    it("Should allow source keeper to set DON ID", async function () {
      const { tnOracle, sourceKeeper, localFunctionsTestnet } = fixture;
      const newDonId = ethers.encodeBytes32String(localFunctionsTestnet.donId);

      await expect(tnOracle.connect(sourceKeeper).setDonId(newDonId))
        .to.emit(tnOracle, "DonIdUpdated")
        .withArgs(newDonId);

      expect(await tnOracle.donID()).to.equal(newDonId);
    });

    it("Should allow source keeper to set subscription ID", async function () {
      const { tnOracle, sourceKeeper, subscriptionId } = fixture;

      await expect(tnOracle.connect(sourceKeeper).setSubscriptionId(subscriptionId))
        .to.emit(tnOracle, "SubscriptionIdUpdated")
        .withArgs(subscriptionId);

      expect(await tnOracle.subscriptionId()).to.equal(subscriptionId);
    });
  });

  describe("Request Functionality", function () {
    beforeEach(async function () {
      const { tnOracle, sourceKeeper, secretsKeeper, localFunctionsTestnet, subscriptionId } = fixture;
      const roles = {
        sourceKeeper,
        secretsKeeper,
        pauseKeeper: fixture.pauseKeeper,
        whitelistKeeper: fixture.whitelistKeeper,
        reader: fixture.reader
      };

      await setupForRequests(tnOracle, roles, {
        subscriptionId: subscriptionId,
        donId: localFunctionsTestnet.donId,
        source: getSource('requestv1'),
      });
      
    });

    it("Should allow reader to request record", async function () {
      const { tnOracle, reader } = fixture;

      await expect(
        tnOracle
          .connect(reader)
          .requestRecord(18, TEST_CONSTANTS.PROVIDER, TEST_CONSTANTS.STREAM, TEST_CONSTANTS.DATE)
      ).not.to.be.reverted;
    });

    it("Should allow reader to request index", async function () {
      const { tnOracle, reader } = fixture;

      await expect(
        tnOracle
          .connect(reader)
          .requestIndex(
            18,
            TEST_CONSTANTS.PROVIDER,
            TEST_CONSTANTS.STREAM,
            TEST_CONSTANTS.DATE,
            "", // frozen_at
            TEST_CONSTANTS.BASE_DATE
          )
      ).not.to.be.reverted;
    });

    it("Should allow reader to request index change", async function () {
      const { tnOracle, reader } = fixture;

      await expect(
        tnOracle
          .connect(reader)
          .requestIndexChange(
            18,
            TEST_CONSTANTS.PROVIDER,
            TEST_CONSTANTS.STREAM,
            TEST_CONSTANTS.DATE,
            "", // frozen_at
            TEST_CONSTANTS.BASE_DATE,
            TEST_CONSTANTS.DAYS_INTERVAL
          )
      ).not.to.be.reverted;
    });

    it("Should prevent non-reader from making requests", async function () {
      const { tnOracle, nonAuthorized } = fixture;

      const err = await expect(
        tnOracle
          .connect(nonAuthorized)
          .requestRecord(18, "provider1", "stream1", "2024-03-14")
      ).to.be.rejected;

      expectRevertedWithCustomError(
        err,
        tnOracle,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Callback Functionality", function () {
    beforeEach(async function () {
      const { tnOracle, secretsKeeper, sourceKeeper, localFunctionsTestnet, subscriptionId } = fixture;

      await setupForRequests(tnOracle, {
        sourceKeeper,
        secretsKeeper,
      }, {
        subscriptionId: subscriptionId,
        donId: localFunctionsTestnet.donId,
        source: getSource('requestv1'),
      });
    });

    it("Should successfully make a request and receive callback with result", async function () {
      const { mockConsumer } = fixture;

      // Make request through mock consumer
      const tx = await mockConsumer.requestRecord(
        18,
        "0x4710a8d8f0d845da110086812a32de6d90d7ff5c",
        "stfcfa66a7c2e9061a6fac8b32027ee8",
        "2024-09-01"
      );

      const dataReceivedPromise = new Promise(resolve => mockConsumer.once(mockConsumer.filters.DataReceived(), (event) => resolve(event)));

      // Wait for transaction
      await tx.wait();
      await dataReceivedPromise;

      // Check the stored values in mock consumer
      const lastRequestId = await mockConsumer.lastRequestId();
      expect(lastRequestId).to.not.equal(ethers.ZeroHash);

      const lastError = await mockConsumer.lastError();
      const lastErrorString = ethers.toUtf8String(lastError);
      expect(lastErrorString).to.equal("");

      const lastDate = await mockConsumer.lastDate();
      expect(lastDate).to.equal("2024-08-30");

      const lastValue = await mockConsumer.lastValue();
      expect(lastValue).to.equal(228750000000000000000n);


    });

    it("Should emit DataReceived event with correct values", async function () {
      const { mockConsumer } = fixture;

      const tx = await mockConsumer.requestRecord(
        18,
        "0x4710a8d8f0d845da110086812a32de6d90d7ff5c",
        "stfcfa66a7c2e9061a6fac8b32027ee8",
        "2024-09-01"
      );

      const dataReceivedPromise = new Promise(resolve => mockConsumer.once(mockConsumer.filters.DataReceived(), (event) => resolve(event)));

      await tx.wait();

      // Wait for local testnet to process
      await dataReceivedPromise;

      // Get the last event
      const events = await mockConsumer.queryFilter(
        mockConsumer.filters.DataReceived()
      );
      expect(events.length).to.be.greaterThan(0);

      const lastEvent = events[events.length - 1];
      expect(lastEvent.args.date).to.equal("2024-08-30");
      expect(lastEvent.args.value).to.equal(228750000000000000000n);
      expect(lastEvent.args.err).to.equal("0x");
    });

    it("Should handle errors gracefully", async function () {
      const { mockConsumer } = fixture;

      // Request with invalid parameters to trigger an error
      const tx = await mockConsumer.requestRecord(
        18,
        "invalid_address",
        "invalid_stream",
        "invalid_date"
      );

      const dataReceivedPromise = new Promise(resolve => mockConsumer.once(mockConsumer.filters.DataReceived(), (event) => resolve(event)));

      // Wait for transaction and log its hash
      const receipt = await tx.wait();

      // Wait for local testnet to process
      await dataReceivedPromise;

      // Existing assertions
      const lastError = await mockConsumer.lastError();
      const lastErrorString = ethers.toUtf8String(lastError);
      expect(lastErrorString).to.match(/Invalid Ethereum address format/);
    });
  });
});
