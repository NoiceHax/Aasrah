"use client";

import { apiClient } from "./client";
import { API_ORIGIN } from "./config";
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
  /**
   * Attach photos to a freshly-created report.
   *
   * `uploadToken` is the short-lived capability returned by `create` — it is
   * what authorises an anonymous reporter to add images to their own report,
   * and it expires in minutes. Hold it in memory; never persist it.
   *
   * The timeout override matters: uploads are multi-megabyte phone photos,
   * often on a slow mobile connection, and the client-wide 20s default aborts
   * them mid-flight.
   */
  async uploadImages(reportId: string, files: File[], uploadToken: string): Promise<void> {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    await apiClient.post(`/reports/${reportId}/images`, form, {
      headers: {
        "Content-Type": "multipart/form-data",
        "X-Upload-Token": uploadToken,
      },
      timeout: 120_000,
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

/**
 * Resolve a relative file URL (e.g. `/api/v1/files/..`) against the API origin.
 *
 * The backend no longer serves stored files from an unauthenticated static
 * mount; every object is delivered by `GET /api/v1/files/{key}`, which requires
 * a bearer token and re-checks case ownership. This helper only builds the
 * absolute URL — it cannot attach the token, so the result is NOT usable as a
 * bare `<img src>` / `<a href>`. Fetch it with the authenticated client and
 * render the response as an object URL.
 */
export function resolveImageUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${API_ORIGIN}${url}`;
}

/**
 * Download a stored file that sits behind authorization.
 *
 * `GET /api/v1/files/{key}` requires a bearer token, so a plain `<a href>`
 * would 401. Fetch the bytes through the authenticated client and hand the
 * browser a temporary object URL instead.
 */
export async function downloadAuthedFile(url: string, filename?: string): Promise<void> {
  const path = url.replace(/^.*\/api\/v1/, "");
  const { data } = await apiClient.get(path, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data as Blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    if (filename) a.download = filename;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
