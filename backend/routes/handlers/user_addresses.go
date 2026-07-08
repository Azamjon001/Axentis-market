package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type deliveryAddress struct {
	ID        int      `json:"id"`
	UserPhone string   `json:"userPhone"`
	Title     *string  `json:"title"`
	Address   string   `json:"address"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	IsDefault bool     `json:"isDefault"`
	CreatedAt string   `json:"createdAt"`
}

// GetUserAddresses GET /api/users/:phone/addresses
func GetUserAddresses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		rows, err := db.Query(`
			SELECT id, user_phone, title, address, latitude, longitude, is_default, created_at
			FROM user_delivery_addresses
			WHERE user_phone = $1
			ORDER BY is_default DESC, created_at DESC`, phone)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var list []deliveryAddress
		for rows.Next() {
			var a deliveryAddress
			if err := rows.Scan(&a.ID, &a.UserPhone, &a.Title, &a.Address, &a.Latitude, &a.Longitude, &a.IsDefault, &a.CreatedAt); err != nil {
				continue
			}
			list = append(list, a)
		}
		if list == nil {
			list = []deliveryAddress{}
		}
		c.JSON(http.StatusOK, list)
	}
}

// AddUserAddress POST /api/users/:phone/addresses
func AddUserAddress(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		var req struct {
			Title     *string  `json:"title"`
			Address   string   `json:"address" binding:"required"`
			Latitude  *float64 `json:"latitude"`
			Longitude *float64 `json:"longitude"`
			IsDefault bool     `json:"isDefault"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		if req.IsDefault {
			if _, err := tx.Exec(`UPDATE user_delivery_addresses SET is_default = FALSE WHERE user_phone = $1`, phone); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		var a deliveryAddress
		err = tx.QueryRow(`
			INSERT INTO user_delivery_addresses (user_phone, title, address, latitude, longitude, is_default)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, user_phone, title, address, latitude, longitude, is_default, created_at`,
			phone, req.Title, req.Address, req.Latitude, req.Longitude, req.IsDefault,
		).Scan(&a.ID, &a.UserPhone, &a.Title, &a.Address, &a.Latitude, &a.Longitude, &a.IsDefault, &a.CreatedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, a)
	}
}

// UpdateUserAddress PUT /api/users/:phone/addresses/:id
func UpdateUserAddress(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var req struct {
			Title     *string  `json:"title"`
			Address   *string  `json:"address"`
			Latitude  *float64 `json:"latitude"`
			Longitude *float64 `json:"longitude"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var a deliveryAddress
		err = db.QueryRow(`
			UPDATE user_delivery_addresses
			SET title = COALESCE($1, title),
			    address = COALESCE($2, address),
			    latitude = COALESCE($3, latitude),
			    longitude = COALESCE($4, longitude)
			WHERE id = $5 AND user_phone = $6
			RETURNING id, user_phone, title, address, latitude, longitude, is_default, created_at`,
			req.Title, req.Address, req.Latitude, req.Longitude, id, phone,
		).Scan(&a.ID, &a.UserPhone, &a.Title, &a.Address, &a.Latitude, &a.Longitude, &a.IsDefault, &a.CreatedAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, a)
	}
}

// DeleteUserAddress DELETE /api/users/:phone/addresses/:id
func DeleteUserAddress(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		res, err := db.Exec(`DELETE FROM user_delivery_addresses WHERE id = $1 AND user_phone = $2`, id, phone)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// FrequentLocation is a delivery destination the customer uses often.
type frequentLocation struct {
	Address     string   `json:"address"`
	Coordinates string   `json:"coordinates"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	Count       int      `json:"count"`
}

// GetFrequentLocations GET /api/users/:phone/frequent-locations
// Returns up to 3 most frequently used delivery destinations for the customer,
// derived from their order history. Lets the app suggest "frequent markers".
func GetFrequentLocations(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")

		// Group delivery orders by address, prefer the most common coordinates
		// for that address, and rank by how often the customer ordered there.
		rows, err := db.Query(`
			SELECT addr,
			       (ARRAY_AGG(coords ORDER BY coords_rank DESC))[1] AS coords,
			       SUM(cnt)::INT AS total
			FROM (
				SELECT TRIM(delivery_address)        AS addr,
				       COALESCE(delivery_coordinates, '') AS coords,
				       COUNT(*)                        AS cnt,
				       COUNT(*)                        AS coords_rank
				FROM orders
				WHERE customer_phone = $1
				  AND delivery_type = 'delivery'
				  AND delivery_address IS NOT NULL
				  AND TRIM(delivery_address) <> ''
				GROUP BY TRIM(delivery_address), COALESCE(delivery_coordinates, '')
			) t
			GROUP BY addr
			ORDER BY total DESC, addr ASC
			LIMIT 3`, phone)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		list := []frequentLocation{}
		for rows.Next() {
			var loc frequentLocation
			if err := rows.Scan(&loc.Address, &loc.Coordinates, &loc.Count); err != nil {
				continue
			}
			// Parse "lat,lng" into numeric fields for convenience on the client.
			if loc.Coordinates != "" {
				parts := strings.SplitN(loc.Coordinates, ",", 2)
				if len(parts) == 2 {
					if lat, e1 := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64); e1 == nil {
						if lng, e2 := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64); e2 == nil {
							loc.Latitude = &lat
							loc.Longitude = &lng
						}
					}
				}
			}
			list = append(list, loc)
		}
		c.JSON(http.StatusOK, list)
	}
}

// SetDefaultAddress PUT /api/users/:phone/addresses/:id/default
func SetDefaultAddress(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer tx.Rollback()

		if _, err := tx.Exec(`UPDATE user_delivery_addresses SET is_default = FALSE WHERE user_phone = $1`, phone); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var a deliveryAddress
		err = tx.QueryRow(`
			UPDATE user_delivery_addresses SET is_default = TRUE
			WHERE id = $1 AND user_phone = $2
			RETURNING id, user_phone, title, address, latitude, longitude, is_default, created_at`,
			id, phone,
		).Scan(&a.ID, &a.UserPhone, &a.Title, &a.Address, &a.Latitude, &a.Longitude, &a.IsDefault, &a.CreatedAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, a)
	}
}
