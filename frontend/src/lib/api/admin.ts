"use client";

import { apiClient } from "./client";
import type {
  AdminDashboardData,
  AdminNgo,
  AdminVolunteer,
  AdminUser,
  Announcement,
  AnnouncementAudience,
  AutomationRule,
  PaginatedAuditLogs,
  PaginatedUsers,
  PlatformInsight,
  SearchHit,
  UserRole,
} from "./types";

export const adminApi = {
  async dashboard(): Promise<AdminDashboardData> {
    return (await apiClient.get<AdminDashboardData>("/admin/dashboard")).data;
  },
  async ngos(pendingOnly = false): Promise<AdminNgo[]> {
    return (await apiClient.get<AdminNgo[]>("/admin/ngos", { params: { pending_only: pendingOnly } })).data;
  },
  async verifyNgo(ngoId: string, approve: boolean): Promise<AdminNgo> {
    return (await apiClient.post<AdminNgo>(`/admin/ngos/${ngoId}/verify?approve=${approve}`)).data;
  },
  async volunteers(pendingOnly = false): Promise<AdminVolunteer[]> {
    return (await apiClient.get<AdminVolunteer[]>("/admin/volunteers", { params: { pending_only: pendingOnly } })).data;
  },
  async approveVolunteer(volunteerId: string, approve: boolean): Promise<AdminVolunteer> {
    return (await apiClient.post<AdminVolunteer>(`/admin/volunteers/${volunteerId}/approve?approve=${approve}`)).data;
  },
  async createNgo(input: {
    name: string;
    owner_email: string;
    temp_password: string;
    owner_full_name?: string;
    focus_area?: string;
    location?: string;
    description?: string;
    contact_email?: string;
    contact_phone?: string;
    service_latitude?: number | null;
    service_longitude?: number | null;
    service_radius_km?: number;
    verified?: boolean;
  }): Promise<AdminNgo> {
    return (await apiClient.post<AdminNgo>("/admin/ngos", input)).data;
  },
  async users(params: { search?: string; role?: UserRole; page?: number; page_size?: number } = {}): Promise<PaginatedUsers> {
    return (await apiClient.get<PaginatedUsers>("/admin/users", { params })).data;
  },
  async setUserActive(userId: string, active: boolean): Promise<AdminUser> {
    return (await apiClient.post<AdminUser>(`/admin/users/${userId}/suspend?active=${active}`)).data;
  },
  async forceCloseReport(reportId: string): Promise<{ message: string }> {
    return (await apiClient.post(`/admin/reports/${reportId}/force-close`)).data;
  },
  async announcements(): Promise<Announcement[]> {
    return (await apiClient.get<Announcement[]>("/admin/announcements")).data;
  },
  async createAnnouncement(input: {
    title: string;
    body: string;
    audience: AnnouncementAudience;
    pinned: boolean;
  }): Promise<Announcement> {
    return (await apiClient.post<Announcement>("/admin/announcements", input)).data;
  },
  async deleteAnnouncement(id: string): Promise<{ message: string }> {
    return (await apiClient.delete(`/admin/announcements/${id}`)).data;
  },
  async auditLogs(params: { action?: string; page?: number; page_size?: number } = {}): Promise<PaginatedAuditLogs> {
    return (await apiClient.get<PaginatedAuditLogs>("/admin/audit-logs", { params })).data;
  },

  /* Phase 5: ops */
  async monitoring(): Promise<{ metrics: Record<string, unknown>; jobs: Record<string, unknown> }> {
    return (await apiClient.get("/admin/monitoring")).data;
  },
  async insights(): Promise<{ insights: PlatformInsight[]; forecast_next_week: number }> {
    return (await apiClient.get("/admin/insights")).data;
  },
  async automationRules(): Promise<AutomationRule[]> {
    return (await apiClient.get<AutomationRule[]>("/admin/automation-rules")).data;
  },
  async createAutomationRule(input: {
    name: string;
    trigger: string;
    enabled: boolean;
    threshold_minutes: number;
  }): Promise<AutomationRule> {
    return (await apiClient.post<AutomationRule>("/admin/automation-rules", input)).data;
  },
  async toggleAutomationRule(id: string, enabled: boolean): Promise<AutomationRule> {
    return (await apiClient.patch<AutomationRule>(`/admin/automation-rules/${id}?enabled=${enabled}`)).data;
  },
  async runAutomation(): Promise<{ message: string }> {
    return (await apiClient.post("/admin/automation-rules/run")).data;
  },
};

export const searchApi = {
  async query(q: string): Promise<SearchHit[]> {
    const { data } = await apiClient.get<{ hits: SearchHit[] }>("/search", { params: { q } });
    return data.hits;
  },
};
