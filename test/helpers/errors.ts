import { assert, expect } from "chai";
import { BaseContract, ErrorFragment } from "ethers";

// Helper function to decode error data
function decodeErrorData(
  contract: BaseContract,
  errorData: string | undefined
) {
  if (!errorData) {
    throw new Error("Error data is undefined or null");
  }

  let decoded;
  try {
    decoded = contract.interface.parseError(errorData);
  } catch (e: any) {
    // If we can't decode directly, try to match known errors by their signatures
    if (typeof errorData === "string" && errorData.startsWith("0x")) {
      const errorSignature = errorData.slice(0, 10);
      const knownErrors = contract.interface.fragments.filter(
        (f): f is ErrorFragment => f.type === "error"
      );
      const matchingError = knownErrors.find(
        (err) =>
          contract.interface.getError(err.format("sighash"))?.selector ===
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

  return decoded;
}

function getErrorDataFromError(error: any): string | undefined {
  if (!error) return undefined;
  if (typeof error.data === "object" && error.data.result) return error.data.result;
  return error.data || (error.error && error.error.data);
}

// We can't use the chai expect(...).to.be.reverted[...] because it's not working with localTestnet from Chainlink
export function expectRevertedWithCustomError(
  error: any,
  contract: BaseContract,
  errorName: string,
  expectedArgs?: any[]
): void {
  const errorData = getErrorDataFromError(error);

  expect(errorData, "Error data is undefined or null").to.not.be.undefined;
  expect(errorData, "Error data is undefined or null").to.not.be.null;

  const decoded = decodeErrorData(contract, errorData);

  assert(decoded, "Failed to decode error data");

  expect(
    decoded.name,
    `Expected error "${errorName}" but got "${decoded.name}"`
  ).to.equal(errorName);

  if (expectedArgs) {
    if ("args" in decoded) {
      const args = decoded.args;
      assert(args, "Error arguments not found");
      assert.equal(args!.length, expectedArgs.length, "Wrong number of error arguments");
      expectedArgs.forEach((expectedArg, index) => {
        expect(decoded!.args![index], `Argument ${index} mismatch`).to.equal(
          expectedArg
        );
      });
    }
  }
}

export async function expectNotToBeReverted(
  promise: Promise<any>,
  contract: BaseContract
): Promise<void> {
  try {
    await promise;
  } catch (error: any) {
    const errorData = error.data?.result || error.data;
    let decoded;
    try {
      if (errorData) {
        decoded = contract.interface.parseError(errorData);
        if (decoded) {
          throw new Error(
            `Expected transaction not to revert, but it reverted with: ${decoded.name}`
          );
        }
      }
      // If we can't decode the error or there's no error data, throw the original error
      throw error;
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      // If we caught something else, throw the original error
      throw error;
    }
  }
}
