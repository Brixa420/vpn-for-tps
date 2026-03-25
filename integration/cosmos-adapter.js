/**
 * Cosmos/SDK Chain Adapter for BrixaScaler
 * 
 * Provides compatibility with Cosmos SDK-based chains:
 * - Cosmos Hub, Osmosis, Juno, Terra, etc.
 * - IBC (Inter-Blockchain Communication)
 * 
 * Run: node cosmos-adapter.js
 */

const crypto = require('crypto');
const { bech32 } = require('bech32'); // npm install bech32

// ============================================
// COSMOS CONSTANTS
// ============================================

const COSMOSConstants = {
  CHAIN_ID: 'cosmoshub-4',
  
  // Denoms
  ATOM: 'uatom',
  MICRO_ATOM: 'uatom',
  
  // Transaction
  MAX_TX_SIZE: 1048576, // 1MB
  GAS_PER_BYTE: 5,
  
  // Block
  BLOCK_TIMEOUT: 10000, // ms
  BLOCK_TIME: 6000, // ~6 seconds
  
  // IBC
  IBC_TRANSFER_PORT: 'transfer',
  IBC_TRANSFER_CHANNEL: 'channel-0',
};

// ============================================
// ADDRESS UTILITIES
// ============================================

class CosmosAddress {
  /**
   * Validate Cosmos address (bech32)
   */
  static isValid(address, prefix = 'cosmos') {
    try {
      const { prefix: decodedPrefix } = bech32.decode(address);
      return decodedPrefix === prefix;
    } catch {
      return false;
    }
  }

  /**
   * Convert address to bytes
   */
  static toBytes(address) {
    const { words } = bech32.decode(address);
    return Buffer.from(bech32.fromWords(words));
  }

  /**
   * Convert bytes to address
   */
  static fromBytes(bytes, prefix = 'cosmos') {
    const words = bech32.toWords(bytes);
    return bech32.encode(prefix, words);
  }

  /**
   * Derive address from public key (mock)
   */
  static fromPubKey(pubKey, prefix = 'cosmos') {
    const hash = crypto.createHash('sha256').update(pubKey).digest();
    const address = hash.slice(0, 20);
    return CosmosAddress.fromBytes(address, prefix);
  }
}

// ============================================
// COSMOS TRANSACTION BUILDER
// ============================================

class CosmosTransaction {
  constructor(chainId = COSMOSConstants.CHAIN_ID) {
    this.chainId = chainId;
    this.accountNumber = 0;
    this.sequence = 0;
    this.fee = { amount: [], gas: '200000' };
    this.msgs = [];
    this.memo = '';
    this.signatures = [];
  }

  /**
   * Set account info
   */
  setAccountInfo(accountNumber, sequence) {
    this.accountNumber = accountNumber;
    this.sequence = sequence;
    return this;
  }

  /**
   * Set fee
   */
  setFee(amount, denom, gas) {
    this.fee = {
      amount: [{ amount: String(amount), denom }],
      gas: String(gas)
    };
    return this;
  }

  /**
   * Add message - Bank (transfer)
   */
  addMsgSend(from, to, amount, denom) {
    this.msgs.push({
      type: 'cosmos-sdk/MsgSend',
      value: {
        from_address: from,
        to_address: to,
        amount: [{ amount: String(amount), denom }]
      }
    });
    return this;
  }

  /**
   * Add message - Delegate
   */
  addMsgDelegate(delegator, validator, amount, denom) {
    this.msgs.push({
      type: 'cosmos-sdk/MsgDelegate',
      value: {
        delegator_address: delegator,
        validator_address: validator,
        amount: { amount: String(amount), denom }
      }
    });
    return this;
  }

  /**
   * Add message - Undelegate
   */
  addMsgUndelegate(delegator, validator, amount, denom) {
    this.msgs.push({
      type: 'cosmos-sdk/MsgUndelegate',
      value: {
        delegator_address: delegator,
        validator_address: validator,
        amount: { amount: String(amount), denom }
      }
    });
    return this;
  }

  /**
   * Add message - IBC Transfer
   */
  addMsgIBCTransfer(sourcePort, sourceChannel, token, sender, receiver) {
    this.msgs.push({
      type: 'cosmos-sdk/MsgTransfer',
      value: {
        source_port: sourcePort,
        source_channel: sourceChannel,
        token: token,
        sender: sender,
        receiver: receiver,
        timeout_height: {
          revision_number: 1,
          revision_height: 1000000
        }
      }
    });
    return this;
  }

  /**
   * Set memo
   */
  setMemo(memo) {
    this.memo = memo;
    return this;
  }

  /**
   * Get sign bytes
   */
  getSignBytes() {
    return {
      chain_id: this.chainId,
      account_number: String(this.accountNumber),
      sequence: String(this.sequence),
      fee: this.fee,
      msgs: this.msgs,
      memo: this.memo
    };
  }

  /**
   * Add signature
   */
  addSignature(signature) {
    this.signatures.push(signature);
    return this;
  }

  /**
   * Encode to JSON (ready for broadcast)
   */
  encode() {
    return JSON.stringify({
      tx: {
        msg: this.msgs,
        fee: this.fee,
        signatures: this.signatures,
        memo: this.memo
      },
      mode: 'block'
    });
  }
}

// ============================================
// COSMOS BATCH PROCESSOR
// ============================================

class CosmosBatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 500;
    this.batchInterval = options.batchInterval || 5000;
    this.maxGasPerTx = options.maxGas || 300000;
    
    this.txQueue = [];
    this.batches = [];
    this.processedCount = 0;
    
    this.startBatchProcessor();
  }

  /**
   * Add transaction to queue
   */
  async addTransaction(tx) {
    this.txQueue.push(tx);
    
    if (this.txQueue.length >= this.batchSize) {
      return await this.processBatch();
    }
    return null;
  }

  /**
   * Process batch
   */
  async processBatch() {
    if (this.txQueue.length === 0) return null;

    const batch = this.txQueue.splice(0, this.batchSize);
    
    // Group by message type
    const byType = {};
    for (const tx of batch) {
      for (const msg of tx.msgs) {
        const type = msg.type;
        if (!byType[type]) byType[type] = [];
        byType[type].push(msg);
      }
    }

    // Calculate total gas
    const totalGas = this.estimateGas(batch);
    
    const batchResult = {
      id: `cosmos-batch-${Date.now()}`,
      txs: batch.length,
      msgTypes: Object.keys(byType),
      totalGas,
      timestamp: Date.now(),
      transactions: batch.map(tx => ({
        msgs: tx.msgs.length,
        fee: tx.fee
      }))
    };
    
    this.batches.push(batchResult);
    this.processedCount += batch.length;
    
    return batchResult;
  }

  /**
   * Estimate gas for batch
   */
  estimateGas(txs) {
    const gasPerTx = this.maxGasPerTx;
    return txs.length * gasPerTx;
  }

  /**
   * Start automatic batch processing
   */
  startBatchProcessor() {
    setInterval(async () => {
      if (this.txQueue.length > 0) {
        await this.processBatch();
      }
    }, this.batchInterval);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      queued: this.txQueue.length,
      processed: this.processedCount,
      batches: this.batches.length,
      avgBatchSize: this.batches.length > 0 
        ? this.batches.reduce((a, b) => a + b.txs, 0) / this.batches.length 
        : 0
    };
  }
}

// ============================================
// COSMOS RPC CLIENT
// ============================================

class CosmosRPC {
  constructor(rpcUrl, chainId = COSMOSConstants.CHAIN_ID) {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
  }

  /**
   * Broadcast transaction
   */
  async broadcastTx(tx) {
    const encoded = tx.encode();
    
    return await this.request('/txs', {
      method: 'POST',
      body: encoded
    });
  }

  /**
   * Get account info
   */
  async getAccount(address) {
    return await this.request(`/auth/accounts/${address}`);
  }

  /**
   * Get balance
   */
  async getBalance(address, denom = COSMOSConstants.ATOM) {
    return await this.request(`/bank/balances/${address}`);
  }

  /**
   * Get latest block
   */
  async getLatestBlock() {
    return await this.request('/blocks/latest');
  }

  /**
   * Get block by height
   */
  async getBlock(height) {
    return await this.request(`/blocks/${height}`);
  }

  /**
   * Get validators
   */
  async getValidators() {
    return await this.request('/validatorsets/latest');
  }

  /**
   * Get node info
   */
  async getNodeInfo() {
    return await this.request('/node_info');
  }

  /**
   * Generic request
   */
  async request(path, options = {}) {
    try {
      const url = `${this.rpcUrl}${path}`;
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      
      if (options.method === 'POST') {
        // POST returns raw bytes, need to handle differently
        return await response.text();
      }
      
      return await response.json();
    } catch (error) {
      console.error('Cosmos RPC error:', error.message);
      return null;
    }
  }
}

// ============================================
// IBC RELAYER (Simplified)
// ============================================

class IBCRelayer {
  constructor(sourceChain, destChain) {
    this.sourceChain = sourceChain;
    this.destChain = destChain;
    this.packets = [];
    this.acks = [];
  }

  /**
   * Relay packet from source to destination
   */
  async relayPacket(packet) {
    // In production: actually send packet to destination chain
    this.packets.push({
      ...packet,
      relayedAt: Date.now()
    });
    
    return { success: true, packetId: packet.id };
  }

  /**
   * Process acknowledgment
   */
  async processAck(ack) {
    this.acks.push({
      ...ack,
      processedAt: Date.now()
    });
    
    return { success: true };
  }

  /**
   * Get pending packets
   */
  getPendingPackets() {
    return this.packets.filter(p => !p.acknowledged);
  }
}

// ============================================
// MAIN - Test Cosmos Adapter
// ============================================

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('    Cosmos/SDK Adapter - BrixaScaler');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test address validation
  console.log('📝 Testing Address Utilities...');
  try {
    const testAddr = 'cosmos1abc123';
    const isValid = CosmosAddress.isValid(testAddr, 'cosmos');
    console.log(`   Address ${testAddr} valid: ${isValid}`);
  } catch (e) {
    console.log('   (bech32 not installed, using mock validation)');
  }

  // Test transaction builder
  console.log('\n📝 Building Test Transaction...');
  const tx = new CosmosTransaction('cosmoshub-4');
  tx.setAccountInfo(12345, 1)
    .setFee(5000, 'uatom', 200000)
    .addMsgSend(
      'cosmos1sender123456789012345678901234567',
      'cosmos1receiver1234567890123456789012345',
      1000000,
      'uatom'
    )
    .setMemo('BrixaScaler batch');

  console.log('   Transaction built:', tx.msgs.length, 'messages');
  console.log('   Sign bytes:', JSON.stringify(tx.getSignBytes()).slice(0, 100) + '...');

  // Test batch processor
  console.log('\n📦 Testing Batch Processor...');
  const processor = new CosmosBatchProcessor({ batchSize: 100 });

  // Add test transactions
  for (let i = 0; i < 250; i++) {
    const testTx = new CosmosTransaction();
    testTx.addMsgSend(
      `cosmos1sender${i}`,
      `cosmos1receiver${i}`,
      1000,
      'uatom'
    );
    await processor.addTransaction(testTx);
  }

  const stats = processor.getStats();
  console.log('   Queued:', stats.queued);
  console.log('   Processed:', stats.processed);
  console.log('   Batches:', stats.batches);

  // Test RPC (if provided)
  if (process.env.COSMOS_RPC) {
    console.log('\n🔗 Testing RPC Connection...');
    const rpc = new CosmosRPC(process.env.COSMOS_RPC);
    const info = await rpc.getNodeInfo();
    console.log('   Node info:', info?.node_info?.chain_id || 'connected');
  } else {
    console.log('\n💡 Set COSMOS_RPC to test RPC connection');
    console.log('   Example: COSMOS_RPC=https://cosmos-rpc.polkachu.com node cosmos-adapter.js');
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);

// Export
module.exports = {
  COSMOSConstants,
  CosmosAddress,
  CosmosTransaction,
  CosmosBatchProcessor,
  CosmosRPC,
  IBCRelayer
};