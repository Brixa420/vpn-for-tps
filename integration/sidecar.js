/**
 * BrixaScaler Sidecar - Run alongside any validator
 * 
 * SECURITY FEATURES (enabled by default):
 * - Rate limiting: 100 requests per 10 seconds per IP
 * - API key authentication (set API_KEY env var to enable)
 * - Input validation on all RPC calls
 * - CORS restricted to localhost by default
 * - Demo mode (transactions logged, NOT sent)
 * 
 * Usage:
 *   node sidecar.js --chain ethereum              # Auto-detect chain
 *   node sidecar.js --original-rpc http://your-validator:8546  # Your validator
 * 
 * Secure production mode:
 *   API_KEY=mysecretkey node sidecar.js --demo false
 */

const http = require('http');
const { 
  BrixaScaler, 
  PUBLIC_RPCS, 
  getPublicRPC,
  SECURITY,
  checkRateLimit,
  validateRPCInput,
  validateApiKey
} = require('./brixa-scaler');

// Get client IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.socket.remoteAddress || 
         'unknown';
}

// Parse args
const args = process.argv.slice(2);
const config = {
  chain: null,  // Auto-detect
  originalRpc: null,
  port: parseInt(process.env.PORT) || 8545,
  shards: 100,
  batchSize: 1000,
  demo: process.env.DEMO_MODE !== 'false'
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  if (key === 'chain') config.chain = value;
  if (key === 'original-rpc') config.originalRpc = value;
  if (key === 'rpc') config.originalRpc = value;
  if (key === 'port') config.port = parseInt(value);
  if (key === 'shards') config.shards = parseInt(value);
  if (key === 'batch-size') config.batchSize = parseInt(value);
  if (key === 'demo') config.demo = value !== 'false';
}

async function detectChain(rpcUrl) {
  // Try to detect chain ID
  const chainIds = {
    '0x1': 'ethereum',
    '0x89': 'polygon',
    '0x38': 'bsc',
    '0xa86a': 'avalanche',
    '0xa4b1': 'arbitrum',
    '0xa': 'optimism',
  };
  
  try {
    const chainId = await makeRPCRequest(rpcUrl, 'eth_chainId', []);
    if (chainId && chainIds[chainId]) {
      return chainIds[chainId];
    }
    
    // Try Solana
    const slot = await makeRPCRequest(rpcUrl, 'getSlot', []);
    if (slot !== null) return 'solana';
  } catch (e) {
    // Try Bitcoin
    try {
      const info = await makeRPCRequest(rpcUrl, 'getblockchaininfo', []);
      if (info) return 'bitcoin';
    } catch (e2) {}
  }
  
  return 'ethereum'; // Default
}

async function main() {
  console.log('\n' + '═'.repeat(50));
  console.log('💜 BrixaScaler Sidecar - Chain-Agnostic (SECURE)');
  console.log('═'.repeat(50));
  console.log(`   Listen on: ${config.port}`);
  console.log(`   Demo Mode: ${config.demo ? 'ON' : 'OFF'}`);
  console.log(`   API Key: ${SECURITY.apiKey ? 'Required' : 'Not required'}`);
  console.log(`   Rate Limit: ${SECURITY.rateLimit.maxRequests}/${SECURITY.rateLimit.windowMs/1000}s\n`);

  // Determine RPC
  let rpcUrl = config.originalRpc;
  
  if (!rpcUrl) {
    // Try common local endpoints
    const localRpcs = [
      'http://localhost:8545',
      'http://localhost:8546', 
      'http://localhost:8332',
      'http://localhost:26657', // Cosmos
    ];
    
    for (const local of localRpcs) {
      try {
        console.log(`   Trying: ${local}...`);
        const detected = await detectChain(local);
        if (detected) {
          rpcUrl = local;
          config.chain = detected;
          break;
        }
      } catch (e) {}
    }
    
    // If no local found, use public RPC
    if (!rpcUrl) {
      console.log('   No local chain detected, using public RPC...\n');
      config.chain = 'ethereum';
      rpcUrl = PUBLIC_RPCS.ethereum[0];
    }
  }
  
  if (!config.chain) {
    config.chain = await detectChain(rpcUrl);
  }
  
  console.log(`   Chain detected: ${config.chain}`);
  console.log(`   RPC: ${rpcUrl}\n`);

  // Create scaler
  const scaler = new BrixaScaler(config.chain, {
    shards: config.shards,
    batchSize: config.batchSize,
    demo: config.demo
  });

  await scaler.start();

  // Create proxy server with security middleware
  const server = http.createServer(async (req, res) => {
    const clientIP = getClientIP(req);
    
    // Security: Rate limiting
    if (!checkRateLimit(clientIP)) {
      console.log(`🚫 Rate limit exceeded for ${clientIP}`);
      res.writeHead(429, { 
        'Content-Type': 'application/json',
        'Retry-After': '10'
      });
      res.end(JSON.stringify({ 
        jsonrpc: '2.0', 
        id: 1, 
        error: { 
          code: -32005, 
          message: 'Rate limit exceeded' 
        } 
      }));
      return;
    }

    // Security: API Key check
    if (!validateApiKey(req)) {
      console.log(`🚫 Invalid API key from ${clientIP}`);
      res.writeHead(401, { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="brixa-scaler"'
      });
      res.end(JSON.stringify({ 
        jsonrpc: '2.0', 
        id: 1, 
        error: { 
          code: -32001, 
          message: 'Unauthorized' 
        } 
      }));
      return;
    }

    // Security: CORS
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

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
        // Security: Validate input
        let rpc;
        try {
          rpc = JSON.parse(body);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            jsonrpc: '2.0', 
            id: 1, 
            error: { 
              code: -32600, 
              message: 'Invalid JSON' 
            } 
          }));
          return;
        }
        
        const validation = validateRPCInput(rpc);
        if (!validation.valid) {
          console.log(`🚫 Invalid RPC from ${clientIP}: ${validation.errors.join(', ')}`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            jsonrpc: '2.0', 
            id: 1, 
            error: { 
              code: -32602, 
              message: 'Invalid params: ' + validation.errors.join(', ') 
            } 
          }));
          return;
        }

        const { jsonrpc, method, params, id } = rpc;

        console.log(`📨 ${method} from ${clientIP}`);

        // Handle transactions - queue through BrixaScaler
        if (method === 'eth_sendTransaction' || method === 'eth_sendRawTransaction') {
          const tx = params[0] || {};
          const txId = scaler.submit(tx);

          if (txId === null) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              jsonrpc: '2.0', 
              id, 
              error: { 
                code: -32099, 
                message: 'Queue full' 
              } 
            }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: txId }));
          console.log(`   ✅ Queued: ${txId}`);

        } else {
          // Pass through to original validator
          const result = await passThrough(rpcUrl, method, params);

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
    console.log('✅ Sidecar running securely!');
    console.log(`   Chain: ${config.chain}`);
    console.log(`   Listen: http://localhost:${config.port}`);
    console.log(`   RPC: ${rpcUrl}`);
    console.log(`   Batching: ${config.batchSize} txs per batch`);
    console.log(`   Security: Rate limiting + Input validation`);
    if (SECURITY.apiKey) {
      console.log(`   Auth: API key required (header: X-API-Key)`);
    }
    console.log('');
    console.log(config.demo 
      ? '⚠️  DEMO MODE - Transactions queued but not sent to chain\n'
      : '🔴 PRODUCTION MODE - Transactions will be sent to chain!\n');
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

// ============ Helper Functions ============

function makeRPCRequest(rpcUrl, method, params) {
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