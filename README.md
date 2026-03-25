# 💜 BrixaScaler + BrixaRoll

> **"The VPN for TPS" - True Off-Chain Rollup**

Two versions for maximum chaos:

---

## 🚀 BrixaRoll (Recommended - TRUE OFF-CHAIN)

**The chain barely knows you exist.**

```bash
node brixaroll.js --rpc https://your-rpc-url
```

### How It Works

```
WALLET ──► 1000 TXS ──► BRIXAROLL (OFF-CHAIN)
                            │
                            ▼
                   [hold all txs off-chain]
                            │
                            ▼
                   Generate ZK proof
                            │
                            ▼
                   Submit 1 PROOF TX to chain
                            │
                            ▼
              CHAIN SEES: 1 transaction
              ACTUALLY EXECUTED: 1000 transactions
```

- Chain sees: **1 tx**
- Real txs: **1000 tx**
- Speed: **🚀🚀🚀 INSANE**

---

## ⚡ BrixaScaler (Batching)

**Simpler, less efficient, still fast.**

```bash
node brixa-scaler.js --rpc https://your-rpc-url
```

### How It Works

```
WALLET ──► 1000 TXS ──► BRIXASCALER
                            │
                            ▼
                   [batch together]
                            │
                            ▼
                   Send 1 RPC call
                            │
                            ▼
              CHAIN SEES: 1 call (with 1000 txs)
```

- Chain sees: **1 RPC call**
- Still fast, simpler to run

---

## Quick Start

```bash
# BrixaRoll - TRUE off-chain (recommended)
node brixaroll.js --rpc https://your-rpc-url

# OR BrixaScaler - simple batching
node brixa-scaler.js --rpc https://your-rpc-url
```

---

## Which One?

| Version | Chain Sees | Speed | Complexity |
|---------|-----------|-------|------------|
| **BrixaRoll** | 1 tx per 1000 | 🚀🚀🚀 | Medium |
| **BrixaScaler** | 1 call per 1000 | 🚀 | Easy |

**BrixaRoll = maximum chaos.** 

---

## Smart Contract (for BrixaRoll)

Deploy `contracts/BrixaRollup.sol` to enable true off-chain:

```bash
# Compile with solc
solc contracts/BrixaRollup.sol --combined-json abi > abi.json

# Deploy (using remix, hardhat, etc.)
# Set ROLLUP_CONTRACT env var
export ROLLUP_CONTRACT=0xYourDeployedAddress
```

---

## ⚠️ Required: RPC Endpoint

You must provide your own RPC URL:

```bash
node brixaroll.js --rpc https://your-rpc-url
```

---

## Bitcoin Setup

Bitcoin needs a local node:

```bash
# Run bitcoind
bitcoind -server -rpcuser=user -rpcpassword=pass -rpcport=8332

# Connect
node brixaroll.js --rpc http://user:pass@localhost:8332
```

---

## Demo Mode

**Default: DEMO_MODE=true** - Logs transactions, doesn't submit to chain.

For production:
```bash
export DEMO_MODE=false
node brixaroll.js --rpc https://your-rpc-url
```

---

## Files

```
integration/
├── brixaroll.js       # ⭐ TRUE OFF-CHAIN ROLLUP
├── brixa-scaler.js    # Simple batching
├── server.js          # Basic proxy
└── sidecar.js        # Validator sidecar

contracts/
└── BrixaRollup.sol   # Smart contract for rollup
```

---

## License

**MIT License - Do whatever you want.** Just don't sue us.

```
DISCLAIMER: This software is provided "as is", without warranty.
We are not liable for any damages, lost funds, or pet rocks 
running away resulting from its use.
```

**TL;DR:** Use it, fork it, break it. Just don't cry to us. 🧸💖

---

**Built by Laura Wolf (Brixa420) + Elara AI 🧸💖**
**"The chain won't know what hit it."**