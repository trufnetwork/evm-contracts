import * as fs from "fs";
import { ConfigurableScopeDefinition } from "hardhat/types";
import * as path from "path";
import { EnumArgumentType } from "../../src/EnumArgumentType";
import { getLoadableSource, getSource, SourceKeys } from "../../src/getSource";

const sourceEnum = new EnumArgumentType(Object.keys(SourceKeys));

export const registerBuildSourceTasks = (scope: ConfigurableScopeDefinition) => {
  // Builds the source code to dist/sources/<name>.js
  // 
  // It's meant to facilitate uploading the source code to some URL (e.g. Github Gist)
  // It's meant to be used directly by the Chainlink Functions SDK. 
  // However, it can't be used currently because remote code locations are not supported yet.
  // See https://github.com/smartcontractkit/functions-toolkit/issues/72
  scope
    .task("build-source", "Builds and saves the source code to dist/sources/<name>.js")
    .addParam("source", "The source key to build", "simpleExample", sourceEnum, true)
    .setAction(async (taskArgs) => {
      const sourceCode = getSource(taskArgs.source);

      // Create dist/sources directory if it doesn't exist
      const distDir = path.join(__dirname, "..", "dist", "sources");
      ensureDir(distDir);
      
      // Write source to file
      const fileName = `${taskArgs.source}.js`;
      const filePath = path.join(distDir, fileName);
      fs.writeFileSync(filePath, sourceCode);

      console.log(`Source built and saved to ${filePath}`);
    });

  /**
   * Builds and saves the loadable source code to dist/sources/<name>.loadable.ts
   * 
   * This will be used by the remote loader script. 
   * 
   * After building the source, you can use the generated file to upload into some URL (e.g. Github Gist)
   * and then use the remote loader script to load the source code from the URL.
   */
  scope
    .task("build-loadable-source", "Builds and saves the loadable source code")
    .addParam("source", "The source key to build", "simpleExample", sourceEnum, true)
    .setAction(async (taskArgs) => {
      const loadableSource = await getLoadableSource(taskArgs.source);
      const distDir = path.join(__dirname, "..", "dist", "sources");
      ensureDir(distDir);
      const fileName = `${taskArgs.source}.loadable.ts`;
      const filePath = path.join(distDir, fileName);
      fs.writeFileSync(filePath, loadableSource.source);
      console.log(`Loadable source built and saved to ${filePath}`);
    });
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}