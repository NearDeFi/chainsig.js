# Chainsig.js

A TypeScript library for handling multi-chain transactions and signatures using MPC (Multi-Party Computation).

## Overview

This library provides a unified interface for interacting with different blockchain networks through a common set of methods. It uses MPC for secure key management and transaction signing.

## Features

- **Multi-Chain Support**: Built-in support for EVM chains, Bitcoin, and Cosmos networks
- **Unified Interface**: Common API across all supported chains
- **MPC Integration**: Secure key management and transaction signing
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Modular Design**: Easy to extend with new chain implementations
- **Secure**: No private keys stored or transmitted

## Installation

```bash
npm install chainsig.js
# or
yarn add chainsig.js
# or
pnpm add chainsig.js
```

## Example Repo
https://github.com/NearDeFi/chainsig-example

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
