# Chainsig.js

A TypeScript library for creating transactions for different chains and signing them with NEAR's MPC (Multi-party Computation)service.

## Overview

This library provides a unified interface for interacting with different blockchain networks through a common set of methods. It uses MPC for secure key management and transaction signing.

## Features

- **Multi-Chain Support**: Built-in support for EVM chains, Bitcoin, Cosmos, Solana, Aptos, and SUI networks
- **Unified Interface**: Common API across all supported chains
- **MPC Integration**: Secure key management and transaction signing
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Modular Design**: Easy to extend with new chain implementations
- **Secure**: No private keys stored or transmitted

## Supported Chains

The library provides chain adapters for the following blockchain networks:

- **EVM Chains**: Ethereum, BSC, Polygon, Arbitrum, Optimism, and other EVM-compatible networks
- **Bitcoin**: Bitcoin mainnet and testnet with P2WPKH transaction support
- **Cosmos**: Cosmos Hub, Osmosis, and other Cosmos SDK-based chains
- **Solana**: High-performance blockchain with native token transfers
- **Aptos**: Move-based blockchain with Ed25519 signature support
- **SUI**: Move-based blockchain with Ed25519 signature support
- **XRP Ledger**: XRP mainnet, testnet, and devnet with native XRP transfers

Each chain adapter provides a unified interface for:
- Address and public key derivation
- Balance checking
- Transaction preparation and signing
- Transaction broadcasting

## Installation

```bash
npm install chainsig.js
# or
yarn add chainsig.js
# or
pnpm add chainsig.js
```

## Docs and Examples

Examples for sending transfers and function calls with chainsig.js via a NEAR wallet can be found in the [near-multichain](https://github.com/near-examples/near-multichain) repo, along with in depth documentation in the [NEAR docs](https://docs.near.org/chain-abstraction/chain-signatures/implementation).

Examples for sending transfers with chainsig.js via near-api-js/near-js can be found in the [examples folder](./examples/).

Full typedocs for the library can be found [here](https://neardefi.github.io/chainsig.js/).

### NEAR adapter notes

- NEAR signatures: pass an Ed25519 signature object to `finalizeTransactionSigning` (not an RSV array). The object must contain the raw Ed25519 signature bytes.
- Derived accounts: if the derived account does not exist, the adapter throws a descriptive error. You can create and fund the account programmatically using `chainAdapters.near.utils.ensureDerivedAccountExists`.
- Providers and SDK: the library uses `@near-js/*` v2. Do not mix `near-api-js` types with these helpers. Use `@near-js/crypto` for `KeyPair` and `@near-js/transactions` for actions and transactions.

## Using the Library

Because of underlying dependencies, this library is a Commonjs project. You may need to configure your projects to use this library. 

Here are simple examples in [TypeScript](https://github.com/GregProuty/chainsig-simple-example) and [JavaScript](https://github.com/GregProuty/chainsig-es6-example). 

## Quick Example

```ts twoslash
import { chainAdapters, contracts } from "chainsig.js";
import { KeyPair, type KeyPairString } from "@near-js/crypto";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// Initialize NEAR connection with credentials from environment
const accountId = process.env.NEAR_ACCOUNT_ID;
const privateKey = process.env.NEAR_PRIVATE_KEY as KeyPairString;

if (!accountId || !privateKey) {
  throw new Error(
    "NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY must be set in environment",
  );
}

const keypair = KeyPair.fromString(privateKey);

const contract = new contracts.near.ChainSignatureContract({
  networkId: "testnet",
  contractId: "v1.signer-prod.testnet",
  accountId,
  keypair,
});

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const evmChain = new chainAdapters.evm.EVM({
  publicClient,
  contract,
});

// Derive address and public key
const { address, publicKey } = await evmChain.deriveAddressAndPublicKey(
  accountId,
  "any_string",
);

// Check balance
const { balance, decimals } = await evmChain.getBalance(address);

// Create and sign transaction
const { transaction, hashesToSign } =
  await evmChain.prepareTransactionForSigning({
    from: "0x...",
    to: "0x...",
    value: 1n,
  });

// Sign with MPC
const signature = await contract.sign({
  payload: hashesToSign[0].payload,
  path: "any_string",
  key_version: 0,
});

// Add signature
const signedTx = evmChain.finalizeTransactionSigning({
  transaction,
  rsvSignatures: [signature],
});

// Broadcast transaction
const txHash = await evmChain.broadcastTx(signedTx);
```
