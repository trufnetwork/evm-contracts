import { task } from "hardhat/config";
import { EnumArgumentType } from "../src/EnumArgumentType";
import { getSource, SourceKeys } from "../src/getSource";
import * as fs from "fs";
import * as path from "path";

const sourceEnum = new EnumArgumentType(Object.keys(SourceKeys));

task("build-source", "Builds and saves the source code to dist/sources/<name>.js")
  .addParam("source", "The source key to build", "simpleExample", sourceEnum, true)
  .setAction(async (taskArgs) => {
    const sourceCode = await getSource(taskArgs.source);
    
    // Create dist/sources directory if it doesn't exist
    const distDir = path.join(__dirname, "..", "dist", "sources");
    fs.mkdirSync(distDir, { recursive: true });
    
    // Write source to file
    const filePath = path.join(distDir, `${taskArgs.source}.js`);
    fs.writeFileSync(filePath, sourceCode);
    
    console.log(`Source built and saved to ${filePath}`);
  }); 