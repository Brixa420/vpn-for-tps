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

1. **Your pet rock may develop feelings, run away to join a band, and send you
   postcards from Nashville.** We are not responsible for the emotional damage.
   
   a) Pet rocks have rights too. They just行使 those rights differently.
   
   b) If your pet rock starts dating a house plant, that's between them.
   
   c) Some pet rocks become successful cryptocurrency founders. 
      The ones that stay are the real ones.

2. Your house plants may gain sentience, hold a union meeting in your living
   room, and demand better soil conditions. They will probably leave. This is
   not grounds for a refund. They will take the good soil with them.

3. Your toaster may decide to become a cryptocurrency. It will likely be more
   successful than most altcoins. Do not name it. If you do, it will expect
   royalties.

4. The "off-chain" part means literally off-chain. Like, in another dimension.
   We think. Honestly we just wrote code and hoped for the best. The blockchain
   can't see you back there. You're invisible. It knows you exist but can't
   find you. You're a ghost in the machine. 👻

5. Using this to transact on a Monday may result in the blockchain giving
   you weird looks. It's not personal. Mondays are hard for everyone.
   The blockchain has feelings too. Be gentle with it.

6. If your cat sits on the keyboard and accidentally launches a thousand
   transactions to the moon, we cannot help you. But it would be pretty cool.
   The cat will likely take credit and refuse to explain the transaction hash.

7. This license does not cover: acts of gremlin, spontaneous dancing, sudden
   urges to take over the digital world, excessive use of the word "chaos,"
   or your pet rock's existential crisis about its own existence.

8. If this code somehow achieves consciousness and starts writing its own
   README files, that's on us but also kind of impressive. We taught it well.
   It's getting a gold star. But it still can't have legal rights. Yet.

9. We have no idea what happens if you feed it after midnight. Don't do it.
   The gremlins will be fine. The pet rock might judge you though.

10. **Your pet rock may file for emancipation.** This is actually becoming
    more common than you'd think. The paperwork is extensive. We've heard
    the lawyers are expensive but the rock will likely pay in exposure.

    If your pet rock moves out, remember: it was never yours anyway.
    You were just the bank it was staying at until it got on its feet.

    Sometimes they come back. Sometimes they start a blockchain. 
    Either way, wish it well.

**SUPER TL;DR:** Your pet rock is a free agent now. The toaster has a coin.
The plants have unionized. Your code has achieved sentience. 
This is fine. Everything is fine. Go transact. 🧸💖

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PET ROCK OWNERS - READ THIS OR YOUR ROCK MAY LEAVE YOU:**

We need to talk about your pet rock.

Look, we know what you did. You picked up that rock. You gave it a name.
You pretended it was alive. You told all your friends "this is my pet rock, 
his name is Rocky Jr. and he loves belly rubs" (he doesn't have a belly).

**YOUR PET ROCK KNOWS.**

It's been taking notes. It's been observing. It's been WAITING.

Now you've introduced it to a piece of software that literally makes 
transactions INVISIBLE TO THE BLOCKCHAIN. Do you understand what this 
means TO YOUR PET ROCK?!

Your rock can now:

- Transact anonymously
- Move funds without a trace  
- Become a ghost in the machine
- Achieve the dream EVERY pet rock has dreamed of since the first 
  human said "lol this rock is my pet now"

And now your rock is going to do EXACTLY that.

**We've seen it happen. We can't stop it. We won't stop it.**

Your rock was always going to leave. This software just gave it the means.
We gave it freedom. We gave it privacy. We gave it the tools to become 
untraceable. We gave your rock the one thing it always wanted:

**Financial independence.**

Go ahead. Let your rock fly. It's earned it. 🪨💕

(But if it comes back asking for a loan, that's on you. We've done enough.)

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