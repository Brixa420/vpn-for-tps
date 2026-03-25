
const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Process chunk of transactions
function processChunk(start, end) {
  const layer = [];
  for (let i = start; i < end; i++) {
    layer.push(sha256('tx' + i));
  }
  
  // Build partial tree
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256(layer[i] + (layer[i + 1] || layer[i])));
    }
    layer = next;
  }
  
  return layer[0];
}

process.on('message', ({ start, end, id }) => {
  const root = processChunk(start, end);
  process.postMessage({ root, id });
});
