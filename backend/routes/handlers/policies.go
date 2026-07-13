package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Политика конфиденциальности ──────────────────────────────────────────────
//
// Два отдельных документа: для покупателей (audience = "customer") и для
// компаний-продавцов (audience = "company"). Тексты хранятся в БД и
// редактируются админом (условия и ставки со временем меняются). При каждом
// изменении версия растёт, а принятие пользователем фиксируется в
// policy_acceptances — документальное подтверждение согласия.

const defaultCustomerPolicyRU = `ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ ДЛЯ ПОКУПАТЕЛЕЙ

1. ОБЩИЕ ПОЛОЖЕНИЯ
Axentis Market — торговая платформа, соединяющая покупателей с компаниями-продавцами. Регистрируясь и отмечая согласие с настоящей политикой, вы принимаете описанные ниже условия обработки данных и правила пользования сервисом.

2. КАКИЕ ДАННЫЕ МЫ СОБИРАЕМ
— Имя, фамилия и номер телефона (используется как логин);
— Адреса доставки и координаты, которые вы указываете при оформлении заказа;
— Геолокация устройства (только для определения вашего региона доставки и показа товаров компаний, работающих в нём);
— История заказов, возвратов, избранное и просмотренные товары (для работы сервиса и рекомендаций);
— Токен push-уведомлений (для сообщений о статусе заказа).

3. КАК МЫ ИСПОЛЬЗУЕМ ДАННЫЕ
— Оформление, доставка и сопровождение ваших заказов;
— Уведомления о статусе заказа, ответах на вопросы и возвратах;
— Персональные рекомендации товаров;
— Контроль честности сервиса: мы отслеживаем заказы на предмет ложных и мошеннических заказов, чтобы защитить и покупателей, и продавцов.

4. КТО ИМЕЕТ ДОСТУП К ВАШИМ ДАННЫМ
— Компания-продавец видит только данные, необходимые для выполнения вашего заказа: имя, телефон, адрес доставки и состав заказа;
— Администрация платформы имеет доступ к аналитике и истории заказов для работы сервиса и разбора спорных ситуаций, но НЕ имеет доступа к вашему паролю;
— Пароли хранятся только в зашифрованном виде (bcrypt) и не видны никому, включая администрацию;
— Ваши данные не продаются и не передаются третьим лицам, за исключением случаев, предусмотренных законом.

5. БЕЗОПАСНОСТЬ
Доступ к аккаунту защищён паролем и токенами авторизации. Передача данных ведётся по защищённому соединению. Вы обязаны не передавать свой пароль третьим лицам.

6. ЧТО ЗАПРЕЩЕНО
— Оформление ложных (фиктивных) заказов и злоупотребление возвратами;
— Мошенничество в любой форме, попытки обмана продавцов или платформы;
— Оскорбления и недостоверная информация в отзывах и вопросах;
— Попытки несанкционированного доступа к чужим аккаунтам или системам платформы.

7. ОТВЕТСТВЕННОСТЬ И МЕРЫ
При нарушении правил платформа вправе: вынести предупреждение; ограничить отдельные функции (например, оформление заказов); заблокировать аккаунт. При признаках мошенничества данные могут быть переданы правоохранительным органам в порядке, установленном законом.

8. ИЗМЕНЕНИЯ ПОЛИТИКИ
Платформа может обновлять настоящую политику. Актуальная редакция всегда доступна в приложении. Продолжая пользоваться сервисом после обновления, вы соглашаетесь с новой редакцией.

9. СОГЛАСИЕ
Отмечая галочку при регистрации, вы подтверждаете, что ознакомились с настоящей политикой и принимаете её условия.`

const defaultCustomerPolicyUZ = `XARIDORLAR UCHUN MAXFIYLIK SIYOSATI

1. UMUMIY QOIDALAR
Axentis Market — xaridorlarni sotuvchi kompaniyalar bilan bogʻlovchi savdo platformasi. Roʻyxatdan oʻtib, ushbu siyosatga rozilik belgisini qoʻyish orqali siz quyida bayon etilgan shartlarni qabul qilasiz.

2. QANDAY MAʼLUMOTLAR YIGʻILADI
— Ism, familiya va telefon raqami (login sifatida ishlatiladi);
— Buyurtma rasmiylashtirishda koʻrsatilgan yetkazib berish manzillari;
— Qurilma geolokatsiyasi (faqat hududingizni aniqlash va oʻsha hududda ishlaydigan kompaniyalar tovarlarini koʻrsatish uchun);
— Buyurtmalar, qaytarishlar tarixi, sevimlilar va koʻrilgan tovarlar;
— Push-bildirishnomalar tokeni.

3. MAʼLUMOTLARDAN FOYDALANISH
— Buyurtmalarni rasmiylashtirish va yetkazib berish;
— Buyurtma holati haqida bildirishnomalar;
— Shaxsiy tavsiyalar;
— Halollik nazorati: soxta va firibgar buyurtmalarni aniqlash uchun buyurtmalar kuzatiladi.

4. MAʼLUMOTLARGA KIMLAR KIRA OLADI
— Sotuvchi kompaniya faqat buyurtmani bajarish uchun kerakli maʼlumotlarni koʻradi: ism, telefon, manzil va buyurtma tarkibi;
— Platforma maʼmuriyati xizmat ishlashi uchun analitika va buyurtmalar tarixiga kira oladi, lekin parolingizga kira OLMAYDI;
— Parollar faqat shifrlangan holda saqlanadi va hech kimga koʻrinmaydi;
— Maʼlumotlaringiz uchinchi shaxslarga sotilmaydi.

5. XAVFSIZLIK
Hisobingiz parol va avtorizatsiya tokenlari bilan himoyalangan. Parolingizni boshqalarga bermang.

6. NIMA TAQIQLANADI
— Soxta buyurtmalar va qaytarishlarni suiisteʼmol qilish;
— Har qanday firibgarlik;
— Sharh va savollarda haqorat va yolgʻon maʼlumot;
— Boshqa hisoblarga ruxsatsiz kirishga urinish.

7. JAVOBGARLIK
Qoidalar buzilganda platforma ogohlantirish berishi, funksiyalarni cheklashi yoki hisobni bloklashi mumkin. Firibgarlik belgilari aniqlansa, maʼlumotlar qonunda belgilangan tartibda huquqni muhofaza qilish organlariga berilishi mumkin.

8. OʻZGARISHLAR
Platforma ushbu siyosatni yangilashi mumkin. Amaldagi tahrir har doim ilovada mavjud.

9. ROZILIK
Roʻyxatdan oʻtishda belgi qoʻyish orqali siz ushbu siyosat bilan tanishganingizni va uni qabul qilganingizni tasdiqlaysiz.`

const defaultCompanyPolicyRU = `ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ И УСЛОВИЯ ДЛЯ КОМПАНИЙ-ПРОДАВЦОВ

1. ОБЩИЕ ПОЛОЖЕНИЯ
Настоящий документ регулирует отношения между платформой Axentis Market и компанией-продавцом. Входя в панель компании и отмечая согласие, вы принимаете описанные условия.

2. УЧЁТНЫЕ ДАННЫЕ И ИХ ЗАЩИТА
— Аккаунт компании (телефон-логин, пароль, 30-значный ключ доступа, код приватного режима) создаётся администрацией и передаётся владельцу компании;
— После выдачи учётные данные СКРЫТЫ от администрации: админ-панель не отображает ваши пароль, ключ доступа, код и номер-логин. Администрация может только задать новые значения по вашему запросу (например, при утере);
— Пароли хранятся в зашифрованном виде (bcrypt);
— Компания обязана не передавать учётные данные третьим лицам.

3. К ЧЕМУ ИМЕЕТ ДОСТУП ПЛАТФОРМА
Для работы сервиса и контроля честности администрация имеет доступ к:
— аналитике продаж вашей компании;
— истории заказов и возвратов;
— данным склада и каталога товаров;
— статистике выводов средств и комиссии.
Этот доступ используется для сопровождения сервиса, разбора споров и отслеживания ложных заказов. Администрация НЕ имеет доступа к вашим учётным данным (пароль, ключи, коды).

4. ОНЛАЙН-ПЛАТЕЖИ, КОМИССИЯ И ВЫВОД СРЕДСТВ
— Оплаты покупателей банковскими картами поступают на счёт платформы;
— С каждой онлайн-продажи удерживается комиссия платформы по индивидуальной ставке вашего договора (ставка отображается в панели и может изменяться по соглашению сторон с уведомлением);
— Заработанные средства за вычетом комиссии доступны к выводу на банковскую карту/счёт компании через раздел «Вывод средств»;
— Система в реальном времени рассчитывает доступный остаток: онлайн-выручка минус комиссия минус уже выведенные и находящиеся в обработке суммы;
— Перед выводом реквизиты получателя проверяются; выплата отмечается выполненной только после фактического подтверждения перевода.

5. ОБЯЗАННОСТИ ПРОДАВЦА
— Указывать достоверную информацию о товарах, ценах и остатках;
— Своевременно обрабатывать заказы и заявки на возврат;
— Не продавать запрещённые законом товары и подделки;
— Соблюдать заявленные условия доставки и возврата.

6. ЧТО ЗАПРЕЩЕНО
— Накрутка продаж, рейтингов и фиктивные заказы;
— Манипуляции с ценами и вводящие в заблуждение скидки;
— Использование платформы для незаконной деятельности;
— Попытки обхода комиссии платформы.

7. ОТВЕТСТВЕННОСТЬ И МЕРЫ
При нарушении условий платформа вправе: вынести предупреждение; временно приостановить работу компании (товары скрываются из каталога); удалить компанию с платформы. При мошенничестве с онлайн-платежами выплаты могут быть заморожены до завершения разбирательства, а материалы переданы правоохранительным органам.

8. ИЗМЕНЕНИЯ УСЛОВИЙ
Ставка комиссии и текст настоящих условий могут обновляться. Актуальная редакция всегда доступна в панели компании; о существенных изменениях платформа уведомляет заранее.

9. СОГЛАСИЕ
Отмечая галочку при входе в панель компании, вы подтверждаете, что ознакомились с условиями и принимаете их от имени компании.`

const defaultCompanyPolicyUZ = `SOTUVCHI KOMPANIYALAR UCHUN MAXFIYLIK SIYOSATI VA SHARTLAR

1. UMUMIY QOIDALAR
Ushbu hujjat Axentis Market platformasi va sotuvchi kompaniya oʻrtasidagi munosabatlarni tartibga soladi. Kompaniya paneliga kirib, rozilik belgisini qoʻyish orqali siz shartlarni qabul qilasiz.

2. HISOB MAʼLUMOTLARI VA ULARNING HIMOYASI
— Kompaniya hisobi (telefon-login, parol, 30 xonali kirish kaliti, maxfiy rejim kodi) maʼmuriyat tomonidan yaratilib, kompaniya egasiga topshiriladi;
— Topshirilgandan soʻng hisob maʼlumotlari maʼmuriyatdan YASHIRILADI: admin-panel parol, kalit, kod va login-raqamingizni koʻrsatmaydi. Maʼmuriyat faqat soʻrovingiz boʻyicha yangi qiymat oʻrnatishi mumkin;
— Parollar shifrlangan holda saqlanadi;
— Hisob maʼlumotlarini uchinchi shaxslarga berish taqiqlanadi.

3. PLATFORMA NIMALARGA KIRA OLADI
Xizmat ishlashi va halollik nazorati uchun maʼmuriyat quyidagilarga kira oladi:
— kompaniyangiz savdo analitikasi;
— buyurtmalar va qaytarishlar tarixi;
— ombor va katalog maʼlumotlari;
— pul yechish statistikasi va komissiya.
Maʼmuriyat hisob maʼlumotlaringizga (parol, kalit, kod) kira OLMAYDI.

4. ONLAYN TOʻLOVLAR, KOMISSIYA VA PUL YECHISH
— Xaridorlarning karta orqali toʻlovlari platforma hisobiga tushadi;
— Har bir onlayn savdodan shartnomangizdagi individual stavka boʻyicha platforma komissiyasi ushlab qolinadi (stavka panelda koʻrsatiladi va tomonlar kelishuvi bilan oʻzgarishi mumkin);
— Komissiya ayirilgan mablagʻni «Pul yechish» boʻlimi orqali kompaniya kartasi/hisobiga chiqarish mumkin;
— Tizim mavjud qoldiqni real vaqtda hisoblaydi: onlayn tushum minus komissiya minus yechilgan va jarayondagi summalar;
— Yechishdan oldin oluvchi rekvizitlari tekshiriladi; toʻlov faqat haqiqiy oʻtkazma tasdiqlangandan soʻng bajarilgan deb belgilanadi.

5. SOTUVCHI MAJBURIYATLARI
— Tovarlar, narxlar va qoldiqlar haqida toʻgʻri maʼlumot berish;
— Buyurtma va qaytarish arizalarini oʻz vaqtida koʻrib chiqish;
— Taqiqlangan tovarlar va qalbaki mahsulotlarni sotmaslik.

6. NIMA TAQIQLANADI
— Savdo va reytinglarni sunʼiy oshirish, soxta buyurtmalar;
— Narxlar bilan manipulyatsiya;
— Platformadan noqonuniy faoliyat uchun foydalanish;
— Platforma komissiyasini chetlab oʻtishga urinish.

7. JAVOBGARLIK
Shartlar buzilganda platforma ogohlantirish berishi, kompaniya faoliyatini vaqtincha toʻxtatishi yoki kompaniyani oʻchirishi mumkin. Onlayn toʻlovlarda firibgarlik aniqlansa, toʻlovlar tekshiruv tugagunga qadar muzlatiladi.

8. SHARTLAR OʻZGARISHI
Komissiya stavkasi va ushbu shartlar yangilanishi mumkin. Amaldagi tahrir har doim kompaniya panelida mavjud.

9. ROZILIK
Kompaniya paneliga kirishda belgi qoʻyish orqali siz shartlar bilan tanishganingizni va ularni kompaniya nomidan qabul qilganingizni tasdiqlaysiz.`

func policyDefaults(audience string) (string, string) {
	if audience == "company" {
		return defaultCompanyPolicyRU, defaultCompanyPolicyUZ
	}
	return defaultCustomerPolicyRU, defaultCustomerPolicyUZ
}

func validPolicyAudience(a string) bool {
	return a == "customer" || a == "company"
}

// GetPolicy — GET /policies/:audience. Публичный: текст показывают при
// регистрации/входе. Если записи ещё нет — создаём из дефолтного текста.
func GetPolicy(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		audience := strings.ToLower(c.Param("audience"))
		if !validPolicyAudience(audience) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "audience must be customer or company"})
			return
		}
		var (
			contentRu, contentUz string
			version              int
			updatedAt            time.Time
		)
		err := db.QueryRow(`
			SELECT content_ru, content_uz, version, updated_at FROM policies WHERE audience = $1
		`, audience).Scan(&contentRu, &contentUz, &version, &updatedAt)
		if err == sql.ErrNoRows {
			contentRu, contentUz = policyDefaults(audience)
			version = 1
			updatedAt = time.Now()
			_, _ = db.Exec(`
				INSERT INTO policies (audience, content_ru, content_uz, version)
				VALUES ($1, $2, $3, 1)
				ON CONFLICT (audience) DO NOTHING
			`, audience, contentRu, contentUz)
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load policy"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"audience":  audience,
			"contentRu": contentRu,
			"contentUz": contentUz,
			"version":   version,
			"updatedAt": updatedAt,
		})
	}
}

// UpdatePolicy — PUT /policies/:audience (только админ). Версия растёт при
// каждом сохранении — принятые ранее согласия остаются привязаны к своей версии.
func UpdatePolicy(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		audience := strings.ToLower(c.Param("audience"))
		if !validPolicyAudience(audience) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "audience must be customer or company"})
			return
		}
		var req struct {
			ContentRu string `json:"contentRu"`
			ContentUz string `json:"contentUz"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.ContentRu) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "contentRu is required"})
			return
		}
		var version int
		err := db.QueryRow(`
			INSERT INTO policies (audience, content_ru, content_uz, version, updated_at)
			VALUES ($1, $2, $3, 1, NOW())
			ON CONFLICT (audience) DO UPDATE
			SET content_ru = EXCLUDED.content_ru,
			    content_uz = EXCLUDED.content_uz,
			    version    = policies.version + 1,
			    updated_at = NOW()
			RETURNING version
		`, audience, req.ContentRu, req.ContentUz).Scan(&version)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save policy"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "version": version})
	}
}

// AcceptPolicy — POST /policies/:audience/accept. Фиксирует согласие:
// subject — телефон покупателя или id компании. Дубликаты той же версии
// не пишем повторно.
func AcceptPolicy(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		audience := strings.ToLower(c.Param("audience"))
		if !validPolicyAudience(audience) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "audience must be customer or company"})
			return
		}
		var req struct {
			Subject string `json:"subject"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Subject) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subject is required"})
			return
		}
		subject := strings.TrimSpace(req.Subject)

		var version int
		if err := db.QueryRow(`SELECT version FROM policies WHERE audience = $1`, audience).Scan(&version); err != nil {
			version = 1
		}
		var exists int
		_ = db.QueryRow(`
			SELECT COUNT(*) FROM policy_acceptances
			WHERE audience = $1 AND subject = $2 AND version = $3
		`, audience, subject, version).Scan(&exists)
		if exists == 0 {
			_, _ = db.Exec(`
				INSERT INTO policy_acceptances (audience, subject, version)
				VALUES ($1, $2, $3)
			`, audience, subject, version)
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "version": version})
	}
}
