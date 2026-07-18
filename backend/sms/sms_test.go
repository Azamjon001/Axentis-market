package sms

import "testing"

func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"901234567", "998901234567"},         // локальный формат → 998-префикс
		{"+998 90 123 45 67", "998901234567"}, // отформатированный ввод
		{"998901234567", "998901234567"},      // уже нормализованный
		{"(90) 123-45-67", "998901234567"},    // скобки/дефисы
		{"", ""},                              // пусто
		{"12345", "12345"},                    // слишком короткий — как есть
	}
	for _, c := range cases {
		if got := NormalizePhone(c.in); got != c.want {
			t.Errorf("NormalizePhone(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestSenderFallsBackToDev(t *testing.T) {
	// Без настроенных провайдеров сообщение уходит в dev-канал (лог), без ошибки.
	s := NewSender(nil, "", "", "", "")
	channel, err := s.Send("901234567", "test")
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if channel != "dev" {
		t.Errorf("channel = %q, want \"dev\"", channel)
	}
}
