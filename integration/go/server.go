package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"sync"
	"time"
)

// ═══════════════════════════════════════════════════════════════
// BRIXASCALER HTTP API - Production Ready
// ═══════════════════════════════════════════════════════════════

type Transaction struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Value uint64 `json:"value"`
	Data  string `json:"data,omitempty"`
	Nonce uint64 `json:"nonce"`
}

type BatchRequest struct {
	Transactions []Transaction `json:"transactions"`
	ShardID      int           `json:"shard_id,omitempty"`
}

type BatchResponse struct {
	BatchID      string   `json:"batch_id"`
	Root         string   `json:"merkle_root"`
	TxCount      int      `json:"tx_count"`
	ProcessTime  int64    `json:"process_time_ms"`
	Shards       int      `json:"shards_used"`
}

type HealthResponse struct {
	Status      string  `json:"status"`
	Version     string  `json:"version"`
	Uptime      int64   `json:"uptime_seconds"`
	TPS         float64 `json:"current_tps"`
	TotalBatches uint64 `json:"total_batches"`
	TotalTxs    uint64  `json:"total_txs"`
	NumShards   int     `json:"num_shards"`
	CPUCores    int     `json:"cpu_cores"`
}

type Stats struct {
	totalBatches uint64
	totalTxs     uint64
	startTime    time.Time
	lock         sync.Mutex
}

var stats Stats

func init() {
	stats = Stats{startTime: time.Now()}
}

func HashSHA256(data []byte) []byte {
	h := sha256.Sum256(data)
	return h[:]
}

func MerkleRoot(hashes [][]byte) []byte {
	if len(hashes) == 0 {
		return HashSHA256([]byte("empty"))
	}
	
	layer := make([][]byte, len(hashes))
	copy(layer, hashes)
	
	for len(layer) > 1 {
		next := make([][]byte, 0, (len(layer)+1)/2)
		for i := 0; i < len(layer); i += 2 {
			left := layer[i]
			right := left
			if i+1 < len(layer) {
				right = layer[i+1]
			}
			combined := make([]byte, len(left)+len(right))
			copy(combined, left)
			copy(combined[len(left):], right)
			next = append(next, HashSHA256(combined))
		}
		layer = next
	}
	
	return layer[0]
}

func ProcessShardRange(start, end int, txs []Transaction, result chan []byte, wg *sync.WaitGroup) {
	defer wg.Done()
	
	hashes := make([][]byte, 0, end-start)
	for i := start; i < end && i < len(txs); i++ {
		tx := txs[i]
		data := []byte(fmt.Sprintf("%s%s%d%d%s", tx.From, tx.To, tx.Value, tx.Nonce, tx.Data))
		hashes = append(hashes, HashSHA256(data))
	}
	
	if len(hashes) > 0 {
		root := MerkleRoot(hashes)
		result <- root
	}
}

func ProcessBatch(txs []Transaction, numShards int) (string, int64) {
	start := time.Now()
	
	chunkSize := len(txs) / numShards
	if chunkSize < 100 {
		chunkSize = len(txs)
		numShards = 1
	}
	
	var wg sync.WaitGroup
	result := make(chan []byte, numShards)
	
	for s := 0; s < numShards; s++ {
		startIdx := s * chunkSize
		endIdx := startIdx + chunkSize
		if endIdx > len(txs) {
			endIdx = len(txs)
		}
		if startIdx >= len(txs) {
			break
		}
		
		wg.Add(1)
		go ProcessShardRange(startIdx, endIdx, txs, result, &wg)
	}
	
	wg.Wait()
	close(result)
	
	var roots [][]byte
	for r := range result {
		roots = append(roots, r)
	}
	
	root := MerkleRoot(roots)
	elapsed := time.Since(start).Milliseconds()
	
	stats.lock.Lock()
	stats.totalBatches++
	stats.totalTxs += uint64(len(txs))
	stats.lock.Unlock()
	
	return hex.EncodeToString(root), elapsed
}

// HTTP Handlers
func handleBatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	
	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	if len(req.Transactions) == 0 {
		http.Error(w, "no transactions", http.StatusBadRequest)
		return
	}
	
	// Get shard count from header or default
	numShards := runtime.NumCPU()
	if req.ShardID > 0 {
		numShards = req.ShardID
	}
	
	root, processTime := ProcessBatch(req.Transactions, numShards)
	
	resp := BatchResponse{
		BatchID:     fmt.Sprintf("batch-%d-%d", time.Now().Unix(), stats.totalBatches),
		Root:        root,
		TxCount:     len(req.Transactions),
		ProcessTime: processTime,
		Shards:      numShards,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	stats.lock.Lock()
	elapsed := time.Since(stats.startTime).Seconds()
	tps := float64(stats.totalTxs) / elapsed
	stats.lock.Unlock()
	
	resp := HealthResponse{
		Status:       "healthy",
		Version:      "1.0.0",
		Uptime:       int64(elapsed),
		TPS:          tps,
		TotalBatches: stats.totalBatches,
		TotalTxs:     stats.totalTxs,
		NumShards:    runtime.NumCPU(),
		CPUCores:     runtime.NumCPU(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleBenchmark(w http.ResponseWriter, r *http.Request) {
	// Run quick benchmark
	testSizes := []int{1000, 10000, 100000, 1000000}
	numShards := runtime.NumCPU()
	
	type benchmarkResult struct {
		Size   int   `json:"batch_size"`
		Time   int64 `json:"time_ms"`
		TPS    int   `json:"tps"`
	}
	
	results := make([]benchmarkResult, len(testSizes))
	
	for i, size := range testSizes {
		txs := make([]Transaction, size)
		for j := 0; j < size; j++ {
			txs[j] = Transaction{
				From:  fmt.Sprintf("0x%x", j),
				To:    fmt.Sprintf("0x%x", size-j),
				Value: uint64(j),
				Nonce: uint64(j),
			}
		}
		
		_, timeMs := ProcessBatch(txs, numShards)
		
		results[i] = benchmarkResult{
			Size: size,
			Time: timeMs,
			TPS:  int(float64(size) / float64(timeMs) * 1000),
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"shards":   numShards,
		"cpu_cores": runtime.NumCPU(),
		"results":   results,
	})
}

func main() {
	runtime.GOMAXPROCS(runtime.NumCPU())
	
	fmt.Printf("╔══════════════════════════════════════════════════════════════╗\n")
	fmt.Printf("║           BRIXASCALER HTTP API - Production Ready            ║\n")
	fmt.Printf("╚══════════════════════════════════════════════════════════════╝\n\n")
	
	fmt.Printf("Server starting on http://localhost:8080\n")
	fmt.Printf("CPU Cores: %d\n", runtime.NumCPU())
	fmt.Printf("\nEndpoints:\n")
	fmt.Printf("  POST /batch    - Submit transaction batch\n")
	fmt.Printf("  GET  /health   - Server health & stats\n")
	fmt.Printf("  GET  /benchmark - Quick TPS benchmark\n")
	fmt.Printf("\n")
	
	http.HandleFunc("/batch", handleBatch)
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/benchmark", handleBenchmark)
	
	log.Fatal(http.ListenAndServe(":8080", nil))
}