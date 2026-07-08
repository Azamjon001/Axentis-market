package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

const aiSystemPrompt = `You are a product inventory parser for an online store management system.
Parse the user's text (which may be in Russian, Uzbek, or mixed) and extract all products with their variants.

IMPORTANT RULES:
1. Each unique combination of (color + size + price + stockQuantity) = one variant
2. If a product has no variants mentioned, create one variant with the given price and quantity
3. "Некачественный"/"Sifatsiz" and "Качественный"/"Sifatli" should be used as the "size" field (they are quality tiers)
4. Numbers written as words (пятьдесят, yigirma, etc.) should be converted to digits
5. Currency words (сум, so'm, сўм) should be stripped from prices
6. If name is not clear, use a generic name like "Товар"
7. Return ONLY valid JSON, no markdown, no extra text

Return a JSON array with this exact structure:
[
  {
    "name": "product name",
    "category": "",
    "description": "",
    "variants": [
      {
        "color": "color or empty string",
        "size": "size/quality/weight/storage or empty string",
        "price": 120000,
        "markupPercent": 0,
        "stockQuantity": 20,
        "barcode": "",
        "barid": ""
      }
    ]
  }
]`

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type anthropicResponse struct {
	Content []anthropicContent `json:"content"`
	Error   *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// ParsedVariant represents a single SKU variant from AI parsing
type ParsedVariant struct {
	Color         string  `json:"color"`
	Size          string  `json:"size"`
	Price         float64 `json:"price"`
	MarkupPercent float64 `json:"markupPercent"`
	StockQuantity int     `json:"stockQuantity"`
	Barcode       string  `json:"barcode"`
	Barid         string  `json:"barid"`
}

// ParsedProduct represents a product with its variants from AI parsing
type ParsedProduct struct {
	Name        string          `json:"name"`
	Category    string          `json:"category"`
	Description string          `json:"description"`
	Variants    []ParsedVariant `json:"variants"`
}

// AIParseProducts calls Claude API to parse free-text product descriptions
func AIParseProducts() gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Text string `json:"text"`
		}
		if err := c.BindJSON(&input); err != nil || strings.TrimSpace(input.Text) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "text is required"})
			return
		}

		apiKey := os.Getenv("ANTHROPIC_API_KEY")
		if apiKey == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ANTHROPIC_API_KEY not configured"})
			return
		}

		reqBody := anthropicRequest{
			Model:     "claude-haiku-4-5-20251001",
			MaxTokens: 2048,
			System:    aiSystemPrompt,
			Messages: []anthropicMessage{
				{Role: "user", Content: input.Text},
			},
		}

		bodyBytes, err := json.Marshal(reqBody)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build request"})
			return
		}

		req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(bodyBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
			return
		}
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("content-type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("❌ Claude API error: %v", err)
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to reach Claude API"})
			return
		}
		defer resp.Body.Close()

		respBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read Claude response"})
			return
		}

		var claudeResp anthropicResponse
		if err := json.Unmarshal(respBytes, &claudeResp); err != nil {
			log.Printf("❌ Claude response parse error: %v\nBody: %s", err, string(respBytes))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse Claude response"})
			return
		}

		if claudeResp.Error != nil {
			log.Printf("❌ Claude API error: %s", claudeResp.Error.Message)
			c.JSON(http.StatusBadGateway, gin.H{"error": claudeResp.Error.Message})
			return
		}

		if len(claudeResp.Content) == 0 {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "empty response from Claude"})
			return
		}

		rawText := strings.TrimSpace(claudeResp.Content[0].Text)
		if strings.HasPrefix(rawText, "```") {
			lines := strings.Split(rawText, "\n")
			if len(lines) >= 3 {
				rawText = strings.Join(lines[1:len(lines)-1], "\n")
			}
		}

		var products []ParsedProduct
		if err := json.Unmarshal([]byte(rawText), &products); err != nil {
			log.Printf("❌ Failed to parse Claude JSON output: %v\nRaw: %s", err, rawText)
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error": "AI returned invalid JSON",
				"raw":   rawText,
			})
			return
		}

		log.Printf("✅ AI parsed %d products from text", len(products))
		c.JSON(http.StatusOK, gin.H{"products": products})
	}
}
