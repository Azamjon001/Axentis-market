package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Broadcast chat (admin = owner, companies = members) ─────────────────────
// Хранилище — таблицы broadcast_messages / broadcast_bans (миграция 222).
// Реалтайма в проекте нет — клиенты опрашивают GET /broadcast/messages.

// broadcastSender определяет отправителя по токену: админ или конкретная компания.
func broadcastSender(db *sql.DB, c *gin.Context) (senderType string, companyID int64, name string) {
	if c.GetString("role") == "admin" {
		return "admin", 0, "Axentis"
	}
	cid := c.GetInt64("companyId")
	var n sql.NullString
	_ = db.QueryRow(`SELECT name FROM companies WHERE id = $1`, cid).Scan(&n)
	if n.String == "" {
		n.String = "Kompaniya"
	}
	return "company", cid, n.String
}

// companyBan возвращает (забанена?, до когда). Истёкший бан считается снятым.
func companyBan(db *sql.DB, companyID int64) (bool, *time.Time) {
	if companyID == 0 {
		return false, nil
	}
	var until sql.NullTime
	err := db.QueryRow(`SELECT banned_until FROM broadcast_bans WHERE company_id = $1`, companyID).Scan(&until)
	if err != nil {
		return false, nil // нет записи — не забанен
	}
	if !until.Valid {
		return true, nil // навсегда
	}
	if until.Time.After(time.Now()) {
		t := until.Time
		return true, &t
	}
	return false, nil // срок вышел
}

func broadcastMessageJSON(
	id int64, senderType string, senderCompanyID sql.NullInt64, senderName, mtype, content string,
	mediaURL sql.NullString, edited, deleted bool, createdAt time.Time,
) map[string]interface{} {
	m := map[string]interface{}{
		"id":         id,
		"senderType": senderType,
		"senderName": senderName,
		"type":       mtype,
		"content":    content,
		"edited":     edited,
		"deleted":    deleted,
		"createdAt":  createdAt,
	}
	if senderCompanyID.Valid {
		m["senderCompanyId"] = senderCompanyID.Int64
	}
	if mediaURL.Valid {
		m["mediaUrl"] = mediaURL.String
	}
	return m
}

// GetBroadcastMessages — GET /broadcast/messages?limit=
// Возвращает последние сообщения (по возрастанию) и статус бана текущей компании.
func GetBroadcastMessages(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 100
		if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 && v <= 300 {
			limit = v
		}
		rows, err := db.Query(`
			SELECT id, sender_type, sender_company_id, sender_name, type, content,
			       media_url, edited, deleted, created_at
			FROM (
				SELECT * FROM broadcast_messages ORDER BY id DESC LIMIT $1
			) t
			ORDER BY id ASC
		`, limit)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"messages": []interface{}{}})
			return
		}
		defer rows.Close()

		messages := make([]map[string]interface{}, 0)
		for rows.Next() {
			var (
				id              int64
				senderType      string
				senderCompanyID sql.NullInt64
				senderName      string
				mtype, content  string
				mediaURL        sql.NullString
				edited, deleted bool
				createdAt       time.Time
			)
			if err := rows.Scan(&id, &senderType, &senderCompanyID, &senderName, &mtype,
				&content, &mediaURL, &edited, &deleted, &createdAt); err != nil {
				continue
			}
			messages = append(messages, broadcastMessageJSON(id, senderType, senderCompanyID,
				senderName, mtype, content, mediaURL, edited, deleted, createdAt))
		}

		_, cid, _ := broadcastSender(db, c)
		banned, until := companyBan(db, cid)
		resp := gin.H{"messages": messages, "myBanned": banned}
		if banned && until != nil {
			resp["myBanUntil"] = until.UTC().Format(time.RFC3339)
		}
		c.JSON(http.StatusOK, resp)
	}
}

// SendBroadcastMessage — POST /broadcast/messages
func SendBroadcastMessage(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Type     string `json:"type"`
			Content  string `json:"content"`
			MediaURL string `json:"mediaUrl"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		switch req.Type {
		case "text", "image", "voice", "link":
		default:
			req.Type = "text"
		}
		if strings.TrimSpace(req.Content) == "" && req.MediaURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "empty message"})
			return
		}

		senderType, cid, name := broadcastSender(db, c)
		if senderType == "company" {
			if banned, _ := companyBan(db, cid); banned {
				c.JSON(http.StatusForbidden, gin.H{"error": "banned"})
				return
			}
		}

		var (
			id        int64
			createdAt time.Time
		)
		var companyArg interface{}
		if cid != 0 {
			companyArg = cid
		}
		var media interface{}
		if req.MediaURL != "" {
			media = req.MediaURL
		}
		err := db.QueryRow(`
			INSERT INTO broadcast_messages (sender_type, sender_company_id, sender_name, type, content, media_url)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, created_at
		`, senderType, companyArg, name, req.Type, req.Content, media).Scan(&id, &createdAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send"})
			return
		}

		nc := sql.NullInt64{Int64: cid, Valid: cid != 0}
		nm := sql.NullString{String: req.MediaURL, Valid: req.MediaURL != ""}
		c.JSON(http.StatusCreated, broadcastMessageJSON(id, senderType, nc, name, req.Type, req.Content, nm, false, false, createdAt))
	}
}

// EditBroadcastMessage — PUT /broadcast/messages/:id  (только текст; своё или любое для админа)
func EditBroadcastMessage(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var req struct {
			Content string `json:"content"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Content) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "empty content"})
			return
		}

		isAdmin := c.GetString("role") == "admin"
		cid := c.GetInt64("companyId")

		// Проверяем владельца и тип сообщения.
		var ownerType string
		var ownerCompany sql.NullInt64
		var mtype string
		if err := db.QueryRow(`SELECT sender_type, sender_company_id, type FROM broadcast_messages WHERE id = $1 AND deleted = FALSE`, id).
			Scan(&ownerType, &ownerCompany, &mtype); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if mtype != "text" && mtype != "link" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "only text can be edited"})
			return
		}
		if !isAdmin && (ownerType != "company" || !ownerCompany.Valid || ownerCompany.Int64 != cid) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not your message"})
			return
		}

		_, err = db.Exec(`UPDATE broadcast_messages SET content = $1, edited = TRUE, edited_at = NOW() WHERE id = $2`, req.Content, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// DeleteBroadcastMessage — DELETE /broadcast/messages/:id (своё или любое для админа)
func DeleteBroadcastMessage(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		isAdmin := c.GetString("role") == "admin"
		cid := c.GetInt64("companyId")

		var ownerType string
		var ownerCompany sql.NullInt64
		if err := db.QueryRow(`SELECT sender_type, sender_company_id FROM broadcast_messages WHERE id = $1`, id).
			Scan(&ownerType, &ownerCompany); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if !isAdmin && (ownerType != "company" || !ownerCompany.Valid || ownerCompany.Int64 != cid) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not your message"})
			return
		}
		if _, err := db.Exec(`UPDATE broadcast_messages SET deleted = TRUE, content = '', media_url = NULL WHERE id = $1`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// UploadBroadcastMedia — POST /broadcast/upload (image | voice), поле "file".
func UploadBroadcastMedia(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no file"})
			return
		}
		ext := strings.ToLower(filepath.Ext(file.Filename))
		switch ext {
		case ".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif",
			".mp3", ".m4a", ".aac", ".ogg", ".oga", ".webm", ".wav":
		default:
			ext = ".bin"
		}
		dir := "./uploads/broadcast"
		os.MkdirAll(dir, 0755)
		filename := fmt.Sprintf("bc_%d%s", time.Now().UnixNano(), ext)
		if err := c.SaveUploadedFile(file, filepath.Join(dir, filename)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"url": "/uploads/broadcast/" + filename})
	}
}

// BanBroadcastCompany — POST /broadcast/ban  body {companyId, minutes} (minutes<=0 => навсегда). Только админ.
func BanBroadcastCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID int64  `json:"companyId"`
			Minutes   int    `json:"minutes"`
			Reason    string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.CompanyID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "companyId required"})
			return
		}
		var until interface{}
		if req.Minutes > 0 {
			until = time.Now().Add(time.Duration(req.Minutes) * time.Minute)
		}
		_, err := db.Exec(`
			INSERT INTO broadcast_bans (company_id, banned_until, reason)
			VALUES ($1, $2, $3)
			ON CONFLICT (company_id) DO UPDATE SET banned_until = $2, reason = $3, created_at = NOW()
		`, req.CompanyID, until, req.Reason)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// UnbanBroadcastCompany — DELETE /broadcast/ban/:companyId. Только админ.
func UnbanBroadcastCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cid, err := strconv.ParseInt(c.Param("companyId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		_, _ = db.Exec(`DELETE FROM broadcast_bans WHERE company_id = $1`, cid)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ListBroadcastBans — GET /broadcast/bans. Только админ.
func ListBroadcastBans(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT b.company_id, COALESCE(c.name, ''), b.banned_until, COALESCE(b.reason, '')
			FROM broadcast_bans b
			LEFT JOIN companies c ON c.id = b.company_id
			ORDER BY b.created_at DESC
		`)
		if err != nil {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		defer rows.Close()
		out := make([]map[string]interface{}, 0)
		for rows.Next() {
			var (
				cid    int64
				name   string
				until  sql.NullTime
				reason string
			)
			if err := rows.Scan(&cid, &name, &until, &reason); err != nil {
				continue
			}
			item := map[string]interface{}{"companyId": cid, "companyName": name, "reason": reason, "forever": !until.Valid}
			if until.Valid {
				item["bannedUntil"] = until.Time.UTC().Format(time.RFC3339)
			}
			out = append(out, item)
		}
		c.JSON(http.StatusOK, out)
	}
}
