#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════
 *    PARALLEL BRIXASCALER - Uses all CPU cores
 * ═══════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const cluster = require('cluster');
const os = require('os');

const numCPUs = os.cpus().length;

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Worker process - processes a chunk
if (cluster.isWorker) {
  const { start, end } = cluster.worker.data;
  
  let layer = [];
  for (let i = start; i < end; i++) {
    layer.push(sha256('tx' + i));
  }
  
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256(layer[i] + (layer[i + 1] || layer[i])));
    }
    layer = next;
  }
  
  cluster.worker.send({ root: layer[0] });
  process.exit(0);
}

// Master process
async function runBenchmark() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     PARALLEL BRIXASCALER (Cluster - All Cores)              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Using ${numCPUs} CPU cores\n`);
  
  const sizes = [500000, 1000000, 2000000, 5000000];
  
  console.log('| Size      | Parallel  | Single    | Speedup |');
  console.log('|------------|-----------|-----------|---------|');
  
  for (const size of sizes) {
    const chunkSize = Math.ceil(size / numCPUs);
    
    // Single-threaded baseline
    const t0 = Date.now();
    let layer = [];
    for (let i = 0; i < size; i++) {
      layer.push(sha256('tx' + i));
    }
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(sha256(layer[i] + (layer[i + 1] || layer[i])));
      }
      layer = next;
    }
    const singleTime = Date.now() - t0;
    
    // Parallel with cluster
    const p0 = Date.now();
    const roots = [];
    let completed = 0;
    
    const workers = [];
    
    for (let w = 0; w < numCPUs; w++) {
      const start = w * chunkSize;
      const end = Math.min(start + chunkSize, size);
      
      if (start >= size) break;
      
      const worker = cluster.fork({ start, end, id: w });
      workers.push(worker);
      
      worker.on('message', (msg) => {
        roots[msg.id] = msg.root;
        completed++;
        
        if (completed === workers.length) {
          // Combine all roots
          let finalRoot = roots[0];
          for (let i = 1; i < roots.length; i++) {
            if (roots[i]) {
              finalRoot = sha256(finalRoot + roots[i]);
            }
          }
          
          const parallelTime = Date.now() - p0;
          const speedup = (singleTime / parallelTime).toFixed(2);
          const tps = Math.round(1000 / parallelTime * size);
          
          console.log(`| ${size.toLocaleString().padStart(9)} | ${parallelTime.toString().padStart(7)}ms | ${singleTime.toString().padStart(7)}ms | ${speedup}x   |`);
          
          // Kill all workers
          workers.forEach(w => w.kill());
        }
      });
    }
    
    // Wait for this size to complete
    await new Promise(r => setTimeout(r, singleTime + 5000));
  }
  
  console.log('\n✓ Cluster parallel processing active!\n');
  process.exit(0);
}

runBenchmark();