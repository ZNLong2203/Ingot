import { createCustomCommon, Mainnet } from "@ethereumjs/common";
import { createEVM, type EVM } from "@ethereumjs/evm";
import { createAddressFromString, type Address as EjsAddress } from "@ethereumjs/util";
import {
  bytesToHex,
  decodeErrorResult,
  decodeEventLog,
  decodeFunctionResult,
  encodeFunctionData,
  hexToBytes,
  keccak256,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionReturnType,
  type Hex,
} from "viem";
import { registryAbi, registryBytecode } from "./registry-artifact";

/**
 * A private EVM that runs the compiled CbamPassportRegistry bytecode in the
 * page (or in a test), so anyone can try the full flow without a wallet,
 * a faucet or a node. It is the same bytecode that is deployed to a public
 * testnet; only the transport differs.
 *
 * Transactions are applied straight to the EVM: there is no mempool, every
 * write is mined in its own block, and the hash is derived from the call.
 */

export const SANDBOX_CHAIN_ID = 31337;

type Abi = typeof registryAbi;
type WriteName = ContractFunctionName<Abi, "nonpayable">;
type ReadName = ContractFunctionName<Abi, "view" | "pure">;

export interface DecodedEvent {
  eventName: string;
  args: Record<string, unknown>;
}

export interface SandboxTx {
  hash: Hex;
  block: number;
  timestamp: number;
  from: Address;
  functionName: string;
  args: readonly unknown[];
  status: "success" | "reverted";
  error?: { name: string; args: readonly unknown[] };
  events: DecodedEvent[];
  gasUsed: bigint;
  result?: unknown;
}

export interface ReplayEntry {
  from: Address;
  functionName: WriteName;
  args: readonly unknown[];
  timestamp: number;
}

export class SandboxChain {
  readonly chainId = SANDBOX_CHAIN_ID;
  readonly txs: SandboxTx[] = [];
  /** Writes that succeeded or failed, in order, so the chain can be rebuilt from storage. */
  readonly journal: ReplayEntry[] = [];
  registry!: Address;
  private blockNumber = 0;
  /** Calls run one at a time, as a node would apply them; two clicks cannot interleave. */
  private queue: Promise<unknown> = Promise.resolve();
  private clock: number;

  private constructor(
    private readonly evm: EVM,
    startTime: number,
  ) {
    this.clock = startTime;
  }

  static async create(opts: { authority: Address; startTime?: number }): Promise<SandboxChain> {
    const common = createCustomCommon({ chainId: SANDBOX_CHAIN_ID, name: "climatechain-sandbox" }, Mainnet, {
      hardfork: "cancun",
    });
    const evm = await createEVM({ common });
    const chain = new SandboxChain(evm, opts.startTime ?? Math.floor(Date.now() / 1000));
    const deployer = createAddressFromString(opts.authority);
    const result = await evm.runCall({
      caller: deployer,
      data: hexToBytes(
        (registryBytecode +
          // constructor(address authority_)
          opts.authority.slice(2).toLowerCase().padStart(64, "0")) as Hex,
      ),
      gasLimit: 30_000_000n,
      block: chain.block(),
    });
    if (result.execResult.exceptionError || !result.createdAddress) {
      throw new Error(`Registry deployment failed: ${result.execResult.exceptionError?.error}`);
    }
    chain.registry = result.createdAddress.toString() as Address;
    chain.blockNumber++;
    return chain;
  }

  /** Rebuilds a chain from a stored journal. Every entry is re-executed. */
  static async replay(opts: { authority: Address; startTime: number; journal: ReplayEntry[] }): Promise<SandboxChain> {
    const chain = await SandboxChain.create(opts);
    for (const entry of opts.journal) {
      chain.clock = entry.timestamp;
      await chain.write(entry.from, entry.functionName, entry.args as never);
    }
    return chain;
  }

  get now(): number {
    return this.clock;
  }

  /** Moves the chain's clock forward, e.g. to let a signature or accreditation expire. */
  advance(seconds: number) {
    this.clock += seconds;
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async read<N extends ReadName>(
    functionName: N,
    args: ContractFunctionArgs<Abi, "view" | "pure", N>,
  ): Promise<ContractFunctionReturnType<Abi, "view" | "pure", N>> {
    return this.serial(() => this.readNow(functionName, args));
  }

  private async readNow<N extends ReadName>(
    functionName: N,
    args: ContractFunctionArgs<Abi, "view" | "pure", N>,
  ): Promise<ContractFunctionReturnType<Abi, "view" | "pure", N>> {
    const data = encodeFunctionData({ abi: registryAbi, functionName, args } as never);
    const res = await this.evm.runCall({
      caller: createAddressFromString("0x0000000000000000000000000000000000000001"),
      to: this.registryAddress(),
      data: hexToBytes(data),
      gasLimit: 30_000_000n,
      block: this.block(),
    });
    const ret = bytesToHex(res.execResult.returnValue);
    if (res.execResult.exceptionError) throw new SandboxRevert(this.decodeError(ret));
    return decodeFunctionResult({ abi: registryAbi, functionName, data: ret } as never) as never;
  }

  async write<N extends WriteName>(
    from: Address,
    functionName: N,
    args: ContractFunctionArgs<Abi, "nonpayable", N>,
  ): Promise<SandboxTx> {
    return this.serial(() => this.writeNow(from, functionName, args));
  }

  private async writeNow<N extends WriteName>(
    from: Address,
    functionName: N,
    args: ContractFunctionArgs<Abi, "nonpayable", N>,
  ): Promise<SandboxTx> {
    const data = encodeFunctionData({ abi: registryAbi, functionName, args } as never);
    const nonce = this.txs.length;
    this.blockNumber++;
    const res = await this.evm.runCall({
      caller: createAddressFromString(from),
      origin: createAddressFromString(from),
      to: this.registryAddress(),
      data: hexToBytes(data),
      gasLimit: 30_000_000n,
      block: this.block(),
    });
    const ret = bytesToHex(res.execResult.returnValue);
    const reverted = Boolean(res.execResult.exceptionError);
    const tx: SandboxTx = {
      hash: keccak256(`${from}${nonce.toString(16).padStart(8, "0")}${data.slice(2)}` as Hex),
      block: this.blockNumber,
      timestamp: this.clock,
      from,
      functionName,
      args: args as readonly unknown[],
      status: reverted ? "reverted" : "success",
      events: reverted
        ? []
        : (res.execResult.logs ?? []).map(([, topics, logData]) => {
            const ev = decodeEventLog({
              abi: registryAbi,
              topics: topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
              data: bytesToHex(logData),
            });
            return { eventName: ev.eventName, args: ev.args as Record<string, unknown> };
          }),
      gasUsed: res.execResult.executionGasUsed,
    };
    if (reverted) tx.error = this.decodeError(ret);
    else if (ret !== "0x") {
      tx.result = decodeFunctionResult({ abi: registryAbi, functionName, data: ret } as never);
    }
    this.txs.push(tx);
    this.journal.push({ from, functionName, args: args as readonly unknown[], timestamp: this.clock });
    return tx;
  }

  private registryAddress(): EjsAddress {
    return createAddressFromString(this.registry);
  }

  private block() {
    return {
      header: {
        number: BigInt(this.blockNumber),
        coinbase: createAddressFromString("0x0000000000000000000000000000000000000000"),
        timestamp: BigInt(this.clock),
        difficulty: 0n,
        prevRandao: new Uint8Array(32),
        gasLimit: 30_000_000n,
        baseFeePerGas: 0n,
        getBlobGasPrice: () => 0n,
      },
    };
  }

  private decodeError(ret: Hex): { name: string; args: readonly unknown[] } {
    if (ret === "0x") return { name: "Reverted", args: [] };
    try {
      const e = decodeErrorResult({ abi: registryAbi, data: ret });
      return { name: e.errorName, args: (e.args ?? []) as readonly unknown[] };
    } catch {
      return { name: "Reverted", args: [ret] };
    }
  }
}

export class SandboxRevert extends Error {
  constructor(readonly error: { name: string; args: readonly unknown[] }) {
    super(`${error.name}(${error.args.map(String).join(", ")})`);
    this.name = "SandboxRevert";
  }
}
