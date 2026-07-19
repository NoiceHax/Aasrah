"use client";

import { apiClient } from "./client";
import type {
  AuthResponse,
  GeocodeResult,
  PublicNgo,
  PublicStats,
  ReportCreateInput,
  ReportCreateResponse,
  ReportTracking,
  TokenPair,
  User,
} from "./types";

/* ---- Auth ---- */

export const authApi = {
  async register(input: {
    // Public registration always creates a Volunteer (pending approval).
    // Role is not client-selectable; NGO/Admin accounts are provisioned by an admin.
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>("/auth/register", input);
    return data;
  },
  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
    return data;
  },
  async refresh(refresh_token: string): Promise<TokenPair> {
    const { data } = await apiClient.post<TokenPair>("/auth/refresh", { refresh_token });
    return data;
  },
  async logout(refresh_token: string): Promise<void> {
    await apiClient.post("/auth/logout", { refresh_token });
  },
  async me(): Promise<User> {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
  async forgotPassword(email: string): Promise<{ message: string; reset_token?: string | null }> {
    const { data } = await apiClient.post("/auth/forgot-password", { email });
    return data;
  },
  async resetPassword(token: string, new_password: string): Promise<{ message: string }> {
    const { data } = await apiClient.post("/auth/reset-password", { token, new_password });
    return data;
  },
};

/* ---- Reports ---- */

export const reportsApi = {
  async create(input: ReportCreateInput): Promise<ReportCreateResponse> {
    const { data } = await apiClient.post<ReportCreateResponse>("/reports", input);
    return data;
  },
  async uploadImages(reportId: string, files: File[]): Promise<void> {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    await apiClient.post(`/reports/${reportId}/images`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  async track(trackingId: string): Promise<ReportTracking> {
    const { data } = await apiClient.get<ReportTracking>(
      `/reports/track/${encodeURIComponent(trackingId)}`,
    );
    return data;
  },
};

/* ---- Public stats & directory ---- */

export const statsApi = {
  async platform(): Promise<PublicStats> {
    const { data } = await apiClient.get<PublicStats>("/stats");
    return data;
  },
  async ngos(): Promise<PublicNgo[]> {
    const { data } = await apiClient.get<PublicNgo[]>("/stats/ngos");
    return data;
  },
};

/* ---- Maps ---- */

export const mapsApi = {
  async reverse(lat: number, lon: number): Promise<GeocodeResult> {
    const { data } = await apiClient.get<GeocodeResult>("/maps/reverse", {
      params: { lat, lon },
    });
    return data;
  },
  async search(q: string, limit = 5): Promise<GeocodeResult[]> {
    const { data } = await apiClient.get<GeocodeResult[]>("/maps/search", {
      params: { q, limit },
    });
    return data;
  },
};

/** Resolve a relative upload URL (e.g. /uploads/..) to an absolute origin. */
export function resolveImageUrl(url: string): string {
  if (url.startsWith("http")) return url;
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:8000";
  return `${origin}${url}`;
}
