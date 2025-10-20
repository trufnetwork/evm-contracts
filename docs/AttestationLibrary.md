# Attestation Library

The `contracts/attestation/TrufAttestation.sol` library lets Solidity contracts verify TrufNetwork attestations on-chain. Phase 1 keeps the scope small: single secp256k1 signer, canonical payload parsing, and caller-managed safeguards.

## When to Use It
- You receive the nine-field payload returned by `get_signed_attestation`.
- You need to parse canonical bytes, recover the validator address, and decode `(timestamp, value)` pairs.
- You will enforce validator allowlists, replay limits, and aggregation outside this library.

## Import
```solidity
import {TrufAttestation} from "@trufnetwork/evm-contracts/contracts/attestation/TrufAttestation.sol";
```
Vendoring instead of installing? Keep the relative path; the library is pure Solidity and requires no deployment.

## Canonical Payload Layout
Signed payload = `canonical || signature`

| Field | Notes |
| --- | --- |
| `version (uint8)` | Currently `1`. |
| `algorithm (uint8)` | `0` = secp256k1 (only supported option today). |
| `blockHeight (uint64)` | TrufNetwork block height when produced. |
| `dataProvider (bytes4 + 20)` | Big-endian length prefix + provider address. |
| `streamId (bytes4 + 32)` | Big-endian length prefix + stream identifier bytes. |
| `actionId (uint16)` | Normalized query id; values 1–5 map to the `Action` enum. |
| `args (bytes4 + N)` | Length-prefixed ABI-encoded request arguments. |
| `result (bytes4 + M)` | Length-prefixed ABI-encoded `(uint256[], int256[])`. |
| `signature (65 bytes)` | Validator secp256k1 signature. |

The signature covers fields 1–8: `sha256(canonicalFields)`.

## Solidity Quickstart
```solidity
using TrufAttestation for bytes;

function consume(bytes calldata payload, address validator) external {
    TrufAttestation.Attestation memory att = TrufAttestation.parse(payload);
    require(TrufAttestation.verify(att, validator), "unexpected signer");

    TrufAttestation.DataPoint[] memory points = TrufAttestation.decodeDataPoints(att);
    // Apply max-age checks, aggregation, etc.
}
```

Helpers such as `hash`, `metadata`, `body`, and `toAction` are also available—see the library source for details.

## TypeScript Helpers
When crafting fixtures or unit tests, reuse the exported builders:
```ts
import {
  buildCanonicalAttestation,
  buildSignedAttestation,
} from "@trufnetwork/evm-contracts/src";
```
They mirror the canonical encoder maintained in the TrufNetwork node repo (`github.com/trufnetwork/node`, file `extensions/tn_attestation/canonical.go`) and power the Hardhat tests in `test/attestation/TrufAttestation.test.ts`.

## Consumer Best Practices
- Maintain a governance-controlled validator allowlist and rotate proactively.
- Track digests/block heights to enforce replay and freshness policies.
- Aggregate multiple attestations (median/quorum) in downstream contracts if required.
- Surface verification failures in logs/metrics instead of swallowing them silently.

## Example Contract
- A minimal, non-production example lives at `contracts/attestation/TrufAttestationConsumer.sol`. It keeps a single owner-set leader and shows how to persist the latest datapoint.
- The accompanying test suite (`test/attestation/TrufAttestationConsumer.test.ts`) demonstrates end-to-end verification using the golden fixture.
- Replace the leader management with your own governance/allowlist logic before shipping to mainnet.
