package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"html/template"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// Node represents a VPS in the database
type Node struct {
	ID        string `gorm:"primaryKey" json:"node_id"`
	CreatedAt time.Time
	UpdatedAt time.Time
	Location  string `json:"location"`
	ISP       string `json:"isp"`
	LastSeen  time.Time

	// Latest Stats
	Cores     int     `json:"cores"`
	Load1     float64 `json:"load_1"`
	Load5     float64 `json:"load_5"`
	Load15    float64 `json:"load_15"`
	MemUsed   uint64  `json:"mem_used"`
	MemTotal  uint64  `json:"mem_total"`
	DiskUsed  uint64  `json:"disk_used"`
	DiskTotal uint64  `json:"disk_total"`
	CPUSteal  float64 `json:"cpu_steal"`
	NetUp     float64 `json:"net_up"`
	NetDown   float64 `json:"net_down"`
	Status    string  `gorm:"-" json:"status"` // Computed (Online/Offline)
}

var db *gorm.DB

func initDB() {
	var err error
	db, err = gorm.Open(sqlite.Open("kiloa.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	db.AutoMigrate(&Node{})
}

func main() {
	initDB()

	// Get Auth Token from Env
	authToken := os.Getenv("KILOA_TOKEN")
	if authToken == "" {
		authToken = "secret"
	}

	r := gin.Default()
	r.SetFuncMap(template.FuncMap{
		"div": func(a uint64, b float64) float64 {
			return float64(a) / b
		},
		"mul": func(a, b float64) float64 {
			return a * b
		},
		"percent": func(a, b uint64) float64 {
			if b == 0 {
				return 0
			}
			return (float64(a) / float64(b)) * 100
		},
	})
	r.LoadHTMLGlob("templates/*")
	r.Static("/public", "./public")

	// API Endpoint for Agents
	r.POST("/api/report", func(c *gin.Context) {
		// Valid Auth Token
		token := c.GetHeader("Authorization")
		if token != authToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var input Node
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		input.LastSeen = time.Now()

		// Update or Create
		var currentNode Node
		if result := db.First(&currentNode, "id = ?", input.ID); result.Error == nil {
			// Update existing
			input.CreatedAt = currentNode.CreatedAt // Preserve creation
			db.Save(&input)
		} else {
			// Create new
			db.Create(&input)
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Dashboard UI
	r.GET("/", func(c *gin.Context) {
		var nodes []Node
		db.Find(&nodes)

		// Aggregate Stats
		var totalNodes int64
		var totalMemUsed, totalMemTotal, totalDiskUsed, totalDiskTotal uint64
		var totalNetUp, totalNetDown float64

		processedNodes := make([]Node, 0)

		for _, n := range nodes {
			// Mark as Offline if > 2 mins silence
			if time.Since(n.LastSeen) > 2*time.Minute {
				n.Status = "offline"
			} else {
				n.Status = "online"
			}

			totalMemUsed += n.MemUsed
			totalMemTotal += n.MemTotal
			totalDiskUsed += n.DiskUsed
			totalDiskTotal += n.DiskTotal
			totalNetUp += n.NetUp
			totalNetDown += n.NetDown

			processedNodes = append(processedNodes, n)
		}
		totalNodes = int64(len(processedNodes))

		c.HTML(http.StatusOK, "index.html", gin.H{
			"Nodes": processedNodes,
			"Stats": gin.H{
				"TotalNodes": totalNodes,
				"MemUsed":    formatBytes(totalMemUsed),
				"MemTotal":   formatBytes(totalMemTotal),
				"DiskUsed":   formatBytes(totalDiskUsed),
				"DiskTotal":  formatBytes(totalDiskTotal),
				"NetUp":      totalNetUp,
				"NetDown":    totalNetDown,
			},
		})
	})

	// JSON Endpoint for Frontend Polling
	r.GET("/api/nodes", func(c *gin.Context) {
		var nodes []Node
		db.Find(&nodes)
		// ... (Same logic as above for status/processing could be refactored) ...
		c.JSON(http.StatusOK, nodes)
	})

	r.Run(":8080")
}

func formatBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %c", float64(b)/float64(div), "KMGTPE"[exp])
}
