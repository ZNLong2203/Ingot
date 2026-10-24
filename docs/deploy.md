# Deploying the registry to a public testnet

The demo runs the contract in the browser. The same bytecode deploys to any EVM network, and `scripts/deploy-testnet.ts` replays the demo on it: two accredited verifiers, the smelter and the mill, the pig iron delivery, the mill's Q3 2026 statement consuming it, two shipments, one declaration, and one over-allocation sent with a fixed gas limit so the explorer shows the refusal.

1. Create a throwaway key and give it about 0.05 test ETH (for Sepolia, for example the [Google Cloud faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)). The script sends 0.003 ETH of gas money to each of the six demo actors (`GAS_FUND` changes it). The actors' keys are derived from public strings: never fund them on a real network.
2. Put the RPC URL and the key in `.env.local` (git-ignored):
   ```
   RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
   DEPLOYER_PRIVATE_KEY=0x…
   ```
3. Run:
   ```bash
   npx tsx --env-file=.env.local scripts/deploy-testnet.ts
   ```
4. The registry address, statement ids and every transaction hash are written to `lib/chain/deployments.json`. Commit it and redeploy the site; the ledger page then links each transaction on the explorer.

The script was tested end to end against a local Hardhat node (`npx hardhat node`), where the refused allocation is rejected before mining instead of being mined as failed.
