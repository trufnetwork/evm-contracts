import { BaseContract, ErrorFragment } from "ethers";
import { expect } from "chai";
import { ethers } from "hardhat";

// We can't use the chai expect(...).to.be.reverted[...] because it's not working with localTestnet from chainlink
export function expectRevertedWithCustomError(
  error: any,
  contract: BaseContract,
  errorName: string,
  expectedArgs?: any[]
): void {
  const errorData =
    typeof error.data === "object" && error.data.result
      ? error.data.result
      : error.data || (error.error && error.error.data);

  expect(errorData, "Error data is undefined or null").to.not.be.undefined;
  expect(errorData, "Error data is undefined or null").to.not.be.null;

  let decoded;
  try {
    decoded = contract.interface.parseError(errorData);
  } catch (e: any) {
    if (typeof errorData === "string" && errorData.startsWith("0x")) {
      const errorSignature = errorData.slice(0, 10);
      const knownErrors = contract.interface.fragments.filter(
        (f): f is ErrorFragment => f.type === "error"
      );
      const matchingError = knownErrors.find(
        (e) =>
          contract.interface.getError(e.format("sighash"))?.selector ===
          errorSignature
      );
      if (matchingError) {
        decoded = { name: matchingError.format("sighash") };
      }
    }
    if (!decoded) {
      throw new Error(
        `Failed to parse error data: ${e.message}\nError data: ${JSON.stringify(errorData)}`
      );
    }
  }

  expect(decoded, "Failed to decode error data").to.not.be.undefined;
  expect(
    decoded!.name,
    `Expected error "${errorName}" but got "${decoded?.name}"`
  ).to.equal(errorName);

  if (expectedArgs) {
    expect(decoded!.args, "Error arguments not found").to.not.be.undefined;
    expect(decoded!.args!.length, "Wrong number of error arguments").to.equal(
      expectedArgs.length
    );
    expectedArgs.forEach((expectedArg, index) => {
      expect(decoded!.args![index], `Argument ${index} mismatch`).to.equal(
        expectedArg
      );
    });
  }
} 