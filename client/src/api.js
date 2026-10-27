const TOKEN_KEY = 'zipher-token';
const USER_KEY = 'zipher-user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent('zipher-auth-lost'));
    }
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

export function register(email, password, name) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe() {
  return request('/api/auth/me');
}

export function fetchRecords(kind, rewardType) {
  const params = new URLSearchParams({ kind });
  if (rewardType) params.set('rewardType', rewardType);
  return request(`/api/records?${params.toString()}`);
}

export function createRecord(body) {
  return request('/api/records', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteRecord(id) {
  return request(`/api/records/${id}`, { method: 'DELETE' });
}

export function fetchSummary() {
  return request('/api/summary');
}

export function notifySaved() {
  window.dispatchEvent(new CustomEvent('zipher-saved'));
}

export function todayParts() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  const day = pick('day');
  const month = pick('month');
  const year = pick('year');
  return { day, month, year, label: `${day} ${month} ${year}` };
}

function clockInKolkata(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${pick('hour')}:${pick('minute')}`;
}

export function nowTimeParts() {
  const now = new Date();
  const from = clockInKolkata(now);
  const to = clockInKolkata(new Date(now.getTime() + 8 * 60 * 60 * 1000));
  return { from, to, label: `${from} to ${to}` };
}

export function savedWhen(record) {
  if (!record) return '';
  return `${record.day} ${record.month} ${record.year}`;
}
