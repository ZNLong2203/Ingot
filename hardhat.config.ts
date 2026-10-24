import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  paths: {
    sources: "contracts",
    tests: { nodejs: "contracts/test", solidity: "contracts" },
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
        settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
      },
    },
    npmFilesToBuild: [],
  },
  networks: {
    // Public testnet. The key is read from the Hardhat keystore or the
    // environment, never from this file.
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
