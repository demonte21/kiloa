package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// Config holds command-line arguments
type Config struct {
	ServerURL string
	Token     string
	NodeID    string
	Location  string
	ISP       string
	Interval  time.Duration
}

// SystemStats represents the JSON payload sent to the dashboard
type SystemStats struct {
	NodeID    string  `json:"node_id"`
	Location  string  `json:"location"`
	ISP       string  `json:"isp"`
	Uptime    uint64  `json:"uptime"`
	Cores     int     `json:"cores"`
	Load1     float64 `json:"load_1"`
	Load5     float64 `json:"load_5"`
	Load15    float64 `json:"load_15"`
	MemUsed   uint64  `json:"mem_used"`
	MemTotal  uint64  `json:"mem_total"`
	DiskUsed  uint64  `json:"disk_used"`
	DiskTotal uint64  `json:"disk_total"`
	CPUSteal  float64 `json:"cpu_steal"` // Percentage
	NetUp     float64 `json:"net_up"`    // MB/s
	NetDown   float64 `json:"net_down"`  // MB/s
}

type Collector struct {
	lastNet  []net.IOCountersStat
	lastCPU  []cpu.TimesStat
	lastTime time.Time
}

func NewCollector() *Collector {
	return &Collector{
		lastTime: time.Now(),
	}
}

func (c *Collector) Collect(cfg Config) (*SystemStats, error) {
	now := time.Now()

	// Host Info
	hostInfo, err := host.Info()
	if err != nil {
		return nil, fmt.Errorf("host info: %v", err)
	}

	// CPU Cores
	cores, err := cpu.Counts(true)
	if err != nil {
		cores = 0
	}

	// Load Avg
	avg, err := load.Avg()
	if err != nil {
		return nil, fmt.Errorf("load avg: %v", err)
	}

	// Memory
	v, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("memory: %v", err)
	}

	// Disk (Root)
	d, err := disk.Usage("/")
	if err != nil {
		return nil, fmt.Errorf("disk: %v", err)
	}

	stats := &SystemStats{
		NodeID:    cfg.NodeID,
		Location:  cfg.Location,
		ISP:       cfg.ISP,
		Uptime:    hostInfo.Uptime,
		Cores:     cores,
		Load1:     avg.Load1,
		Load5:     avg.Load5,
		Load15:    avg.Load15,
		MemUsed:   v.Used,
		MemTotal:  v.Total,
		DiskUsed:  d.Used,
		DiskTotal: d.Total,
	}

	// Calculate Deltas for CPU Steal and Network
	sysTimes, err := cpu.Times(false) // Total across all cores
	if err == nil && len(sysTimes) > 0 {
		if len(c.lastCPU) > 0 {
			// Calculate Steal %
			// Steal is in seconds. We need: (currSteal - lastSteal) / (currTotal - lastTotal)
			t1 := c.lastCPU[0]
			t2 := sysTimes[0]

			total1 := t1.User + t1.System + t1.Idle + t1.Nice + t1.Iowait + t1.Irq + t1.Softirq + t1.Steal
			total2 := t2.User + t2.System + t2.Idle + t2.Nice + t2.Iowait + t2.Irq + t2.Softirq + t2.Steal

			diffTotal := total2 - total1
			diffSteal := t2.Steal - t1.Steal

			if diffTotal > 0 {
				stats.CPUSteal = (diffSteal / diffTotal) * 100
			}
		}
		c.lastCPU = sysTimes
	}

	netIO, err := net.IOCounters(false) // Total across all interfaces
	if err == nil && len(netIO) > 0 {
		if len(c.lastNet) > 0 {
			// Calculate Rate in MB/s
			duration := now.Sub(c.lastTime).Seconds()
			if duration > 0 {
				bytesSent := float64(netIO[0].BytesSent - c.lastNet[0].BytesSent)
				bytesRecv := float64(netIO[0].BytesRecv - c.lastNet[0].BytesRecv)

				stats.NetUp = (bytesSent / 1024 / 1024) / duration
				stats.NetDown = (bytesRecv / 1024 / 1024) / duration
			}
		}
		c.lastNet = netIO
	}

	c.lastTime = now
	return stats, nil
}

func main() {
	server := flag.String("server", "http://localhost:8080", "Dashboard URL")
	token := flag.String("token", "secret", "Auth Token")
	nodeID := flag.String("id", "", "Node ID (default: hostname)")
	location := flag.String("location", "Unknown", "Location Label")
	isp := flag.String("isp", "Unknown", "ISP Label")
	interval := flag.Int("interval", 2, "Interval in seconds") // Default 2s for "live" feel testing
	flag.Parse()

	if *nodeID == "" {
		hostInfo, _ := host.Info()
		*nodeID = hostInfo.Hostname
	}

	if *isp == "Unknown" {
		fmt.Println("Detecting ISP...")
		*isp = getISP()
	}

	cfg := Config{
		ServerURL: *server,
		Token:     *token,
		NodeID:    *nodeID,
		Location:  *location,
		ISP:       *isp,
		Interval:  time.Duration(*interval) * time.Second,
	}

	collector := NewCollector()

	fmt.Printf("Starting Kiloa Agent for Node: %s\n", cfg.NodeID)
	fmt.Printf("Posting to: %s every %v\n", cfg.ServerURL, cfg.Interval)

	ticker := time.NewTicker(cfg.Interval)
	for range ticker.C {
		stats, err := collector.Collect(cfg)
		if err != nil {
			log.Printf("Error collecting stats: %v", err)
			continue
		}

		// Print JSON to stdout for debugging
		jsonData, _ := json.Marshal(stats)
		fmt.Printf("Stats: %s\n", string(jsonData))

		// Send to Server
		go sendReport(cfg, jsonData)
	}
}

func sendReport(cfg Config, data []byte) {
	req, err := http.NewRequest("POST", cfg.ServerURL+"/api/report", bytes.NewBuffer(data))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", cfg.Token)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error sending report: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Server returned non-OK status: %v", resp.Status)
	}
}

type IPAPIResponse struct {
	ISP string `json:"isp"`
}

func getISP() string {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/")
	if err != nil {
		return "Unknown"
	}
	defer resp.Body.Close()

	var result IPAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "Unknown"
	}

	if result.ISP == "" {
		return "Unknown"
	}
	return result.ISP
}
