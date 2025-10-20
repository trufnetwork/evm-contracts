import fs from "fs";
import path from "path";

const goldenPath = path.resolve(__dirname, "./fixtures/attestation_golden.json");

export type GoldenFixture = {
  canonical_hex: string;
  signature_hex: string;
  payload_hex: string;
  data_provider: string;
  stream_id: string;
  block_height: number;
  action_id: number;
  args: {
    data_provider: string;
    stream_id: string;
    start_time: number;
    end_time: number;
    pending_filter: null | string;
    use_cache: boolean;
  };
  result: {
    timestamps: number[];
    values: string[];
  };
};

export const goldenFixture = JSON.parse(fs.readFileSync(goldenPath, "utf8")) as GoldenFixture;
export const GOLDEN_CANONICAL = `0x${goldenFixture.canonical_hex}`;
export const GOLDEN_SIGNATURE = `0x${goldenFixture.signature_hex}`;
export const GOLDEN_PAYLOAD = `0x${goldenFixture.payload_hex}`;
