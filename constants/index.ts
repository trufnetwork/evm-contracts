
export const ROUTER_ADDRESS = {
    // https://functions.chain.link/sepolia
    sepolia: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
}

export const DON_ID = {
    // arbitrary name
    localTestnet: "don-id-testnet",
    // https://functions.chain.link/sepolia
    sepolia: "fun-ethereum-sepolia-1",
}

export const SUBSCRIPTION_ID = {
    sepolia: {
        // https://functions.chain.link/sepolia/4056 from 0xad0a4d32509aea47ad10239d21cb7b5115a548f0
     "0xad0a4d32509aea47ad10239d21cb7b5115a548f0":   4056,
    }

} satisfies Record<keyof typeof ROUTER_ADDRESS, {[OwnerAddress: string]: number}>;