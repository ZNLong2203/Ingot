# Deploying the registry to a public testnet

The demo runs the contract in the browser. The same bytecode deploys to any EVM network, and `scripts/deploy-testnet.ts` replays the demo on it: two accredited verifiers, the smelter and the mill, the pig iron delivery, the mill's Q3 2026 statement consuming it, two shipments, one declaration, and one over-allocation sent with a fixed gas limit so the explorer shows the refusal.

## The deployment on Ethereum Sepolia

| | |
|---|---|
| Registry | [`0x81700eedd80142d65859616101e521729fd95473`](https://eth-sepolia.blockscout.com/address/0x81700eedd80142d65859616101e521729fd95473) |
| Source | Verified, exact match on [Sourcify](https://repo.sourcify.dev/11155111/0x81700eedd80142d65859616101e521729fd95473) and on [Blockscout](https://eth-sepolia.blockscout.com/address/0x81700eedd80142d65859616101e521729fd95473?tab=contract) |
| Replayed | 24 October 2026: 20 transactions mined, and the double sale [mined as failed](https://eth-sepolia.blockscout.com/tx/0x91327120ce38dafdf9e444d87a143ff75fd7b15fafc0d06c0edeba5a660647ed) with `ExceedsVerifiedQuantity(availableKg 160,700,000, requestedKg 170,000,000)` |
| Passport | The smelter's delivery to the Italian buyer, anchored there: *Example on Ethereum Sepolia* on [/verify](https://ingot-six-blush.vercel.app/verify) runs all ten checks against the chain |

Every transaction is listed on [/ledger](https://ingot-six-blush.vercel.app/ledger) and in [`lib/chain/deployments.json`](../lib/chain/deployments.json). The demo actors' keys derive from public strings, so anyone can act as them on the testnet; only the authority's key is private. It is a public demo, not a registry of record.

## Doing it yourself

1. Create a throwaway key and give it about 0.05 test ETH (for Sepolia, for example the [Google Cloud faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)). The script sends 0.003 ETH of gas money to each of the six demo actors (`GAS_FUND` changes it). Never fund the actors on a real network.
2. Put the RPC URL and the key in `.env` (git-ignored):
   ```
   RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
   DEPLOYER_PRIVATE_KEY=0x…
   ```
3. Run:
   ```bash
   npx tsx --env-file=.env scripts/deploy-testnet.ts
   ```
   The registry address, statement ids, every transaction hash and the example passport go to `lib/chain/deployments.json`.
4. Verify the source (no API key needed). The constructor argument is the deployer's address:
   ```bash
   set -a; . ./.env; set +a
   npx hardhat verify sourcify --network sepolia --build-profile default <registry> <deployer>
   npx hardhat verify blockscout --network sepolia --build-profile default <registry> <deployer>
   ```
   Then add the Sourcify link as `source` in the deployment's entry.
5. Commit `deployments.json` and redeploy the site: `/ledger` links each transaction on the explorer, and `/verify` offers the example passport.

The script was also tested against a local Hardhat node (`npx hardhat node`), where the refused allocation is rejected before mining instead of being mined as failed.
