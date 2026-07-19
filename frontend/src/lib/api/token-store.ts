"use client";

import type { TokenPair, User } from "./types";

/**
 * Token persistence. Phase 2 uses localStorage for simplicity; the access
 * token is short-lived and refresh rotation limits exposure. A later phase can
 * move refresh tokens to httpOnly cookies for stronger XSS resistance.
 */
const ACCESS_KEY = "aasrah.access";
const REFRESH_KEY = "aasrah.refresh";
const USER_KEY = "aasrah.user";

const isBrowser = typeof window !== "undefined";

export const tokenStore = {
  getAccess(): string | null {
    return isBrowser ? window.localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefresh(): string | null {
    return isBrowser ? window.localStorage.getItem(REFRESH_KEY) : null;
  },
  getUser(): User | null {
    if (!isBrowser) return null;
    const raw = window.localStorage.getItem(USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  setTokens(tokens: TokenPair) {
    if (!isBrowser) return;
    window.localStorage.setItem(ACCESS_KEY, tokens.access_token);
    window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  },
  setUser(user: User) {
    if (isBrowser) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    if (!isBrowser) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};
