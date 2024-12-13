async function handler(args) {
        Deno.env.get = (prop) => {
    console.log("Skipping env", prop);
    return undefined;
};
const { NodeTNClient, StreamId, EthereumAddress } = await import("npm:@trufnetwork/sdk-js@0.2.1");
const { ethers, Wallet } = await import("npm:ethers@6.10.0");
const decimalPkg = await import("npm:decimal.js-light@2.5.1");
const { default: Decimal } = decimalPkg;
const z = await import("npm:zod@3.22.4");
var RequestType;
(function (RequestType) {
    RequestType["RECORD"] = "0";
    RequestType["INDEX"] = "1";
    RequestType["INDEX_CHANGE"] = "2";
})(RequestType || (RequestType = {}));
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const baseArgsSchema = z
    .object({
    requestType: z.enum(["0", "1", "2"]),
    decimalsMultiplier: z
        .string()
        .regex(/^\d+$/, "Must be a non-negative integer")
        .transform(Number)
        .refine((n) => n >= 0 && n <= 100, "Decimals multiplier must be between 0 and 100"),
    dataProviderAddress: z
        .string()
        .regex(ethereumAddressRegex, "Invalid Ethereum address format"),
    streamId: z.string().min(1, "Stream ID cannot be empty"),
    date: z
        .string()
        .regex(dateRegex, "Date must be in YYYY-MM-DD format")
        .refine((date) => !isNaN(new Date(date).getTime()), "Invalid date"),
})
    .strict();
const recordSchema = baseArgsSchema
    .extend({
    requestType: z.literal("0"),
})
    .strict();
const indexSchema = baseArgsSchema
    .extend({
    requestType: z.literal("1"),
    frozen_at: z
        .string()
        .regex(/^\d+$/, "frozen_at must be a positive integer (block height)")
        .transform(Number)
        .refine((n) => n > 0, "frozen_at must be greater than 0")
        .optional()
        .nullable(),
    base_date: z
        .string()
        .regex(dateRegex, "base_date must be in YYYY-MM-DD format")
        .refine((date) => !isNaN(new Date(date).getTime()), "Invalid base_date")
        .optional()
        .nullable(),
})
    .strict();
const indexChangeSchema = baseArgsSchema
    .extend({
    requestType: z.literal("2"),
    frozen_at: z
        .string()
        .regex(/^\d+$/, "frozen_at must be a positive integer (block height)")
        .transform(Number)
        .refine((n) => n > 0, "frozen_at must be greater than 0")
        .optional()
        .nullable(),
    base_date: z
        .string()
        .regex(dateRegex, "base_date must be in YYYY-MM-DD format")
        .refine((date) => !isNaN(new Date(date).getTime()), "Invalid base_date")
        .optional()
        .nullable(),
    days_interval: z
        .string()
        .regex(/^\d+$/, "days_interval must be a positive integer")
        .transform(Number)
        .refine((n) => n > 0, "days_interval must be greater than 0"),
})
    .strict();
const argsSchema = z.discriminatedUnion("requestType", [
    recordSchema,
    indexSchema,
    indexChangeSchema,
]);
function numberOrNull(value) {
    return value === null ? null : Number(value);
}
function requestArgsToObject(args) {
    if (args.length < 5) {
        throw new Error(`Insufficient arguments. Received ${args.length}, expected at least 5`);
    }
    const [requestType, decimalsMultiplier, dataProviderAddress, streamId, date, ...rest] = args;
    const baseInput = {
        requestType,
        decimalsMultiplier,
        dataProviderAddress,
        streamId,
        date,
    };
    let input;
    switch (requestType) {
        case "0":
            input = baseInput;
            break;
        case "1":
            input = {
                ...baseInput,
                frozen_at: rest[0] || null,
                base_date: rest[1] || null,
            };
            break;
        case "2":
            input = {
                ...baseInput,
                frozen_at: rest[0] || null,
                base_date: rest[1] || null,
                days_interval: rest[2],
            };
            break;
        default:
            throw new Error(`Invalid request type: ${requestType}`);
    }
    const result = argsSchema.safeParse(input);
    if (!result.success) {
        const formattedError = result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n");
        const ellipsis = formattedError.length > 100 ? "..." : "";
        throw new Error(`Validation failed:\n${formattedError.slice(0, 100)}${ellipsis}`);
    }
    const validated = result.data;
    const baseObject = {
        dataProviderAddress: validated.dataProviderAddress,
        decimalsMultiplier: validated.decimalsMultiplier.toString(),
        streamId: validated.streamId,
        date: validated.date,
    };
    switch (validated.requestType) {
        case "0":
            return {
                ...baseObject,
                requestType: RequestType.RECORD,
            };
        case "1":
            return {
                ...baseObject,
                requestType: RequestType.INDEX,
                frozen_at: validated.frozen_at || null,
                base_date: validated.base_date
                    ? validated.base_date
                    : null,
            };
        case "2":
            return {
                ...baseObject,
                requestType: RequestType.INDEX_CHANGE,
                frozen_at: validated.frozen_at || null,
                base_date: validated.base_date
                    ? validated.base_date
                    : null,
                days_interval: validated.days_interval.toString(),
            };
    }
}
const signer = new Wallet(secrets.PRIVATE_KEY);
const client = new NodeTNClient({
    endpoint: "https://staging.tsn.truflation.com",
    signerInfo: {
        address: signer.address,
        signer: signer,
    },
    chainId: "truflation-staging-2024-11-22",
});
function getPrototypeAtDepth(obj, depth) {
    return depth === 0
        ? obj
        : getPrototypeAtDepth(Object.getPrototypeOf(obj), depth - 1);
}
const api = getPrototypeAtDepth(client["kwilClient"], 4);
const originalRequest = api["request"];
const customAdapter = async (config) => {
    const url = new URL(config.url ?? "", config.baseURL).toString();
    const headers = Object.fromEntries(Object.entries(config.headers ?? {}).map(([key, value]) => [
        key,
        value.toString(),
    ]));
    const response = await Functions.makeHttpRequest({
        url: url ?? "",
        data: JSON.parse(config.data || "{}"),
        headers,
        method: config.method,
        params: config.params,
    });
    return response.error
        ? Promise.reject(response)
        : response;
};
api["request"] = (...args) => {
    const request = originalRequest.apply(client["kwilClient"], args);
    request.defaults.adapter = customAdapter;
    return request;
};
async function getData(args) {
    const owner = EthereumAddress.fromString(args.dataProviderAddress).throw();
    const sId = StreamId.fromString(args.streamId).throw();
    const streams = client.loadStream({ dataProvider: owner, streamId: sId });
    switch (args.requestType) {
        case RequestType.RECORD:
            return await streams.getRecord({
                dateFrom: args.date,
                dateTo: args.date,
            });
        case RequestType.INDEX:
            return await streams.getIndex({
                dateFrom: args.date,
                dateTo: args.date,
                frozenAt: args.frozen_at ?? undefined,
                baseDate: args.base_date ?? undefined,
            });
        case RequestType.INDEX_CHANGE: {
            const daysInterval = numberOrNull(args.days_interval);
            if (daysInterval === null) {
                throw new Error("Days interval is required");
            }
            return await streams.getIndexChange({
                dateFrom: args.date,
                dateTo: args.date,
                frozenAt: args.frozen_at ?? undefined,
                baseDate: args.base_date ?? undefined,
                daysInterval,
            });
        }
    }
}
const argsObject = requestArgsToObject(args);
let results;
try {
    results = await getData(argsObject);
}
catch (e) {
    throw new Error("Error fetching data: " + e);
}
if (results.length != 1) {
    throw new Error("Expected 1 record, got " + results.length);
}
const result = results[0];
const multiplierNum = Number(argsObject.decimalsMultiplier);
if (isNaN(multiplierNum) || multiplierNum < 0) {
    throw new Error(`Invalid multiplier: ${argsObject.decimalsMultiplier}`);
}
const decimalValue = new Decimal(result.value);
const scaledDecimal = decimalValue.mul(new Decimal(10).pow(multiplierNum));
const scaledBigInt = BigInt(scaledDecimal.toFixed(0));
const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const encoded = abiCoder.encode(["string", "int256"], [result.dateValue, scaledBigInt]);
const encodedResult = ethers.getBytes(encoded);

        return encodedResult;
    }
    export default handler;