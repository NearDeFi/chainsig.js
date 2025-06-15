# Chainsig.js

A TypeScript library for handling multi-chain transactions and signatures using MPC (Multi-Party Computation).

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
