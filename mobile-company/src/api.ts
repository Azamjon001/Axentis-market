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
// PRODUCTS
// ============================================================================

export const products = {
  list: (params: { companyId: string; search?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/products?${query}`);
  },

  create: (data: {
    companyId: number;
    name: string;
    quantity?: number;
    price: number;
    markupPercent?: number;
    barcode?: string;
    category?: string;
    description?: string;
    brand?: string;
    availableForCustomers?: boolean;
  }) =>
    apiCall('/products', {
      method: 'POST',
      body: JSON.stringify({
        companyId: data.companyId,
        name: data.name,
        quantity: data.quantity || 0,
        price: data.price,
        markupPercent: data.markupPercent || 0,
        barcode: data.barcode || '',
        category: data.category || '',
        description: data.description || '',
        brand: data.brand || '',
        availableForCustomers: data.availableForCustomers !== false,
      }),
    }),

  update: (id: string | number, data: Record<string, any>) =>
    apiCall(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string | number) => apiCall(`/products/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// ORDERS — тот же поток статусов, что в CompanyOrdersPanel веб-панели:
// pending → confirmed (принять) → shipped (confirmPayment) → completed
// (mark-delivered), либо cancelled.
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
// SALES (офлайн-продажи) и CASH SALES
// ============================================================================

export const sales = {
  list: (params: { companyId: string; startDate?: string; endDate?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/sales?${query}`);
  },
};

// ============================================================================
// COMPANIES
// ============================================================================

export const companies = {
  get: (id: string | number) => apiCall(`/companies/${id}`),
  update: (id: string | number, data: Record<string, any>) =>
    apiCall(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
};

// ============================================================================
// COMPANY MESSAGES — счётчик непрочитанных для шапки
// ============================================================================

export const companyMessages = {
  count: (companyId: number) => apiCall(`/company-messages/company/${companyId}/count`),
};

const api = { auth, policies, products, orders, sales, companies, analytics, companyMessages };
export default api;
