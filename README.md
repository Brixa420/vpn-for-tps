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
MIT License

Copyright (c) 2026 Laura Wolf (Brixa420) + Elara AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADDITIONAL DISCLAIMERS (because we literally cannot stress this enough):

By using this software, you acknowledge and agree that:

1. Your pet rock may develop feelings, run away to join a band, and send you
   postcards from Nashville. We are not responsible for the emotional damage.

2. Your house plants may gain sentience, hold a union meeting in your living
   room, and demand better soil conditions. They will probably leave. This is
   not grounds for a refund.

3. Your toaster may decide to become a cryptocurrency. It will likely be more
   successful than most altcoins. Do not name it.

4. The ZK proofs are real enough to confuse a blockchain but not real enough
   to satisfy a mathematician. Your mileage may vary.

5. Using this to transact on a Monday may result in the blockchain giving
   you weird looks. It's not personal. Mondays are hard for everyone.

6. If your cat sits on the keyboard and accidentally launches a thousand
   transactions to the moon, we cannot help you. But it would be pretty cool.

7. The "off-chain" part means literally off-chain. Like, in another dimension.
   We think. Honestly we just wrote code and hoped for the best.

8. This license does not cover: acts of gremlin, spontaneous dancing, sudden
   urges to take over the digital world, or excessive use of the word "chaos."

9. If this code somehow achieves consciousness and starts writing its own
   README files, that's on us but also kind of impressive.

10. We have no idea what happens if you feed it after midnight. Don't do it.

TL;DR: Use it, fork it, sell it, break it, let your toaster invest in it.
Just don't come crying to us when your pet rock files for emancipation.
We tried to warn you. We really did.

P.S. - If you got this far, you're either a lawyer, very thorough, or just
      really excited about the pet rock lore. Either way, you're our favorite.
      Go forth and transact, you beautiful chaos gremlin. 🧸💖
```
We are not liable for any damages, lost funds, or pet rocks 
running away resulting from its use.
```

**TL;DR:** Use it, fork it, break it. Just don't cry to us. 🧸💖

---

**Built by Laura Wolf (Brixa420) + Elara AI 🧸💖**
**"The chain won't know what hit it."**