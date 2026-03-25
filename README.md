# 💜 BrixaScaler

> **Simple transaction batching for any blockchain**

Batches multiple transactions and submits them together. That's it. No ZK. No tokens. Just works.

---

## Quick Start

```bash
# Run
node brixa-scaler.js --chain ethereum

# Point wallet to http://localhost:8545
```

---

## Features

- ⚡ **Batching** - Queues transactions, submits in batches
- ⛓️ **Multi-chain** - ETH, Polygon, BSC, Avalanche, Arbitrum, Optimism, Solana
- 🔒 **Secure** - Optional API key, rate limiting
- 📊 **Dashboard** - Built-in stats page

---

## Usage

```bash
# Basic
node brixa-scaler.js --chain ethereum

# Custom RPC
node brixa-scaler.js --chain ethereum --rpc https://your-rpc:8546

# Custom port
node brixa-scaler.js --port 8546

# API key (optional)
export API_KEY=your-secret-key
node brixa-scaler.js
```

---

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--chain` | ethereum | Target chain |
| `--rpc` | auto | Custom RPC URL |
| `--port` | 8545 | Server port |
| `--batch-size` | 100 | Txs per batch |
| `--batch-interval` | 1000 | MS between batches |

---

## Supported Chains

- ethereum
- polygon
- bsc
- avalanche
- arbitrum
- optimism
- solana

---

## No Junk

- ❌ No ZK proofs
- ❌ No tokens
- ❌ No blockchain
- ❌ No node rewards
- ✅ Just transaction batching

That's it.