import { expect } from "chai";
import { ethers } from "hardhat";
import { buildCanonical, buildPayload, CanonicalFields } from "../helpers/attestation";
import { GOLDEN_CANONICAL, GOLDEN_PAYLOAD, GOLDEN_SIGNATURE, goldenFixture } from "./golden";

async function deployHarness() {
  const factory = await ethers.getContractFactory("TrufAttestationHarness");
  return factory.deploy();
}

describe("TrufAttestation library", function () {
  it("parses, hashes, verifies, and decodes data points", async function () {
    const [deployer, other] = await ethers.getSigners();
    const harnessFactory = await ethers.getContractFactory("TrufAttestationHarness", deployer);
    const harness = await harnessFactory.deploy();

    const signingWallet = ethers.Wallet.createRandom();

    const timestamps = [1n, 2n, 3n];
    const values = [BigInt(100) * 10n ** 18n, -BigInt(250) * 10n ** 18n, 0n];
    const abiEncodedResult = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[]", "int256[]"],
      [timestamps, values]
    );

    const fields: CanonicalFields = {
      version: 1,
      algorithm: 0,
      blockHeight: 123n,
      dataProvider: signingWallet.address,
      streamId: ethers.hexlify(ethers.randomBytes(32)),
      actionId: 1,
      args: ethers.getBytes("0x010203"),
      result: ethers.getBytes(abiEncodedResult),
    };

    const canonical = buildCanonical(fields);
    const digest = ethers.sha256(canonical);

    const signature = signingWallet.signingKey.sign(ethers.getBytes(digest));
    const serializedSignature = ethers.Signature.from(signature).serialized;

    const payload = buildPayload(fields, ethers.getBytes(serializedSignature));

    const parsed = await harness.parse(payload);
    expect(parsed.version).to.equal(fields.version);
    expect(parsed.algorithm).to.equal(fields.algorithm);
    expect(parsed.blockHeight).to.equal(fields.blockHeight);
    expect(parsed.dataProvider).to.equal(signingWallet.address);
    expect(parsed.streamId.toLowerCase()).to.equal(fields.streamId.toLowerCase());
    expect(parsed.actionId).to.equal(fields.actionId);
    expect(Number(await harness.toAction(parsed.actionId))).to.equal(fields.actionId);
    expect(parsed.args).to.equal(ethers.hexlify(fields.args));
    expect(parsed.result).to.equal(ethers.hexlify(fields.result));
    expect(parsed.signature).to.equal(serializedSignature);

    const hashed = await harness.hash(payload);
    expect(hashed).to.equal(digest);

    expect(await harness.verify(payload, signingWallet.address)).to.equal(true);
    expect(await harness.verify(payload, other.address)).to.equal(false);

    const decoded = await harness.decodeDataPoints(payload);
    expect(decoded.length).to.equal(timestamps.length);
    for (let i = 0; i < decoded.length; i++) {
      expect(decoded[i].timestamp).to.equal(timestamps[i]);
      expect(decoded[i].value).to.equal(values[i]);
    }

    const [metaBlockHeight, metaProvider, metaStream, metaAction] = await harness.metadata(payload);
    expect(metaBlockHeight).to.equal(fields.blockHeight);
    expect(metaProvider).to.equal(signingWallet.address);
    expect(metaStream).to.equal(fields.streamId);
    expect(Number(metaAction)).to.equal(fields.actionId);

    const [bodyArgs, bodyResult] = await harness.body(payload);
    expect(bodyArgs).to.equal(ethers.hexlify(fields.args));
    expect(bodyResult).to.equal(ethers.hexlify(fields.result));
  });

  it("parses attestation payload from the golden fixture", async function () {
    const harness = await deployHarness();

    const payload = GOLDEN_PAYLOAD;
    const parsed = await harness.parse(payload);

    expect(parsed.version).to.equal(1);
    expect(parsed.algorithm).to.equal(0);
    expect(parsed.blockHeight).to.equal(BigInt(goldenFixture.block_height));
    expect(parsed.dataProvider).to.equal(ethers.getAddress(goldenFixture.data_provider));
    expect(parsed.streamId).to.equal(
      ethers.hexlify(ethers.toUtf8Bytes(goldenFixture.stream_id))
    );
    const parsedActionId = Number(parsed.actionId);
    expect(parsedActionId).to.equal(goldenFixture.action_id);
    if (parsedActionId <= 5) {
      expect(Number(await harness.toAction(parsedActionId))).to.equal(goldenFixture.action_id);
    } else {
      await expect(harness.toAction(parsedActionId)).to.be.revertedWithCustomError(
        harness,
        "AttestationUnexpectedActionId"
      );
    }

    const streamLabel = ethers.toUtf8String(parsed.streamId);
    expect(streamLabel).to.equal(goldenFixture.stream_id);
    expect(parsed.signature).to.equal(GOLDEN_SIGNATURE);

    const points = await harness.decodeDataPoints(payload);
    expect(points.length).to.equal(goldenFixture.result.timestamps.length);
    for (let i = 0; i < points.length; i++) {
      expect(points[i].timestamp).to.equal(BigInt(goldenFixture.result.timestamps[i]));
      expect(points[i].value).to.equal(ethers.parseUnits(goldenFixture.result.values[i], 18));
    }

    const expectedValidator = ethers.getAddress(goldenFixture.data_provider);
    expect(await harness.verify(payload, expectedValidator)).to.equal(true);

    const [blockHeight, provider, stream, action] = await harness.metadata(payload);
    expect(blockHeight).to.equal(parsed.blockHeight);
    expect(provider).to.equal(parsed.dataProvider);
    expect(stream).to.equal(parsed.streamId);
    expect(Number(action)).to.equal(goldenFixture.action_id);

    const [argsBytes, resultBytes] = await harness.body(payload);
    expect(argsBytes).to.equal(parsed.args);
    expect(resultBytes).to.equal(parsed.result);

    const payloadBytes = ethers.getBytes(payload);
    const canonicalHexFromPayload = ethers.hexlify(payloadBytes.slice(0, -65));
    const signatureHexFromPayload = ethers.hexlify(payloadBytes.slice(-65));
    expect(canonicalHexFromPayload).to.equal(GOLDEN_CANONICAL);
    expect(signatureHexFromPayload).to.equal(GOLDEN_SIGNATURE);
  });

  it("reverts verification for unsupported algorithm", async function () {
    const [deployer] = await ethers.getSigners();
    const harness = await (await ethers.getContractFactory("TrufAttestationHarness", deployer)).deploy();

    const signingWallet = ethers.Wallet.createRandom();

    const abiEncodedResult = ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]", "int256[]"], [[1n], [0n]]);
    const fields: CanonicalFields = {
      version: 1,
      algorithm: 2,
      blockHeight: 1n,
      dataProvider: signingWallet.address,
      streamId: ethers.hexlify(ethers.randomBytes(32)),
      actionId: 1,
      args: ethers.getBytes("0x"),
      result: ethers.getBytes(abiEncodedResult),
    };

    const canonical = buildCanonical(fields);
    const digest = ethers.sha256(canonical);
    const signature = ethers.Signature.from(signingWallet.signingKey.sign(ethers.getBytes(digest))).serialized;
    const payload = buildPayload(fields, ethers.getBytes(signature));

    await expect(harness.verify(payload, signingWallet.address)).to.be.revertedWithCustomError(
      harness,
      "AttestationInvalidAlgorithm"
    );
  });

  it("rejects payloads with truncated canonical bytes", async function () {
    const harness = await deployHarness();
    const truncated = GOLDEN_PAYLOAD.slice(0, GOLDEN_PAYLOAD.length - 130);
    await expect(harness.parse(truncated)).to.be.revertedWithCustomError(harness, "AttestationInvalidLength");
  });

  it("rejects payloads with truncated signature bytes", async function () {
    const harness = await deployHarness();
    const canonical = Buffer.from(goldenFixture.canonical_hex, "hex");
    const signature = Buffer.from(goldenFixture.signature_hex, "hex").slice(0, 64);
    const truncatedPayload = ethers.hexlify(Buffer.concat([canonical, signature]));
    await expect(harness.parse(truncatedPayload)).to.be.revertedWithCustomError(
      harness,
      "AttestationInvalidLength"
    );
  });

  it("returns false when signature or canonical bytes are tampered", async function () {
    const harness = await deployHarness();

    const expectedValidator = ethers.getAddress(goldenFixture.data_provider);
    expect(await harness.verify(GOLDEN_PAYLOAD, expectedValidator)).to.equal(true);

    const tamperedCanonical = ethers.getBytes(GOLDEN_PAYLOAD);
    tamperedCanonical[5] ^= 0xff;
    expect(await harness.verify(ethers.hexlify(tamperedCanonical), expectedValidator)).to.equal(false);
  });

  it("decodes datapoints for varying array sizes", async function () {
    const harness = await deployHarness();
    const signingWallet = ethers.Wallet.createRandom();
    const [, other] = await ethers.getSigners();

    for (const size of [0, 1, 5, 10]) {
      const timestamps = Array.from({ length: size }, (_, i) => BigInt(i + 1));
      const values = Array.from({ length: size }, (_, i) => BigInt(i));
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]", "int256[]"], [timestamps, values]);

      const fields: CanonicalFields = {
        version: 1,
        algorithm: 0,
        blockHeight: BigInt(200 + size),
        dataProvider: signingWallet.address,
        streamId: ethers.hexlify(ethers.randomBytes(32)),
        actionId: 1,
        args: ethers.getBytes("0x"),
        result: ethers.getBytes(encoded),
      };

      const canonical = buildCanonical(fields);
      const digest = ethers.sha256(canonical);
      const signature = ethers.Signature.from(signingWallet.signingKey.sign(ethers.getBytes(digest))).serialized;
      const payload = buildPayload(fields, ethers.getBytes(signature));

      const decoded = await harness.decodeDataPoints(payload);
      expect(decoded.length).to.equal(size);
      if (size > 0) {
        expect(decoded[0].timestamp).to.equal(timestamps[0]);
        expect(decoded[size - 1].value).to.equal(values[size - 1]);
      }

      expect(await harness.verify(payload, signingWallet.address)).to.equal(true);
      expect(await harness.verify(payload, other.address)).to.equal(false);
    }
  });
});
