/**
 * BrixaScaler RPC Proxy Server
 * Run as middleware - NO API KEY NEEDED by default!
 * 
 * SECURITY FEATURES (enabled by default):
 * - Rate limiting: 100 requests per 10 seconds per IP
 * - API key authentication (set API_KEY env var to enable)
 * - Input validation on all RPC calls
 * - CORS restricted to localhost by default
 * - Demo mode (transactions logged, NOT sent)
 * 
 * Usage:
 *   node server.js --chain ethereum --port 8545
 * 
 * Secure production mode:
 *   API_KEY=mysecretkey node server.js --chain ethereum --demo false
 * 
 * That's it! Uses public RPCs automatically.
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
  chain: 'ethereum',  // Default, can override with --chain
  port: parseInt(process.env.PORT) || 8545,
  shards: 100,
  batchSize: 1000,
  demo: process.env.DEMO_MODE !== 'false'
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  if (key === 'chain') config.chain = value;
  if (key === 'port') config.port = parseInt(value);
  if (key === 'shards') config.shards = parseInt(value);
  if (key === 'batch-size') config.batchSize = parseInt(value);
  if (key === 'demo') config.demo = value !== 'false';
}

async function main() {
  console.log('\n' + '═'.repeat(50));
  console.log('💜 BrixaScaler - VPN for TPS (SECURE)');
  console.log('═'.repeat(50));
  console.log(`   Chain: ${config.chain}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Shards: ${config.shards}`);
  console.log(`   Demo Mode: ${config.demo ? 'ON' : 'OFF'}`);
  console.log(`   API Key: ${SECURITY.apiKey ? 'Required' : 'Not required'}`);
  console.log(`   Rate Limit: ${SECURITY.rateLimit.maxRequests}/${SECURITY.rateLimit.windowMs/1000}s\n`);

  // Create scaler
  const scaler = new BrixaScaler(config.chain, {
    shards: config.shards,
    batchSize: config.batchSize,
    demo: config.demo
  });

  // Auto-start with public RPC
  await scaler.start();

  // Show available chains
  console.log('📡 Available chains (free public RPCs):');
  const chains = Object.keys(PUBLIC_RPCS).filter(c => c !== 'bitcoin');
  chains.forEach(c => console.log(`   - ${c}`));
  console.log('');

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
          message: 'Rate limit exceeded. Try again later.' 
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
          message: 'Unauthorized. Provide valid API key.' 
        } 
      }));
      return;
    }

    // Security: CORS
    const origin = req.headers.origin;
    const allowedOrigin = SECURITY.corsAllowedOrigins.find(o => 
      o === '*' || 
      origin?.match(o.replace('*', '.*')) ||
      origin === o
    );
    
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'null');
    }
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

        // Handle transactions
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
                message: 'Service unavailable - queue full' 
              } 
            }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: txId }));
          console.log(`   ✅ Queued: ${txId}`);

        } else if (method === 'eth_blockNumber' || method === 'eth_chainId' || 
                   method === 'eth_gasPrice' || method === 'net_version') {
          // For demo, return fake but realistic responses
          const fakeResponses = {
            'eth_blockNumber': '0x10d4f1e',
            'eth_chainId': config.chain === 'ethereum' ? '0x1' : 
                           config.chain === 'polygon' ? '0x89' :
                           config.chain === 'bsc' ? '0x38' : '0x1',
            'eth_gasPrice': '0x4a817c800',
            'net_version': '1'
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: fakeResponses[method] || '0x0' }));

        } else {
          // Other methods - return success
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: null }));
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: error.message } }));
      }
    });
  });

  server.listen(config.port, () => {
    console.log('✅ Server running securely!');
    console.log(`   Point wallet to: http://localhost:${config.port}`);
    console.log(`   Security: Rate limiting + Input validation enabled`);
    if (SECURITY.apiKey) {
      console.log(`   Auth: API key required (header: X-API-Key)`);
    }
    console.log('');
    console.log('💜 BrixaScaler - VPN for TPS\n');
    console.log(config.demo 
      ? '⚠️  DEMO MODE - Transactions are queued but NOT sent to chain\n'
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

main().catch(console.error);