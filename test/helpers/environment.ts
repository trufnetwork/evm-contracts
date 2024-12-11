const environmentVariables = {
    TN_READER_PRIVATE_KEY: process.env.TN_READER_PRIVATE_KEY
}

export const getEnv = (key: keyof typeof environmentVariables) => {
    const value = environmentVariables[key];
    if (!value) {
        throw new Error(`${key} not provided - check your environment variables`);
    }
    return value;
}