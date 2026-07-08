package handlers

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

var (
	firebaseApp     *firebase.App
	firebaseClient  *messaging.Client
	firebaseInitErr error
	firebaseOnce    sync.Once
)

// InitFirebase - инициализация Firebase Admin SDK (вызывается один раз)
func InitFirebase() (*messaging.Client, error) {
	firebaseOnce.Do(func() {
		// Путь к JSON файлу с ключом
		credPath := "./firebase-admin-sdk.json"
		
		// Проверяем наличие файла
		if _, err := os.Stat(credPath); os.IsNotExist(err) {
			log.Printf("⚠️ Firebase Admin SDK key file not found: %s", credPath)
			log.Printf("📝 Push notifications will use Expo Push API as fallback")
			firebaseInitErr = fmt.Errorf("firebase key file not found")
			return
		}

		opt := option.WithCredentialsFile(credPath)
		
		ctx := context.Background()
		app, err := firebase.NewApp(ctx, nil, opt)
		if err != nil {
			log.Printf("❌ Firebase Admin SDK initialization error: %v", err)
			firebaseInitErr = err
			return
		}

		client, err := app.Messaging(ctx)
		if err != nil {
			log.Printf("❌ Firebase Messaging client error: %v", err)
			firebaseInitErr = err
			return
		}

		firebaseApp = app
		firebaseClient = client
		log.Printf("✅ Firebase Admin SDK initialized successfully")
	})

	return firebaseClient, firebaseInitErr
}

// SendFCMPushNotification - отправить FCM уведомление через Firebase Admin SDK
func SendFCMPushNotification(tokens []string, title, body string) (int, error) {
	// Инициализируем Firebase (только первый раз)
	client, err := InitFirebase()
	
	// Если Firebase не настроен - используем Expo Push API как fallback
	if err != nil {
		log.Printf("⚠️ Firebase not available, using Expo Push API")
		return SendExpoPushNotification(tokens, title, body)
	}

	if len(tokens) == 0 {
		log.Printf("⚠️ No FCM tokens provided")
		return 0, nil
	}

	log.Printf("📲 Processing %d push tokens (FCM/Expo detection)", len(tokens))

	ctx := context.Background()
	successCount := 0
	fcmCount := 0
	expoCount := 0

	for _, token := range tokens {
		if token == "" {
			continue
		}

		// Определяем тип токена: FCM или Expo
		isFCMToken := !isExpoToken(token)

		if isFCMToken {
			fcmCount++
			// Отправляем через Firebase Admin SDK
			message := &messaging.Message{
				Token: token,
				Notification: &messaging.Notification{
					Title: title,
					Body:  body,
				},
				Data: map[string]string{
					"type":  "admin_message",
					"title": title,
					"body":  body,
				},
				Android: &messaging.AndroidConfig{
					Priority: "high",
					Notification: &messaging.AndroidNotification{
						Title:        title,
						Body:         body,
						Sound:        "default",
						ChannelID:    "default",
						Color:        "#FF6B00",
						Icon:         "@mipmap/ic_launcher",
						Priority:     messaging.PriorityHigh,
						DefaultSound: true,
					},
				},
			}

			response, err := client.Send(ctx, message)
			if err != nil {
				log.Printf("❌ FCM send error for token %s: %v", token[:min(20, len(token))]+"...", err)
				continue
			}

			successCount++
			log.Printf("✅ FCM notification sent: %s (token: %s)", response, token[:min(20, len(token))]+"...")
		} else {
			expoCount++
			log.Printf("📱 Expo token detected: %s...", token[:min(30, len(token))])
			// Отправляем через Expo Push API
			_, err := SendExpoPushNotification([]string{token}, title, body)
			if err == nil {
				successCount++
			}
		}
	}

	log.Printf("📊 Push notifications summary: %d total, %d FCM, %d Expo, %d successful", 
		len(tokens), fcmCount, expoCount, successCount)
	return successCount, nil
}

// isExpoToken - проверяет, является ли токен Expo Push Token
func isExpoToken(token string) bool {
	return len(token) > 18 && (token[:18] == "ExponentPushToken[" || token[:12] == "ExpoPushToken[")
}
