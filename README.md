# 💜 BrixaScaler - VPN for TPS

> **Proof of Concept** - For experienced developers to finish

**Add infinite transactions per second to any blockchain**

BrixaScaler is a **transaction scaling middleware** that sits between your wallet and the blockchain. It queues, batches, and processes transactions to multiply your effective TPS.

**Not a blockchain. Not a Layer 2. Just a VPN for TPS.**

---

## 🚀 Quick Start

### Option 1: Standalone (Quick Test)
```bash
# Clone
git clone https://github.com/Brixa420/vpn-for-tps.git
cd vpn-for-tps/integration

# Run (no API key needed!)
node server.js --chain ethereum

# Connect wallet to http://localhost:8545
```

That's it! Your transactions now flow through BrixaScaler.

### Option 2: Validator Sidecar (Production)
```bash
# Install alongside existing validator - just run!
node sidecar.js --chain ethereum

# Or to enhance your own validator:
node sidecar.js --chain ethereum --original-rpc http://your-validator:8546 --port 8545

# Your validator now has transaction batching!
```

---

## 📖 How It Works

```
┌─────────┐     ┌─────────────┐     ┌────────────┐
│ Wallet  │────►│  BrixaScaler │────►│ Blockchain │
│         │     │ (your PC)    │     │ (ETH/SOL)  │
└─────────┘     └─────────────┘     └────────────┘
                   ▲
                   │ 1. Queue transactions
                   │ 2. Batch them together
                   │ 3. Submit as one
```

1. **Wallet** sends transaction to BrixaScaler (not directly to chain)
2. **BrixaScaler** queues transactions across 100 shards
3. **Batch Processor** combines them (default: 1,000 per batch)
4. **Chain Handler** submits to blockchain

**Result:** 1,000 wallet txs = 1 blockchain call

---

## ⚡ Features

- ✅ **Drop-in** - No blockchain changes required
- ✅ **100 shards** - Parallel transaction processing
- ✅ **Public RPCs** - No API key needed
- ✅ **7 chains** - ETH, Polygon, BSC, Avalanche, Arbitrum, Optimism, Solana
- ✅ **Status page** - Built-in dashboard at http://localhost:8545
- ✅ **Security** - Rate limiting, API auth, input validation

---

## 📡 Supported Chains

| Chain | Command | Status |
|-------|---------|--------|
| Ethereum | `--chain ethereum` | ✅ |
| Polygon | `--chain polygon` | ✅ |
| BSC | `--chain bsc` | ✅ |
| Avalanche | `--chain avalanche` | ✅ |
| Arbitrum | `--chain arbitrum` | ✅ |
| Optimism | `--chain optimism` | ✅ |
| Solana | `--chain solana` | ✅ |

---

## 🔧 Usage

### RPC Server
```bash
# Basic
node server.js --chain ethereum

# Custom port
node server.js --chain polygon --port 8546

# Custom shards
node server.js --chain ethereum --shards 200
```

### JavaScript Library
```javascript
const { BrixaScaler } = require('./brixa-scaler');

const scaler = new BrixaScaler('ethereum', {
  shards: 100,
  batchSize: 1000
});

await scaler.start();

// Submit transactions
const txId = await scaler.submit({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
  value: '1000000000000000000'
});
```

---

## ⚠️ Demo Mode

Current version is **DEMO MODE**:
- Transactions are queued and logged
- NOT actually submitted to blockchain
- To enable real sends, add private key + signing

---

## 📂 Files

```
vpn-for-tps/
├── WHITEPAPER.md           # Full technical explanation
├── integration/
│   ├── brixa-scaler.js    # Main library
│   ├── server.js          # RPC proxy server
│   └── drop-in.html       # Browser version
├── python/                 # Python package
└── package.json
```

---

## 🤝 Contributing

1. Fork it
2. Make changes
3. Open PR

---

## 📜 License

MIT

---

## ⚠️ Proof of Concept

**This is a proof of concept** - a working skeleton, not production-ready.

### What's Done
- ✅ Transaction queuing and sharding
- ✅ Batch processing logic  
- ✅ RPC proxy server
- ✅ Public RPC integration
- ✅ Security (rate limiting, API auth, input validation)

### What Needs Finishing (for production)
- ❌ Real transaction signing (add private key handling)
- ❌ Gas/fee management
- ❌ Transaction confirmations
- ❌ Distributed coordination

---

## 🔒 Security

BrixaScaler includes security features enabled by default:

### Default Security (Always On)
- **Rate limiting**: 100 requests per 10 seconds per IP
- **Input validation**: All RPC params validated
- **CORS**: Restricted to localhost by default
- **Demo mode**: Transactions logged, NOT sent to chain

### Optional Security (Enable for Production)

```bash
# Enable API key authentication
export API_KEY=your-secret-key
node server.js --chain ethereum

# Production mode (actually send transactions)
export DEMO_MODE=false
export API_KEY=your-secret-key
node server.js --chain ethereum
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | (none) | Set to require authentication |
| `DEMO_MODE` | true | Set to `false` to send real transactions |
| `CORS_ORIGINS` | localhost | Comma-separated list |
| `MAX_QUEUE_SIZE` | 100000 | Max queued transactions |
| `MAX_BATCH_SIZE` | 1000 | Max txs per batch |
| `PORT` | 8545 | Server port |

### Connecting to Your RPC
```bash
# Point to your blockchain RPC
node server.js --chain ethereum
```

The dev just needs to:
1. Clone the repo
2. Run `npm install`
3. Point their wallet to `http://localhost:8545`
4. Optionally set `DEMO_MODE=false` and add RPC credentials for real sends

---

## 👤 Author

**Laura Wolf (Brixa420)**

Built with 🧸 by Elara AI

---

## 🔗 Links

- [GitHub](https://github.com/Brixa420/vpn-for-tps)
- [Whitepaper](WHITEPAPER.md)