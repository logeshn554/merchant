import { Platform } from 'react-native';

const CANDIDATE_HOSTS = [
  'http://localhost:3005/api',
  'http://10.10.71.164:3005/api',
  'http://10.0.2.2:3005/api',
];
let currentBaseUrl = 'http://localhost:3005/api';

let activeToken: string | null = null;
let activeUser: any = null;

export function setApiBaseUrl(url: string) {
  currentBaseUrl = url;
}

export function setAuthSession(token: string | null, user: any) {
  activeToken = token;
  activeUser = user;
}

export function getAuthSession() {
  return { token: activeToken, user: activeUser };
}

export async function merchantRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const headers: Record<string, string> = {
    'X-AllGo-App': 'merchant',
    'X-AllGo-Native': '1',
  };

  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const hostsToTry = [
    currentBaseUrl,
    ...CANDIDATE_HOSTS.filter(h => h !== currentBaseUrl),
  ];

  let lastError: any = null;
  for (const base of hostsToTry) {
    try {
      const url = `${base}${path}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed (${response.status})`);
      }

      currentBaseUrl = base;
      return data as T;
    } catch (err: any) {
      lastError = err;
      if (err.message && !err.message.includes('Network') && !err.message.includes('aborted') && err.name !== 'AbortError') {
        throw err;
      }
    }
  }

  throw lastError || new Error('Cannot reach account server. Please check your connection.');
}

export const merchantApi = {
  login: async (email: string, password: string) => {
    const res = await merchantRequest<{ token: string; profile: any }>('/auth/login', 'POST', { email, password });
    if (res.profile?.role && res.profile.role !== 'merchant') {
      throw new Error(`This account is a ${res.profile.role} account. Only merchant restaurant owners can access this app.`);
    }
    setAuthSession(res.token, res.profile);
    return res;
  },

  register: async (name: string, email: string, password: string, phone: string, restaurantName: string) => {
    const res = await merchantRequest<{ token: string; profile: any }>('/auth/register', 'POST', {
      name,
      email,
      password,
      phone,
      role: 'merchant',
      restaurantName,
    });
    setAuthSession(res.token, res.profile);
    return res;
  },

  sendOtp: async (phone: string) => {
    return merchantRequest<{ ok: boolean; message: string; phone: string; devOtp?: string }>('/auth/otp/send', 'POST', { phone });
  },

  verifyOtp: async (phone: string, code: string) => {
    const res = await merchantRequest<{ token: string; profile: any }>('/auth/otp/verify', 'POST', { phone, code });
    if (res.profile?.role && res.profile.role !== 'merchant') {
      throw new Error(`This account is a ${res.profile.role} account. Only registered merchants can access this app.`);
    }
    setAuthSession(res.token, res.profile);
    return res;
  },

  getProfile: async () => {
    return merchantRequest<any>('/account');
  },

  logout: async () => {
    try {
      await merchantRequest('/auth/logout', 'POST');
    } catch {
      // Ignored
    }
    setAuthSession(null, null);
  },

  getOrders: async () => {
    return merchantRequest<any[]>('/orders/merchant');
  },

  acceptOrder: async (orderId: string, prepTimeMinutes: number = 20) => {
    // Immediate driver dispatch starts upon merchant acceptance!
    return merchantRequest<any>(`/orders/${encodeURIComponent(orderId)}/merchant-accept`, 'POST', {
      prepTimeMinutes,
    });
  },

  rejectOrder: async (orderId: string, reason: string) => {
    return merchantRequest<any>(`/orders/${encodeURIComponent(orderId)}/merchant-reject`, 'POST', {
      reason,
    });
  },

  setPreparing: async (orderId: string) => {
    return merchantRequest<any>(`/orders/${encodeURIComponent(orderId)}/merchant-preparing`, 'POST');
  },

  markReady: async (orderId: string) => {
    // Generates and returns server pickup_code
    return merchantRequest<{ ok: boolean; pickup_code: string; order_status: string }>(
      `/orders/${encodeURIComponent(orderId)}/merchant-ready`,
      'POST'
    );
  },

  getSettlements: async () => {
    return merchantRequest<any>('/merchant/settlements');
  },

  getMenu: async (restaurantId: string = 'res_spice_symphony') => {
    return merchantRequest<any[]>(`/data/catalog/menu?parent=${encodeURIComponent(restaurantId)}`);
  },
};
