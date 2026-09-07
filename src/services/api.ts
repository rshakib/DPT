import * as SecureStore from 'expo-secure-store';

// ============================================
// Toggle this for local vs production testing
// LOCAL:   http://10.0.2.2:5001 (Android emulator) or http://localhost:5001 (iOS/web)
// PROD:    https://e-pay-fydp.onrender.com
// ============================================
const USE_LOCAL = true; // <-- Change to false before deploying to Render

const BASE_URL = USE_LOCAL
  ? 'http://192.168.0.212:5001'  // PC's local IP (Ethernet + WiFi same router)
  : 'https://e-pay-fydp.onrender.com';

const TOKEN_KEY = 'niropay_token';
const USER_KEY = 'niropay_user';

async function getHeaders(authRequired = true) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authRequired) {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export interface ApiResult<T> {
  success: boolean;
  message?: string;
  data?: T;
  status?: number;
}

/**
 * Lightweight health check ping to keep Render free-tier server awake.
 * Uses a minimal GET request with a short timeout.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${BASE_URL}/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Fetch the server's RSA public key for envelope encryption.
 */
export async function getServerPublicKey(): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/server-public-key`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await response.json();
    if (response.ok && json.public_key) {
      return json.public_key;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper for crash-proof JSON parsing from raw HTTP response
async function safeParseJsonResponse(response: Response): Promise<{ success: boolean; json?: any; message?: string; status: number }> {
  const rawText = await response.text();
  try {
    const json = JSON.parse(rawText);
    return { success: true, json, status: response.status };
  } catch (parseError) {
    return {
      success: false,
      message: `Server returned invalid response (status ${response.status})`,
      status: response.status,
    };
  }
}

// 1. login(username, password)
export async function login(username: string, password: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: await getHeaders(false),
      body: JSON.stringify({ username, password }),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.ok) {
      const token = json.token;
      // Extract user object - handle if nested or direct
      const user = json.user || {
        id: json.id,
        username: json.username || username,
        t: json.t,
        balance: json.balance,
        accountId: json.accountId || json.account_id,
        daily_limit: json.daily_limit || json.dailyLimit,
        today_spent: json.today_spent || json.todaySpent,
      };

      // Persist in secure store
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

      return { success: true, data: { token, user } };
    } else {
      let message = json.error || json.message || 'Authentication failed';
      if (response.status === 400) message = json.error || 'Missing username or password';
      if (response.status === 401) message = json.error || 'Invalid password';
      if (response.status === 404) message = json.error || 'User not found';
      return { success: false, message, status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 2. register(username, password, nid, activationCode, extraFields?)
export async function register(
  username: string,
  password: string,
  nid: string,
  activationCode: string,
  extraFields?: {
    rsaPublicKey?: string;
    fullName?: string;
    mobile?: string;
    email?: string;
    biometricEnrolled?: boolean;
  }
): Promise<ApiResult<any>> {
  try {
    const cleanUsername = username.toLowerCase().trim();
    const payload: Record<string, any> = {
      username: cleanUsername,
      password,
      nid,
      activationCode,
    };
    if (extraFields?.rsaPublicKey) payload.rsaPublicKey = extraFields.rsaPublicKey;
    if (extraFields?.fullName) payload.fullName = extraFields.fullName;
    if (extraFields?.mobile) payload.mobile = extraFields.mobile;
    if (extraFields?.email) payload.email = extraFields.email;
    if (extraFields?.biometricEnrolled) payload.biometricEnrolled = extraFields.biometricEnrolled;

    const response = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: await getHeaders(false),
      body: JSON.stringify(payload),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.status === 201 || response.ok) {
      return { success: true, data: json };
    } else {
      return { success: false, message: json.error || json.message || 'Registration failed', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 3. checkReceiver(username)
export async function checkReceiver(username: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/check-receiver/${username}`, {
      method: 'GET',
      headers: await getHeaders(true),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.ok) {
      return { success: true, data: json };
    } else {
      return { success: false, message: json.error || json.message || 'Receiver not found', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 4. transfer(username, receiver, amount, idempotencyKey?)
export async function transfer(
  username: string,
  receiver: string,
  amount: number,
  idempotencyKey?: string
): Promise<ApiResult<any>> {
  try {
    const payload: Record<string, any> = { username, receiver, amount };
    if (idempotencyKey) {
      payload.idempotencyKey = idempotencyKey;
      payload.idempotency_key = idempotencyKey;
    }
    const headers = await getHeaders(true);
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await fetch(`${BASE_URL}/transfer`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.ok) {
      if (json.status === 'futile' || json.status === 'failed') {
        return { success: false, message: json.message || 'Transaction failed', status: 200 };
      }
      return { success: true, data: json };
    } else {
      let message = json.error || json.message || 'Transfer failed';
      if (response.status === 400) message = json.error || 'Invalid transfer parameters';
      if (response.status === 403) message = json.error || 'Forbidden transaction';
      return { success: false, message, status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 5. getUser(username)
export async function getUser(username: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/user/${username}`, {
      method: 'GET',
      headers: await getHeaders(true),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.ok) {
      return { success: true, data: json };
    } else {
      return { success: false, message: json.error || json.message || 'Failed to fetch user info', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 6. getTransactions(username, sinceTimestamp?)
export async function getTransactions(username: string, sinceTimestamp?: string): Promise<ApiResult<any>> {
  try {
    let url = `${BASE_URL}/transactions/${username}`;
    if (sinceTimestamp) {
      url += `?since=${encodeURIComponent(sinceTimestamp)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: await getHeaders(true),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.ok) {
      return { success: true, data: json.transactions || json };
    } else {
      return { success: false, message: json.error || json.message || 'Failed to fetch transactions', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 7. getNotifications(username, sinceTimestamp?)
export async function getNotifications(username: string, sinceTimestamp?: string): Promise<ApiResult<any>> {
  try {
    let url = `${BASE_URL}/notifications/${username}`;
    if (sinceTimestamp) {
      url += `?since=${encodeURIComponent(sinceTimestamp)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: await getHeaders(true),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.ok) {
      return { success: true, data: json.notifications || json };
    } else {
      return { success: false, message: json.error || json.message || 'Failed to fetch notifications', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 8. verifyPin(username, pin) - dry-run check without updating session tokens
export async function verifyPin(username: string, pin: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password: pin }),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    const json = parsed.json;

    if (response.ok) {
      return { success: true, data: json };
    } else {
      let message = json.error || json.message || 'Verification failed';
      if (response.status === 401) message = 'Invalid PIN';
      return { success: false, message, status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 9. saveProfilePicture(username, imageData) - save to DB1
export async function saveProfilePicture(username: string, imageData: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/profile-picture`, {
      method: 'POST',
      headers: await getHeaders(true),
      body: JSON.stringify({ username, imageData }),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    if (response.ok) {
      return { success: true, data: parsed.json };
    } else {
      return { success: false, message: parsed.json.message || 'Failed to save profile picture' };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

// 10. getProfilePicture(username) - get from DB1
export async function getProfilePicture(username: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/profile-picture/${username}`, {
      method: 'GET',
      headers: await getHeaders(true),
    });

    const parsed = await safeParseJsonResponse(response);
    if (!parsed.success) {
      return { success: false, message: parsed.message, status: parsed.status };
    }

    if (response.ok) {
      return { success: true, data: parsed.json };
    } else {
      return { success: false, message: parsed.json.message || 'Failed to get profile picture' };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}
