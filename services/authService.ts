import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_DATA_KEY } from '../constants/config';


export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) throw new Error("No auth token found");
  return { Authorization: `Bearer ${token}` };
}

export async function fetchApiWithRefresh(url: string, requestInit?: RequestInit): Promise<any> {
  const headers = {
    ...await getAuthHeaders(),
    ...requestInit?.headers
  }
  const response = await fetch(url, {
    ...requestInit,
    headers
  });
  if (response.ok) return response;
  else if (response.status !== 401) throw new Error("Failed to fetch API");
  //if it's 401 the cause is likely that the jwt has expired
  //trying jwt refresh...
  const refreshTokenResponse = await getRefreshTokenResponse();
  if (!refreshTokenResponse.ok) throw new Error("Failed to fetch refresh Token");
  const data = await refreshTokenResponse.json();
  AsyncStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
  AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)

  //trying fetching again
  // recompute headers so Authorization contains the fresh access token
  const newHeaders = {
    ...await getAuthHeaders(),
    ...requestInit?.headers
  };
  const newResponse = await fetch(url, {
    ...requestInit,
    headers: newHeaders,
  });
  if (!newResponse.ok) throw new Error("Failed to fetch API");
  return newResponse;
}

async function getRefreshTokenResponse(): Promise<Response> {
  const refreshUrl = `${API_BASE_URL}/auth/refresh/`;
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  console.log("Refresh token : ", refreshToken);
  const refreshRequestInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body:
      JSON.stringify({ refresh_token: refreshToken })
  }
  const refreshResponse = await fetch(refreshUrl, refreshRequestInit);
  return refreshResponse;
}

export async function login(email: string, password: string): Promise<boolean> {
  const body = new URLSearchParams();
  body.append("grant_type", "password");
  body.append("username", email);
  body.append("password", password);

  //
  const response = await fetch(`${API_BASE_URL}/auth/jwt/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if(!response.ok) throw new Error("Failed logging in");
  const data = await response.json();
  if (!data.access_token || !data.refresh_token) throw new Error("Response is not containing necessary information");
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

  // Create a minimal user object since server doesn't return user data
  const userData = { id: 'user', email, name: email.split('@')[0] };
  await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  return true;
}

export async function getCurrentUser(){
  const storedUser = await AsyncStorage.getItem(USER_DATA_KEY);
  if(!storedUser) return null;
  const userObj = JSON.parse(storedUser);
  return userObj;
}

export async function register(email: string, password: string, name: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!response.ok) throw Error("Error during registration");
  // Auto-login after successful registration
  return await login(email, password);
}

export async function logout(): Promise<void> {
  try {
    await fetch('/auth/jwt/logout', { method: 'POST' });
  } catch (e) {
    // ignore errors from logout endpoint
  }
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_DATA_KEY);
}

export default {
  getAuthHeaders,
};
