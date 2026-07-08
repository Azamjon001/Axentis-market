package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// AskQuestion lets a customer post a question about a product (POST /products/:id/questions).
func AskQuestion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")
		var req struct {
			UserPhone string `json:"userPhone"`
			UserName  string `json:"userName"`
			Question  string `json:"question"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.Question == "" || req.UserPhone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userPhone and question are required"})
			return
		}

		// Derive the owning company from the product so the seller can be notified.
		var companyID sql.NullInt64
		db.QueryRow(`SELECT company_id FROM products WHERE id = $1`, productID).Scan(&companyID)

		var id int64
		err := db.QueryRow(`
			INSERT INTO product_questions (product_id, company_id, user_phone, user_name, question)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, productID, companyID, req.UserPhone, req.UserName, req.Question).Scan(&id)
		if err != nil {
			log.Printf("❌ AskQuestion: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to post question"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
	}
}

// GetProductQuestions lists questions for a product (GET /products/:id/questions).
func GetProductQuestions(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Приватность: вопрос виден только автору. Если передан user_phone —
		// возвращаем только его вопросы. Без параметра (панель продавца) — все.
		phone := c.Query("user_phone")
		var rows *sql.Rows
		var err error
		if phone != "" {
			rows, err = db.Query(`
				SELECT id, COALESCE(user_name, ''), question, COALESCE(answer, ''),
				       COALESCE(answered_by, ''), is_answered, created_at, answered_at
				FROM product_questions
				WHERE product_id = $1 AND user_phone = $2
				ORDER BY created_at DESC
			`, c.Param("id"), phone)
		} else {
			rows, err = db.Query(`
				SELECT id, COALESCE(user_name, ''), question, COALESCE(answer, ''),
				       COALESCE(answered_by, ''), is_answered, created_at, answered_at
				FROM product_questions
				WHERE product_id = $1
				ORDER BY created_at DESC
			`, c.Param("id"))
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch questions"})
			return
		}
		defer rows.Close()

		list := make([]gin.H, 0)
		for rows.Next() {
			var (
				id                                  int64
				userName, question, answer, answBy  string
				isAnswered                          bool
				createdAt                           time.Time
				answeredAt                          sql.NullTime
			)
			if err := rows.Scan(&id, &userName, &question, &answer, &answBy, &isAnswered, &createdAt, &answeredAt); err != nil {
				continue
			}
			item := gin.H{
				"id": id, "userName": userName, "question": question, "answer": answer,
				"answeredBy": answBy, "isAnswered": isAnswered, "createdAt": createdAt,
			}
			if answeredAt.Valid {
				item["answeredAt"] = answeredAt.Time
			}
			list = append(list, item)
		}
		c.JSON(http.StatusOK, list)
	}
}

// AnswerQuestion lets the seller answer a question (POST /questions/:id/answer).
func AnswerQuestion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Answer     string `json:"answer"`
			AnsweredBy string `json:"answeredBy"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.Answer == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "answer is required"})
			return
		}
		res, err := db.Exec(`
			UPDATE product_questions
			SET answer = $1, answered_by = $2, is_answered = TRUE, answered_at = NOW()
			WHERE id = $3
		`, req.Answer, req.AnsweredBy, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save answer"})
			return
		}
		if affected, _ := res.RowsAffected(); affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// DeleteQuestion removes a question (DELETE /questions/:id).
func DeleteQuestion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM product_questions WHERE id = $1`, c.Param("id")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete question"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
