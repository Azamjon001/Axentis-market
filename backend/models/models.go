package models

import "time"

type Company struct {
	ID                   int64     `json:"id"`
	Name                 string    `json:"name"`
	Phone                string    `json:"phone"`
	PasswordHash         string    `json:"-"`
	AccessKey            *string   `json:"accessKey,omitempty"`
	Mode                 string    `json:"mode"` // public или private
	PrivateCode          *string   `json:"privateCode,omitempty"` // 🔐 Уникальный код для приватной компании (5-6 цифр)
	Status               string    `json:"status"`
	LogoURL              *string   `json:"logoUrl,omitempty"`
	Address              *string   `json:"address,omitempty"`
	Region               *string   `json:"region,omitempty"`               // 📍 Регион/Область (например: Андижан, Ташкент)
	District             *string   `json:"district,omitempty"`             // 📍 Район (например: Кургантепа, Джалакудук)
	LocationLat          *float64  `json:"locationLat,omitempty"`          // 🗺️ Широта
	LocationLng          *float64  `json:"locationLng,omitempty"`          // 🗺️ Долгота
	LocationAddress      *string   `json:"locationAddress,omitempty"`      // 🗺️ Адрес из карт
	Description          *string   `json:"description,omitempty"`
	ProductsDescription  *string   `json:"productsDescription,omitempty"`
	DeliveryRadiusKm     float64   `json:"deliveryRadiusKm"`
	DeliveryRadiusLat    *float64  `json:"deliveryRadiusLat,omitempty"`
	DeliveryRadiusLng    *float64  `json:"deliveryRadiusLng,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

type Product struct {
	ID                   int64     `json:"id"`
	CompanyID            int64     `json:"companyId"`
	Name                 string    `json:"name"`
	Quantity             int       `json:"quantity"`
	Price                float64   `json:"price"`
	MarkupPercent        float64   `json:"markupPercent"`
	SellingPrice         float64   `json:"sellingPrice"`
	MarkupAmount         float64   `json:"markupAmount"`
	Barcode              *string   `json:"barcode,omitempty"`
	Barid                *string   `json:"barid,omitempty"`
	Images               string    `json:"images"`
	Description          *string   `json:"description,omitempty"`
	Color                *string   `json:"color,omitempty"`
	Size                 *string   `json:"size,omitempty"`
	Brand                *string   `json:"brand,omitempty"`
	Category             *string   `json:"category,omitempty"`
	HasColorOptions      bool      `json:"hasColorOptions"`
	AvailableForCustomers bool     `json:"availableForCustomers"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

type Sale struct {
	ID            int64     `json:"id"`
	CompanyID     int64     `json:"companyId"`
	Items         string    `json:"items"`
	TotalAmount   float64   `json:"totalAmount"`
	PaymentMethod string    `json:"paymentMethod"`
	CardSubtype   *string   `json:"cardSubtype,omitempty"` // 💳 Подтип карты: uzcard, humo, visa, other
	CreatedAt     time.Time `json:"createdAt"`
}

type Order struct {
	ID                  int64     `json:"id"`
	CompanyID           int64     `json:"companyId"`
	CustomerName        string    `json:"customerName"`
	CustomerPhone       string    `json:"customerPhone"`
	Address             *string   `json:"address,omitempty"`
	Items               string    `json:"items"`
	TotalAmount         float64   `json:"totalAmount"`
	DeliveryCost        float64   `json:"deliveryCost"`
	DeliveryType        string    `json:"deliveryType"`        // pickup или delivery
	RecipientName       *string   `json:"recipientName,omitempty"`
	DeliveryAddress     *string   `json:"deliveryAddress,omitempty"`
	DeliveryCoordinates *string   `json:"deliveryCoordinates,omitempty"`
	Status              string    `json:"status"`
	PaymentMethod       *string   `json:"paymentMethod,omitempty"`  // 💳 Способ оплаты
	CardSubtype         *string   `json:"cardSubtype,omitempty"`    // 💳 Подтип карты: uzcard, humo, visa, other
	Comment             *string   `json:"comment,omitempty"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

type User struct {
	ID               int64     `json:"id"`
	Phone            string    `json:"phone"`
	Name             *string   `json:"name,omitempty"`
	Mode             string    `json:"mode"` // public или private
	PrivateCompanyID *int64    `json:"privateCompanyId,omitempty"` // 🔐 ID приватной компании, к которой привязан пользователь
	Cart             string    `json:"cart"`
	Likes            string    `json:"likes"`
	Receipts         string    `json:"receipts"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// Discount represents a discount offer from a company on a specific product
type Discount struct {
	ID              int64      `json:"id"`
	CompanyID       int64      `json:"companyId"`
	ProductID       int64      `json:"productId"`
	VariantID       *int64     `json:"variantId,omitempty"` // NULL = весь товар, иначе конкретный SKU
	DiscountPercent float64    `json:"discountPercent"`
	Title           *string    `json:"title,omitempty"`
	Description     *string    `json:"description,omitempty"`
	Status          string     `json:"status"` // pending, approved, rejected
	AdminReviewed   bool       `json:"adminReviewed"`
	StartDate       *time.Time `json:"startDate,omitempty"`
	EndDate         *time.Time `json:"endDate,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

// DiscountWithDetails includes product and company information
type DiscountWithDetails struct {
	Discount
	ProductName      string  `json:"productName"`
	ProductImages    string  `json:"productImages"`
	ProductPrice     float64 `json:"productPrice"`
	ProductBasePrice float64 `json:"productBasePrice"`
	MarkupPercent    float64 `json:"markupPercent"`
	CompanyName      string  `json:"companyName"`
	CompanyLogo      *string `json:"companyLogo,omitempty"`
}

// PaymentCard represents a saved payment card for a user
type PaymentCard struct {
	ID                   int64     `json:"id"`
	UserPhone            string    `json:"userPhone"`
	CardNumberLast4      string    `json:"cardNumberLast4"` // Последние 4 цифры для отображения
	CardNumberEncrypted  *string   `json:"-"` // Зашифрованный полный номер (не отправляем клиенту)
	CardExpiry           *string   `json:"cardExpiry,omitempty"` // MM/YY
	CardHolderFirstName  string    `json:"cardHolderFirstName"` // Имя
	CardHolderLastName   string    `json:"cardHolderLastName"` // Фамилия
	CardHolderName       string    `json:"cardHolderName"` // Полное имя (для совместимости)
	CardType             *string   `json:"cardType,omitempty"` // uzcard, humo, visa, mastercard
	IsDefault            bool      `json:"isDefault"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

// AggressiveDiscount represents special liquidation discount (can go below base price)
// Used to sell slow-moving inventory (products that haven't sold in months/years)
type AggressiveDiscount struct {
	ID              int64      `json:"id"`
	CompanyID       int64      `json:"companyId"`
	ProductID       int64      `json:"productId"`
	VariantID       *int64     `json:"variantId,omitempty"` // NULL = весь товар, иначе конкретный SKU
	DiscountPercent float64    `json:"discountPercent"`
	Title           *string    `json:"title,omitempty"`
	Description     *string    `json:"description,omitempty"`
	Status          string     `json:"status"` // pending, approved, rejected
	AdminReviewed   bool       `json:"adminReviewed"`
	StartDate       *time.Time `json:"startDate,omitempty"`
	EndDate         *time.Time `json:"endDate,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

// AggressiveDiscountWithDetails includes product and company information
type AggressiveDiscountWithDetails struct {
	AggressiveDiscount
	ProductName      string  `json:"productName"`
	ProductImages    string  `json:"productImages"`
	ProductPrice     float64 `json:"productPrice"`
	ProductBasePrice float64 `json:"productBasePrice"`
	MarkupPercent    float64 `json:"markupPercent"`
	CompanyName      string  `json:"companyName"`
	CompanyLogo      *string `json:"companyLogo,omitempty"`
}

// ProductVariant represents a single SKU variation of a product (color, size, price, stock)
type ProductVariant struct {
	ID            int64     `json:"id"`
	ProductID     int64     `json:"productId"`
	Color         *string   `json:"color,omitempty"`
	Size          *string   `json:"size,omitempty"`
	Price         float64   `json:"price"`
	MarkupPercent float64   `json:"markupPercent"`
	SellingPrice  float64   `json:"sellingPrice"`
	StockQuantity int       `json:"stockQuantity"`
	Barcode       *string   `json:"barcode,omitempty"`
	SKU           *string   `json:"sku,omitempty"`
	Barid         *string   `json:"barid,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// ProductPurchase represents history of product purchases/stock additions by company
// 📦 История закупок товаров компанией
type ProductPurchase struct {
	ID            int64      `json:"id"`
	CompanyID     int64      `json:"companyId"`
	ProductID     *int64     `json:"productId,omitempty"`     // NULL if product was deleted
	ProductName   string     `json:"productName"`             // Save product name at purchase time
	Quantity      int        `json:"quantity"`                // Number of items purchased
	PurchasePrice float64    `json:"purchasePrice"`           // Purchase price per unit
	TotalCost     float64    `json:"totalCost"`               // Total cost (quantity * purchasePrice)
	Supplier      *string    `json:"supplier,omitempty"`      // Supplier name (optional)
	Notes         *string    `json:"notes,omitempty"`         // Additional notes/comments
	PurchaseDate  time.Time  `json:"purchaseDate"`            // Date of purchase
	CreatedAt     time.Time  `json:"createdAt"`
}
