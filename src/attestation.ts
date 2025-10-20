import { ethers } from "ethers";

export type CanonicalAttestationFields = {
  version: number;
  algorithm: number;
  blockHeight: bigint;
  dataProvider: string;
  streamId: string;
  actionId: number;
  args: Uint8Array;
  result: Uint8Array;
};

/**
 * Encode the canonical (unsigned) attestation payload.
 */
export function buildCanonicalAttestation(fields: CanonicalAttestationFields): Uint8Array {
  const provider = ethers.getBytes(fields.dataProvider);
  if (provider.length !== 20) {
    throw new Error("dataProvider must be 20 bytes");
  }

  const stream = ethers.getBytes(fields.streamId);
  if (stream.length !== 32) {
    throw new Error("streamId must be 32 bytes");
  }

  const args = Uint8Array.from(fields.args);
  const result = Uint8Array.from(fields.result);

  const pieces: Buffer[] = [
    Buffer.from([fields.version & 0xff]),
    Buffer.from([fields.algorithm & 0xff]),
    encodeUint64BE(fields.blockHeight),
    lengthPrefix(Buffer.from(provider)),
    lengthPrefix(Buffer.from(stream)),
    encodeUint16BE(fields.actionId),
    lengthPrefix(Buffer.from(args)),
    lengthPrefix(Buffer.from(result)),
  ];

  return Buffer.concat(pieces);
}

/**
 * Append the signature bytes to the canonical payload.
 */
export function buildSignedAttestation(fields: CanonicalAttestationFields, signature: Uint8Array): Uint8Array {
  if (signature.length !== 65) {
    throw new Error("signature must be 65 bytes");
  }
  const canonical = buildCanonicalAttestation(fields);
  return Buffer.concat([Buffer.from(canonical), Buffer.from(signature)]);
}

function encodeUint16BE(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16BE(value & 0xffff, 0);
  return buffer;
}

function encodeUint64BE(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(value & BigInt("0xffffffffffffffff"), 0);
  return buffer;
}

function lengthPrefix(data: Buffer): Buffer {
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(data.length, 0);
  return Buffer.concat([prefix, data]);
}
