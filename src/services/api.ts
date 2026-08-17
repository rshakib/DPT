import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://e-pay-fydp.onrender.com';

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

// 2. register(username, password, nid, activationCode)
export async function register(
  username: string,
  password: string,
  nid: string,
  activationCode: string
): Promise<ApiResult<any>> {
  try {
    const cleanUsername = username.toLowerCase().trim();
    const response = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: await getHeaders(false),
      body: JSON.stringify({ username: cleanUsername, password, nid, activationCode }),
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

// 4. transfer(username, receiver, amount)
export async function transfer(
  username: string,
  receiver: string,
  amount: number
): Promise<ApiResult<any>> {
  try {
    const payload = { username, receiver, amount };
    const headers = await getHeaders(true);
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
