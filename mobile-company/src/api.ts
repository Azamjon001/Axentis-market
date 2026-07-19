import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// API-клиент мобильной панели компании Axentis.
//
// Те же endpoints, что использует веб-панель компаний (src/utils/api.tsx),
// но НАМЕРЕННО без admin-части: в приложении нет ни /auth/login/admin,
// ни одного /admin/* вызова — войти администратором из приложения нельзя.
// ============================================================================

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://axentis.uz/api';

const TOKEN_KEY = 'axentis_token';
const SESSION_KEY = 'axentis_company_session';

let authToken: string | null = null;

export async function loadStoredToken(): Promise<string | null> {
  authToken = await AsyncStorage.getItem(TOKEN_KEY);
  return authToken;
}

async function setToken(token: string) {
  authToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearAuth() {
  authToken = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
}

export interface CompanySession {
  id: number;
  name: string;
  phone: string;
  mode?: string;
  status?: string;
}

export async function saveSession(company: CompanySession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(company));
}

export async function loadSession(): Promise<CompanySession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'number' && parsed.id > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = API_BASE.replace('/api', '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let message = `${response.status}`;
    try {
      if (isJson) {
        const data = await response.json();
        message = data.error || data.message || message;
      } else {
        message = (await response.text()) || message;
      }
    } catch {
      /* keep status code */
    }
    throw new Error(message);
  }

  return isJson ? response.json() : response.text();
}

// ============================================================================
// AUTH — только вход компании. Админ-аккаунты в приложение не допускаются.
// ============================================================================

export const auth = {
  loginCompany: async (
    phone: string,
    password: string,
    referralCode?: string
  ): Promise<{ token: string; company: CompanySession }> => {
    const response = await apiCall('/auth/login/company', {
      method: 'POST',
      body: JSON.stringify({ phone, password, referralCode: referralCode || undefined }),
    });
    if (!response?.token || !response?.company) {
      throw new Error('Invalid credentials');
    }
    // 🔒 Токен сохраняем ТОЛЬКО для валидного ответа компании
    await setToken(response.token);
    return response;
  },

  logout: async () => clearAuth(),
};

// ============================================================================
// POLICIES — фиксация принятия политики конфиденциальности (как в вебе)
// ============================================================================

export const policies = {
  accept: (audience: 'company', principalId: string) =>
    apiCall(`/policies/${audience}/accept`, {
      method: 'POST',
      body: JSON.stringify({ principalId }),
    }),
};

// ============================================================================
// PRODUCTS — полный набор склада: CRUD, варианты (SKU), фото
// ============================================================================

export interface ProductPayload {
  companyId?: number;
  name?: string;
  quantity?: number;
  price?: number;
  markupPercent?: number;
  barcode?: string;
  barid?: string;
  category?: string;
  description?: string;
  color?: string;
  size?: string;
  brand?: string;
  hasColorOptions?: boolean;
  availableForCustomers?: boolean;
}

export const products = {
  list: (params: { companyId: string; search?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/products?${query}`);
  },

  create: (data: ProductPayload & { companyId: number; name: string; price: number }) =>
    apiCall('/products', {
      method: 'POST',
      body: JSON.stringify({
        companyId: data.companyId,
        name: data.name,
        quantity: data.quantity || 0,
        price: data.price,
        markupPercent: data.markupPercent || 0,
        barcode: data.barcode || '',
        barid: data.barid || '',
        category: data.category || '',
        description: data.description || '',
        color: data.color || '',
        size: data.size || '',
        brand: data.brand || '',
        hasColorOptions: data.hasColorOptions || false,
        availableForCustomers: data.availableForCustomers !== false,
      }),
    }),

  update: (id: string | number, data: Record<string, any>) =>
    apiCall(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string | number) => apiCall(`/products/${id}`, { method: 'DELETE' }),

  // Массовое выставление/снятие с продажи — как в SalesPanel/DigitalWarehouse
  bulkToggleAvailability: (productIds: number[], available: boolean) =>
    Promise.all(
      productIds.map((id) =>
        apiCall(`/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ availableForCustomers: available }),
        })
      )
    ),

  // 📸 Загрузка фото товара (multipart, поле files — как в вебе)
  uploadImages: (id: string | number, files: { uri: string; name: string; type: string }[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f as any));
    return apiCall(`/products/${id}/images`, { method: 'POST', body: formData });
  },

  deleteImage: (id: string | number, filepath: string) =>
    apiCall(`/products/${id}/images`, {
      method: 'DELETE',
      body: JSON.stringify({ filepath }),
    }),

  // ── Варианты (SKU: цвет/размер) ────────────────────────────────────────────
  getVariants: (productId: string | number) => apiCall(`/products/${productId}/variants`),

  createVariant: (
    productId: string | number,
    data: {
      color?: string;
      size?: string;
      price: number;
      markupPercent?: number;
      stockQuantity?: number;
      barcode?: string;
      sku?: string;
      description?: string;
    }
  ) =>
    apiCall(`/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(data) }),

  updateVariant: (
    productId: string | number,
    variantId: string | number,
    data: Record<string, any>
  ) =>
    apiCall(`/products/${productId}/variants/${variantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteVariant: (productId: string | number, variantId: string | number) =>
    apiCall(`/products/${productId}/variants/${variantId}`, { method: 'DELETE' }),

  findByBarcode: (companyId: number, barcode: string) =>
    apiCall(`/products/find-by-barcode?companyId=${companyId}&q=${encodeURIComponent(barcode)}`),
};

// ============================================================================
// ORDERS — тот же поток статусов, что в CompanyOrdersPanel веб-панели:
// pending → confirmed (принять) → shipped (confirmPayment) → completed
// (mark-delivered с частичными возвратами), либо cancelled.
// ============================================================================

export const orders = {
  list: (params: { companyId: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/orders?${query}`);
  },

  updateStatus: (id: string | number, status: string) =>
    apiCall(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  confirmPayment: (id: number) => apiCall(`/orders/${id}/confirm`, { method: 'POST' }),

  markDelivered: (id: number, returns: { index: number; quantity: number }[] = []) =>
    apiCall(`/orders/${id}/mark-delivered`, {
      method: 'PUT',
      body: JSON.stringify({ returns }),
    }),

  cancel: (id: number) =>
    apiCall(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }),
};

// ============================================================================
// SALES (офлайн-касса) — история продаж
// ============================================================================

export const sales = {
  list: (params: { companyId: string; startDate?: string; endDate?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/sales?${query}`);
  },
};

// ============================================================================
// CASH SALES — кассовые продажи (сканер-касса, как BarcodeSearchPanel)
// ============================================================================

export interface CashSaleItem {
  id: number;
  product_id?: number;
  variant_id?: number;
  name?: string;
  productName?: string;
  quantity: number;
  price: number;
  price_with_markup: number;
}

export interface CashSalePayload {
  companyId: number;
  paymentMethod: 'cash' | 'card';
  cardSubtype?: 'uzcard' | 'humo' | 'visa' | 'other';
  items: CashSaleItem[];
}

export const cashSales = {
  create: (data: CashSalePayload) =>
    apiCall('/cash-sales', { method: 'POST', body: JSON.stringify(data) }),
};

// ============================================================================
// PRODUCT PURCHASES — закупки товара (пополнение склада с ценой закупки)
// ============================================================================

export const productPurchases = {
  create: (data: {
    companyId: number;
    productId?: number;
    variantId?: number;
    productName: string;
    quantity: number;
    purchasePrice: number;
    totalCost: number;
  }) => apiCall('/product-purchases', { method: 'POST', body: JSON.stringify(data) }),

  list: (params: { companyId: string | number; startDate?: string; endDate?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/product-purchases?${query}`);
  },

  stats: (params: { companyId: string | number; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/product-purchases/stats?${query}`);
  },
};

// ============================================================================
// EXPENSES — операционные расходы компании (для чистой прибыли в аналитике)
// ============================================================================

export const expenses = {
  create: (data: { amount: number; category: string; description?: string; date?: string }) =>
    apiCall('/expenses', { method: 'POST', body: JSON.stringify(data) }),

  list: (params: { companyId?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/expenses?${query}`);
  },

  delete: (id: string | number) => apiCall(`/expenses/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// DISCOUNTS — скидки на товары (создание из склада, как в вебе)
// ============================================================================

export const discounts = {
  create: (data: {
    companyId: number;
    productId: number;
    variantId?: number | null;
    discountPercent: number;
    title?: string;
    endDate?: string;
  }) =>
    apiCall('/discounts', {
      method: 'POST',
      body: JSON.stringify({
        companyId: data.companyId,
        productId: data.productId,
        variantId: data.variantId ?? null,
        discountPercent: data.discountPercent,
        title: data.title || null,
        endDate: data.endDate || undefined,
      }),
    }),

  listByCompany: (companyId: number) => apiCall(`/discounts/company/${companyId}`),
};

// ============================================================================
// COMPANIES — профиль, настройки доставки/возвратов, приватный режим, Telegram
// ============================================================================

export const companies = {
  get: (id: string | number) => apiCall(`/companies/${id}`),

  update: (id: string | number, data: Record<string, any>) =>
    apiCall(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Переключение публичный ↔ закрытый режим (выдаёт privateCode)
  setPrivacy: (id: string | number, mode: 'public' | 'private') =>
    apiCall(`/companies/${id}/privacy`, { method: 'PUT', body: JSON.stringify({ mode }) }),

  telegramStatus: (id: string | number) => apiCall(`/companies/${id}/telegram`),
  telegramDisconnect: (id: string | number) =>
    apiCall(`/companies/${id}/telegram`, { method: 'DELETE' }),

  // 📲 Push-токен приложения продавца (PUT /companies/:id/push-token)
  savePushToken: (
    id: string | number,
    token: string,
    prefs?: { newOrders?: boolean; dailySummary?: boolean }
  ) =>
    apiCall(`/companies/${id}/push-token`, {
      method: 'PUT',
      body: JSON.stringify({ token, ...prefs }),
    }),
};

// ============================================================================
// REGIONS — регионы обслуживания (фильтр товаров для покупателей)
// ============================================================================

export const regions = {
  list: () => apiCall('/regions'),
};

// ============================================================================
// CATEGORIES — глобальный каталог категорий платформы
// ============================================================================

export const categories = {
  list: () => apiCall('/categories'),
};

// ============================================================================
// ANALYTICS (только company-scope — платформенная аналитика недоступна)
// ============================================================================

export const analytics = {
  company: (companyId: number, params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams((params || {}) as any).toString();
    return apiCall(`/analytics/company/${companyId}?${query}`);
  },
  dashboard: (companyId: number) => apiCall(`/analytics/company/${companyId}/dashboard`),
  profit: (companyId: number) => apiCall(`/analytics/company/${companyId}/profit`),
  inventoryInsights: (companyId: number) =>
    apiCall(`/analytics/company/${companyId}/inventory-insights`),
  customerSegments: (companyId: number) =>
    apiCall(`/analytics/company/${companyId}/customer-segments`),
};

// ============================================================================
// COMPANY MESSAGES — счётчик непрочитанных для шапки
// ============================================================================

export const companyMessages = {
  count: (companyId: number) => apiCall(`/company-messages/company/${companyId}/count`),
};

const api = {
  auth,
  policies,
  products,
  orders,
  sales,
  cashSales,
  productPurchases,
  expenses,
  discounts,
  companies,
  regions,
  categories,
  analytics,
  companyMessages,
};
export default api;
