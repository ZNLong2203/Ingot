import {
  createPublicClient,
  http,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionReturnType,
  type Hex,
  type PublicClient,
} from "viem";
import type { Passport } from "@/lib/passport";
import deployments from "./deployments.json";
import { registryAbi } from "./registry-artifact";

/**
 * The same registry on a public testnet, read through a public RPC node. It
 * answers the same view calls as the sandbox, so a passport anchored there
 * is checked by the same code, from any browser.
 */

type Abi = typeof registryAbi;
type ReadName = ContractFunctionName<Abi, "view" | "pure">;

/**
 * Networks the deploy script knows. Sepolia's explorer is Blockscout, where the
 * source verifies without an API key. Only networks with an RPC here can be
 * read from the page.
 */
export const networks: Record<number, { name: string; slug: string; explorer: string; rpc?: string }> = {
  11155111: {
    name: "Ethereum Sepolia",
    slug: "sepolia",
    explorer: "https://eth-sepolia.blockscout.com",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  },
  84532: { name: "Base Sepolia", slug: "base-sepolia", explorer: "https://sepolia.basescan.org" },
  80002: { name: "Polygon Amoy", slug: "polygon-amoy", explorer: "https://amoy.polygonscan.com" },
};

export interface Deployment {
  chainId: number;
  explorer: string | null;
  /** Where the verified source can be read, when it has been verified. */
  source?: string;
  registry: Address;
  deployedAt: string;
  statements: { smelter: Hex; mill: Hex };
  transactions: { label: string; hash: Hex; status: string }[];
  /** The smelter's delivery to the Italian buyer, anchored on this deployment. */
  examplePassport?: Passport;
}

export const publicDeployments = deployments.deployments as unknown as Deployment[];

export class PublicLedger {
  readonly chainId: number;
  readonly registry: Address;
  private client: PublicClient;

  constructor(d: Deployment, rpc: string) {
    this.chainId = d.chainId;
    this.registry = d.registry;
    this.client = createPublicClient({ transport: http(rpc) });
  }

  async read<N extends ReadName>(
    functionName: N,
    args: ContractFunctionArgs<Abi, "view" | "pure", N>,
  ): Promise<ContractFunctionReturnType<Abi, "view" | "pure", N>> {
    return this.client.readContract({ address: this.registry, abi: registryAbi, functionName, args } as never) as never;
  }
}

/** The deployment a passport names, if the page can read that network. */
export function findDeployment(chainId: number, registry: string): { deployment: Deployment; ledger: PublicLedger } | null {
  const deployment = publicDeployments.find((d) => d.chainId === chainId && d.registry.toLowerCase() === registry.toLowerCase());
  const rpc = networks[chainId]?.rpc;
  return deployment && rpc ? { deployment, ledger: new PublicLedger(deployment, rpc) } : null;
}
