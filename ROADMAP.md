# BrixaScaler - Technical Roadmap

## Acknowledgments
Kimi K2.5 provided excellent feedback. This document addresses the gaps and outlines the full architecture.

---

## Current Status (What We Have)

### ✅ Working
1. **Off-chain batching**: 750K TPS (verified on M4)
2. **ZK-SNARK circuit**: batch_merkle.circom (72-level Merkle)
3. **Trusted setup**: Complete with contribution
4. **Proof generation/verification**: Working (snarkjs)
5. **Solidity verifier**: Verifier.sol for on-chain verification
6. **RPC proxy**: server.js handles eth_sendTransaction

### ⚠️ Gaps (What Kimi Rightly Pointed Out)

---

## Gap 1: State Management

**Current:** In-memory only (resets on restart)

**Needed:**
- [ ] Merkle tree persistence (LevelDB/Redis)
- [ ] State root history
- [ ] Transaction inclusion proofs

**Plan:**
```
LevelDB Schema:
- state_root -> {block_height, timestamp, batch_id}
- batch_id -> {tx_hashes[], merkle_root, proof}
- tx_hash -> {position, inclusion_proof}
```

---

## Gap 2: On-Chain Settlement

**Reality Check:**
- Ethereum: ~15 TPS
- Polygon: ~65 TPS  
- Arbitrum: ~70 TPS

**Our Solution: Recursive Proof Aggregation**

```
Layer 1: 1000 txs → 1 proof (local)
Layer 2: 100 proofs → 1 aggregated proof
Layer 3: 100 aggregated → 1 final proof

Final: 1,000,000 txs → 1 on-chain transaction! ✅
```

**Implementation:**
- [ ] Implement proof aggregation circuit
- [ ] Recursive Groth16 (proof of proofs)
- [ ] Final aggregation contract

---

## Gap 3: Data Availability

**Current:** Transactions processed, not stored off-chain

**Options:**

### Option A: Validium (Recommended for V1)
- [ ] Store tx data in LevelDB locally
- [ ] Serve data on-demand for dispute window
- [ ] No external DA required

### Option B: EigenDA / Celestia
- [ ] Integrate EigenDA SDK
- [ ] Upload encrypted tx blobs
- [ ] Retrieve for verification

### Option C: IPFS
- [ ] Pin encrypted batches to IPFS
- [ ] Use Filecoin for persistence

**V1 Decision:** Use Validium (local storage) - simplest path to working product

---

## Gap 4: Real Benchmarking

**Current:** ad-hoc benchmarks

**Needed:** Proper metrics
- [ ] TPS counter (tx/second)
- [ ] Proof generation time
- [ ] Memory usage
- [ ] Batch fill rate
- [ ] Settlement latency

**Implementation:**
```javascript
const metrics = {
  txsProcessed: 0,
  proofsGenerated: 0,
  proofsVerified: 0,
  avgBatchTime: 0,
  avgProofTime: 0
};
```

---

## Architecture Diagram (Target)

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENTS (ETH/L2)                         │
│  eth_sendTransaction → BrixaScaler RPC                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  BRIXASCALER (Off-Chain)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Shard 1   │  │   Shard N   │  │   ...       │         │
│  │  Queue      │  │  Queue      │  │              │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         └─────────────────┼────────────────┘                │
│                           ▼                                  │
│                 ┌─────────────────┐                          │
│                 │  Batch Builder  │                          │
│                 │  (Merkle Root)  │                          │
│                 └────────┬────────┘                          │
│                          ▼                                   │
│                 ┌─────────────────┐                          │
│                 │  ZK Prover      │                          │
│                 │  (snarkjs)      │                          │
│                 └────────┬────────┘                          │
└──────────────────────────┼───────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ LevelDB │       │ EigenDA │       │ IPFS    │
    │ (Local) │       │ (Chain) │       │ (Pin)   │
    └─────────┘       └─────────┘       └─────────┘
         │                                   │
         └─────────────────┬─────────────────┘
                           ▼
         ┌─────────────────────────────────┐
         │    ON-CHAIN SETTLEMENT          │
         │  (Aggregator → L2)              │
         │  1 tx = 1,000,000 batched txs   │
         └─────────────────────────────────┘
```

---

## V1 Milestones

- [x] Batching engine (750K TPS verified)
- [x] ZK circuit + trusted setup
- [x] Proof verification
- [ ] State persistence (LevelDB)
- [ ] Validium mode (local DA)
- [ ] Metrics dashboard
- [ ] Recursive aggregation (V2)
- [ ] EigenDA integration (V2)

---

## Performance Reality

| Layer | TPS | Notes |
|-------|-----|-------|
| Off-chain batching | 750,000 | Verified on M4 |
| ZK proof gen | ~1-5 | Per batch (CPU) |
| Proof aggregation | 1-10 | Recursive |
| **Final settlement** | **65** | Polygon L2 |

**Effective throughput:** Up to 1M+ tx per on-chain transaction via aggregation.

---

## Conclusion

Kimi's feedback is valid and appreciated. The current code is a **proving ground** - it demonstrates:
- Batching works at scale
- ZK proofs work
- Verification works

The production system needs:
1. Persistence (V1)
2. Recursive aggregation (V2) 
3. DA integration (V2)

**We are building the right thing, just need to complete the stack.** 🧸💖