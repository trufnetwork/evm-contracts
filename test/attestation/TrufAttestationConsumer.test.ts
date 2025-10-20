import { expect } from "chai";
import { ethers } from "hardhat";
import { buildCanonical, buildPayload, CanonicalFields } from "../helpers/attestation";
import { GOLDEN_PAYLOAD, goldenFixture } from "./golden";

describe("TrufAttestationConsumer", function () {
  async function deployConsumer() {
    const factory = await ethers.getContractFactory("TrufAttestationConsumer");
    return factory.deploy();
  }

  it("consumes a valid attestation and stores the latest datapoint", async function () {
    const consumer = await deployConsumer();
    const validator = ethers.getAddress(goldenFixture.data_provider);
    await consumer.setLeader(validator);

    const lastTimestamp = BigInt(goldenFixture.result.timestamps[goldenFixture.result.timestamps.length - 1]);
    const lastValue = ethers.parseUnits(goldenFixture.result.values[goldenFixture.result.values.length - 1], 18);
    const expectedStreamId = ethers.hexlify(ethers.toUtf8Bytes(goldenFixture.stream_id));

    await expect(consumer.consume(GOLDEN_PAYLOAD))
      .to.emit(consumer, "AttestationConsumed")
      .withArgs(
        validator,
        BigInt(goldenFixture.block_height),
        expectedStreamId,
        goldenFixture.action_id,
        lastTimestamp,
        lastValue
      );

    expect(await consumer.lastValidator()).to.equal(validator);
    expect(await consumer.lastBlockHeight()).to.equal(BigInt(goldenFixture.block_height));
    expect(await consumer.lastStreamId()).to.equal(expectedStreamId);
    expect(await consumer.lastActionId()).to.equal(goldenFixture.action_id);
    expect(await consumer.lastTimestamp()).to.equal(lastTimestamp);
    expect(await consumer.lastValue()).to.equal(lastValue);
  });

  it("reverts when validator is not trusted", async function () {
    const consumer = await deployConsumer();
    const validator = ethers.getAddress(goldenFixture.data_provider);
    await consumer.setLeader(validator);
    const tamperedPayload = (() => {
      const canonical = Buffer.from(goldenFixture.canonical_hex, "hex");
      canonical[canonical.length - 1] ^= 0xff;
      const signature = Buffer.from(goldenFixture.signature_hex, "hex");
      return `0x${Buffer.concat([canonical, signature]).toString("hex")}`;
    })();
    await expect(consumer.consume(tamperedPayload)).to.be.revertedWithCustomError(
      consumer,
      "AttestationConsumerInvalidSigner"
    );
  });

  it("reverts when attestation result is empty", async function () {
    const consumer = await deployConsumer();
    const signer = ethers.Wallet.createRandom();
    await consumer.setLeader(signer.address);

    const fields: CanonicalFields = {
      version: 1,
      algorithm: 0,
      blockHeight: 777n,
      dataProvider: signer.address,
      streamId: ethers.hexlify(ethers.randomBytes(32)),
      actionId: 1,
      args: ethers.getBytes("0x"),
      result: ethers.getBytes(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]", "int256[]"], [[], []])
      ),
    };

    const canonical = buildCanonical(fields);
    const digest = ethers.sha256(canonical);
    const signature = ethers.Signature.from(signer.signingKey.sign(ethers.getBytes(digest))).serialized;
    const payload = buildPayload(fields, ethers.getBytes(signature));

    await expect(consumer.consume(payload)).to.be.revertedWithCustomError(
      consumer,
      "AttestationConsumerEmptyResult"
    );
  });

  it("only owner can set leader", async function () {
    const consumer = await deployConsumer();
    const [, other] = await ethers.getSigners();
    await expect(consumer.connect(other).setLeader(other.address)).to.be.revertedWithCustomError(
      consumer,
      "AttestationConsumerOnlyOwner"
    );
  });

  it("reverts when leader is not configured", async function () {
    const consumer = await deployConsumer();
    await expect(consumer.consume(GOLDEN_PAYLOAD)).to.be.revertedWithCustomError(
      consumer,
      "AttestationConsumerLeaderNotSet"
    );
  });
});
