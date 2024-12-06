import { CLIArgumentType } from "hardhat/types/runtime";

export class EnumArgumentType<T> implements CLIArgumentType<T> {
  
  constructor(public readonly enumValues: T[]) { }

  name = "enum";

  validate(argName: string, argumentValue: any): void {
    if (!this.enumValues.includes(argumentValue)) {
      throw new Error(`Invalid value for ${argName}: ${argumentValue}. Possible values: ${this.enumValues.join(", ")}`);
    }
  }

  parse(argName: string, strValue: string): T {
    return strValue as T;
  }
}
