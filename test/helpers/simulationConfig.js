// see https://github.com/smartcontractkit/functions-toolkit/blob/main/README.md#local-functions-testnet
const secrets = { 
    PRIVATE_KEY: process.env.TN_READER_PRIVATE_KEY 
} // `secrets` object which can be accessed by the JavaScript code during request execution (can only contain string values)
const maxOnChainResponseBytes = 256 // Maximum size of the returned value in bytes (defaults to 256)
const maxExecutionTimeMs = 10000 // Maximum execution duration (defaults to 10_000ms)
const maxMemoryUsageMb = 128 // Maximum RAM usage (defaults to 128mb)
const numAllowedQueries = 5 // Maximum number of HTTP requests (defaults to 5)
const maxQueryDurationMs = 9000// Maximum duration of each HTTP request (defaults to 9_000ms)
const maxQueryUrlLength = 2048 // Maximum HTTP request URL length (defaults to 2048)
const maxQueryRequestBytes = 2048 // Maximum size of outgoing HTTP request payload (defaults to 2048 == 2 KB)
const maxQueryResponseBytes = 2097152 // Maximum size of incoming HTTP response payload (defaults to 2_097_152 == 2 MB)

module.exports = {
    secrets,
    maxOnChainResponseBytes,
    maxExecutionTimeMs,
    maxMemoryUsageMb,
    numAllowedQueries,
    maxQueryDurationMs,
    maxQueryUrlLength,
    maxQueryRequestBytes,
    maxQueryResponseBytes
}