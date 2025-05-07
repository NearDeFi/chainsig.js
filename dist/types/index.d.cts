import { KeyPair as KeyPair$1 } from '@near-js/crypto';
import BN from 'bn.js';
import { Action as Action$1 } from '@near-js/transactions';
import { TxExecutionStatus } from '@near-js/types';
import { NetworkId, Action, FinalExecutionOutcome } from '@near-wallet-selector/core';
import { KeyPair } from 'near-api-js';
import * as bitcoin from 'bitcoinjs-lib';
import { EncodeObject } from '@cosmjs/proto-signing';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { TransactionRequest, Address, SignableMessage, TypedDataDefinition, Hex, PublicClient, Hash } from 'viem';
import { Transaction, TransactionInstruction, PublicKey, Connection } from '@solana/web3.js';

interface BTCTransaction$1 {
    vout: Array<{
        scriptpubkey: string;
        value: number;
    }>;
}
interface BTCInput {
    txid: string;
    vout: number;
    value: number;
    scriptPubKey: Buffer;
}
type BTCOutput = {
    value: number;
} | {
    address: string;
    value: number;
} | {
    script: Buffer;
    value: number;
};
type BTCTransactionRequest = {
    publicKey: string;
} & ({
    inputs: BTCInput[];
    outputs: BTCOutput[];
    from?: never;
    to?: never;
    value?: never;
} | {
    inputs?: never;
    outputs?: never;
    from: string;
    to: string;
    value: string;
});
interface BTCUnsignedTransaction {
    psbt: bitcoin.Psbt;
    publicKey: string;
}
type BTCNetworkIds = 'mainnet' | 'testnet' | 'regtest';

type CosmosNetworkIds = string;
type CosmosUnsignedTransaction = TxRaw;
interface CosmosTransactionRequest {
    address: string;
    publicKey: string;
    messages: EncodeObject[];
    memo?: string;
    gas?: number;
}

type EVMUnsignedTransaction = TransactionRequest & {
    type: 'eip1559';
    chainId: number;
};
interface EVMTransactionRequest extends Omit<EVMUnsignedTransaction, 'chainId' | 'type'> {
    from: Address;
}
type EVMMessage = SignableMessage;
type EVMTypedData = TypedDataDefinition;
interface UserOperationV7 {
    sender: Hex;
    nonce: Hex;
    factory: Hex;
    factoryData: Hex;
    callData: Hex;
    callGasLimit: Hex;
    verificationGasLimit: Hex;
    preVerificationGas: Hex;
    maxFeePerGas: Hex;
    maxPriorityFeePerGas: Hex;
    paymaster: Hex;
    paymasterVerificationGasLimit: Hex;
    paymasterPostOpGasLimit: Hex;
    paymasterData: Hex;
    signature: Hex;
}
interface UserOperationV6 {
    sender: Hex;
    nonce: Hex;
    initCode: Hex;
    callData: Hex;
    callGasLimit: Hex;
    verificationGasLimit: Hex;
    preVerificationGas: Hex;
    maxFeePerGas: Hex;
    maxPriorityFeePerGas: Hex;
    paymasterAndData: Hex;
    signature: Hex;
}

type ChainSignatureContractIds = string;
type NearNetworkIds = 'mainnet' | 'testnet';
interface ChainProvider {
    providerUrl: string;
    contract: ChainSignatureContractIds;
}
interface NearAuthentication {
    networkId: NearNetworkIds;
    accountId: string;
}
interface SuccessResponse {
    transactionHash: string;
    success: true;
}
interface FailureResponse {
    success: false;
    errorMessage: string;
}
type Response = SuccessResponse | FailureResponse;
type EVMChainConfigWithProviders = ChainProvider;
interface EVMRequest {
    transaction: EVMTransactionRequest;
    chainConfig: EVMChainConfigWithProviders;
    nearAuthentication: NearAuthentication;
    fastAuthRelayerUrl?: string;
    derivationPath: string;
}
type BTCChainConfigWithProviders = ChainProvider & {
    network: BTCNetworkIds;
};
interface BitcoinRequest {
    transaction: BTCTransactionRequest;
    chainConfig: BTCChainConfigWithProviders;
    nearAuthentication: NearAuthentication;
    fastAuthRelayerUrl?: string;
    derivationPath: string;
}
interface CosmosChainConfig {
    contract: ChainSignatureContractIds;
    chainId: CosmosNetworkIds;
}
interface CosmosRequest {
    chainConfig: CosmosChainConfig;
    transaction: CosmosTransactionRequest;
    nearAuthentication: NearAuthentication;
    derivationPath: string;
    fastAuthRelayerUrl?: string;
}

declare const mpcPayloadsToChainSigTransaction: ({ networkId, contractId, hashesToSign, path, }: {
    networkId: NetworkId;
    contractId: ChainSignatureContractIds;
    hashesToSign: HashToSign[];
    path: KeyDerivationPath;
}) => Promise<{
    receiverId: string;
    actions: Action[];
}>;
declare const responseToMpcSignature: ({ response, }: {
    response: FinalExecutionOutcome;
}) => RSVSignature | undefined;
interface SendTransactionOptions {
    until: TxExecutionStatus;
    retryCount: number;
    delay: number;
    nodeUrl: string;
}
declare const sendTransactionUntil: ({ accountId, keypair, networkId, receiverId, actions, nonce, options, }: {
    accountId: string;
    keypair: KeyPair;
    networkId: NetworkId;
    receiverId: string;
    actions: Action$1[];
    nonce?: number;
    options?: SendTransactionOptions;
}) => Promise<FinalExecutionOutcome>;

type transaction_SendTransactionOptions = SendTransactionOptions;
declare const transaction_mpcPayloadsToChainSigTransaction: typeof mpcPayloadsToChainSigTransaction;
declare const transaction_responseToMpcSignature: typeof responseToMpcSignature;
declare const transaction_sendTransactionUntil: typeof sendTransactionUntil;
declare namespace transaction {
  export { type transaction_SendTransactionOptions as SendTransactionOptions, transaction_mpcPayloadsToChainSigTransaction as mpcPayloadsToChainSigTransaction, transaction_responseToMpcSignature as responseToMpcSignature, transaction_sendTransactionUntil as sendTransactionUntil };
}

interface SignArgs {
    /** The payload to sign as an array of 32 bytes */
    payload: number[];
    /** The derivation path for key generation */
    path: string;
    /** Version of the key to use */
    key_version: number;
}
interface ChainSignatureContractArgs {
    networkId: NearNetworkIds;
    contractId: ChainSignatureContractIds;
    accountId?: string;
    keypair?: KeyPair$1;
    rootPublicKey?: NajPublicKey;
    sendTransactionOptions?: SendTransactionOptions;
}
/**
 * Implementation of the ChainSignatureContract for NEAR chains.
 *
 * This class provides an interface to interact with the ChainSignatures contract
 * deployed on NEAR. It supports both view methods (which don't require authentication)
 * and change methods (which require a valid NEAR account and keypair).
 */
declare class ChainSignatureContract {
    private readonly networkId;
    private readonly contractId;
    private readonly accountId;
    private readonly keypair;
    private readonly rootPublicKey?;
    private readonly sendTransactionOptions?;
    constructor({ networkId, contractId, accountId, keypair, rootPublicKey, sendTransactionOptions, }: ChainSignatureContractArgs);
    private getContract;
    getCurrentSignatureDeposit(): Promise<BN>;
    getDerivedPublicKey(args: {
        path: string;
        predecessor: string;
        IsEd25519?: boolean;
    }): Promise<UncompressedPubKeySEC1 | `Ed25519:${string}`>;
    getPublicKey(): Promise<UncompressedPubKeySEC1>;
    sign(args: SignArgs, options?: {
        nonce?: number;
    }): Promise<RSVSignature>;
    private requireAccount;
}

type HashToSign = SignArgs['payload'];
type Base58String = string;
type NajPublicKey = `secp256k1:${Base58String}`;
type UncompressedPubKeySEC1 = `04${string}`;
type CompressedPubKeySEC1 = `02${string}` | `03${string}`;
type Ed25519PubKey = `Ed25519:${string}`;
interface DerivedPublicKeyArgs {
    path: string;
    predecessor: string;
}
interface Signature {
    scheme: string;
    signature: number[];
}
interface KeyDerivationPath {
    index: number;
    scheme: 'secp256k1' | 'ed25519';
}
interface RSVSignature {
    r: string;
    s: string;
    v: number;
}
interface NearNearMpcSignature {
    big_r: {
        affine_point: string;
    };
    s: {
        scalar: string;
    };
    recovery_id: number;
}
interface ChainSigNearMpcSignature {
    big_r: string;
    s: string;
    recovery_id: number;
}
interface ChainSigEvmMpcSignature {
    bigR: {
        x: bigint;
        y: bigint;
    };
    s: bigint;
    recoveryId: number;
}
type MPCSignature = NearNearMpcSignature | ChainSigNearMpcSignature | ChainSigEvmMpcSignature;

declare const ENVS: {
    readonly TESTNET_DEV: "TESTNET_DEV";
    readonly TESTNET: "TESTNET";
    readonly MAINNET: "MAINNET";
};
/**
 * Root public keys for the Sig Network Smart Contracts across different environments.
 *
 * These keys should never change.
 */
declare const ROOT_PUBLIC_KEYS: Record<keyof typeof ENVS, NajPublicKey>;
/**
 * Chain ID used in the key derivation function (KDF) for deriving child public keys.
 *
 * @see {@link deriveChildPublicKey} in cryptography.ts for usage details
 */
declare const KDF_CHAIN_ID: "0x18d";
/**
 * Contract addresses for different chains and environments.
 *
 * - Testnet Dev: Used for internal development, very unstable
 * - Testnet: Used for external development, stable
 * - Mainnet: Production contract address
 *
 * @see ChainSignatureContract documentation for implementation details
 */
declare const CONTRACT_ADDRESSES: Record<keyof typeof ENVS, string>;

declare const constants_CONTRACT_ADDRESSES: typeof CONTRACT_ADDRESSES;
declare const constants_ENVS: typeof ENVS;
declare const constants_KDF_CHAIN_ID: typeof KDF_CHAIN_ID;
declare const constants_ROOT_PUBLIC_KEYS: typeof ROOT_PUBLIC_KEYS;
declare namespace constants {
  export { constants_CONTRACT_ADDRESSES as CONTRACT_ADDRESSES, constants_ENVS as ENVS, constants_KDF_CHAIN_ID as KDF_CHAIN_ID, constants_ROOT_PUBLIC_KEYS as ROOT_PUBLIC_KEYS };
}

declare const toRSV: (signature: MPCSignature) => RSVSignature;
/**
 * Compresses an uncompressed public key to its compressed format following SEC1 standards.
 * In SEC1, a compressed public key consists of a prefix (02 or 03) followed by the x-coordinate.
 * The prefix indicates whether the y-coordinate is even (02) or odd (03).
 *
 * @param uncompressedPubKeySEC1 - The uncompressed public key in hex format, with or without '04' prefix
 * @returns The compressed public key in hex format
 * @throws Error if the uncompressed public key length is invalid
 */
declare const compressPubKey: (uncompressedPubKeySEC1: UncompressedPubKeySEC1) => string;
/**
 * Converts a NAJ public key to an uncompressed SEC1 public key.
 *
 * @param najPublicKey - The NAJ public key to convert (e.g. secp256k1:3Ww8iFjqTHufye5aRGUvrQqETegR4gVUcW8FX5xzscaN9ENhpkffojsxJwi6N1RbbHMTxYa9UyKeqK3fsMuwxjR5)
 * @returns The uncompressed SEC1 public key (e.g. 04 || x || y)
 */
declare const najToUncompressedPubKeySEC1: (najPublicKey: NajPublicKey) => UncompressedPubKeySEC1;
/**
 * Derives a child public key from a parent public key using the sig.network v1.0.0 epsilon derivation scheme.
 * The parent public keys are defined in @constants.ts
 *
 * @param najPublicKey - The parent public key in uncompressed SEC1 format (e.g. 04 || x || y)
 * @param predecessorId - The predecessor ID is the address of the account calling the signer contract (e.g EOA or Contract Address)
 * @param path - Optional derivation path suffix (defaults to empty string)
 * @returns The derived child public key in uncompressed SEC1 format (04 || x || y)
 */
declare function deriveChildPublicKey(rootUncompressedPubKeySEC1: UncompressedPubKeySEC1, predecessorId: string, path?: string): UncompressedPubKeySEC1;

declare const cryptography_compressPubKey: typeof compressPubKey;
declare const cryptography_deriveChildPublicKey: typeof deriveChildPublicKey;
declare const cryptography_najToUncompressedPubKeySEC1: typeof najToUncompressedPubKeySEC1;
declare const cryptography_toRSV: typeof toRSV;
declare namespace cryptography {
  export { cryptography_compressPubKey as compressPubKey, cryptography_deriveChildPublicKey as deriveChildPublicKey, cryptography_najToUncompressedPubKeySEC1 as najToUncompressedPubKeySEC1, cryptography_toRSV as toRSV };
}

declare const index$6_cryptography: typeof cryptography;
declare namespace index$6 {
  export { index$6_cryptography as cryptography };
}

declare abstract class ChainAdapter<TransactionRequest, UnsignedTransaction> {
    /**
     * Gets the native token balance and decimals for a given address
     *
     * @param address - The address to check
     * @returns Promise resolving to an object containing:
     *          - balance: The balance as a bigint, in the chain's base units
     *          - decimals: The number of decimals used to format the balance
     */
    abstract getBalance(address: string): Promise<{
        balance: bigint;
        decimals: number;
    }>;
    /**
     * Uses Sig Network Key Derivation Function to derive the address and public key. from a signer ID and string path.
     *
     * @param predecessor - The id/address of the account requesting signature
     * @param path - The string path used to derive the key
     * @returns Promise resolving to the derived address and public key
     */
    abstract deriveAddressAndPublicKey(predecessor: string, path: string): Promise<{
        address: string;
        publicKey: string;
    }>;
    /**
     * Serializes an unsigned transaction to a string format.
     * This is useful for storing or transmitting the transaction.
     *
     * @param transaction - The unsigned transaction to serialize
     * @returns The serialized transaction string
     */
    abstract serializeTransaction(transaction: UnsignedTransaction): string;
    /**
     * Deserializes a transaction string back into an unsigned transaction object.
     * This reverses the serialization done by serializeTransaction().
     *
     * @param serialized - The serialized transaction string
     * @returns The deserialized unsigned transaction
     */
    abstract deserializeTransaction(serialized: string): UnsignedTransaction;
    /**
     * Prepares a transaction for Sig Network MPC signing by creating the necessary payloads.
     * This method handles chain-specific transaction preparation including:
     * - Fee calculation
     * - Nonce/sequence management
     * - UTXO selection (for UTXO-based chains)
     * - Transaction encoding
     *
     * @param transactionRequest - The transaction request containing parameters like recipient, amount, etc.
     * @returns Promise resolving to an object containing:
     *          - transaction: The unsigned transaction
     *          - hashesToSign: Array of payloads to be signed by MPC. The order of these payloads must match
     *                         the order of signatures provided to finalizeTransactionSigning()
     */
    abstract prepareTransactionForSigning(transactionRequest: TransactionRequest): Promise<{
        transaction: UnsignedTransaction;
        hashesToSign: HashToSign[];
    }>;
    /**
     * Adds Sig Network MPC-generated signatures to an unsigned transaction.
     *
     * @param params - Parameters for adding signatures
     * @param params.transaction - The unsigned transaction to add signatures to
     * @param params.rsvSignatures - Array of RSV signatures generated through MPC. Must be in the same order
     *                              as the payloads returned by prepareTransactionForSigning()
     * @returns The serialized signed transaction ready for broadcast
     */
    abstract finalizeTransactionSigning(params: {
        transaction: UnsignedTransaction | Transaction;
        rsvSignatures: RSVSignature[] | Signature;
    }): string;
    /**
     * Broadcasts a signed transaction to the network.
     *
     * @param txSerialized - The serialized signed transaction
     * @returns Promise resolving to an object containing the transaction hash/ID
     */
    abstract broadcastTx(txSerialized: string): Promise<{
        hash: string;
    }>;
}

/**
 * Implementation of the ChainAdapter interface for EVM-compatible networks.
 * Handles interactions with Ethereum Virtual Machine based blockchains like Ethereum, BSC, Polygon, etc.
 */
declare class EVM extends ChainAdapter<EVMTransactionRequest, EVMUnsignedTransaction> {
    private readonly client;
    private readonly contract;
    /**
     * Creates a new EVM chain instance
     * @param params - Configuration parameters
     * @param params.publicClient - A Viem PublicClient instance for reading from the blockchain
     * @param params.contract - Instance of the chain signature contract for MPC operations
     */
    constructor({ publicClient, contract, }: {
        publicClient: PublicClient;
        contract: ChainSignatureContract;
    });
    private attachGasAndNonce;
    private transformRSVSignature;
    private assembleSignature;
    deriveAddressAndPublicKey(predecessor: string, path: string): Promise<{
        address: string;
        publicKey: string;
    }>;
    getBalance(address: string): Promise<{
        balance: bigint;
        decimals: number;
    }>;
    serializeTransaction(transaction: EVMUnsignedTransaction): `0x${string}`;
    deserializeTransaction(serialized: `0x${string}`): EVMUnsignedTransaction;
    prepareTransactionForSigning(transactionRequest: EVMTransactionRequest): Promise<{
        transaction: EVMUnsignedTransaction;
        hashesToSign: HashToSign[];
    }>;
    prepareMessageForSigning(message: EVMMessage): Promise<{
        hashToSign: HashToSign;
    }>;
    prepareTypedDataForSigning(typedDataRequest: EVMTypedData): Promise<{
        hashToSign: HashToSign;
    }>;
    /**
     * This implementation is a common step for Biconomy and Alchemy.
     * Key differences between implementations:
     * - Signature format: Biconomy omits 0x00 prefix when concatenating, Alchemy includes it
     * - Version support: Biconomy only supports v6, Alchemy supports both v6 and v7
     * - Validation: Biconomy uses modules for signature validation, Alchemy uses built-in validation
     */
    prepareUserOpForSigning(userOp: UserOperationV7 | UserOperationV6, entryPointAddress?: Address, chainIdArgs?: number): Promise<{
        userOp: UserOperationV7 | UserOperationV6;
        hashToSign: HashToSign;
    }>;
    finalizeTransactionSigning({ transaction, rsvSignatures, }: {
        transaction: EVMUnsignedTransaction;
        rsvSignatures: RSVSignature[];
    }): `0x02${string}`;
    finalizeMessageSigning({ rsvSignature, }: {
        rsvSignature: RSVSignature;
    }): Hex;
    finalizeTypedDataSigning({ rsvSignature, }: {
        rsvSignature: RSVSignature;
    }): Hex;
    finalizeUserOpSigning({ userOp, rsvSignature, }: {
        userOp: UserOperationV7 | UserOperationV6;
        rsvSignature: RSVSignature;
    }): UserOperationV7 | UserOperationV6;
    broadcastTx(txSerialized: string): Promise<{
        hash: Hash;
    }>;
}

interface EVMFeeProperties {
    gas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
}
declare function fetchEVMFeeProperties(client: PublicClient, transaction: TransactionRequest): Promise<EVMFeeProperties>;

type index$5_EVM = EVM;
declare const index$5_EVM: typeof EVM;
type index$5_EVMMessage = EVMMessage;
type index$5_EVMTransactionRequest = EVMTransactionRequest;
type index$5_EVMTypedData = EVMTypedData;
type index$5_EVMUnsignedTransaction = EVMUnsignedTransaction;
declare const index$5_fetchEVMFeeProperties: typeof fetchEVMFeeProperties;
declare namespace index$5 {
  export { index$5_EVM as EVM, type index$5_EVMMessage as EVMMessage, type index$5_EVMTransactionRequest as EVMTransactionRequest, type index$5_EVMTypedData as EVMTypedData, type index$5_EVMUnsignedTransaction as EVMUnsignedTransaction, index$5_fetchEVMFeeProperties as fetchEVMFeeProperties };
}

declare abstract class BTCRpcAdapter {
    abstract selectUTXOs(from: string, targets: BTCOutput[]): Promise<{
        inputs: BTCInput[];
        outputs: BTCOutput[];
    }>;
    abstract broadcastTransaction(transactionHex: string): Promise<string>;
    abstract getBalance(address: string): Promise<number>;
    abstract getTransaction(txid: string): Promise<BTCTransaction$1>;
}

declare class Mempool extends BTCRpcAdapter {
    private readonly providerUrl;
    constructor(providerUrl: string);
    private fetchFeeRate;
    private fetchUTXOs;
    selectUTXOs(from: string, targets: BTCOutput[], confirmationTarget?: number): Promise<{
        inputs: BTCInput[];
        outputs: BTCOutput[];
    }>;
    broadcastTransaction(transactionHex: string): Promise<string>;
    getBalance(address: string): Promise<number>;
    getTransaction(txid: string): Promise<BTCTransaction$1>;
}

declare const BTCRpcAdapters: {
    Mempool: typeof Mempool;
};

/**
 * Implementation of the ChainAdapter interface for Bitcoin network.
 * Handles interactions with both Bitcoin mainnet and testnet, supporting P2WPKH transactions.
 */
declare class Bitcoin extends ChainAdapter<BTCTransactionRequest, BTCUnsignedTransaction> {
    private static readonly SATOSHIS_PER_BTC;
    private readonly network;
    private readonly btcRpcAdapter;
    private readonly contract;
    /**
     * Creates a new Bitcoin chain instance
     * @param params - Configuration parameters
     * @param params.network - Network identifier (mainnet/testnet)
     * @param params.contract - Instance of the chain signature contract for MPC operations
     * @param params.btcRpcAdapter - Bitcoin RPC adapter for network interactions
     */
    constructor({ network, contract, btcRpcAdapter, }: {
        network: BTCNetworkIds;
        contract: ChainSignatureContract;
        btcRpcAdapter: BTCRpcAdapter;
    });
    /**
     * Converts satoshis to BTC
     * @param satoshis - Amount in satoshis
     * @returns Amount in BTC
     */
    static toBTC(satoshis: number): number;
    /**
     * Converts BTC to satoshis
     * @param btc - Amount in BTC
     * @returns Amount in satoshis (rounded)
     */
    static toSatoshi(btc: number): number;
    private fetchTransaction;
    private static transformRSVSignature;
    /**
     * Creates a Partially Signed Bitcoin Transaction (PSBT)
     * @param params - Parameters for creating the PSBT
     * @param params.transactionRequest - Transaction request containing inputs and outputs
     * @returns Created PSBT instance
     */
    createPSBT({ transactionRequest, }: {
        transactionRequest: BTCTransactionRequest;
    }): Promise<bitcoin.Psbt>;
    getBalance(address: string): Promise<{
        balance: bigint;
        decimals: number;
    }>;
    deriveAddressAndPublicKey(predecessor: string, path: string): Promise<{
        address: string;
        publicKey: string;
    }>;
    serializeTransaction(transaction: BTCUnsignedTransaction): string;
    deserializeTransaction(serialized: string): BTCUnsignedTransaction;
    prepareTransactionForSigning(transactionRequest: BTCTransactionRequest): Promise<{
        transaction: BTCUnsignedTransaction;
        hashesToSign: HashToSign[];
    }>;
    finalizeTransactionSigning({ transaction: { psbt, publicKey }, rsvSignatures, }: {
        transaction: BTCUnsignedTransaction;
        rsvSignatures: RSVSignature[];
    }): string;
    broadcastTx(txSerialized: string): Promise<{
        hash: string;
    }>;
}

type index$4_BTCInput = BTCInput;
type index$4_BTCNetworkIds = BTCNetworkIds;
type index$4_BTCOutput = BTCOutput;
type index$4_BTCRpcAdapter = BTCRpcAdapter;
declare const index$4_BTCRpcAdapter: typeof BTCRpcAdapter;
declare const index$4_BTCRpcAdapters: typeof BTCRpcAdapters;
type index$4_BTCTransactionRequest = BTCTransactionRequest;
type index$4_BTCUnsignedTransaction = BTCUnsignedTransaction;
type index$4_Bitcoin = Bitcoin;
declare const index$4_Bitcoin: typeof Bitcoin;
declare namespace index$4 {
  export { type index$4_BTCInput as BTCInput, type index$4_BTCNetworkIds as BTCNetworkIds, type index$4_BTCOutput as BTCOutput, index$4_BTCRpcAdapter as BTCRpcAdapter, index$4_BTCRpcAdapters as BTCRpcAdapters, type BTCTransaction$1 as BTCTransaction, type index$4_BTCTransactionRequest as BTCTransactionRequest, type index$4_BTCUnsignedTransaction as BTCUnsignedTransaction, index$4_Bitcoin as Bitcoin };
}

/**
 * Implementation of the ChainAdapter interface for Cosmos-based networks.
 * Handles interactions with Cosmos SDK chains like Cosmos Hub, Osmosis, etc.
 */
declare class Cosmos extends ChainAdapter<CosmosTransactionRequest, CosmosUnsignedTransaction> {
    private readonly registry;
    private readonly chainId;
    private readonly contract;
    private readonly endpoints?;
    /**
     * Creates a new Cosmos chain instance
     * @param params - Configuration parameters
     * @param params.chainId - Chain id for the Cosmos network
     * @param params.contract - Instance of the chain signature contract for MPC operations
     * @param params.endpoints - Optional RPC and REST endpoints
     * @param params.endpoints.rpcUrl - Optional RPC endpoint URL
     * @param params.endpoints.restUrl - Optional REST endpoint URL
     */
    constructor({ chainId, contract, endpoints, }: {
        contract: ChainSignatureContract;
        chainId: CosmosNetworkIds;
        endpoints?: {
            rpcUrl?: string;
            restUrl?: string;
        };
    });
    private transformRSVSignature;
    private getChainInfo;
    getBalance(address: string): Promise<{
        balance: bigint;
        decimals: number;
    }>;
    deriveAddressAndPublicKey(predecessor: string, path: string): Promise<{
        address: string;
        publicKey: string;
    }>;
    serializeTransaction(transaction: CosmosUnsignedTransaction): string;
    deserializeTransaction(serialized: string): CosmosUnsignedTransaction;
    prepareTransactionForSigning(transactionRequest: CosmosTransactionRequest): Promise<{
        transaction: CosmosUnsignedTransaction;
        hashesToSign: HashToSign[];
    }>;
    finalizeTransactionSigning({ transaction, rsvSignatures, }: {
        transaction: CosmosUnsignedTransaction;
        rsvSignatures: RSVSignature[];
    }): string;
    broadcastTx(txSerialized: string): Promise<string>;
}

type index$3_Cosmos = Cosmos;
declare const index$3_Cosmos: typeof Cosmos;
type index$3_CosmosNetworkIds = CosmosNetworkIds;
type index$3_CosmosTransactionRequest = CosmosTransactionRequest;
type index$3_CosmosUnsignedTransaction = CosmosUnsignedTransaction;
declare namespace index$3 {
  export { index$3_Cosmos as Cosmos, type index$3_CosmosNetworkIds as CosmosNetworkIds, type index$3_CosmosTransactionRequest as CosmosTransactionRequest, type index$3_CosmosUnsignedTransaction as CosmosUnsignedTransaction };
}

interface SolanaTransactionRequest {
    from: string;
    to: string;
    amount: bigint | BN;
    instructions?: TransactionInstruction[];
    feePayer?: PublicKey;
}
interface SolanaUnsignedTransaction {
    transaction: Transaction;
    feePayer: PublicKey;
    recentBlockhash: string;
}

declare class Solana extends ChainAdapter<SolanaTransactionRequest, SolanaUnsignedTransaction> {
    private readonly connection;
    private readonly contract;
    constructor(args: {
        solanaConnection: Connection;
        contract: ChainSignatureContract;
    });
    getBalance(address: string): Promise<{
        balance: bigint;
        decimals: number;
    }>;
    deriveAddressAndPublicKey(predecessor: string, path: string): Promise<{
        address: string;
        publicKey: string;
    }>;
    serializeTransaction(transaction: SolanaUnsignedTransaction): string;
    deserializeTransaction(serialized: string): SolanaUnsignedTransaction;
    prepareTransactionForSigning(request: SolanaTransactionRequest): Promise<{
        transaction: SolanaUnsignedTransaction;
        hashesToSign: HashToSign[];
    }>;
    finalizeTransactionSigning({ transaction, rsvSignatures, senderAddress, }: {
        transaction: Transaction;
        rsvSignatures: Signature;
        senderAddress: string;
    }): string;
    broadcastTx(txSerialized: string): Promise<{
        hash: string;
    }>;
}

type index$2_Solana = Solana;
declare const index$2_Solana: typeof Solana;
type index$2_SolanaTransactionRequest = SolanaTransactionRequest;
type index$2_SolanaUnsignedTransaction = SolanaUnsignedTransaction;
declare namespace index$2 {
  export { index$2_Solana as Solana, type index$2_SolanaTransactionRequest as SolanaTransactionRequest, type index$2_SolanaUnsignedTransaction as SolanaUnsignedTransaction };
}

type index$1_ChainAdapter<TransactionRequest, UnsignedTransaction> = ChainAdapter<TransactionRequest, UnsignedTransaction>;
declare const index$1_ChainAdapter: typeof ChainAdapter;
declare namespace index$1 {
  export { index$1_ChainAdapter as ChainAdapter, index$4 as btc, index$3 as cosmos, index$5 as evm, index$2 as solana };
}

declare const EVMTransaction: (req: EVMRequest, keyPair: KeyPair$1) => Promise<Response>;
declare const BTCTransaction: (req: BitcoinRequest, keyPair: KeyPair$1) => Promise<Response>;
declare const CosmosTransaction: (req: CosmosRequest, keyPair: KeyPair$1) => Promise<Response>;

declare const keypair_BTCTransaction: typeof BTCTransaction;
declare const keypair_CosmosTransaction: typeof CosmosTransaction;
declare const keypair_EVMTransaction: typeof EVMTransaction;
declare namespace keypair {
  export { keypair_BTCTransaction as BTCTransaction, keypair_CosmosTransaction as CosmosTransaction, keypair_EVMTransaction as EVMTransaction };
}

declare const signAndSend_keypair: typeof keypair;
declare namespace signAndSend {
  export { signAndSend_keypair as keypair };
}

declare const utils: {
    transaction: typeof transaction;
    signAndSend: typeof signAndSend;
};

type index_ChainSignatureContract = ChainSignatureContract;
declare const index_ChainSignatureContract: typeof ChainSignatureContract;
type index_SignArgs = SignArgs;
declare const index_utils: typeof utils;
declare namespace index {
  export { index_ChainSignatureContract as ChainSignatureContract, type index_SignArgs as SignArgs, index_utils as utils };
}

export { type ChainSigEvmMpcSignature, type ChainSigNearMpcSignature, type CompressedPubKeySEC1, type DerivedPublicKeyArgs, type Ed25519PubKey, type HashToSign, type KeyDerivationPath, type MPCSignature, type NajPublicKey, type NearNearMpcSignature, type RSVSignature, type Signature, type UncompressedPubKeySEC1, index$1 as chainAdapters, constants, index as contracts, index$6 as utils };
