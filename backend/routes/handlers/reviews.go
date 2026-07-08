package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetProductReviews - получить отзывы для продукта
func GetProductReviews(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")
		userPhone := c.Query("user_phone") // Опционально для получения информации о голосах пользователя
		
		log.Printf("📝 GetProductReviews called for productId=%s", productID)

		rows, err := db.Query(`
			SELECT r.id, r.product_id, r.user_phone, r.user_name, r.rating, r.comment, r.created_at,
			       COALESCE(r.likes, 0) as likes, COALESCE(r.dislikes, 0) as dislikes,
			       COALESCE(u.avatar_url, '') as user_avatar_url,
			       COALESCE(r.images::text, '[]') as images
			FROM reviews r
			LEFT JOIN users u ON u.phone = r.user_phone
			WHERE r.product_id = $1
			ORDER BY (COALESCE(r.likes, 0) - COALESCE(r.dislikes, 0)) DESC, r.created_at DESC
		`, productID)
		if err != nil {
			log.Printf("❌ GetProductReviews error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
			return
		}
		defer rows.Close()

		reviews := make([]map[string]interface{}, 0)
		for rows.Next() {
			var review struct {
				ID            int64
				ProductID     int64
				UserPhone     string
				UserName      string
				Rating        int
				Comment       string
				CreatedAt     string
				Likes         int
				Dislikes      int
				UserAvatarURL string
				Images        string
			}

			err := rows.Scan(
				&review.ID,
				&review.ProductID,
				&review.UserPhone,
				&review.UserName,
				&review.Rating,
				&review.Comment,
				&review.CreatedAt,
				&review.Likes,
				&review.Dislikes,
				&review.UserAvatarURL,
				&review.Images,
			)
			if err != nil {
				log.Printf("❌ GetProductReviews scan error: %v", err)
				continue
			}

			images := []string{}
			if review.Images != "" {
				_ = json.Unmarshal([]byte(review.Images), &images)
			}

			reviewData := map[string]interface{}{
				"id":              review.ID,
				"product_id":      review.ProductID,
				"user_phone":      review.UserPhone,
				"user_name":       review.UserName,
				"rating":          review.Rating,
				"comment":         review.Comment,
				"created_at":      review.CreatedAt,
				"likes":           review.Likes,
				"dislikes":        review.Dislikes,
				"user_avatar_url": review.UserAvatarURL,
				"images":          images,
			}

			// Если передан телефон пользователя, проверяем его голос
			if userPhone != "" {
				var voteType sql.NullString
				err := db.QueryRow(`
					SELECT vote_type FROM review_votes 
					WHERE review_id = $1 AND user_phone = $2
				`, review.ID, userPhone).Scan(&voteType)
				
				if err == nil && voteType.Valid {
					reviewData["user_vote"] = voteType.String
				} else {
					reviewData["user_vote"] = nil
				}
			}

			reviews = append(reviews, reviewData)
		}

		log.Printf("✅ GetProductReviews: Found %d reviews for product %s", len(reviews), productID)
		c.JSON(http.StatusOK, reviews)
	}
}

// CreateReview - создать новый отзыв
func CreateReview(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ProductID int64    `json:"product_id" binding:"required"`
			UserPhone string   `json:"user_phone" binding:"required"`
			UserName  string   `json:"user_name" binding:"required"`
			Rating    int      `json:"rating" binding:"required,min=1,max=5"`
			Comment   string   `json:"comment"`
			Images    []string `json:"images"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ CreateReview: Invalid request: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		// Не больше 5 фото на отзыв; пустые/битые ссылки отбрасываем.
		clean := make([]string, 0, len(req.Images))
		for _, u := range req.Images {
			if u != "" && len(clean) < 5 {
				clean = append(clean, u)
			}
		}
		imagesJSON, _ := json.Marshal(clean)

		log.Printf("📝 CreateReview called for product %d by user %s (rating: %d, photos: %d)",
			req.ProductID, req.UserPhone, req.Rating, len(clean))

		var reviewID int64
		err := db.QueryRow(`
			INSERT INTO reviews (product_id, user_phone, user_name, rating, comment, images)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb)
			RETURNING id
		`, req.ProductID, req.UserPhone, req.UserName, req.Rating, req.Comment, string(imagesJSON)).Scan(&reviewID)

		if err != nil {
			log.Printf("❌ CreateReview error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
			return
		}

		log.Printf("✅ CreateReview: Review created with ID=%d", reviewID)
		c.JSON(http.StatusCreated, gin.H{
			"id":         reviewID,
			"product_id": req.ProductID,
			"user_phone": req.UserPhone,
			"user_name":  req.UserName,
			"rating":     req.Rating,
			"comment":    req.Comment,
			"images":     clean,
		})
	}
}

// GetReviewStats - получить статистику отзывов для продукта
func GetReviewStats(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productIDStr := c.Param("id")
		productID, err := strconv.ParseInt(productIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		var stats struct {
			Count         int
			AverageRating float64
		}

		err = db.QueryRow(`
			SELECT 
				COUNT(*) as count,
				COALESCE(AVG(rating), 0) as average_rating
			FROM reviews 
			WHERE product_id = $1
		`, productID).Scan(&stats.Count, &stats.AverageRating)

		if err != nil {
			log.Printf("❌ GetReviewStats error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get review stats"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"count":          stats.Count,
			"average_rating": stats.AverageRating,
		})
	}
}

// VoteReview - лайк или дизлайк отзыва
func VoteReview(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		reviewIDStr := c.Param("id")
		reviewID, err := strconv.ParseInt(reviewIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid review ID"})
			return
		}

		var req struct {
			UserPhone string `json:"user_phone" binding:"required"`
			VoteType  string `json:"vote_type" binding:"required"` // "like" или "dislike"
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ VoteReview: Invalid request: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		if req.VoteType != "like" && req.VoteType != "dislike" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "vote_type must be 'like' or 'dislike'"})
			return
		}

		log.Printf("👍 VoteReview called for review %d by user %s (vote: %s)", 
			reviewID, req.UserPhone, req.VoteType)

		// Начинаем транзакцию
		tx, err := db.Begin()
		if err != nil {
			log.Printf("❌ VoteReview: Failed to begin transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process vote"})
			return
		}
		defer tx.Rollback()

		// Проверяем, есть ли уже голос от этого пользователя
		var existingVote sql.NullString
		err = tx.QueryRow(`
			SELECT vote_type FROM review_votes 
			WHERE review_id = $1 AND user_phone = $2
		`, reviewID, req.UserPhone).Scan(&existingVote)

		if err != nil && err != sql.ErrNoRows {
			log.Printf("❌ VoteReview: Failed to check existing vote: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process vote"})
			return
		}

		// Если голос уже существует
		if existingVote.Valid {
			if existingVote.String == req.VoteType {
				// Убираем голос (пользователь нажал на ту же кнопку повторно)
				_, err = tx.Exec(`DELETE FROM review_votes WHERE review_id = $1 AND user_phone = $2`, 
					reviewID, req.UserPhone)
				if err != nil {
					log.Printf("❌ VoteReview: Failed to remove vote: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove vote"})
					return
				}

				// Обновляем счетчик
				if req.VoteType == "like" {
					_, err = tx.Exec(`UPDATE reviews SET likes = GREATEST(likes - 1, 0) WHERE id = $1`, reviewID)
				} else {
					_, err = tx.Exec(`UPDATE reviews SET dislikes = GREATEST(dislikes - 1, 0) WHERE id = $1`, reviewID)
				}
				
				if err != nil {
					log.Printf("❌ VoteReview: Failed to update counter: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vote"})
					return
				}

				if err := tx.Commit(); err != nil {
					log.Printf("❌ VoteReview: Failed to commit: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save vote"})
					return
				}

				log.Printf("✅ VoteReview: Vote removed for review %d", reviewID)
				c.JSON(http.StatusOK, gin.H{"message": "Vote removed", "action": "removed"})
				return
			} else {
				// Меняем голос на противоположный
				_, err = tx.Exec(`UPDATE review_votes SET vote_type = $1 WHERE review_id = $2 AND user_phone = $3`,
					req.VoteType, reviewID, req.UserPhone)
				if err != nil {
					log.Printf("❌ VoteReview: Failed to update vote: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vote"})
					return
				}

				// Обновляем счетчики (убираем старый, добавляем новый)
				if req.VoteType == "like" {
					_, err = tx.Exec(`UPDATE reviews SET likes = likes + 1, dislikes = GREATEST(dislikes - 1, 0) WHERE id = $1`, reviewID)
				} else {
					_, err = tx.Exec(`UPDATE reviews SET dislikes = dislikes + 1, likes = GREATEST(likes - 1, 0) WHERE id = $1`, reviewID)
				}
				
				if err != nil {
					log.Printf("❌ VoteReview: Failed to update counters: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vote"})
					return
				}

				if err := tx.Commit(); err != nil {
					log.Printf("❌ VoteReview: Failed to commit: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save vote"})
					return
				}

				log.Printf("✅ VoteReview: Vote changed for review %d", reviewID)
				c.JSON(http.StatusOK, gin.H{"message": "Vote updated", "action": "changed"})
				return
			}
		}

		// Создаем новый голос
		_, err = tx.Exec(`
			INSERT INTO review_votes (review_id, user_phone, vote_type) 
			VALUES ($1, $2, $3)
		`, reviewID, req.UserPhone, req.VoteType)
		
		if err != nil {
			log.Printf("❌ VoteReview: Failed to insert vote: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save vote"})
			return
		}

		// Обновляем счетчик
		if req.VoteType == "like" {
			_, err = tx.Exec(`UPDATE reviews SET likes = likes + 1 WHERE id = $1`, reviewID)
		} else {
			_, err = tx.Exec(`UPDATE reviews SET dislikes = dislikes + 1 WHERE id = $1`, reviewID)
		}
		
		if err != nil {
			log.Printf("❌ VoteReview: Failed to update counter: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vote"})
			return
		}

		if err := tx.Commit(); err != nil {
			log.Printf("❌ VoteReview: Failed to commit: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save vote"})
			return
		}

		log.Printf("✅ VoteReview: New vote added for review %d", reviewID)
		c.JSON(http.StatusOK, gin.H{"message": "Vote added", "action": "added"})
	}
}

// GetCompanyProductReviews lists every review left on a company's products,
// with the product name so the seller can see which product each review is for
// (GET /companies/:id/product-reviews). Used by the company management panel.
func GetCompanyProductReviews(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")
		rows, err := db.Query(`
			SELECT r.id, r.product_id, COALESCE(p.name, '') AS product_name,
			       r.user_phone, COALESCE(r.user_name, '') AS user_name, r.rating,
			       COALESCE(r.comment, '') AS comment, r.created_at,
			       COALESCE(u.avatar_url, '') AS user_avatar_url
			FROM reviews r
			JOIN products p ON p.id = r.product_id
			LEFT JOIN users u ON u.phone = r.user_phone
			WHERE p.company_id = $1
			ORDER BY r.created_at DESC
			LIMIT 300
		`, companyID)
		if err != nil {
			log.Printf("❌ GetCompanyProductReviews: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
			return
		}
		defer rows.Close()

		reviews := make([]gin.H, 0)
		for rows.Next() {
			var (
				id, productID                            int64
				productName, userPhone, userName, comment, avatar string
				rating                                   int
				createdAt                                string
			)
			if err := rows.Scan(&id, &productID, &productName, &userPhone, &userName, &rating, &comment, &createdAt, &avatar); err != nil {
				continue
			}
			reviews = append(reviews, gin.H{
				"id":              id,
				"productId":       productID,
				"productName":     productName,
				"userPhone":       userPhone,
				"userName":        userName,
				"rating":          rating,
				"comment":         comment,
				"createdAt":       createdAt,
				"userAvatarUrl":   avatar,
			})
		}
		c.JSON(http.StatusOK, gin.H{"reviews": reviews})
	}
}

// DeleteReview removes a product review (DELETE /reviews/:id). The seller can
// remove inappropriate reviews from their management panel — but only reviews
// on their OWN products (the admin can remove any).
func DeleteReview(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var productCompanyID sql.NullInt64
		err := db.QueryRow(`
			SELECT p.company_id FROM reviews r JOIN products p ON p.id = r.product_id
			WHERE r.id = $1
		`, c.Param("id")).Scan(&productCompanyID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Review not found"})
			return
		}
		if err == nil && !requireCompanyMatch(c, productCompanyID.Int64) {
			return
		}
		if _, err := db.Exec(`DELETE FROM reviews WHERE id = $1`, c.Param("id")); err != nil {
			log.Printf("❌ DeleteReview: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete review"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
