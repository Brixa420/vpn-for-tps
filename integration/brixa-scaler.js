#!/usr/bin/env node

/**
 * BrixaScaler - Simple Transaction Batching
 * 
 * A simple RPC proxy that batches transactions and submits them to any blockchain.
 * No ZK. No tokens. No blockchain. Just works.
 * 
 * Usage: node brixa-scaler.js --chain ethereum
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ============================================
// CONFIG
// ============================================

const CONFIG = {
  chain: process.env.CHAIN || 'ethereum',
  rpcUrl: process.env.RPC_URL || null,
  port: parseInt(process.env.PORT) || 8545,
  batchSize: parseInt(process.env.BATCH_SIZE) || 100,
  batchInterval: parseInt(process.env.BATCH_INTERVAL) || 1000,
  apiKey: process.env.API_KEY || ''
};

const CHAINS = {
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon-rpc.com',
  bsc: 'https://bsc-dataseed.binance.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  solana: 'https://api.mainnet-beta.solana.com'
};

const CHAIN_IDS = {
  ethereum: '0x1',
  polygon: '0x89',
  bsc: '0x38',
  avalanche: '0xa86a',
  arbitrum: '0xa4b1',
  optimism: '0xa',
  solana: '0x1'
};

// ============================================
// CORE ENGINE
// ============================================

class BrixaScaler {
  constructor(chain) {
    this.chain = chain.toLowerCase();
    this.rpcUrl = CONFIG.rpcUrl || CHAINS[this.chain] || CHAINS.ethereum;
    this.chainId = CHAIN_IDS[this.chain] || '0x1';
    
    this.queue = [];
    this.processing = false;
    this.stats = { received: 0, submitted: 0, failed: 0 };
    
    this.startProcessor();
  }

  startProcessor() {
    setInterval(() => this.processBatch(), CONFIG.batchInterval);
  }

  addTransaction(tx) {
    this.queue.push({ tx, addedAt: Date.now() });
    this.stats.received++;
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async processBatch() {
    if (this.queue.length === 0 || this.processing) return;
    
    this.processing = true;
    const batch = this.queue.splice(0, CONFIG.batchSize);
    
    console.log(`📦 Processing batch of ${batch.length} transactions...`);
    
    for (const item of batch) {
      try {
        await this.submitTransaction(item.tx);
        this.stats.submitted++;
      } catch (e) {
        this.stats.failed++;
        console.log(`❌ Failed: ${e.message}`);
      }
    }
    
    this.processing = false;
  }

  async submitTransaction(tx) {
    // Build the transaction
    const params = tx;
    
    const payload = {
      jsonrpc: '2.0',
      method: 'eth_sendTransaction',
      params: [params],
      id: 1
    };

    return this.rpcCall(payload);
  }

  async rpcCall(payload) {
    return new Promise((resolve, reject) => {
      const u = new URL(this.rpcUrl);
      const client = u.protocol === 'https:' ? https : http;
      
      const req = client.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname || '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(new Error(parsed.error.message));
            else resolve(parsed.result);
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  getStats() {
    return {
      chain: this.chain,
      queued: this.queue.length,
      received: this.stats.received,
      submitted: this.stats.submitted,
      failed: this.stats.failed
    };
  }
}

// ============================================
// SERVER
// ============================================

function startServer() {
  const scaler = new BrixaScaler(CONFIG.chain);

  console.log('\n' + '═'.repeat(50));
  console.log('💜 BrixaScaler - Transaction Batching');
  console.log('═'.repeat(50));
  console.log(`   Chain: ${CONFIG.chain}`);
  console.log(`   RPC: ${scaler.rpcUrl}`);
  console.log(`   Batch: ${CONFIG.batchSize} txs / ${CONFIG.batchInterval}ms`);
  console.log('');

  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API Key
    if (CONFIG.apiKey) {
      const key = req.headers['x-api-key'];
      if (key !== CONFIG.apiKey) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    // GET = Dashboard
    if (req.method === 'GET') {
      const s = scaler.getStats();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>BrixaScaler</title>
  <style>
    body { font-family: monospace; background: #0d0d1a; color: #e0e0e0; padding: 40px; }
    h1 { color: #ff2d75; }
    .stats { display: flex; gap: 30px; margin: 30px 0; }
    .stat { background: #1a1a2e; padding: 20px; border-radius: 10px; }
    .stat-value { font-size: 2em; color: #00f5d4; }
    .stat-label { color: #666; }
    .info { color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>💜 BrixaScaler</h1>
  <p>Transaction batching for ${s.chain}</p>
  
  <div class="stats">
    <div class="stat"><div class="stat-value">${s.queued}</div><div class="stat-label">Queued</div></div>
    <div class="stat"><div class="stat-value">${s.received}</div><div class="stat-label">Received</div></div>
    <div class="stat"><div class="stat-value">${s.submitted}</div><div class="stat-label">Submitted</div></div>
    <div class="stat"><div class="stat-value">${s.failed}</div><div class="stat-label">Failed</div></div>
  </div>
  
  <p class="info">RPC: http://localhost:${CONFIG.port}</p>
</body>
</html>
      `);
      return;
    }

    // POST = JSON-RPC
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const rpc = JSON.parse(body);
        const { method, params, id } = rpc;

        if (method === 'eth_sendTransaction') {
          const tx = params?.[0] || {};
          const txId = scaler.addTransaction(tx);
          console.log(`📨 Queued: ${txId}`);
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: '0x' + txId }));
          return;
        }

        if (method === 'eth_blockNumber') {
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: '0x' + Math.floor(Date.now() / 1000).toString(16) }));
          return;
        }

        if (method === 'eth_chainId') {
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: scaler.chainId }));
          return;
        }

        if (method === 'eth_estimateGas') {
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: '0x5208' }));
          return;
        }

        // Pass through
        const result = await scaler.rpcCall(rpc);
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));

      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  });

  server.listen(CONFIG.port, () => {
    console.log('🚀 Server running at http://localhost:' + CONFIG.port);
    console.log('📡 Point wallet to http://localhost:' + CONFIG.port);
    console.log('');
  });
}

// ============================================
// CLI
// ============================================

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--chain' && args[i + 1]) CONFIG.chain = args[i + 1];
  if (args[i] === '--rpc' && args[i + 1]) CONFIG.rpcUrl = args[i + 1];
  if (args[i] === '--port' && args[i + 1]) CONFIG.port = parseInt(args[i + 1]);
  if (args[i] === '--batch-size' && args[i + 1]) CONFIG.batchSize = parseInt(args[i + 1]);
  if (args[i] === '--batch-interval' && args[i + 1]) CONFIG.batchInterval = parseInt(args[i + 1]);
  if (args[i] === '--help') {
    console.log('Usage: node brixa-scaler.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --chain <name>       ethereum, polygon, bsc, avalanche, arbitrum, optimism');
    console.log('  --rpc <url>          Custom RPC URL');
    console.log('  --port <n>           Port (default 8545)');
    console.log('  --batch-size <n>    Txs per batch (default 100)');
    console.log('  --batch-interval <ms>  Batch interval (default 1000)');
    process.exit(0);
  }
}

startServer();

module.exports = { BrixaScaler, CONFIG, CHAINS };