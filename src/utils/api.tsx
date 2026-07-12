/// <reference types="vite/client" />

// ============================================================================
// NEW API CLIENT - PostgreSQL Backend (Fastify + Socket.io)
// ============================================================================
// Заменяет все Supabase вызовы на новые API endpoints

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Преобразует путь к изображению в полный URL
 * Поддерживает как Docker/nginx режим (/api), так и локальную разработку (http://localhost:3000/api)
 */
export function getImageUrl(path: string | undefined | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  
  // Remove /api from the base URL to get the server root
  const baseUrl = API_BASE.replace('/api', '');
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If baseUrl is empty (Docker/nginx mode), just return the normalized path
  if (!baseUrl) return normalizedPath;
  
  // For absolute URLs (local dev), combine baseUrl with path
  return `${baseUrl}${normalizedPath}`;
}

// ============================================================================
// Authentication Token Management
// ============================================================================

export function getAuthToken(): string | null {
  return localStorage.getItem('azaton_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('azaton_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('azaton_token');
}

// ============================================================================
// Base API Call Function
// ============================================================================

interface ApiOptions extends RequestInit {
  requiresAuth?: boolean;
}

async function apiCall(
  endpoint: string,
  options: ApiOptions = {}
): Promise<any> {
  const { requiresAuth = true, ...fetchOptions } = options;

  const headers: Record<string, string> = {};

  // Don't set Content-Type for FormData (browser will set it automatically with boundary)
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Always attach the auth token when we have one — the backend now scopes
  // personal data (cart, favorites, orders, addresses, cards, notifications)
  // to the authenticated principal, so even "public-ish" calls must carry it.
  // Attaching a token to a truly public endpoint is harmless.
  // `requiresAuth` is kept for call-site compatibility.
  void requiresAuth;
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `${API_BASE}${endpoint}`;
    console.log(`🌐 [API] ${fetchOptions.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    console.log(`✅ [API] Response: ${response.status} ${response.statusText}`);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      let errorMessage = response.statusText;

      if (isJson) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } else {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }

      console.error(`❌ [API] Error ${response.status}:`, errorMessage);
      throw new Error(errorMessage);
    }

    return isJson ? response.json() : response.text();
  } catch (error) {
    console.error(`❌ [API] Fetch failed:`, error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Network error: Unable to connect to ${API_BASE}. Check if backend is running.`);
    }
    throw error;
  }
}

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const auth = {
  // User login (no SMS verification)
  loginUser: async (phone: string) => {
    const response = await apiCall('/auth/login/user', {
      method: 'POST',
      body: JSON.stringify({ phone }),
      requiresAuth: false,
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  // User registration
  registerUser: async (phone: string, name?: string) => {
    const response = await apiCall('/auth/register/user', {
      method: 'POST',
      body: JSON.stringify({ phone, name }),
      requiresAuth: false,
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  // Company login
  loginCompany: async (phone: string, password: string, accessKey?: string, referralCode?: string) => {
    const response = await apiCall('/auth/login/company', {
      method: 'POST',
      body: JSON.stringify({ phone, password, accessKey, referralCode }),
      requiresAuth: false,
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  // Company registration
  registerCompany: async (data: {
    name: string;
    phone: string;
    password: string;
    mode: 'public' | 'private';
    description?: string;
    accessKey?: string;
  }) => {
    const response = await apiCall('/auth/register/company', {
      method: 'POST',
      body: JSON.stringify(data),
      requiresAuth: false,
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  // Admin login
  loginAdmin: async (phone: string, password: string) => {
    const response = await apiCall('/auth/login/admin', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
      requiresAuth: false,
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  // 🔐 Admin credentials: read current login phone (never the password)
  getAdminCredentials: async () => {
    return apiCall('/admin/credentials');
  },

  // 🔐 Admin credentials: change login phone and/or password (stored in DB)
  updateAdminCredentials: async (currentPassword: string, newPhone: string, newPassword: string) => {
    return apiCall('/admin/credentials', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPhone, newPassword }),
    });
  },

  // Get current user
  me: async () => {
    return apiCall('/auth/me');
  },

  // Logout
  logout: async () => {
    removeAuthToken();
    return { success: true };
  },
};

// ============================================================================
// PRODUCTS API
// ============================================================================

export const products = {
  // Get all products with filtering
  list: async (params?: {
    companyId?: string;
    search?: string;
    availableOnly?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/products?${query}`, { requiresAuth: false });
  },

  // 🔍 Typo-tolerant relevance search (pg_trgm).
  // extra: { sort: 'price_asc'|'price_desc'|'popular'|'new', minPrice, maxPrice, category, brand }
  search: async (q: string, limit = 30, extra: Record<string, string | number> = {}) => {
    const params = new URLSearchParams({ q, limit: String(limit), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
    return apiCall(`/products/search?${params}`, { requiresAuth: false });
  },

  // 💡 Автодополнение поисковой строки: [{ label, type: 'product'|'brand'|'category' }]
  suggest: async (q: string) => {
    if (!q || q.trim().length < 2) return [];
    return apiCall(`/products/suggest?q=${encodeURIComponent(q.trim())}`, { requiresAuth: false });
  },

  // Get product by ID
  get: async (id: string) => {
    return apiCall(`/products/${id}`, { requiresAuth: false });
  },

  // Create product (company only)
  create: async (data: {
    companyId: number;
    name: string;
    quantity?: number;
    price: number;
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
  }) => {
    return apiCall('/products', {
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
        availableForCustomers: data.availableForCustomers !== false
      }),
    });
  },

  // Update product
  update: async (id: string, data: Partial<any>) => {
    return apiCall(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete product
  delete: async (id: string) => {
    return apiCall(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Upload images
  uploadImages: async (id: string, files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    // Don't pass headers - let browser set Content-Type with boundary for FormData
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/products/${id}/images`, {
      method: 'POST',
      body: formData,
      headers: headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || response.statusText);
    }

    return response.json();
  },

  // Delete image
  deleteImage: async (id: string, filepath: string) => {
    return apiCall(`/products/${id}/images`, {
      method: 'DELETE',
      body: JSON.stringify({ filepath }),
    });
  },

  // ── Variant endpoints ──────────────────────────────────────────────────────
  // inStock=true hides out-of-stock variants (customer view); the seller
  // warehouse calls without it to see every variant.
  getVariants: async (productId: string | number, inStock = false) => {
    const q = inStock ? '?inStock=true' : '';
    return apiCall(`/products/${productId}/variants${q}`, { requiresAuth: false });
  },

  createVariant: async (productId: string | number, data: {
    color?: string;
    size?: string;
    price: number;
    markupPercent?: number;
    stockQuantity?: number;
    barcode?: string;
    sku?: string;
    barid?: string;
    description?: string;
  }) => {
    return apiCall(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateVariant: async (productId: string | number, variantId: string | number, data: Partial<{
    color: string;
    size: string;
    price: number;
    markupPercent: number;
    stockQuantity: number;
    barcode: string;
    sku: string;
    barid: string;
    description: string;
  }>) => {
    return apiCall(`/products/${productId}/variants/${variantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteVariant: async (productId: string | number, variantId: string | number) => {
    return apiCall(`/products/${productId}/variants/${variantId}`, {
      method: 'DELETE',
    });
  },
  // ── End variant endpoints ──────────────────────────────────────────────────

  // Get product reviews
  getReviews: async (id: string) => {
    return apiCall(`/products/${id}/reviews`, {
      method: 'GET',
    });
  },

  // Get product review stats
  getReviewStats: async (id: string) => {
    return apiCall(`/products/${id}/review-stats`, {
      method: 'GET',
    });
  },

  // Bulk toggle availability
  bulkToggleAvailability: async (productIds: number[], available: boolean) => {
    const promises = productIds.map(id =>
      apiCall(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ availableForCustomers: available }),
      })
    );
    return Promise.all(promises);
  },

  // Bulk import products
  bulkImport: async (companyId: number | string, productsData: any[]) => {
    console.log(`📦 Starting bulk import of ${productsData.length} products for company ${companyId}`);
    
    // Import products in batches to avoid overwhelming the server
    const batchSize = 50;
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < productsData.length; i += batchSize) {
      const batch = productsData.slice(i, i + batchSize);
      console.log(`📤 Importing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(productsData.length/batchSize)}: ${batch.length} products`);
      
      const batchPromises = batch.map((product, index) => 
        apiCall('/products', {
          method: 'POST',
          body: JSON.stringify({
            ...product,
            companyId: companyId,
          }),
        }).then(result => {
          successCount++;
          console.log(`✅ Product ${i + index + 1}/${productsData.length} imported: ${product.name}`);
          return result;
        }).catch(error => {
          errorCount++;
          console.error(`❌ Failed to import product ${i + index + 1}/${productsData.length} (${product.name}):`, error);
          return { error: error.message, product: product.name };
        })
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    console.log(`📊 Import completed: ${successCount} success, ${errorCount} errors`);
    return results;
  },

  // Find product by barcode/sku — also searches product_variants
  findByBarcode: async (companyId: number, barcode: string) => {
    return apiCall(`/products/find-by-barcode?companyId=${companyId}&q=${encodeURIComponent(barcode)}`, { requiresAuth: false });
  },
};

// ============================================================================
// SALES API
// ============================================================================

export const sales = {
  // Create sale
  create: async (data: {
    items: any[];
    totalAmount: number;
    paymentMethod: string;
  }) => {
    return apiCall('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // List sales
  list: async (params?: {
    companyId?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/sales?${query}`);
  },

  // Get sale by ID
  get: async (id: string) => {
    return apiCall(`/sales/${id}`);
  },

  // Get sales summary
  summary: async (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/sales/analytics/summary?${query}`);
  },
};

// ============================================================================
// CASH SALES API (для панели штрих-кода)
// ============================================================================

export const cashSales = {
  // Создать кассовую продажу
  create: async (data: {
    companyId: number | string;
    paymentMethod?: 'cash' | 'card';
    cardSubtype?: 'uzcard' | 'humo' | 'visa' | 'other';
    items: Array<{
      id: number;
      product_id?: number;
      name?: string;
      productName?: string;
      quantity: number;
      price: number;
      price_with_markup: number;
      priceWithMarkup?: number;
      image_url?: string;
    }>;
  }) => {
    return apiCall('/cash-sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Получить список кассовых продаж
  list: async (params?: {
    companyId?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/cash-sales?${query}`);
  },
};

// ============================================================================
// ORDERS API
// ============================================================================

export const orders = {
  // Create order
  create: async (data: {
    companyId: string;
    items: any[];
    totalAmount: number;
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
    deliveryCoordinates?: string;
    deliveryType?: string;
    paymentMethod?: string;
    cardSubtype?: string;
    notes?: string;
  }) => {
    return apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // List orders
  list: async (params?: {
    companyId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/orders?${query}`);
  },

  // Get order by ID
  get: async (id: string) => {
    return apiCall(`/orders/${id}`);
  },

  // List orders for a specific customer (buyer's own orders)
  listByCustomer: async (phone: string) => {
    return apiCall(`/orders?customer_phone=${encodeURIComponent(phone)}`, { requiresAuth: false });
  },

  // Update order status (company only)
  updateStatus: async (id: string, status: string) => {
    return apiCall(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // Confirm payment - mark order as completed and create sale record
  confirmPayment: async (id: number) => {
    return apiCall(`/orders/${id}/confirm`, {
      method: 'POST',
    });
  },

  // Cancel order
  cancel: async (id: number) => {
    return apiCall(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    });
  },

  // Delete order (company only)
  delete: async (id: string) => {
    return apiCall(`/orders/${id}`, {
      method: 'DELETE',
    });
  },

  // Courier: mark an order as delivered (completed).
  // `returns` (optional) lists items the customer refused so they go back to
  // the seller — each entry is { index, quantity } against the order's items.
  markDelivered: async (
    id: number | string,
    returns?: { index: number; quantity: number }[],
  ) => {
    return apiCall(`/orders/${id}/mark-delivered`, {
      method: 'PUT',
      requiresAuth: false,
      body: JSON.stringify({ returns: returns || [] }),
    });
  },
};

// ============================================================================
// COURIERS API
// ============================================================================
export const couriers = {
  // Курьер получает собственный JWT — сохраняем его, чтобы обновление
  // статуса/локации и список заказов проходили авторизацию.
  login: async (phone: string, password: string) => {
    const response = await apiCall('/couriers/login', { method: 'POST', body: JSON.stringify({ phone, password }), requiresAuth: false });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  list: async (companyId?: number | string) =>
    apiCall(`/couriers${companyId ? `?company_id=${companyId}` : ''}`, { requiresAuth: false }),

  create: async (data: {
    company_id?: number | null;
    name: string;
    surname: string;
    phone: string;
    password: string;
    passport_id?: string;
  }) => apiCall('/couriers', { method: 'POST', body: JSON.stringify(data), requiresAuth: false }),

  delete: async (id: number | string) =>
    apiCall(`/couriers/${id}`, { method: 'DELETE', requiresAuth: false }),

  setStatus: async (id: number | string, is_online: boolean) =>
    apiCall(`/couriers/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_online }), requiresAuth: false }),

  updateLocation: async (id: number | string, lat: number, lng: number) =>
    apiCall(`/couriers/${id}/location`, { method: 'PUT', body: JSON.stringify({ lat, lng }), requiresAuth: false }),

  getOrders: async (id: number | string) =>
    apiCall(`/couriers/${id}/orders`, { requiresAuth: false }),

  // 📊 Статистика курьера: доставлено сегодня (кол-во, сумма) и всего
  getStats: async (id: number | string) =>
    apiCall(`/couriers/${id}/stats`),
};

// ============================================================================
// COMPANIES API
// ============================================================================

export const companies = {
  // List companies
  list: async (params?: {
    approved?: boolean;
    mode?: 'public' | 'private';
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/companies?${query}`, { requiresAuth: false });
  },

  // ⭐ Top / "hit" shops for the recommended-shops row
  top: async () => {
    return apiCall('/companies/top', { requiresAuth: false });
  },

  // Get company by ID
  get: async (id: string) => {
    return apiCall(`/companies/${id}`, { requiresAuth: false });
  },

  // Verify access key
  verifyAccess: async (id: string, accessKey: string) => {
    return apiCall(`/companies/${id}/verify-access`, {
      method: 'POST',
      body: JSON.stringify({ accessKey }),
      requiresAuth: false,
    });
  },

  // Update company (own company only)
  update: async (id: string, data: Partial<any>) => {
    return apiCall(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Upload logo
  uploadLogo: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiCall(`/companies/${id}/upload-logo`, {
      method: 'POST',
      body: formData,
    });
  },

  // Upload cover (фоновое фото магазина)
  uploadCover: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiCall(`/companies/${id}/upload-cover`, {
      method: 'POST',
      body: formData,
    });
  },

  // 📸 Сторис магазина: список, публикация (картинка), удаление
  listStories: async (id: string | number) => apiCall(`/companies/${id}/stories`),
  createStory: async (id: string | number, file: File, caption?: string, productId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    if (productId) formData.append('productId', String(productId));
    return apiCall(`/companies/${id}/stories`, { method: 'POST', body: formData });
  },
  deleteStory: async (id: string | number, storyId: number) =>
    apiCall(`/companies/${id}/stories/${storyId}`, { method: 'DELETE' }),

  // 🎉 Скидочные кампании (именованные акции)
  listCampaigns: async (id: string | number) => apiCall(`/companies/${id}/campaigns`),
  createCampaign: async (id: string | number, data: any) =>
    apiCall(`/companies/${id}/campaigns`, { method: 'POST', body: JSON.stringify(data) }),
  deleteCampaign: async (id: string | number, campaignId: number) =>
    apiCall(`/companies/${id}/campaigns/${campaignId}`, { method: 'DELETE' }),

  // ✅ Выдать/снять значок «Проверенный магазин» (админ)
  setVerified: async (id: string | number, isVerified: boolean) =>
    apiCall(`/companies/${id}/verify`, { method: 'PUT', body: JSON.stringify({ isVerified }) }),

  // Approve company (admin only)
  approve: async (id: string, approved: boolean) => {
    return apiCall(`/companies/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approved }),
    });
  },

  // Delete company (admin only)
  delete: async (id: string) => {
    return apiCall(`/companies/${id}`, {
      method: 'DELETE',
    });
  },

  // Get company stats (views, subscribers, expenses)
  getStats: async (id: string) => {
    return apiCall(`/companies/${id}/stats`, { requiresAuth: false });
  },

  // 👁️ Засчитать просмотр страницы магазина
  trackView: async (id: string | number) =>
    apiCall(`/companies/${id}/view`, { method: 'POST', requiresAuth: false }),

  // Update company expenses
  updateExpenses: async (id: string, expenses: {
    employeeExpenses: number;
    electricityExpenses: number;
    purchaseCosts: number;
  }) => {
    return apiCall(`/companies/${id}/expenses`, {
      method: 'PUT',
      body: JSON.stringify(expenses),
    });
  },

  // ⭐ Rate a company (customer)
  rate: async (id: string | number, userPhone: string, rating: number) =>
    apiCall(`/companies/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ user_phone: userPhone, rating }),
      requiresAuth: false,
    }),

  // 🔔 Subscribe / unsubscribe to a company (customer)
  subscribe: async (id: string | number, userPhone: string) =>
    apiCall(`/companies/${id}/subscribe`, { method: 'POST', body: JSON.stringify({ userPhone }), requiresAuth: false }),
  unsubscribe: async (id: string | number, userPhone: string) =>
    apiCall(`/companies/${id}/unsubscribe`, { method: 'POST', body: JSON.stringify({ userPhone }), requiresAuth: false }),
};

// ============================================================================
// USERS API
// ============================================================================

export const users = {
  // Check if user is unique
  checkUnique: async (firstName: string, lastName: string, phone: string) => {
    return apiCall('/users/check-unique', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, phone }),
      requiresAuth: false,
    });
  },

  // Get own profile
  me: async () => {
    return apiCall('/users/me');
  },

  // Update own profile
  updateProfile: async (data: { name?: string; phone?: string; address?: string }) => {
    return apiCall('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Like product
  likeProduct: async (productId: string) => {
    return apiCall(`/users/likes/${productId}`, {
      method: 'POST',
    });
  },

  // Unlike product
  unlikeProduct: async (productId: string) => {
    return apiCall(`/users/likes/${productId}`, {
      method: 'DELETE',
    });
  },

  // Get liked products
  getLikes: async (phone?: string) => {
    if (phone) {
      const items = await apiCall(`/favorites/${phone}`, { requiresAuth: false });
      if (!Array.isArray(items)) return [];
      return items.map((item: any) => Number(item.product_id));
    }
    return apiCall('/users/likes');
  },

  // Sync likes: diff-based — only add missing, remove extra. No GET needed for individual ops.
  saveLikes: async (phone: string, likes: number[]) => {
    // NOTE: this is used for bulk restores only. For individual toggle use toggleLike/removeLike.
    // Get current state from backend
    let current: number[] = [];
    try {
      const items = await apiCall(`/favorites/${phone}`, { requiresAuth: false });
      if (Array.isArray(items)) {
        current = items.map((item: any) => Number(item.product_id));
      }
    } catch (_) {}

    const toAdd = likes.filter(id => !current.includes(id));
    const toRemove = current.filter(id => !likes.includes(id));

    await Promise.all([
      ...toAdd.map(productId =>
        apiCall('/favorites/toggle', {
          method: 'POST',
          body: JSON.stringify({ user_phone: phone, product_id: productId }),
          requiresAuth: false,
        }).catch(() => {})
      ),
      ...toRemove.map(productId =>
        apiCall('/favorites', {
          method: 'DELETE',
          body: JSON.stringify({ user_phone: phone, product_id: productId }),
          requiresAuth: false,
        }).catch(() => {})
      ),
    ]);
  },

  // Direct like toggle — single API call, no GET needed
  addLike: async (phone: string, productId: number) => {
    return apiCall('/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ user_phone: phone, product_id: productId }),
      requiresAuth: false,
    });
  },

  // Direct like remove — single API call, no GET needed
  removeLike: async (phone: string, productId: number) => {
    return apiCall('/favorites', {
      method: 'DELETE',
      body: JSON.stringify({ user_phone: phone, product_id: productId }),
      requiresAuth: false,
    });
  },

  // Get user cart — returns quantities AND per-item color/size
  getCart: async (phone: string) => {
    const items = await apiCall(`/cart/${phone}`, { requiresAuth: false });
    if (!Array.isArray(items)) return { quantities: {} as { [key: number]: number }, colors: {} as { [key: number]: string }, sizes: {} as { [key: number]: string } };
    const quantities: { [key: number]: number } = {};
    const colors: { [key: number]: string } = {};
    const sizes: { [key: number]: string } = {};
    items.forEach((item: any) => {
      const id = Number(item.product_id);
      quantities[id] = item.quantity;
      if (item.selected_color) colors[id] = item.selected_color;
      if (item.selected_size) sizes[id] = item.selected_size;
    });
    return { quantities, colors, sizes };
  },

  // Sync cart — direct per-item calls, no GET, no race condition.
  saveCart: async (phone: string, cart: any) => {
    // NOTE: this is used for bulk restores only. For individual actions use setCartQty/removeCartItem.
    // Get current state from backend once for bulk sync
    let currentItems: Array<{ id: number; product_id: number; quantity: number }> = [];
    try {
      const items = await apiCall(`/cart/${phone}`, { requiresAuth: false });
      if (Array.isArray(items)) {
        currentItems = items.map((item: any) => ({
          id: Number(item.id),
          product_id: Number(item.product_id),
          quantity: item.quantity,
        }));
      }
    } catch (_) {}

    const desiredEntries = Object.entries(cart) as [string, number][];
    const desiredMap: { [productId: number]: number } = {};
    desiredEntries.forEach(([pid, qty]) => { desiredMap[Number(pid)] = Number(qty); });

    const ops: Promise<any>[] = [];

    for (const cur of currentItems) {
      if (!(cur.product_id in desiredMap)) {
        ops.push(
          apiCall(`/cart/item/${cur.id}`, { method: 'DELETE', requiresAuth: false }).catch(() => {})
        );
      }
    }

    for (const [pidStr, qty] of desiredEntries) {
      const pid = Number(pidStr);
      const existing = currentItems.find(c => c.product_id === pid);
      if (existing) {
        if (existing.quantity !== qty) {
          ops.push(
            apiCall(`/cart/item/${existing.id}`, {
              method: 'PUT',
              body: JSON.stringify({ quantity: qty }),
              requiresAuth: false,
            }).catch(() => {})
          );
        }
      } else {
        ops.push(
          apiCall('/cart', {
            method: 'POST',
            body: JSON.stringify({ user_phone: phone, product_id: pid, quantity: qty }),
            requiresAuth: false,
          }).catch(() => {})
        );
      }
    }

    await Promise.all(ops);
  },

  // Set exact quantity for a cart item (upsert). quantity=0 removes the item. Single API call, no GET.
  setCartQty: async (phone: string, productId: number, quantity: number, selectedColor?: string, selectedSize?: string) => {
    return apiCall('/cart/set', {
      method: 'POST',
      body: JSON.stringify({ user_phone: phone, product_id: productId, quantity, selected_color: selectedColor || '', selected_size: selectedSize || '' }),
      requiresAuth: false,
    });
  },

  // Remove a specific item from cart by product_id. Single API call, no GET.
  removeCartItem: async (phone: string, productId: number) => {
    return apiCall('/cart/item', {
      method: 'DELETE',
      body: JSON.stringify({ user_phone: phone, product_id: productId }),
      requiresAuth: false,
    });
  },

  // Get user receipts
  getReceipts: async (phone: string) => {
    return apiCall(`/users/${phone}/receipts`, { requiresAuth: false });
  },

  // 👤 Public profile / stats / reviews / subscriptions
  getProfile: async (phone: string) => apiCall(`/users/${phone}/profile`, { requiresAuth: false }),
  getStats: async (phone: string) => apiCall(`/users/${phone}/stats`, { requiresAuth: false }),
  getReviews: async (phone: string) => apiCall(`/users/${phone}/reviews`, { requiresAuth: false }),
  incrementViews: async (phone: string) =>
    apiCall(`/users/${phone}/increment-views`, { method: 'POST', requiresAuth: false }),
  toggleSubscription: async (phone: string, targetPhone: string) =>
    apiCall(`/users/${phone}/subscribe`, { method: 'POST', body: JSON.stringify({ targetPhone }), requiresAuth: false }),
  subscriptionStatus: async (phone: string, targetPhone: string) =>
    apiCall(`/users/${phone}/subscription-status/${targetPhone}`, { requiresAuth: false }),

  // List all users (admin only)
  list: async (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/users?${query}`);
  },

  // Get user by ID (admin only)
  get: async (id: string) => {
    return apiCall(`/users/${id}`);
  },

  // Delete user (admin only)
  delete: async (id: string) => {
    return apiCall(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Get users count (admin only)
  count: async () => {
    return apiCall('/users/count');
  },
};

// ============================================================================
// EXPENSES API
// ============================================================================

export const expenses = {
  // Create expense
  create: async (data: {
    amount: number;
    category: string;
    description?: string;
    date?: string;
  }) => {
    return apiCall('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // List expenses
  list: async (params?: {
    companyId?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/expenses?${query}`);
  },

  // Get expense by ID
  get: async (id: string) => {
    return apiCall(`/expenses/${id}`);
  },

  // Update expense
  update: async (id: string, data: Partial<any>) => {
    return apiCall(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete expense
  delete: async (id: string) => {
    return apiCall(`/expenses/${id}`, {
      method: 'DELETE',
    });
  },

  // Get expenses summary
  summary: async (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/expenses/analytics/summary?${query}`);
  },
};

// ============================================================================
// PRODUCT PURCHASES API
// 📦 API для истории закупок товаров
// ============================================================================

export const productPurchases = {
  // Create product purchase
  create: async (data: {
    companyId: number;
    productId?: number;
    variantId?: number;
    productName: string;
    quantity: number;
    purchasePrice: number;
    totalCost: number;
    supplier?: string;
    notes?: string;
    purchaseDate?: string;
  }) => {
    return apiCall('/product-purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // List product purchases
  list: async (params?: {
    companyId?: string | number;
    startDate?: string;
    endDate?: string;
    productId?: string | number;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/product-purchases?${query}`);
  },

  // Get purchase statistics
  stats: async (params?: {
    companyId?: string | number;
    startDate?: string;
    endDate?: string;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/product-purchases/stats?${query}`);
  },

  // Update product purchase
  update: async (id: string | number, data: Partial<any>) => {
    return apiCall(`/product-purchases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete product purchase
  delete: async (id: string | number) => {
    return apiCall(`/product-purchases/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// COMPANY MESSAGES API (входящие сообщения компании от админа)
// ============================================================================
// ⚠️ Раньше эти вызовы шли через «голый» fetch без Authorization-заголовка,
// поэтому endpoint'ы, защищённые RequireAdminOrOwnCompanyParam, отвечали 401.
// apiCall всегда добавляет JWT-токен, поэтому используем его.

export const companyMessages = {
  // Список сообщений компании
  list: async (companyId: number | string) => {
    return apiCall(`/company-messages/company/${companyId}`);
  },

  // Количество непрочитанных сообщений
  count: async (companyId: number | string) => {
    return apiCall(`/company-messages/company/${companyId}/count`);
  },

  // Отметить одно сообщение прочитанным
  markRead: async (messageId: number | string) => {
    return apiCall(`/company-messages/${messageId}/read`, { method: 'PUT' });
  },

  // Отметить все сообщения компании прочитанными
  markAllRead: async (companyId: number | string) => {
    return apiCall(`/company-messages/company/${companyId}/read-all`, { method: 'PUT' });
  },

  // === Админ ===
  // Список компаний для рассылки (только админ)
  adminListCompanies: async () => {
    return apiCall('/company-messages/companies');
  },

  // Отправить сообщение одной компании
  adminSend: async (payload: { company_id: number | string; title: string; message: string }) => {
    return apiCall('/company-messages/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Отправить сообщение всем компаниям
  adminSendAll: async (payload: { title: string; message: string }) => {
    return apiCall('/company-messages/send-all', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ============================================================================
// ADS API
// ============================================================================

export const ads = {
  // Upload ad image
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiCall('/ads/upload-image', {
      method: 'POST',
      body: formData,
    });
  },

  // Create ad
  create: async (data: {
    title: string;
    content: string;
    linkUrl?: string;
    imageUrl?: string;
    adType: 'company' | 'product'; // 🆕 Тип рекламы
    companyId?: number;
    productId?: number; // 🆕 ID товара для рекламы товара
  }) => {
    // Преобразуем camelCase в snake_case для бэкенда
    const backendData = {
      title: data.title,
      content: data.content,
      caption: data.content, // Дублируем в caption для отображения
      link_url: data.linkUrl || '',
      image_url: data.imageUrl || '', // ✅ Преобразуем imageUrl -> image_url
      ad_type: data.adType, // ✅ Преобразуем adType -> ad_type
      company_id: data.companyId,
      product_id: data.productId
    };
    
    console.log('📤 [API] Sending ad data to backend:', backendData);
    
    return apiCall('/ads', {
      method: 'POST',
      body: JSON.stringify(backendData),
    });
  },

  // List ads
  list: async (params?: {
    status?: 'pending' | 'approved' | 'rejected' | 'deleted';
    companyId?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/ads?${query}`, { requiresAuth: false });
  },

  // Get ad by ID
  get: async (id: string) => {
    return apiCall(`/ads/${id}`, { requiresAuth: false });
  },

  // Update ad
  update: async (id: string, data: Partial<any>) => {
    return apiCall(`/ads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete ad (soft delete - sets status to 'deleted')
  delete: async (id: string) => {
    return apiCall(`/ads/${id}`, {
      method: 'DELETE',
    });
  },

  // Delete all company ads
  deleteAll: async (companyId: string) => {
    return apiCall(`/ads/company/${companyId}/all`, {
      method: 'DELETE',
    });
  },

  // Update ad link_url (admin only)
  updateLink: async (id: string, linkUrl: string) => {
    return apiCall(`/ads/${id}/link`, {
      method: 'PUT',
      body: JSON.stringify({ link_url: linkUrl }),
    });
  },

  // Moderate ad (admin only)
  moderate: async (id: string, status: 'approved' | 'rejected', reason?: string, adminMessage?: string) => {
    return apiCall(`/ads/${id}/moderate`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status, 
        reason: reason || null,
        admin_message: adminMessage || null,
      }),
    });
  },
};

// ============================================================================
// MESSAGES API
// ============================================================================

export const messages = {
  // Send message to company
  sendToCompany: async (data: {
    companyId: string;
    message: string;
    mediaUrl?: string;
  }) => {
    return apiCall('/messages/company', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reply to user (company only)
  replyToUser: async (data: {
    userId: string;
    message: string;
    mediaUrl?: string;
  }) => {
    return apiCall('/messages/company/reply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get messages with company
  getCompanyMessages: async (companyId: string, params?: {
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/messages/company/${companyId}?${query}`);
  },

  // Send message to admin (company only)
  sendToAdmin: async (data: { message: string; mediaUrl?: string }) => {
    return apiCall('/messages/admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reply to company (admin only)
  replyToCompany: async (data: {
    companyId: string;
    message: string;
    mediaUrl?: string;
  }) => {
    return apiCall('/messages/admin/reply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get admin messages
  getAdminMessages: async (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/messages/admin?${query}`);
  },

  // Upload media
  uploadMedia: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiCall('/messages/upload', {
      method: 'POST',
      body: formData,
      headers: {},
    });
  },

  // Delete message
  delete: async (id: string, type: 'company' | 'admin') => {
    return apiCall(`/messages/${id}?type=${type}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// ANALYTICS API
// ============================================================================

export const analytics = {
  // Get company statistics
  company: async (companyId: string, params?: {
    startDate?: string;
    endDate?: string;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/analytics/company/${companyId}?${query}`);
  },

  // 📊 Unified seller dashboard snapshot
  dashboard: async (companyId: string | number) => {
    return apiCall(`/analytics/company/${companyId}/dashboard`);
  },

  // 📦 Инсайты склада: прогноз остатков (дней до нуля) + ABC-анализ по выручке
  inventoryInsights: async (companyId: string | number) => {
    return apiCall(`/analytics/company/${companyId}/inventory-insights`);
  },

  // Get top products
  topProducts: async (params?: { companyId?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/analytics/products/top?${query}`, { requiresAuth: false });
  },

  // Get revenue analytics
  revenue: async (params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/analytics/revenue?${query}`);
  },

  // Get ROI
  roi: async (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/analytics/roi?${query}`);
  },

  // Get inventory analytics
  inventory: async () => {
    return apiCall('/analytics/inventory');
  },

  // Get order statistics
  orders: async (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/analytics/orders?${query}`);
  },

  // Get admin overview (admin only)
  adminOverview: async () => {
    return apiCall('/analytics/admin/overview');
  },
};

// ============================================================================
// 🛡️ Модерация и жалобы (админ) + 🚩 создание жалобы (покупатель)
// ============================================================================
export const moderation = {
  feed: () => apiCall('/admin/moderation-feed'),
  // 🔍 Единый поиск по платформе (товары, магазины, пользователи, заказы)
  globalSearch: (q: string) => apiCall(`/admin/global-search?q=${encodeURIComponent(q)}`),
};

export const complaints = {
  // Покупатель жалуется на товар/магазин
  create: (data: { targetType: 'product' | 'company'; targetId: number; customerPhone?: string; reason: string; message?: string }) =>
    apiCall('/complaints', { method: 'POST', body: JSON.stringify(data), requiresAuth: false }),
  // Очередь жалоб (админ)
  list: (status = 'open') => apiCall(`/complaints?status=${status}`),
  resolve: (id: number | string, status: 'resolved' | 'dismissed', note?: string) =>
    apiCall(`/complaints/${id}/resolve`, { method: 'PUT', body: JSON.stringify({ status, note }) }),
};

// ============================================================================
// Health Check
// ============================================================================

export async function checkServerHealth(): Promise<boolean> {
  try {
    await fetch(`${API_BASE.replace('/api', '')}/health`, { requiresAuth: false } as any);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Export all APIs as default
// ============================================================================

// Reviews API
export const reviews = {
  create: async (data: {
    product_id: number;
    user_phone: string;
    user_name: string;
    rating: number;
    comment: string;
  }) => {
    return apiCall('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  // ⭐ Все отзывы на товары компании (для панели управления продавца)
  listByCompany: async (companyId: number | string) => {
    return apiCall(`/companies/${companyId}/product-reviews`);
  },
  // 🗑 Продавец удаляет неуместный отзыв
  delete: async (reviewId: number | string) => {
    return apiCall(`/reviews/${reviewId}`, { method: 'DELETE' });
  },
};

// ============================================================================
// Discounts API
// ============================================================================

export const discounts = {
  // Create discount (company)
  create: async (data: {
    companyId: number;
    productId: number;
    variantId?: number | null; // null = весь товар, иначе конкретный SKU
    discountPercent: number;
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return apiCall('/discounts', {
      method: 'POST',
      body: JSON.stringify({
        companyId: data.companyId,
        productId: data.productId,
        variantId: data.variantId ?? null,
        discountPercent: data.discountPercent,
        title: data.title || null,
        description: data.description || null,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined
      }),
    });
  },

  // Get company discounts
  listByCompany: async (companyId: number) => {
    return apiCall(`/discounts/company/${companyId}`);
  },

  // Get all discounts (admin)
  listAll: async () => {
    return apiCall('/discounts/all');
  },

  // Get approved discounts (public)
  listApproved: async () => {
    return apiCall('/discounts/approved', { requiresAuth: false });
  },

  // Update discount status (admin)
  updateStatus: async (id: number, status: 'approved' | 'rejected') => {
    return apiCall(`/discounts/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // Delete discount
  delete: async (id: number) => {
    return apiCall(`/discounts/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// Aggressive Discounts API
// ============================================================================

export const aggressiveDiscounts = {
  // Get approved aggressive discounts (public)
  listApproved: async () => {
    return apiCall('/aggressive-discounts/approved', { requiresAuth: false });
  },

  // Create aggressive discount (company) — требует токен (RequireCompany)
  create: async (data: {
    companyId: number;
    productId: number;
    variantId?: number | null;
    discountPercent: number;
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return apiCall('/aggressive-discounts', {
      method: 'POST',
      body: JSON.stringify({
        companyId: data.companyId,
        productId: data.productId,
        variantId: data.variantId ?? null,
        discountPercent: data.discountPercent,
        title: data.title || null,
        description: data.description || null,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      }),
    });
  },

  // Company aggressive discounts
  listByCompany: async (companyId: number | string) =>
    apiCall(`/aggressive-discounts/company/${companyId}`, { requiresAuth: false }),

  // Delete aggressive discount (company) — требует токен
  delete: async (id: number) =>
    apiCall(`/aggressive-discounts/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// CATEGORIES API - Глобальные категории (управляются админом)
// ============================================================================

export const categories = {
  // Список категорий (публично)
  list: async (activeOnly = false) =>
    apiCall(`/categories${activeOnly ? '?activeOnly=true' : ''}`, { requiresAuth: false }),

  // Создать категорию (админ) — требует токен
  create: async (data: { name: string; icon: string; description?: string; sortOrder?: number }) =>
    apiCall('/categories', { method: 'POST', body: JSON.stringify(data) }),

  // Обновить категорию (админ)
  update: async (id: number | string, data: Partial<{ name: string; icon: string; description: string; isActive: boolean; sortOrder: number }>) =>
    apiCall(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Удалить категорию (админ)
  delete: async (id: number | string) =>
    apiCall(`/categories/${id}`, { method: 'DELETE' }),

  // Загрузить картинку-иконку (PNG/SVG), возвращает { url }
  uploadIcon: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiCall('/categories/upload-icon', { method: 'POST', body: formData });
  },
};

// ============================================================================
// REFERRALS API - Реферальная система
// ============================================================================

export const referrals = {
  // Создать реферального агента (админ)
  createAgent: async (data: { phone: string; password: string; name?: string; surname?: string; commission_percent?: number }) => {
    return apiCall('/referrals/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Изменить процент агента (админ)
  updateAgentCommission: async (agentId: number | string, commissionPercent: number) => {
    return apiCall(`/referrals/agents/${agentId}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ commission_percent: commissionPercent }),
    });
  },

  // Изменить процент платформы для компании (админ) + уведомление компании
  updateCompanyCommission: async (companyId: number | string, platformCommissionPercent: number, message?: string) => {
    return apiCall(`/referrals/companies/${companyId}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ platform_commission_percent: platformCommissionPercent, message }),
    });
  },

  // Вход реферального агента
  loginAgent: async (phone: string, password: string) => {
    const response = await apiCall('/referrals/agents/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
      requiresAuth: false,
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    return response;
  },

  // Получить всех агентов (админ)
  listAgents: async () => {
    return apiCall('/referrals/agents');
  },

  // Получить статистику агента
  getAgentStats: async (agentId: number | string) => {
    return apiCall(`/referrals/agents/${agentId}/stats`);
  },

  // 💰 Получить финансовую аналитику агента
  getAgentAnalytics: async (agentId: number | string) => {
    return apiCall(`/referrals/agents/${agentId}/analytics`);
  },

  // Обновить пароль агента
  updateAgentPassword: async (agentId: number | string, oldPassword: string, newPassword: string) => {
    return apiCall(`/referrals/agents/${agentId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  // Удалить агента (админ)
  deleteAgent: async (agentId: number | string) => {
    return apiCall(`/referrals/agents/${agentId}`, {
      method: 'DELETE',
    });
  },

  // Получить компании агента
  getMyCompanies: async (agentId: number | string) => {
    return apiCall(`/referrals/agents/${agentId}/companies`);
  },

  // Проверить реферальный код
  validateCode: async (code: string) => {
    return apiCall(`/referrals/validate/${code}`, {
      requiresAuth: false,
    });
  },

  // Включить/выключить компанию (админ)
  toggleCompanyStatus: async (companyId: number | string, isEnabled: boolean) => {
    return apiCall(`/referrals/companies/${companyId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ isEnabled }),
    });
  },

  // Получить все компании с реферальной информацией (админ)
  getAllCompaniesWithReferralInfo: async () => {
    return apiCall('/referrals/companies/all');
  },
};

// ============================================================================
// 🎟️ Promo codes API (промокоды)
// ============================================================================

export const promoCodes = {
  create: (data: any) =>
    apiCall('/promo-codes', { method: 'POST', body: JSON.stringify(data) }),
  // Компания создаёт/удаляет свой промокод
  createForCompany: (companyId: number | string, data: any) =>
    apiCall(`/promo-codes/company/${companyId}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteForCompany: (companyId: number | string, id: number | string) =>
    apiCall(`/promo-codes/company/${companyId}/${id}`, { method: 'DELETE' }),
  listByCompany: (companyId: number | string) =>
    apiCall(`/promo-codes/company/${companyId}`),
  listAll: () => apiCall('/promo-codes/all'),
  validate: (data: { code: string; userPhone?: string; companyId?: number | null; orderAmount: number }) =>
    apiCall('/promo-codes/validate', { method: 'POST', body: JSON.stringify(data), requiresAuth: false }),
  redeem: (data: { promoId: number; userPhone?: string; orderId?: number | null; discount: number }) =>
    apiCall('/promo-codes/redeem', { method: 'POST', body: JSON.stringify(data), requiresAuth: false }),
  toggle: (id: number | string, isActive: boolean) =>
    apiCall(`/promo-codes/${id}/toggle`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
  delete: (id: number | string) =>
    apiCall(`/promo-codes/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// ↩️ Returns / refunds API (возвраты)
// ============================================================================

export const returns = {
  create: (data: any) =>
    apiCall('/returns', { method: 'POST', body: JSON.stringify(data), requiresAuth: false }),
  listByCompany: (companyId: number | string) =>
    apiCall(`/returns?companyId=${companyId}`),
  listByCustomer: (phone: string) =>
    apiCall(`/returns?customerPhone=${encodeURIComponent(phone)}`, { requiresAuth: false }),
  get: (id: number | string) =>
    apiCall(`/returns/${id}`),
  updateStatus: (id: number | string, status: string, comment?: string) =>
    apiCall(`/returns/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, comment }) }),
};

// ============================================================================
// ❓ Product questions API (вопросы к товару)
// ============================================================================

export const productQuestions = {
  ask: (productId: number | string, data: { userPhone: string; userName?: string; question: string }) =>
    apiCall(`/products/${productId}/questions`, { method: 'POST', body: JSON.stringify(data), requiresAuth: false }),
  listByProduct: (productId: number | string) =>
    apiCall(`/products/${productId}/questions`, { requiresAuth: false }),
  listByCompany: (companyId: number | string, unansweredOnly = false) =>
    apiCall(`/questions/company/${companyId}${unansweredOnly ? '?unanswered=true' : ''}`),
  answer: (questionId: number | string, data: { answer: string; answeredBy?: string }) =>
    apiCall(`/questions/${questionId}/answer`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (questionId: number | string) =>
    apiCall(`/questions/${questionId}`, { method: 'DELETE' }),
};

// ============================================================================
// ⭐ Loyalty / cashback API (баллы и кэшбэк)
// ============================================================================

export const loyalty = {
  get: (phone: string) =>
    apiCall(`/loyalty/${encodeURIComponent(phone)}`, { requiresAuth: false }),
  earn: (data: { userPhone: string; points: number; orderId?: number | null; description?: string }) =>
    apiCall('/loyalty/earn', { method: 'POST', body: JSON.stringify(data) }),
  redeem: (data: { userPhone: string; points: number; orderId?: number | null; description?: string }) =>
    apiCall('/loyalty/redeem', { method: 'POST', body: JSON.stringify(data), requiresAuth: false }),
};

// ============================================================================
// BROADCAST CHAT API (общий канал: админ — владелец, компании — участники)
// ============================================================================
export const broadcast = {
  list: (limit = 100) => apiCall(`/broadcast/messages?limit=${limit}`),
  send: (data: { type: string; content?: string; mediaUrl?: string }) =>
    apiCall('/broadcast/messages', { method: 'POST', body: JSON.stringify(data) }),
  edit: (id: number, content: string) =>
    apiCall(`/broadcast/messages/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  remove: (id: number) =>
    apiCall(`/broadcast/messages/${id}`, { method: 'DELETE' }),
  upload: (file: File | Blob, filename = 'file') => {
    const form = new FormData();
    form.append('file', file, filename);
    return apiCall('/broadcast/upload', { method: 'POST', body: form });
  },
  ban: (companyId: number, minutes: number, reason = '') =>
    apiCall('/broadcast/ban', { method: 'POST', body: JSON.stringify({ companyId, minutes, reason }) }),
  unban: (companyId: number) =>
    apiCall(`/broadcast/ban/${companyId}`, { method: 'DELETE' }),
  bans: () => apiCall('/broadcast/bans'),
};

// ============================================================================
// REGIONS API (границы рисует админ, компании выбирают свой регион)
// ============================================================================
export const regions = {
  list: () => apiCall('/regions', { requiresAuth: false }),
  create: (data: { name: string; nameUz?: string; parentId?: number | null; geojson: any }) =>
    apiCall('/regions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name: string; nameUz?: string; geojson: any }) =>
    apiCall(`/regions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => apiCall(`/regions/${id}`, { method: 'DELETE' }),
  setCompanyRegion: (companyId: number, regionId: number | null) =>
    apiCall(`/companies/${companyId}/region`, { method: 'PUT', body: JSON.stringify({ regionId }) }),
};

// ============================================================================
// DECORATION VIDEOS API (админ загружает короткие ролики, компании их используют
// как анимированный фон страницы магазина)
// ============================================================================
// ============================================================================
// CUSTOMER NOTIFICATIONS API (общий backend с приложением Homepage)
// ============================================================================
export const notifications = {
  list: (phone: string) =>
    apiCall(`/notifications?userPhone=${encodeURIComponent(phone)}`, { requiresAuth: false }),
  unreadCount: (phone: string) =>
    apiCall(`/notifications/unread-count?userPhone=${encodeURIComponent(phone)}`, { requiresAuth: false }),
  markRead: (id: number | string) =>
    apiCall(`/notifications/${id}/read`, { method: 'PUT', requiresAuth: false }),
  markAllRead: (phone: string) =>
    apiCall('/notifications/mark-all-read', { method: 'PUT', body: JSON.stringify({ user_phone: phone }), requiresAuth: false }),
};

export const decorationVideos = {
  list: () => apiCall('/decoration-videos', { requiresAuth: false }),
  upload: (file: File, title = '') => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return apiCall('/decoration-videos', { method: 'POST', body: form });
  },
  remove: (id: number) => apiCall(`/decoration-videos/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// 📢 Внутренняя реклама (промо-размещение)
// ============================================================================
export const promotions = {
  // Продавец подаёт заявку: scope 'company' (весь магазин) | 'product'
  request: (data: { companyId: number; scope: 'company' | 'product'; productId?: number; days: number; note?: string }) =>
    apiCall('/promotions', { method: 'POST', body: JSON.stringify(data) }),
  // Заявки/статусы своей компании
  listByCompany: (companyId: number | string) =>
    apiCall(`/promotions/company/${companyId}`),
  // Все заявки (админ), ?status=pending — очередь модерации
  listAll: (status?: string) =>
    apiCall(`/promotions${status ? `?status=${status}` : ''}`),
  revenue: () => apiCall('/promotions/revenue'),
  approve: (id: number | string, amount: number, days?: number) =>
    apiCall(`/promotions/${id}/approve`, { method: 'PUT', body: JSON.stringify({ amount, days }) }),
  reject: (id: number | string) =>
    apiCall(`/promotions/${id}/reject`, { method: 'PUT' }),
  cancel: (id: number | string) =>
    apiCall(`/promotions/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// 💸 ВЫВОД СРЕДСТВ (онлайн-заработок компаний за вычетом комиссии платформы)
// ============================================================================
export const payouts = {
  balance: (companyId: number) => apiCall(`/companies/${companyId}/payout-balance`),
  list: (companyId: number) => apiCall(`/companies/${companyId}/payouts`),
  create: (companyId: number, data: { cardNumber: string; cardHolder: string; amount: number }) =>
    apiCall(`/companies/${companyId}/payouts`, { method: 'POST', body: JSON.stringify(data) }),
  verifyCard: (cardNumber: string) =>
    apiCall('/payouts/verify-card', { method: 'POST', body: JSON.stringify({ cardNumber }) }),
  cancel: (id: number) => apiCall(`/payouts/${id}/cancel`, { method: 'PUT' }),
  // Админ: очередь выплат и ручная обработка
  listAll: (status?: string) => apiCall(`/payouts${status ? `?status=${status}` : ''}`),
  updateStatus: (id: number, data: { status: string; providerRef?: string; failureReason?: string }) =>
    apiCall(`/payouts/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ============================================================================
// 📜 ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ (customer | company)
// ============================================================================
export const policies = {
  get: (audience: 'customer' | 'company') =>
    apiCall(`/policies/${audience}`, { requiresAuth: false }),
  update: (audience: 'customer' | 'company', data: { contentRu: string; contentUz: string }) =>
    apiCall(`/policies/${audience}`, { method: 'PUT', body: JSON.stringify(data) }),
  accept: (audience: 'customer' | 'company', subject: string) =>
    apiCall(`/policies/${audience}/accept`, {
      method: 'POST',
      body: JSON.stringify({ subject }),
      requiresAuth: false,
    }),
};

export default {
  baseURL: API_BASE.replace('/api', ''), // 🔗 Base URL для прямых fetch запросов
  policies, // 📜 Политика конфиденциальности
  payouts, // 💸 Вывод средств компаний
  promotions, // 📢 Внутренняя реклама
  moderation, // 🛡️ Лента модерации
  complaints, // 🚩 Жалобы
  auth,
  broadcast, // 💬 Общий чат-канал
  regions, // 🗺️ Регионы доставки
  decorationVideos, // 🎬 Декоративные видео (фон страницы магазина)
  notifications, // 🔔 Уведомления покупателя
  products,
  sales,
  cashSales,
  orders,
  companies,
  users,
  expenses,
  productPurchases, // 📦 История закупок товаров
  companyMessages, // 📬 Входящие сообщения компании
  ads,
  aggressiveDiscounts,
  messages,
  analytics,
  reviews,
  discounts,
  categories, // 🗂️ Глобальные категории
  referrals, // 👥 Реферальная система
  promoCodes, // 🎟️ Промокоды
  returns, // ↩️ Возвраты
  productQuestions, // ❓ Вопросы к товару
  loyalty, // ⭐ Баллы и кэшбэк
  checkServerHealth,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
};

// ============================================================================
// Legacy API function aliases (for backward compatibility with cache.tsx)
// ============================================================================

export const getProducts = (companyId?: number | string) => 
  products.list({ companyId: companyId ? String(companyId) : undefined });
export const getProductsPaginated = (params: any) => products.list(params);
export const addProduct = (data: any) => products.create(data);
export const updateProduct = (id: string, data: any) => products.update(id, data);
export const deleteProduct = (id: string) => products.delete(id);
export const bulkToggleCustomerAvailability = (productIds: number[], setAvailable: boolean) => 
  products.bulkToggleAvailability(productIds, setAvailable);

export const getSalesHistory = (companyId: string) => sales.list({ companyId });
export const getCustomerOrders = (companyId: string) => orders.list({ companyId });
export const addCustomerOrder = (data: any) => orders.create(data);

export const getCompanies = () => companies.list();
export const addUser = (data: { first_name?: string; last_name?: string; phone_number: string; company_id?: string | null }) => {
  const fullName = data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : data.first_name || '';
  return auth.registerUser(data.phone_number, fullName);
};
export const getCompanyRevenue = () => analytics.revenue();
export const getCompanyProfile = (companyId: string) => companies.get(companyId);

export const getUserCart = (phone: string) => users.getCart(phone);
export const getUserCartFull = (phone: string) => users.getCart(phone);
export const saveUserCart = (phone: string, cart: any) => users.saveCart(phone, cart);
export const getUserLikes = (phone: string) => users.getLikes(phone);
export const saveUserLikes = (phone: string, likes: any) => users.saveLikes(phone, likes);
export const getUserReceipts = (phone: string) => users.getReceipts(phone);
