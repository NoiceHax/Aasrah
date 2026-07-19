"use client";

import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { tokenStore } from "./token-store";
import type { ApiError, TokenPair } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

// --- Request interceptor: attach the access token ---
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// --- Response interceptor: refresh on 401, normalize errors ---
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshing: Promise<TokenPair | null> | null = null;

async function refreshTokens(): Promise<TokenPair | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    // Use a bare axios call to avoid interceptor recursion.
    const { data } = await axios.post<TokenPair>(`${BASE_URL}/auth/refresh`, {
      refresh_token: refresh,
    });
    tokenStore.setTokens(data);
    return data;
  } catch {
    tokenStore.clear();
    return null;
  }
}

/**
 * Obtain a fresh access token via the refresh flow. Returns the new access
 * token, or null if refresh failed (i.e. the session is effectively dead).
 * Exposed for non-axios consumers like the WebSocket provider.
 */
export async function ensureFreshToken(): Promise<string | null> {
  const tokens = await refreshTokens();
  return tokens?.access_token ?? null;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: ApiError }>) => {
    const original = error.config as RetriableConfig | undefined;

    // Attempt a single transparent refresh on 401 (but never for the auth
    // endpoints themselves, to avoid loops).
    const isAuthCall = original?.url?.includes("/auth/");
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing ?? refreshTokens();
      const tokens = await refreshing;
      refreshing = null;
      if (tokens) {
        original.headers.set("Authorization", `Bearer ${tokens.access_token}`);
        return apiClient(original);
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export function normalizeError(error: unknown): ApiError {
  // The response interceptor already rejects with an ApiError, so callers that
  // normalize again must get the same object back rather than the fallback.
  if (isApiError(error)) return error;
  if (axios.isAxiosError(error)) {
    const axErr = error as AxiosError<{ error?: ApiError }>;
    const payload = axErr.response?.data?.error;
    if (payload) {
      return { ...payload, status: axErr.response?.status };
    }
    if (axErr.code === "ECONNABORTED") {
      return { code: "timeout", message: "The request timed out. Please try again." };
    }
    if (!axErr.response) {
      return {
        code: "network_error",
        message: "Can't reach the server. Check your connection and try again.",
      };
    }
    return {
      code: "http_error",
      message: axErr.message || "Something went wrong.",
      status: axErr.response?.status,
    };
  }
  if (error instanceof Error) {
    return { code: "unknown", message: error.message };
  }
  return { code: "unknown", message: "An unexpected error occurred." };
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as ApiError).code === "string" &&
    typeof (value as ApiError).message === "string"
  );
}
