package handlers

import (
	"regexp"
	"testing"

	"azaton-backend/config"
)

func TestGenerateOTPCode(t *testing.T) {
	re := regexp.MustCompile(`^\d{6}$`)
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		code := generateOTPCode()
		if !re.MatchString(code) {
			t.Fatalf("generateOTPCode() = %q, want 6 digits", code)
		}
		seen[code] = true
	}
	// 200 кодов не должны совпасть все до одного — иначе генератор сломан.
	if len(seen) < 100 {
		t.Errorf("too many duplicate codes: %d unique out of 200", len(seen))
	}
}

func TestHashOTPDeterministic(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret"}
	h1 := hashOTP(cfg, "998901234567", "123456")
	h2 := hashOTP(cfg, "998901234567", "123456")
	if h1 != h2 {
		t.Error("same phone+code must hash identically")
	}
	if h1 == hashOTP(cfg, "998901234567", "654321") {
		t.Error("different codes must hash differently")
	}
	if h1 == hashOTP(cfg, "998907654321", "123456") {
		t.Error("different phones must hash differently")
	}
	if len(h1) != 64 { // hex(sha256)
		t.Errorf("hash length = %d, want 64", len(h1))
	}
}
