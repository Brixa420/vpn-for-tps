/**
 * BrixaScaler Sidecar - Run alongside existing validator
 * 
 * Usage:
 *   node sidecar.js --chain ethereum --port 8545
 * 
 * That's it! Uses public RPC as default. To enhance your own validator:
 *   node sidecar.js --chain ethereum --original-rpc http://your-validator:8546 --port 8545
 */

const http = require('http');
const { BrixaScaler, PUBLIC_RPCS } = require('./brixa-scaler');

// Parse args
const args = process.argv.slice(2);
const config = {
  chain: 'ethereum',
  originalRpc: null,  // Will default to public RPC
  port: 8545,
  shards: 100,
  batchSize: 1000
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  if (key === 'chain') config.chain = value;
  if (key === 'original-rpc') config.originalRpc = value;
  if (key === 'port') config.port = parseInt(value);
  if (key === 'shards') config.shards = parseInt(value);
  if (key === 'batch-size') config.batchSize = parseInt(value);
}

async function main() {
  console.log('\n' + '═'.repeat(50));
  console.log('💜 BrixaScaler Sidecar - Validator Enhancement');
  console.log('═'.repeat(50));
  console.log(`   Chain: ${config.chain}`);
  console.log(`   Listen on: ${config.port}`);
  console.log('');

  // Default to public RPC if no original provided
  if (!config.originalRpc) {
    const publicRpcs = PUBLIC_RPCS[config.chain.toLowerCase()];
    if (publicRpcs && publicRpcs[0]) {
      config.originalRpc = publicRpcs[0];
      console.log(`   Using public RPC: ${config.originalRpc}\n`);
    } else {
      console.log('⚠️  No public RPC found for this chain');
      console.log('   Use --original-rpc to specify your validator\n');
    }
  } else {
    console.log(`   Original RPC: ${config.originalRpc}`);
  }

  // Create scaler
  const scaler = new BrixaScaler(config.chain, {
    shards: config.shards,
    batchSize: config.batchSize
  });

  await scaler.start();

  // Create proxy server
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const rpc = JSON.parse(body);
        const { jsonrpc, method, params, id } = rpc;

        console.log(`📨 ${method}`);

        // Handle transactions - queue through BrixaScaler
        if (method === 'eth_sendTransaction' || method === 'eth_sendRawTransaction') {
          const tx = params[0] || {};
          const txId = scaler.submit(tx);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: txId }));
          console.log(`   ✅ Queued: ${txId}`);

        } else {
          // Pass through to original validator
          const result = await passThrough(config.originalRpc, method, params);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: error.message } }));
      }
    });
  });

  server.listen(config.port, () => {
    console.log('✅ Sidecar running!');
    console.log(`   Validator enhanced at: http://localhost:${config.port}\n`);
    console.log(`   Original RPC: ${config.originalRpc}`);
    console.log(`   Batching: ${config.batchSize} txs per batch\n`);
  });

  // Stats
  setInterval(() => {
    const stats = scaler.getStats();
    if (stats.queued > 0) {
      console.log(`📊 Queued: ${stats.queued} | Chain: ${stats.chain}`);
    }
  }, 5000);
}

function passThrough(rpcUrl, method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1
    });

    const url = new URL(rpcUrl);
    const lib = url.protocol === 'https:' ? require('https') : require('http');

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          resolve(p.result);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

main().catch(console.error);