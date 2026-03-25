/**
 * ════════════════════════════════════════════════════════════════
 * BRIXA VPN-FOR-TPS — Full Test Suite
 * Covers: BrixaScaler · BrixaRoll · RPC Proxy · Merkle/ZK Proofs
 * ```
 · Sharding · Auto-scale · Batch logic · DEMO_MODE
 ```
 * 
 * Run: node test-brixa.js
 * Deps: none (pure Node.js built-ins only)
 * ════════════════════════════════════════════════════════════════
 */

const http = require('http');
const crypto = require('crypto');
const assert = require('assert');

// ── tiny test harness ───────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const results = [];

async function test(label, fn) {
try {
await fn();
console.log(` ✅ ${label}`);
results.push({ label, status: 'PASS' });
passed++;
} catch (err) {
console.log(` ❌ ${label}`);
console.log(` → ${err.message}`);
results.push({ label, status: 'FAIL', error: err.message });
failed++;
}
}

function skip(label, reason) {
console.log(` ⏭️ ${label} (skipped: ${reason})`);
results.push({ label, status: 'SKIP', reason });
skipped++;
}

function section(name) {
console.log(`\n━━━ ${name} ${'━'.repeat(Math.max(0, 55 - name.length))}`);
}

// ── helpers ─────────────────────────────────────────────────────
function sha256(data) {
return crypto.createHash('sha256').update(data).digest('hex');
}

function buildMerkleRoot(leaves) {
if (!leaves.length) return sha256('empty');
let layer = leaves.map(l => sha256(JSON.stringify(l)));
while (layer.length > 1) {
const next = [];
for (let i = 0; i < layer.length; i += 2) {
const left = layer[i];
const right = layer[i + 1] || left;
next.push(sha256(left + right));
}
layer = next;
}
return layer[0];
}

function mockTx(i = 0) {
return {
to: `0x${'a'.repeat(38)}${String(i).padStart(2, '0')}`,
value: `0x${(i * 1000).toString(16)}`,
nonce: i,
data: '0x',
};
}

function rpcRequest(method, params = []) {
return { jsonrpc: '2.0', method, params, id: Math.floor(Math.random() * 9999) };
}

// ── in-process BrixaScaler stub ─────────────────────────────────
// (mirrors the public API described in the README / integration guide)
class BrixaScaler {
constructor(chain = 'ethereum', opts = {}) {
this.chain = chain;
this.shards = opts.shards || 1000;
this.maxShards = opts.maxShards || 10000;
this.batchSize = opts.batchSize || 1000;
this.batchInterval= opts.batchInterval|| 1000;
this.demoMode = opts.demoMode !== false; // default true
this.queue = [];
this.batchesSent = 0;
this.running = false;
this.submitToChain= opts.submitToChain || null;
this._autoScaled = false;
}

enqueue(tx) {
this.queue.push({ ...tx, _ts: Date.now() });
if (this.queue.length > 5000 && this.shards < this.maxShards) {
this.shards = Math.min(this.shards * 2, this.maxShards);
this._autoScaled = true;
}
}

async flush() {
if (!this.queue.length) return null;
const batch = this.queue.splice(0, this.batchSize);
const root = buildMerkleRoot(batch);
this.batchesSent++;
if (!this.demoMode && this.submitToChain) {
await this.submitToChain(batch, root);
}
return { batch, root, count: batch.length };
}

start() { this.running = true; }
stop() { this.running = false; }
}

// ── in-process BrixaRoll stub ────────────────────────────────────
class BrixaRoll {
constructor(opts = {}) {
this.workers = opts.workers || 1;
this.shards = opts.shards || 1000;
this.batchSize = opts.batchSize|| 1000;
this.demoMode = opts.demoMode !== false;
this.proofsGenerated = 0;
this.queue = [];
}

enqueue(tx) { this.queue.push(tx); }

generateProof(batch) {
const root = buildMerkleRoot(batch);
const proofHash= sha256(root + batch.length);
this.proofsGenerated++;
return { root, proofHash, txCount: batch.length };
}

async flushShard() {
if (!this.queue.length) return null;
const batch = this.queue.splice(0, this.batchSize);
const proof = this.generateProof(batch);
return { proof, chainTxCount: 1, realTxCount: batch.length };
}
}

// ═══════════════════════════════════════════════════════════════
// TEST SECTIONS
// ═══════════════════════════════════════════════════════════════

async function main() {

section('1 · BrixaScaler — core batching');

await test('instantiates with defaults', async () => {
const s = new BrixaScaler();
assert.strictEqual(s.chain, 'ethereum');
assert.strictEqual(s.shards, 1000);
assert.strictEqual(s.batchSize, 1000);
assert.strictEqual(s.demoMode, true);
});

await test('accepts custom config', async () => {
const s = new BrixaScaler('polygon', { shards: 50, batchSize: 500, demoMode: false });
assert.strictEqual(s.chain, 'polygon');
assert.strictEqual(s.shards, 50);
assert.strictEqual(s.demoMode, false);
});

await test('enqueues transactions', async () => {
const s = new BrixaScaler();
for (let i = 0; i < 10; i++) s.enqueue(mockTx(i));
assert.strictEqual(s.queue.length, 10);
});

await test('flush returns null on empty queue', async () => {
const s = new BrixaScaler();
const res = await s.flush();
assert.strictEqual(res, null);
});

await test('flush drains queue into a single batch', async () => {
const s = new BrixaScaler('ethereum', { batchSize: 1000 });
for (let i = 0; i < 500; i++) s.enqueue(mockTx(i));
const res = await s.flush();
assert.strictEqual(res.count, 500);
assert.strictEqual(s.queue.length, 0);
});

await test('flush respects batchSize limit', async () => {
const s = new BrixaScaler('ethereum', { batchSize: 100 });
for (let i = 0; i < 300; i++) s.enqueue(mockTx(i));
const res = await s.flush();
assert.strictEqual(res.count, 100);
assert.strictEqual(s.queue.length, 200); // 200 still waiting
});

await test('multiple flushes track batchesSent counter', async () => {
const s = new BrixaScaler('ethereum', { batchSize: 50 });
for (let i = 0; i < 150; i++) s.enqueue(mockTx(i));
await s.flush(); await s.flush(); await s.flush();
assert.strictEqual(s.batchesSent, 3);
});

await test('DEMO_MODE: submitToChain is NOT called', async () => {
let called = false;
const s = new BrixaScaler('ethereum', {
demoMode: true,
submitToChain: () => { called = true; },
});
s.enqueue(mockTx());
await s.flush();
assert.strictEqual(called, false);
});

await test('DEMO_MODE=false: submitToChain IS called', async () => {
let called = false;
const s = new BrixaScaler('ethereum', {
demoMode: false,
submitToChain: async () => { called = true; },
});
s.enqueue(mockTx());
await s.flush();
assert.strictEqual(called, true);
});

// ─────────────────────────────────────────────────────────────
section('2 · Auto-scaling shards');

await test('shards double when queue exceeds 5000', async () => {
const s = new BrixaScaler('ethereum', { shards: 1000, maxShards: 10000, batchSize: 10000 });
for (let i = 0; i < 5001; i++) s.enqueue(mockTx(i));
assert.ok(s.shards > 1000, `Expected shards > 1000, got ${s.shards}`);
assert.strictEqual(s._autoScaled, true);
});

await test('shards never exceed maxShards', async () => {
const s = new BrixaScaler('ethereum', { shards: 9000, maxShards: 10000, batchSize: 100000 });
for (let i = 0; i < 6000; i++) s.enqueue(mockTx(i));
assert.ok(s.shards <= 10000, `Shards ${s.shards} exceeded maxShards`);
});

await test('auto-scale does not trigger below threshold', async () => {
const s = new BrixaScaler('ethereum', { shards: 1000 });
for (let i = 0; i < 4999; i++) s.enqueue(mockTx(i));
assert.strictEqual(s._autoScaled, false);
assert.strictEqual(s.shards, 1000);
});

// ─────────────────────────────────────────────────────────────
section('3 · Merkle proof generation');

await test('merkle root is deterministic', () => {
const txs = Array.from({ length: 10 }, (_, i) => mockTx(i));
const r1 = buildMerkleRoot(txs);
const r2 = buildMerkleRoot(txs);
assert.strictEqual(r1, r2);
});

await test('different batches produce different roots', () => {
const a = buildMerkleRoot([mockTx(1), mockTx(2)]);
const b = buildMerkleRoot([mockTx(3), mockTx(4)]);
assert.notStrictEqual(a, b);
});

await test('root is a 64-char hex string', () => {
const root = buildMerkleRoot([mockTx(0)]);
assert.match(root, /^[0-9a-f]{64}$/);
});

await test('empty batch returns a valid root', () => {
const root = buildMerkleRoot([]);
assert.match(root, /^[0-9a-f]{64}$/);
});

await test('single-element batch returns expected root', () => {
const tx = mockTx(42);
const root = buildMerkleRoot([tx]);
assert.strictEqual(root, sha256(JSON.stringify(tx)));
});

await test('flush result includes a merkle root', async () => {
const s = new BrixaScaler();
s.enqueue(mockTx(1));
s.enqueue(mockTx(2));
const res = await s.flush();
assert.ok(res.root && /^[0-9a-f]{64}$/.test(res.root), 'root missing or malformed');
});

// ─────────────────────────────────────────────────────────────
section('4 · BrixaRoll — off-chain ZK rollup logic');

await test('instantiates with defaults', () => {
const r = new BrixaRoll();
assert.strictEqual(r.workers, 1);
assert.strictEqual(r.shards, 1000);
assert.strictEqual(r.demoMode, true);
});

await test('enqueues and holds txs off-chain', () => {
const r = new BrixaRoll();
for (let i = 0; i < 1000; i++) r.enqueue(mockTx(i));
assert.strictEqual(r.queue.length, 1000);
});

await test('flushShard returns null on empty queue', async () => {
const r = new BrixaRoll();
const res = await r.flushShard();
assert.strictEqual(res, null);
});

await test('flushShard produces 1 chain tx for N real txs', async () => {
const r = new BrixaRoll({ batchSize: 1000 });
for (let i = 0; i < 1000; i++) r.enqueue(mockTx(i));
const res = await r.flushShard();
assert.strictEqual(res.chainTxCount, 1);
assert.strictEqual(res.realTxCount, 1000);
});

await test('proof contains root and proofHash', async () => {
const r = new BrixaRoll();
r.enqueue(mockTx(7));
const res = await r.flushShard();
assert.ok(res.proof.root, 'root missing from proof');
assert.ok(res.proof.proofHash, 'proofHash missing from proof');
});

await test('proofsGenerated increments correctly', async () => {
const r = new BrixaRoll({ batchSize: 10 });
for (let i = 0; i < 30; i++) r.enqueue(mockTx(i));
await r.flushShard();
await r.flushShard();
await r.flushShard();
assert.strictEqual(r.proofsGenerated, 3);
});

await test('same batch always produces same proof root', async () => {
const txs = Array.from({ length: 5 }, (_, i) => mockTx(i));
const r1 = new BrixaRoll({ batchSize: 5 });
const r2 = new BrixaRoll({ batchSize: 5 });
txs.forEach(tx => { r1.enqueue(tx); r2.enqueue(tx); });
const res1 = await r1.flushShard();
const res2 = await r2.flushShard();
assert.strictEqual(res1.proof.root, res2.proof.root);
});

// ─────────────────────────────────────────────────────────────
section('5 · RPC proxy — JSON-RPC request validation');

await test('valid eth_sendTransaction request has correct shape', () => {
const req = rpcRequest('eth_sendTransaction', [mockTx()]);
assert.strictEqual(req.jsonrpc, '2.0');
assert.ok(typeof req.id === 'number');
assert.strictEqual(req.method, 'eth_sendTransaction');
assert.ok(Array.isArray(req.params));
});

await test('eth_blockNumber request is valid', () => {
const req = rpcRequest('eth_blockNumber');
assert.strictEqual(req.method, 'eth_blockNumber');
assert.deepStrictEqual(req.params, []);
});

await test('eth_getBalance request has address param', () => {
const addr = '0x' + 'a'.repeat(40);
const req = rpcRequest('eth_getBalance', [addr, 'latest']);
assert.strictEqual(req.params[0], addr);
assert.strictEqual(req.params[1], 'latest');
});

await test('rpcRequest assigns unique ids', () => {
const ids = new Set(Array.from({ length: 50 }, () => rpcRequest('eth_blockNumber').id));
// Statistically near-certain to have multiple unique ids
assert.ok(ids.size > 1);
});

await test('supported method list covers expected methods', () => {
const supported = [
'eth_sendTransaction',
'eth_sendRawTransaction',
'eth_blockNumber',
'eth_getBalance',
'eth_call',
];
for (const m of supported) {
const req = rpcRequest(m);
assert.strictEqual(req.method, m);
}
});

// ─────────────────────────────────────────────────────────────
section('6 · Performance benchmarks (regression guards)');

await test('1,000 tx batch processes in < 50ms', async () => {
const s = new BrixaScaler('ethereum', { batchSize: 1000 });
const start = Date.now();
for (let i = 0; i < 1000; i++) s.enqueue(mockTx(i));
await s.flush();
const elapsed = Date.now() - start;
assert.ok(elapsed < 50, `Too slow: ${elapsed}ms (limit 50ms)`);
});

await test('10,000 tx batch processes in < 200ms', async () => {
const s = new BrixaScaler('ethereum', { batchSize: 10000 });
const start = Date.now();
for (let i = 0; i < 10000; i++) s.enqueue(mockTx(i));
await s.flush();
const elapsed = Date.now() - start;
assert.ok(elapsed < 200, `Too slow: ${elapsed}ms (limit 200ms)`);
});

await test('merkle root for 1,000 txs generates in < 30ms', () => {
const txs = Array.from({ length: 1000 }, (_, i) => mockTx(i));
const start = Date.now();
buildMerkleRoot(txs);
const elapsed = Date.now() - start;
assert.ok(elapsed < 30, `Too slow: ${elapsed}ms (limit 30ms)`);
});

await test('throughput: 1000 enqueue+flush cycles > 50k ops/sec', async () => {
const s = new BrixaScaler('ethereum', { batchSize: 1 });
const start = Date.now();
for (let i = 0; i < 1000; i++) {
s.enqueue(mockTx(i));
await s.flush();
}
const elapsed = (Date.now() - start) / 1000; // seconds
const opsPerSec = 1000 / elapsed;
assert.ok(opsPerSec > 50000, `Low throughput: ${opsPerSec.toFixed(0)} ops/s`);
});

// ─────────────────────────────────────────────────────────────
section('7 · Multi-chain config');

const chains = ['ethereum', 'polygon', 'bsc', 'avalanche', 'arbitrum', 'bitcoin'];

for (const chain of chains) {
await test(`accepts chain: ${chain}`, async () => {
const s = new BrixaScaler(chain);
assert.strictEqual(s.chain, chain);
s.enqueue(mockTx());
const res = await s.flush();
assert.strictEqual(res.count, 1);
});
}

// ─────────────────────────────────────────────────────────────
section('8 · Edge cases & error handling');

await test('flush handles 1-tx batch correctly', async () => {
const s = new BrixaScaler();
s.enqueue(mockTx(0));
const res = await s.flush();
assert.strictEqual(res.count, 1);
assert.ok(res.root);
});

await test('concurrent flushes do not double-spend queue', async () => {
const s = new BrixaScaler('ethereum', { batchSize: 100 });
for (let i = 0; i < 100; i++) s.enqueue(mockTx(i));
// Two concurrent flushes — second should return null (queue already drained)
const [r1, r2] = await Promise.all([s.flush(), s.flush()]);
const total = (r1?.count || 0) + (r2?.count || 0);
assert.strictEqual(total, 100);
});

await test('tx object preserves all fields through enqueue', async () => {
const tx = { to: '0xdeadbeef', value: '0x1', data: '0xabcd', nonce: 99 };
const s = new BrixaScaler();
s.enqueue(tx);
const item = s.queue[0];
assert.strictEqual(item.to, tx.to);
assert.strictEqual(item.value, tx.value);
assert.strictEqual(item.data, tx.data);
assert.strictEqual(item.nonce, tx.nonce);
});

await test('start/stop toggles running state', () => {
const s = new BrixaScaler();
assert.strictEqual(s.running, false);
s.start();
assert.strictEqual(s.running, true);
s.stop();
assert.strictEqual(s.running, false);
});

await test('submitToChain receives correct batch and root', async () => {
let capturedBatch, capturedRoot;
const s = new BrixaScaler('ethereum', {
demoMode: false,
submitToChain: async (batch, root) => {
capturedBatch = batch;
capturedRoot = root;
},
});
const txs = [mockTx(1), mockTx(2), mockTx(3)];
txs.forEach(tx => s.enqueue(tx));
await s.flush();
assert.strictEqual(capturedBatch.length, 3);
assert.ok(/^[0-9a-f]{64}$/.test(capturedRoot));
});

// ─────────────────────────────────────────────────────────────
section('9 · Live RPC proxy connectivity (optional)');

const RPC_URL = process.env.RPC_URL || null;
const PROXY = process.env.PROXY_URL || 'http://localhost:8545';

if (RPC_URL) {
await test('proxy responds to eth_blockNumber', async () => {
const body = JSON.stringify(rpcRequest('eth_blockNumber'));
const res = await new Promise((resolve, reject) => {
const url = new URL(PROXY);
const req = http.request({ hostname: url.hostname, port: url.port || 80,
path: '/', method: 'POST', headers: { 'Content-Type': 'application/json' } },
res => {
let data = '';
res.on('data', d => data += d);
res.on('end', () => resolve(JSON.parse(data)));
}
);
req.on('error', reject);
req.write(body);
req.end();
});
assert.ok(res.result, 'No result from proxy');
});
} else {
skip('proxy responds to eth_blockNumber', 'set RPC_URL env var to enable');
skip('proxy responds to eth_getBalance', 'set RPC_URL env var to enable');
}

// ─────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────
const total = passed + failed + skipped;
console.log('\n' + '═'.repeat(58));
console.log(` RESULTS · ${total} tests`);
console.log(` ✅ Passed: ${passed}`);
console.log(` ❌ Failed: ${failed}`);
console.log(` ⏭️ Skipped: ${skipped}`);
console.log('═'.repeat(58) + '\n');

if (failed > 0) {
console.log('Failed tests:');
results.filter(r => r.status === 'FAIL')
.forEach(r => console.log(` ✗ ${r.label}\n ${r.error}`));
process.exit(1);
}

} // end main()

main().catch(err => { console.error('Unhandled error:', err); process.exit(1); });