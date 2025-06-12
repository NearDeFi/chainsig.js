# ChainSig.js Examples

This directory contains examples demonstrating how to use ChainSig.js for multi-chain transactions using NEAR's Chain Signatures (MPC).

## Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the .env file with your NEAR account credentials:**
   - Replace `ACCOUNT_ID` with your NEAR testnet account (e.g., `yourname.testnet`)
   - Replace `PRIVATE_KEY` with your actual ed25519 private key

3. **Install dependencies:**
   ```bash
   npm install
   ```

## Available Examples

### Solana Example
```bash
npm run send-sol
```
Demonstrates sending SOL tokens using NEAR Chain Signatures.

### Sui Example
```bash
npm run send-sui
```
Demonstrates sending SUI tokens using NEAR Chain Signatures.

### Aptos Example
```bash
npm run send-apt
```
Demonstrates sending APT tokens using NEAR Chain Signatures.

## Important Notes

- **Funding Required**: The derived addresses need to be funded with native tokens for gas fees
- **Testnet Only**: These examples are configured for testnet networks
- **NEAR Account**: You need a NEAR testnet account with some NEAR tokens for MPC signing fees
