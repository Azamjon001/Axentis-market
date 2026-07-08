package handlers

import (
	"image"
	"image/jpeg"
	_ "image/png" // регистрируем PNG-декодер
	"log"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"
)

// maxImageDim — максимальная сторона сохраняемого изображения. Фото товара
// шире этого не нужно (детали видны и при зуме), а вес падает в разы.
const maxImageDim = 1280

// jpegQuality — качество перекодирования. 82 — визуально «как оригинал»,
// но файл в 10–20 раз меньше телефонного снимка.
const jpegQuality = 82

// optimizeImage уменьшает и пережимает изображение НА МЕСТЕ (перезаписывает
// файл). Телефонное фото ~3–8 МБ превращается в ~100–200 КБ JPEG, поэтому
// витрина открывается в разы быстрее и экономит трафик покупателю.
//
// Безопасно: при любой ошибке (не картинка, экзотический формат, сбой)
// оригинал остаётся нетронутым — загрузка товара никогда не падает из-за
// оптимизации.
func optimizeImage(path string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ optimizeImage panic on %s: %v (original kept)", path, r)
		}
	}()

	ext := strings.ToLower(filepath.Ext(path))
	// Анимированные GIF и SVG не трогаем (перекодирование их сломает).
	if ext == ".gif" || ext == ".svg" || ext == ".webp" {
		return
	}

	f, err := os.Open(path)
	if err != nil {
		return
	}
	src, _, err := image.Decode(f)
	f.Close()
	if err != nil {
		return // не изображение или неподдерживаемый формат — оставляем как есть
	}

	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w == 0 || h == 0 {
		return
	}

	// Считаем целевой размер с сохранением пропорций.
	nw, nh := w, h
	if w > maxImageDim || h > maxImageDim {
		if w >= h {
			nw = maxImageDim
			nh = int(float64(h) * float64(maxImageDim) / float64(w))
		} else {
			nh = maxImageDim
			nw = int(float64(w) * float64(maxImageDim) / float64(h))
		}
	}

	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	// CatmullRom — качественная интерполяция (плавно, без «лесенки»).
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)

	// Пишем во временный файл рядом, затем атомарно заменяем оригинал —
	// чтобы при сбое записи не остаться с «полуфайлом».
	tmp := path + ".opt"
	out, err := os.Create(tmp)
	if err != nil {
		return
	}
	if err := jpeg.Encode(out, dst, &jpeg.Options{Quality: jpegQuality}); err != nil {
		out.Close()
		os.Remove(tmp)
		return
	}
	out.Close()

	// Заменяем оригинал оптимизированной версией только если она реально меньше.
	if oldInfo, e1 := os.Stat(path); e1 == nil {
		if newInfo, e2 := os.Stat(tmp); e2 == nil && newInfo.Size() < oldInfo.Size() {
			if err := os.Rename(tmp, path); err != nil {
				os.Remove(tmp)
			}
			return
		}
	}
	os.Remove(tmp) // оптимизация не уменьшила файл — оставляем оригинал
}
