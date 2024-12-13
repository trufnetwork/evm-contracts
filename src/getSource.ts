import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import tsc from "typescript";
import esbuild from "esbuild";

export const SourceKeys = {
    simpleExample: 'simpleExample',
    requestv1: 'requestv1',
}

export type SourceKey = keyof typeof SourceKeys;

const SourceKeyFiles = {
    simpleExample: 'simpleExample.ts',
    requestv1: 'requestV1/source.ts',
} satisfies Record<keyof typeof SourceKeys, string>;

const getSourceWithoutReturn = (file: keyof typeof SourceKeys) => {
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
    return source;
}

/**
 * Returns the source code for a given source key, present at deno-src/
 * 
 * @param file - The source key to get the source for
 * @returns The source code for the given source key
 */
export const getSource = (file: keyof typeof SourceKeys) => {
    let source = getSourceWithoutReturn(file);
    return source + "\nreturn encodedResult;";
}

export const getMinifiedSource = async (file: keyof typeof SourceKeys) => {
    const source = getSourceWithoutReturn(file);
    const minifiedSourceCodeWithoutReturn = await esbuild.transform(source, {
      minify: true,
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      sourcemap: false,
      target: 'esnext'
    });
    return minifiedSourceCodeWithoutReturn.code + "return encodedResult;";
}

export const getProxifiableSource = async (file: keyof typeof SourceKeys) => {
    const source = getSourceWithoutReturn(file);
    
    /* 
    we want to have:
    ```
    export function handler(args) {
        <source code>
        return encodedResult;
    }
    ```
    */

    const proxySource = `async function handler(args) {
    ${source}
    return encodedResult;
}
export default handler;`;

    return proxySource;
}

export const getProxySource = (url: string) => `const {handler} = await import("${url}");
return await handler(args);`

export const getEncryptedSecretsUrl = () => {
    dotenv.config();
    const encryptedSecretsUrl = process.env.ENCRYPTED_SECRETS_URL;
    if (!encryptedSecretsUrl) {
        throw new Error("ENCRYPTED_SECRETS_URL not provided - check your environment variables");
    }
    return encryptedSecretsUrl;
}