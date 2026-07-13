package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ─── Регионы доставки (границы рисует админ, компании выбирают) ───────────────

// ListRegions — GET /regions. Публичный список регионов с границами (GeoJSON).
func ListRegions(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, name, COALESCE(name_uz, ''), parent_id, COALESCE(geojson::text, 'null')
			FROM regions
			ORDER BY parent_id NULLS FIRST, name
		`)
		if err != nil {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		defer rows.Close()
		out := make([]map[string]interface{}, 0)
		for rows.Next() {
			var (
				id       int64
				name     string
				nameUz   string
				parentID sql.NullInt64
				geojson  string
			)
			if err := rows.Scan(&id, &name, &nameUz, &parentID, &geojson); err != nil {
				continue
			}
			item := map[string]interface{}{
				"id":      id,
				"name":    name,
				"nameUz":  nameUz,
				"geojson": rawJSON(geojson),
			}
			if parentID.Valid {
				item["parentId"] = parentID.Int64
			}
			out = append(out, item)
		}
		c.JSON(http.StatusOK, out)
	}
}

// rawJSON оборачивает строку JSON, чтобы gin отдал её как объект, а не как строку.
func rawJSON(s string) interface{} {
	if s == "" || s == "null" {
		return nil
	}
	return json.RawMessage(s)
}

// CreateRegion — POST /regions (только админ).
func CreateRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name     string          `json:"name"`
			NameUz   string          `json:"nameUz"`
			ParentID *int64          `json:"parentId"`
			GeoJSON  json.RawMessage `json:"geojson"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
			return
		}
		var geo interface{}
		if len(req.GeoJSON) > 0 && string(req.GeoJSON) != "null" {
			geo = string(req.GeoJSON)
		}
		var id int64
		err := db.QueryRow(`
			INSERT INTO regions (name, name_uz, parent_id, geojson)
			VALUES ($1, $2, $3, $4::jsonb)
			RETURNING id
		`, req.Name, req.NameUz, req.ParentID, geo).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

// UpdateRegion — PUT /regions/:id (только админ).
func UpdateRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var req struct {
			Name    string          `json:"name"`
			NameUz  string          `json:"nameUz"`
			GeoJSON json.RawMessage `json:"geojson"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		var geo interface{}
		if len(req.GeoJSON) > 0 && string(req.GeoJSON) != "null" {
			geo = string(req.GeoJSON)
		}
		_, err = db.Exec(`
			UPDATE regions SET name = $1, name_uz = $2, geojson = $3::jsonb WHERE id = $4
		`, req.Name, req.NameUz, geo, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// DeleteRegion — DELETE /regions/:id (только админ).
func DeleteRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		_, _ = db.Exec(`DELETE FROM regions WHERE id = $1`, id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ─── Геопривязка: точка покупателя → нарисованные админом регионы ────────────
//
// Админ рисует границы (GeoJSON) в таблице regions, а компании отмечают эти
// зоны в service_regions / region_id. Покупательское приложение передаёт свои
// координаты, и мы определяем, внутри каких зон находится точка, — только так
// нарисованные границы реально влияют на выдачу товаров.

// MatchedRegion — регион, внутри границ которого находится точка.
type MatchedRegion struct {
	ID     int64
	Name   string
	NameUz string
}

// pointInRing — алгоритм «луча»: находится ли точка внутри кольца полигона.
func pointInRing(lng, lat float64, ring [][]float64) bool {
	inside := false
	n := len(ring)
	for i, j := 0, n-1; i < n; j, i = i, i+1 {
		if len(ring[i]) < 2 || len(ring[j]) < 2 {
			continue
		}
		xi, yi := ring[i][0], ring[i][1]
		xj, yj := ring[j][0], ring[j][1]
		if (yi > lat) != (yj > lat) && lng < (xj-xi)*(lat-yi)/(yj-yi)+xi {
			inside = !inside
		}
	}
	return inside
}

// pointInPolygonCoords — точка внутри внешнего кольца и вне «дырок».
func pointInPolygonCoords(lng, lat float64, poly [][][]float64) bool {
	if len(poly) == 0 || !pointInRing(lng, lat, poly[0]) {
		return false
	}
	for _, hole := range poly[1:] {
		if pointInRing(lng, lat, hole) {
			return false
		}
	}
	return true
}

// geojsonContainsPoint поддерживает Polygon/MultiPolygon, а также обёртки
// Feature/FeatureCollection/GeometryCollection — админ-панель сохраняет чистый
// Polygon, но импортированные границы могут прийти в любом из этих видов.
func geojsonContainsPoint(raw []byte, lng, lat float64) bool {
	var g struct {
		Type        string            `json:"type"`
		Coordinates json.RawMessage   `json:"coordinates"`
		Geometry    json.RawMessage   `json:"geometry"`
		Geometries  []json.RawMessage `json:"geometries"`
		Features    []json.RawMessage `json:"features"`
	}
	if err := json.Unmarshal(raw, &g); err != nil {
		return false
	}
	switch g.Type {
	case "Polygon":
		var coords [][][]float64
		if err := json.Unmarshal(g.Coordinates, &coords); err != nil {
			return false
		}
		return pointInPolygonCoords(lng, lat, coords)
	case "MultiPolygon":
		var coords [][][][]float64
		if err := json.Unmarshal(g.Coordinates, &coords); err != nil {
			return false
		}
		for _, poly := range coords {
			if pointInPolygonCoords(lng, lat, poly) {
				return true
			}
		}
	case "Feature":
		return len(g.Geometry) > 0 && geojsonContainsPoint(g.Geometry, lng, lat)
	case "FeatureCollection":
		for _, f := range g.Features {
			if geojsonContainsPoint(f, lng, lat) {
				return true
			}
		}
	case "GeometryCollection":
		for _, gg := range g.Geometries {
			if geojsonContainsPoint(gg, lng, lat) {
				return true
			}
		}
	}
	return false
}

// ResolveRegionsAtPoint возвращает регионы, чьи границы содержат точку,
// плюс их родительские регионы (точка в «Карасу» ⇒ и в родительской области).
func ResolveRegionsAtPoint(db *sql.DB, lat, lng float64) []MatchedRegion {
	rows, err := db.Query(`
		SELECT id, name, COALESCE(name_uz, ''), parent_id, COALESCE(geojson::text, '')
		FROM regions
	`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	type regionRow struct {
		MatchedRegion
		parentID sql.NullInt64
		geojson  string
	}
	all := map[int64]regionRow{}
	for rows.Next() {
		var r regionRow
		if err := rows.Scan(&r.ID, &r.Name, &r.NameUz, &r.parentID, &r.geojson); err != nil {
			continue
		}
		all[r.ID] = r
	}

	matchedIDs := map[int64]bool{}
	for id, r := range all {
		if r.geojson == "" || r.geojson == "null" {
			continue
		}
		if geojsonContainsPoint([]byte(r.geojson), lng, lat) {
			matchedIDs[id] = true
			// Поднимаемся по цепочке родителей: компания, обслуживающая
			// родительский регион, обслуживает и его подзоны.
			pid := r.parentID
			for pid.Valid {
				if matchedIDs[pid.Int64] {
					break
				}
				matchedIDs[pid.Int64] = true
				parent, ok := all[pid.Int64]
				if !ok {
					break
				}
				pid = parent.parentID
			}
		}
	}

	out := make([]MatchedRegion, 0, len(matchedIDs))
	for id := range matchedIDs {
		out = append(out, all[id].MatchedRegion)
	}
	return out
}

// ResolveRegionAtPoint — GET /regions/resolve?lat=..&lng=..
// Публичный: покупательское приложение узнаёт, в какой зоне доставки находится.
func ResolveRegionAtPoint(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		lat, errLat := strconv.ParseFloat(c.Query("lat"), 64)
		lng, errLng := strconv.ParseFloat(c.Query("lng"), 64)
		if errLat != nil || errLng != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lng are required"})
			return
		}
		matched := ResolveRegionsAtPoint(db, lat, lng)
		out := make([]map[string]interface{}, 0, len(matched))
		for _, m := range matched {
			out = append(out, map[string]interface{}{"id": m.ID, "name": m.Name, "nameUz": m.NameUz})
		}
		c.JSON(http.StatusOK, gin.H{"matched": out})
	}
}

// ─── Мост «зона админа ↔ текстовая область» ──────────────────────────────────
//
// Компании выбирают регионы доставки ДВУМЯ способами: текстовые области из
// статического списка («Андижанская область») и зоны, нарисованные админом
// («Карасу»). Покупатель же передаёт ОДНО название (ручной выбор) или точку.
// Чтобы покупатель из Карасу видел и компании, обслуживающие всю Андижанскую
// область, название зоны сопоставляется с областью по ключевым словам — тот же
// словарь, что в приложении (Homepage/src/utils/region.js).

var oblastKeywords = []struct {
	Name string
	Keys []string
}{
	{"Андижанская область", []string{"andijan", "andijon", "андижан", "asaka", "асака", "shahrixon", "shahrikhan", "shakhrikhan", "qorgontepa", "qo'rg'ontepa", "kurgontepa", "kurgantepa", "кургантепа", "qorasuv", "korasuv", "karasu", "карасу", "xonobod", "khanabad", "ханабад", "xo'jaobod", "мархамат", "marhamat", "paxtaobod", "пахтаабад"}},
	{"Бухарская область", []string{"bukhara", "buxoro", "бухар", "kogon", "когон", "g'ijduvon", "гиждуван"}},
	{"Джизакская область", []string{"jizzakh", "jizzax", "джизак", "zomin", "зомин", "заамин"}},
	{"Кашкадарьинская область", []string{"kashkadarya", "qashqadaryo", "qarshi", "karshi", "кашкадар", "карши", "shahrisabz", "шахрисабз"}},
	{"Навоийская область", []string{"navoiy", "navoi", "навои", "zarafshon", "зарафшан"}},
	{"Наманганская область", []string{"namangan", "наманган", "chust", "чуст", "pop", "поп", "chortoq", "чартак"}},
	{"Самаркандская область", []string{"samarkand", "samarqand", "самарканд", "kattaqo'rg'on", "каттакурган", "urgut", "ургут"}},
	{"Сурхандарьинская область", []string{"surkhandarya", "surxondaryo", "termez", "termiz", "сурхандар", "термез", "denov", "денау"}},
	{"Сырдарьинская область", []string{"syrdarya", "sirdaryo", "gulistan", "guliston", "сырдар", "гулистан", "yangiyer", "янгиер"}},
	{"Ферганская область", []string{"fergana", "farg'ona", "fargona", "ферган", "kokand", "qo'qon", "коканд", "margilan", "marg'ilon", "маргилан", "quvasoy", "кувасай", "rishton", "риштан"}},
	{"Хорезмская область", []string{"khorezm", "xorazm", "urgench", "urganch", "хорезм", "ургенч", "xiva", "khiva", "хива"}},
	{"Республика Каракалпакстан", []string{"karakalpak", "qoraqalpog", "nukus", "каракалпак", "нукус"}},
}

// matchOblastName возвращает каноническое название области по названию зоны
// («Карасу» → «Андижанская область»), либо "" если не распознано.
func matchOblastName(zoneName string) string {
	hay := strings.ToLower(strings.TrimSpace(zoneName))
	if hay == "" {
		return ""
	}
	if strings.Contains(hay, "tashkent") || strings.Contains(hay, "toshkent") || strings.Contains(hay, "ташкент") {
		if strings.Contains(hay, "region") || strings.Contains(hay, "viloyat") || strings.Contains(hay, "област") {
			return "Ташкентская область"
		}
		return "город Ташкент"
	}
	for _, o := range oblastKeywords {
		for _, k := range o.Keys {
			if strings.Contains(hay, k) {
				return o.Name
			}
		}
	}
	return ""
}

// ExpandBuyerRegion разворачивает регион покупателя (название зоны или области)
// в полный набор условий: id совпавших зон (для companies.region_id), их
// названия (ru и uz), названия всех родительских зон и текстовая область.
// Так покупатель из «Карасу» находит компании, выбравшие зону «Карасу»,
// родительскую зону «Андижан» или текстовую «Андижанскую область».
func ExpandBuyerRegion(db *sql.DB, buyerRegion string) (zoneIDs []int64, names []string) {
	buyerRegion = strings.TrimSpace(buyerRegion)
	if buyerRegion == "" {
		return nil, nil
	}
	seenName := map[string]bool{}
	addName := func(n string) {
		n = strings.TrimSpace(n)
		if n == "" || seenName[strings.ToLower(n)] {
			return
		}
		seenName[strings.ToLower(n)] = true
		names = append(names, n)
	}
	addName(buyerRegion)

	// Зоны админа: совпадение по ru/uz названию + подъём по цепочке родителей.
	rows, err := db.Query(`SELECT id, name, COALESCE(name_uz, ''), parent_id FROM regions`)
	if err == nil {
		defer rows.Close()
		type zone struct {
			id       int64
			name     string
			nameUz   string
			parentID sql.NullInt64
		}
		all := map[int64]zone{}
		for rows.Next() {
			var z zone
			if err := rows.Scan(&z.id, &z.name, &z.nameUz, &z.parentID); err != nil {
				continue
			}
			all[z.id] = z
		}
		lower := strings.ToLower(buyerRegion)
		seenZone := map[int64]bool{}
		for _, z := range all {
			if strings.ToLower(z.name) != lower && (z.nameUz == "" || strings.ToLower(z.nameUz) != lower) {
				continue
			}
			// сама зона + все родители
			for cur, ok := z, true; ok && !seenZone[cur.id]; {
				seenZone[cur.id] = true
				zoneIDs = append(zoneIDs, cur.id)
				addName(cur.name)
				if cur.nameUz != "" {
					addName(cur.nameUz)
				}
				if !cur.parentID.Valid {
					break
				}
				cur, ok = all[cur.parentID.Int64]
			}
		}
	}

	// Текстовая область по ключевым словам — для каждого найденного названия
	// (names уже содержит buyerRegion; снимок нужен, т.к. addName растит срез).
	for _, n := range append([]string(nil), names...) {
		if oblast := matchOblastName(n); oblast != "" {
			addName(oblast)
		}
	}
	return zoneIDs, names
}

// SetCompanyRegion — PUT /companies/:id/region. Компания выбирает свой регион.
// Используется companyId из токена (а не из пути) — компания меняет только себя.
func SetCompanyRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cid := c.GetInt64("companyId")
		if cid == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
			return
		}
		var req struct {
			RegionID *int64 `json:"regionId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		if _, err := db.Exec(`UPDATE companies SET region_id = $1 WHERE id = $2`, req.RegionID, cid); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
