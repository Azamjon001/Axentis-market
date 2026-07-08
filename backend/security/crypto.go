// Package security provides small cryptographic helpers for protecting
// sensitive data at rest (e.g. stored card numbers).
package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
)

// deriveKey turns an arbitrary-length key string into a fixed 32-byte AES-256
// key via SHA-256, so operators can use any passphrase as CARD_ENCRYPTION_KEY.
func deriveKey(key string) []byte {
	sum := sha256.Sum256([]byte(key))
	return sum[:]
}

// Encrypt encrypts plaintext with AES-256-GCM and returns base64(nonce|ciphertext).
// Each call uses a fresh random nonce, so encrypting the same value twice
// yields different ciphertexts.
func Encrypt(key, plaintext string) (string, error) {
	if key == "" {
		return "", errors.New("empty encryption key")
	}
	block, err := aes.NewCipher(deriveKey(key))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt reverses Encrypt. It is provided for future use (e.g. when a real
// payment integration needs the full number); the card storage path itself
// only ever writes encrypted data.
func Decrypt(key, encoded string) (string, error) {
	if key == "" {
		return "", errors.New("empty encryption key")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(deriveKey(key))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(data) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
