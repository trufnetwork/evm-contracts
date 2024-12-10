import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import tsc from "typescript";

export const SourceKeys = {
    simpleExample: 'simpleExample',
    requestv1: 'requestv1'
}

export type SourceKey = keyof typeof SourceKeys;

const SourceKeyFiles = {
    simpleExample: 'simpleExample.ts',
    requestv1: 'requestV1/source.ts'
} satisfies Record<keyof typeof SourceKeys, string>;

/**
 * Returns the source code for a given source key, present at deno-src/
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
    let source = rawSourceLines.slice(startIndex, endIndex).join("\n") + "\nreturn encodedResult;";

    // remove comments, because chainlink functions doesn't support them
    // https://discordapp.com/channels/592041321326182401/1080516970765623437/1248550711273455686
    source = tsc.transpileModule(source, { compilerOptions: { removeComments: true, target: tsc.ScriptTarget.ESNext, module: tsc.ModuleKind.ESNext } }).outputText;
    return source;
}

export const getEncryptedSecretsUrl = () => {
    dotenv.config();
    const encryptedSecretsUrl = process.env.ENCRYPTED_SECRETS_URL;
    if (!encryptedSecretsUrl) {
        throw new Error("ENCRYPTED_SECRETS_URL not provided - check your environment variables");
    }
    return encryptedSecretsUrl;
}