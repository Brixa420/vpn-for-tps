/**
 * ═══════════════════════════════════════════════════════════════════
 * 
 *    💜 BRIXASEQUENCER - Transaction Ordering 💜
 * 
 *    Handles:
 *    • Transaction ordering and sequencing
 *    • Batch building from mempool
 *    • State transition logic
 *    • Communication with rollup contract
 * 
 *    Usage: node sequencer.js --rpc <rpc-url> --contract <contract-address>
 * 
 *    ⚠️  WARNING: DEMO/PROOF OF CONCEPT ⚠️
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const CONFIG = {
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  contractAddress: process.env.CONTRACT_ADDRESS || null,
  privateKey: process.env.SEQUENCER_PRIVATE_KEY || null,
  batchSize: parseInt(process.env.BATCH_SIZE) || 1000,
  batchInterval: parseInt(process.env.BATCH_INTERVAL) || 5000,
  maxFeePerGas: parseInt(process.env.MAX_FEE_PER_GAS) || 100000000000, // 100 gwei
  demoMode: process.env.DEMO_MODE !== 'false'
};

// ═══════════════════════════════════════════════════════════════════
// MERKLE TREE FOR STATE
// ═══════════════════════════════════════════════════════════════════

class MerkleTree {
  constructor(depth = 20) {
    this.depth = depth;
    this.leaves = [];
    this.tree = [];
  }

  insert(leaf) {
    this.leaves.push(leaf);
    this.buildTree();
  }

  buildTree() {
    this.tree = [];
    let level = this.leaves.map(l => this.hash(l));
    
    this.tree.push(level);
    
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        next.push(this.hash(left + right));
      }
      this.tree.push(next);
      level = next;
    }
  }

  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getRoot() {
    if (this.tree.length === 0) return this.hash('empty');
    return this.tree[this.tree.length - 1][0];
  }

  getProof(index) {
    const proof = [];
    for (let i = 0; i < this.tree.length - 1; i++) {
      const level = this.tree[i];
      const isRight = index % 2 === 1;
      const sibling = isRight ? level[index - 1] : level[index + 1] || level[index];
      proof.push({ side: isRight ? 'left' : 'right', value: sibling });
      index = Math.floor(index / 2);
    }
    return proof;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SEQUENCER
// ═══════════════════════════════════════════════════════════════════

class Sequencer {
  constructor(options = {}) {
    this.rpcUrl = options.rpcUrl;
    this.contractAddress = options.contractAddress;
    this.privateKey = options.privateKey;
    this.batchSize = options.batchSize || 1000;
    this.batchInterval = options.batchInterval || 5000;
    this.demoMode = options.demoMode !== false;

    this.mempool = [];
    this.stateTree = new MerkleTree();
    this.batchCount = 0;
    this.currentStateRoot = null;
    this.isRunning = false;

    this.signer = null;
    this.contract = null;
    this.provider = null;
  }

  /**
   * Initialize connection to L1
   */
  async init() {
    if (!this.rpcUrl) {
      throw new Error('RPC URL required');
    }

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    if (this.privateKey && this.contractAddress) {
      this.signer = new ethers.Wallet(this.privateKey, this.provider);
      console.log('🔗 Connected to L1 as sequencer');
    } else {
      console.log('🔗 Connected to L1 (read-only mode)');
    }
  }

  /**
   * Register as sequencer on L1 contract
   */
  async registerSequencer() {
    if (!this.signer || !this.contractAddress) {
      console.log('⚠️ No private key - cannot register as sequencer');
      return;
    }

    const contract = new ethers.Contract(
      this.contractAddress,
      ['function registerSequencer() external payable'],
      this.signer
    );

    const bond = ethers.parseEther('1'); // 1 ETH bond
    try {
      const tx = await contract.registerSequencer({ value: bond });
      console.log('📝 Registering as sequencer...', tx.hash);
      await tx.wait();
      console.log('✅ Sequencer registered!');
    } catch (e) {
      console.log('ℹ️ Sequencer registration:', e.message);
    }
  }

  /**
   * Receive transaction into mempool
   */
  addTransaction(tx) {
    const txWithMeta = {
      ...tx,
      hash: this.hashTransaction(tx),
      timestamp: Date.now(),
      nonce: this.mempool.length
    };
    
    this.mempool.push(txWithMeta);
    return txWithMeta.hash;
  }

  /**
   * Hash transaction for ordering
   */
  hashTransaction(tx) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(tx))
      .digest('hex');
  }

  /**
   * Order transactions (FIFO + priority)
   */
  orderTransactions() {
    // Sort by timestamp (FIFO) then by fee (priority)
    return [...this.mempool].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return (b.fee || 0) - (a.fee || 0);
    });
  }

  /**
   * Build batch from mempool
   */
  buildBatch() {
    const ordered = this.orderTransactions();
    const batch = ordered.slice(0, this.batchSize);
    
    // Clear used transactions from mempool
    const batchHashes = new Set(batch.map(tx => tx.hash));
    this.mempool = this.mempool.filter(tx => !batchHashes.has(tx.hash));
    
    return batch;
  }

  /**
   * Create compressed transaction data for L1
   */
  compressTransactions(txs) {
    // Simple compression: just concat with delimiter
    // In production: use more efficient encoding
    return txs.map(tx => 
      `${tx.from}:${tx.to}:${tx.value}:${tx.nonce}:${tx.data || '0x'}`
    ).join('|');
  }

  /**
   * Compute new state root from batch
   */
  computeNewStateRoot(txs) {
    // Add all transactions to state tree
    for (const tx of txs) {
      this.stateTree.insert(tx.hash);
    }
    
    return this.stateTree.getRoot();
  }

  /**
   * Generate ZK proof for batch (placeholder - integrate with zk-prover)
   */
  async generateProof(previousRoot, newRoot, dataHash, batchId) {
    // In production: call zk-prover.js
    // For now: return dummy proof structure
    return {
      a: [0, 0],
      b: [[0, 0], [0, 0]],
      c: [0, 0],
      input: [
        previousRoot,
        newRoot,
        dataHash,
        batchId
      ]
    };
  }

  /**
   * Submit batch to L1
   */
  async submitBatch() {
    if (this.mempool.length === 0) return null;
    
    const batch = this.buildBatch();
    if (batch.length === 0) return null;

    const previousRoot = this.currentStateRoot || this.stateTree.getRoot();
    const newRoot = this.computeNewStateRoot(batch);
    const dataHash = crypto.createHash('sha256')
      .update(this.compressTransactions(batch))
      .digest('hex');
    
    const batchId = this.batchCount;
    
    // Generate proof
    const proof = await this.generateProof(previousRoot, newRoot, dataHash, batchId);
    const transactions = this.compressTransactions(batch);
    
    if (this.demoMode) {
      console.log(`📦 [Sequencer] Batch ${batchId}: ${batch.length} txs`);
      console.log(`   Previous Root: ${previousRoot?.slice(0, 16)}...`);
      console.log(`   New Root: ${newRoot.slice(0, 16)}...`);
      console.log(`   Data Hash: ${dataHash.slice(0, 16)}...`);
      console.log(`   🧾 ZK Proof: groth16 (${proof.input.length} inputs)`);
      
      this.batchCount++;
      this.currentStateRoot = newRoot;
      
      return { batchId, txCount: batch.length, newRoot, dataHash };
    }
    
    // Submit to L1 (production)
    try {
      const contract = new ethers.Contract(
        this.contractAddress,
        ['function submitBatch(uint256[2],uint256[2][2],uint256[2],uint256[4],bytes)'],
        this.signer
      );
      
      const tx = await contract.submitBatch(
        proof.a,
        proof.b,
        proof.c,
        proof.input,
        transactions,
        { maxFeePerGas: CONFIG.maxFeePerGas }
      );
      
      console.log(`📤 Submitted batch ${batchId} (${batch.length} txs)`);
      console.log(`   TX: ${tx.hash}`);
      
      await tx.wait();
      
      this.batchCount++;
      this.currentStateRoot = newRoot;
      
      return { batchId, txCount: batch.length, txHash: tx.hash };
    } catch (e) {
      console.error('❌ Failed to submit batch:', e.message);
      // Re-add to mempool
      this.mempool.push(...batch);
      return null;
    }
  }

  /**
   * Start sequencer loop
   */
  start() {
    this.isRunning = true;
    
    console.log('🚀 Sequencer starting...');
    console.log(`   Batch size: ${this.batchSize}`);
    console.log(`   Batch interval: ${this.batchInterval}ms`);
    console.log(`   Mode: ${this.demoMode ? 'DEMO' : 'LIVE'}`);
    
    // Main sequencer loop
    setInterval(async () => {
      if (!this.isRunning) return;
      await this.submitBatch();
    }, this.batchInterval);
    
    // Stats reporting
    setInterval(() => {
      console.log(`📊 Mempool: ${this.mempool.length} | Batches: ${this.batchCount}`);
    }, 30000);
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Sequencer stopped');
  }

  getStats() {
    return {
      mempoolSize: this.mempool.length,
      batchesSubmitted: this.batchCount,
      currentStateRoot: this.currentStateRoot,
      mode: this.demoMode ? 'demo' : 'live'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('    💜 BRIXASEQUENCER - Transaction Sequencer 💜');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Create sequencer
  const sequencer = new Sequencer({
    rpcUrl: CONFIG.rpcUrl,
    contractAddress: CONFIG.contractAddress,
    privateKey: CONFIG.privateKey,
    batchSize: CONFIG.batchSize,
    batchInterval: CONFIG.batchInterval,
    demoMode: CONFIG.demoMode
  });

  await sequencer.init();
  
  // Register as sequencer if keys provided
  if (CONFIG.contractAddress) {
    await sequencer.registerSequencer();
  }

  // Add some test transactions
  for (let i = 0; i < 100; i++) {
    sequencer.addTransaction({
      from: `0x${'a'.repeat(38)}${String(i).padStart(2, '0')}`,
      to: `0x${'b'.repeat(38)}${String(i).padStart(2, '0')}`,
      value: `0x${(i * 1000).toString(16)}`,
      nonce: i,
      data: '0x'
    });
  }
  
  console.log(`📥 Added 100 test transactions to mempool`);

  // Start sequencer
  sequencer.start();

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    sequencer.stop();
    process.exit(0);
  });
}

main().catch(console.error);

module.exports = { Sequencer, MerkleTree };