package security

import "testing"

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := "a-test-encryption-key"
	plaintext := "4111111111111234"

	enc, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}
	if enc == plaintext {
		t.Fatal("ciphertext must not equal plaintext")
	}

	dec, err := Decrypt(key, enc)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}
	if dec != plaintext {
		t.Fatalf("round-trip mismatch: got %q want %q", dec, plaintext)
	}
}

func TestEncryptUsesRandomNonce(t *testing.T) {
	key := "k"
	a, _ := Encrypt(key, "secret")
	b, _ := Encrypt(key, "secret")
	if a == b {
		t.Fatal("encrypting the same value twice should produce different ciphertexts")
	}
}

func TestDecryptWithWrongKeyFails(t *testing.T) {
	enc, _ := Encrypt("right-key", "secret")
	if _, err := Decrypt("wrong-key", enc); err == nil {
		t.Fatal("decrypting with the wrong key must fail")
	}
}

func TestEmptyKeyRejected(t *testing.T) {
	if _, err := Encrypt("", "x"); err == nil {
		t.Fatal("empty key must be rejected")
	}
}
