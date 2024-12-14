import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import tsc from "typescript";

export const SourceKeys = {
    simpleExample: 'simpleExample',
    requestv1: 'requestv1',
}

export type SourceKey = keyof typeof SourceKeys;

const SourceKeyFiles = {
    simpleExample: 'simpleExample.ts',
    requestv1: 'requestV1/source.ts',
} satisfies Record<keyof typeof SourceKeys, string>;

/**
 * Returns the source code for a given source key, present at deno-src/
 * Appends the return statement to the source code.
 * 
 * @param file - The source key to get the source for
 * @returns The source code for the given source key
 */
export const getSource = (file: keyof typeof SourceKeys) => {
    if (!file) {
        throw new Error("No source file provided");
    }
    const rawSourceLines = fs.readFileSync(path.join(__dirname, `../deno-src/${SourceKeyFiles[file]}`)).toString().split("\n");
    const startIndex = rawSourceLines.findIndex((line: string | string[]) => line.includes("CHAINLINK FUNCTION START")) + 1;
    const endIndex = rawSourceLines.findIndex((line: string | string[]) => line.includes("CHAINLINK FUNCTION END")) - 1;
    let source = rawSourceLines.slice(startIndex, endIndex).join("\n");

    // remove comments, because chainlink functions doesn't support them
    // https://discordapp.com/channels/592041321326182401/1080516970765623437/1248550711273455686
    source = tsc.transpileModule(source, { compilerOptions: { removeComments: true, target: tsc.ScriptTarget.ESNext, module: tsc.ModuleKind.ESNext } }).outputText;
    return source + "\nreturn encodedResult;";
}

/**
 * Replaces import statements with their corresponding package references
 * @param source - The source code containing import statements
 * @param importStatements - Array of import statements to replace
 * @returns Source code with import statements replaced by package references
 */
const replaceImportStatementsWithPackages = (source: string, importStatements: string[]): string => {
    let sourceWithoutPackages = source;
    for (const importStatement of importStatements) {
        const index = importStatements.indexOf(importStatement);
        sourceWithoutPackages = sourceWithoutPackages.replace(importStatement, `pkgs[${index}]`);
    }
    return sourceWithoutPackages;
}

/**
 * Returns the source code for a given source key, present at deno-src/
 * 
 * This source code is designed to be loaded remotely via our "remote loader" script.
 * 
 * @param file - The source key to get the source for
 * @returns The source code for the given source key
 */
export const getLoadableSource = async (file: keyof typeof SourceKeys): Promise<{source: string, importStatements: string[]}> => {
    const source = getSource(file);
    const importStatements = await getPackagesImportStatement(source);
    
    if (importStatements.length > 4) {
        throw new Error(`Too many packages imported (${importStatements.length}). Chainlink Functions doesn't support more than 5 total packages (including the proxy).`);
    }
    
    const sourceWithoutPackages = replaceImportStatementsWithPackages(source, importStatements);
    
    // these arguments are not available in the loaded script. We're wrapping the source in a function to pass them in.
    const proxySource = `export async function handler(args, secrets, Functions, pkgs) {
    ${sourceWithoutPackages}
};`;

    return {source: proxySource, importStatements};
}

/**
 * Returns the import statements for the given source code.
 * 
 * @param source - The source code to get the import statements for
 * @returns The import statements for the given source code
 */
const getPackagesImportStatement = async (source: string): Promise<string[]> => {
    const packages = source.match(/await import\(".+"\)/g);
    if (!packages) {
        return [];
    }
    return packages;
}

/**
 * Returns the source code for a given source key, present at deno-src/
 * 
 * This is the "remote loader" script. It injects dependencies into the source code, and loads it as a JS module.
 * 
 * @param url - The URL of the remote source code
 * @param importStatements - The import statements for the remote source code. This is obtained from getLoadableSource.
 * @returns The source code for the given source key
 */
export const getRemoteLoaderSource = (url: string, importStatements: string[]) => {
    const importStatementsString = importStatements.map(importPkg => `${importPkg}`).join(",");
    return `const url = "${url}";
const res = await Functions.makeHttpRequest({url, responseType: "text"});
if (!('data' in res)) {
    throw new Error("No data in response");
};
const dataUrl = \`data:application/javascript,$\{res.data}\`;
const pkgs = [${importStatementsString}];
const {handler} = await import(dataUrl);
return handler(args, secrets, Functions, pkgs);`;
}

