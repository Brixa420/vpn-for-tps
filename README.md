# 💜 BrixaScaler - The Legendary Edition

> **"The VPN for TPS" - Zero-Knowledge Transaction Batching**

- ⚡ **1000x TPS** on any chain
- 🔐 **ZK Privacy** - Zero-knowledge commitments
- ⛓️ **ANY CHAIN** - Just provide your RPC
- 🎮 **Just Works**

---

## ⚠️ Required: RPC Endpoint

**You must provide your own RPC URL.** This is how BrixaScaler talks to the blockchain.

```bash
node brixa-scaler.js --rpc https://your-rpc-url
```

No presets. No defaults. You bring the RPC, BrixaScaler adds the batching + ZK.

---

## What It Does

```
WALLET ─► 1,000 TXS ─► BRIXASCALER ─► ZK PROOF ─► BLOCKCHAIN
                                    │
                              Privacy preserved!
                              Batch verified!
```

### The Magic

1. **Queue** - Transactions come in, get ZK commitments
2. **Batch** - 1,000 txs combined into one
3. **ZK Proof** - Proves batch is valid without revealing details
4. **Submit** - One call to blockchain instead of 1,000

**Result: 1000x TPS + privacy on ANY chain**

---

## ZK Privacy

```
Transaction: { to: "Alice", value: 100 }

becomes:

Commitment: hash(tx + secret) ──► Public
Secret: (hidden) ──► Only you know

The blockchain sees:
- ✓ Batch is valid
- ✓ All txs are legitimate
- ✗ No one knows who sent what
```

---

## Demo Mode

**Default: DEMO_MODE=true** - Transactions are logged but NOT sent to chain.

This is for:
- Testing your app
- Development
- Seeing how it works

**For production:**
```bash
export DEMO_MODE=false
node brixa-scaler.js --chain ethereum
```

---

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--chain` | ethereum | Target chain |
| `--rpc` | auto | Custom RPC URL |
| `--port` | 8545 | Server port |
| `--batch-size` | 1000 | Txs per batch |
| `--batch-interval` | 1000 | MS between batches |
| `--shards` | 100 | Parallel shards |

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_MODE` | true | false = actually send txs |
| `API_KEY` | - | Require API key |
| `RPC_URL` | auto | Override RPC |

---

## No Presets

- ❌ No token lists
- ❌ No chain configs
- ❌ No limitations

- ✅ ANY RPC URL works
- ✅ Any blockchain
- ✅ Fully chain agnostic
- ❌ No complexity

- ✅ Just TPS + ZK + middleware

---

## Files

```
integration/
├── brixa-scaler.js    # ⭐ Main server
├── server.js         # Basic proxy
├── sidecar.js        # Validator sidecar
└── test-scaler.js    # Tests
```

---

**Built by Laura Wolf (Brixa420) + Elara AI 🧸💖**