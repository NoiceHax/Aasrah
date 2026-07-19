"use client";

import { apiClient } from "./client";
import type {
  AnalyticsData,
  Assignment,
  CaseAttachment,
  CaseDetail,
  CaseNote,
  DashboardData,
  DuplicateSuggestion,
  Ngo,
  NgoUpdateInput,
  NotificationList,
  PaginatedReports,
  RecommendedVolunteer,
  ReportPriority,
  ReportStatus,
  SemanticSearchResult,
  Volunteer,
} from "./types";

export interface NearbyFilters {
  status?: ReportStatus;
  max_distance_km?: number;
  since_hours?: number;
  children_only?: boolean;
  medical_only?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export const ngoApi = {
  /* Profile + settings */
  async profile(): Promise<Ngo> {
    return (await apiClient.get<Ngo>("/ngo/profile")).data;
  },
  async updateProfile(input: NgoUpdateInput): Promise<Ngo> {
    return (await apiClient.patch<Ngo>("/ngo/profile", input)).data;
  },
  async uploadLogo(file: File): Promise<Ngo> {
    const form = new FormData();
    form.append("file", file);
    return (
      await apiClient.post<Ngo>("/ngo/profile/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  },
  async changePassword(current_password: string, new_password: string): Promise<{ message: string }> {
    return (
      await apiClient.post("/ngo/settings/password", { current_password, new_password })
    ).data;
  },

  /* Dashboard + analytics */
  async dashboard(): Promise<DashboardData> {
    return (await apiClient.get<DashboardData>("/ngo/dashboard")).data;
  },
  async analytics(): Promise<AnalyticsData> {
    return (await apiClient.get<AnalyticsData>("/ngo/analytics")).data;
  },

  /* Reports */
  async nearby(filters: NearbyFilters = {}): Promise<PaginatedReports> {
    return (await apiClient.get<PaginatedReports>("/ngo/reports/nearby", { params: filters })).data;
  },
  async claimed(params: { page?: number; page_size?: number; status?: ReportStatus } = {}): Promise<PaginatedReports> {
    return (await apiClient.get<PaginatedReports>("/ngo/reports/claimed", { params })).data;
  },
  async getCase(reportId: string): Promise<CaseDetail> {
    return (await apiClient.get<CaseDetail>(`/ngo/reports/${reportId}`)).data;
  },
  async claim(reportId: string): Promise<CaseDetail> {
    return (await apiClient.post<CaseDetail>(`/ngo/reports/${reportId}/claim`)).data;
  },
  async updateStatus(reportId: string, status: ReportStatus, note?: string): Promise<CaseDetail> {
    return (
      await apiClient.patch<CaseDetail>(`/ngo/reports/${reportId}/status`, { status, note })
    ).data;
  },

  /* Volunteers + assignments */
  async volunteers(params: { search?: string; available_only?: boolean } = {}): Promise<Volunteer[]> {
    return (await apiClient.get<Volunteer[]>("/ngo/volunteers", { params })).data;
  },
  async updateVolunteer(volunteerId: string, input: Partial<Volunteer>): Promise<Volunteer> {
    return (await apiClient.patch<Volunteer>(`/ngo/volunteers/${volunteerId}`, input)).data;
  },
  async assignments(reportId: string): Promise<Assignment[]> {
    return (await apiClient.get<Assignment[]>(`/ngo/reports/${reportId}/assignments`)).data;
  },
  async assign(reportId: string, volunteerIds: string[]): Promise<Assignment[]> {
    return (
      await apiClient.post<Assignment[]>(`/ngo/reports/${reportId}/assignments`, {
        volunteer_ids: volunteerIds,
      })
    ).data;
  },
  async removeAssignment(reportId: string, assignmentId: string): Promise<{ message: string }> {
    return (
      await apiClient.delete(`/ngo/reports/${reportId}/assignments/${assignmentId}`)
    ).data;
  },

  /* Notes */
  async notes(reportId: string): Promise<CaseNote[]> {
    return (await apiClient.get<CaseNote[]>(`/ngo/cases/${reportId}/notes`)).data;
  },
  async addNote(reportId: string, body: string): Promise<CaseNote> {
    return (await apiClient.post<CaseNote>(`/ngo/cases/${reportId}/notes`, { body })).data;
  },
  async editNote(reportId: string, noteId: string, body: string): Promise<CaseNote> {
    return (
      await apiClient.patch<CaseNote>(`/ngo/cases/${reportId}/notes/${noteId}`, { body })
    ).data;
  },
  async deleteNote(reportId: string, noteId: string): Promise<{ message: string }> {
    return (await apiClient.delete(`/ngo/cases/${reportId}/notes/${noteId}`)).data;
  },

  /* Attachments */
  async attachments(reportId: string): Promise<CaseAttachment[]> {
    return (await apiClient.get<CaseAttachment[]>(`/ngo/cases/${reportId}/attachments`)).data;
  },
  async uploadAttachment(reportId: string, file: File, category: string): Promise<CaseAttachment> {
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    return (
      await apiClient.post<CaseAttachment>(`/ngo/cases/${reportId}/attachments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  },
  async deleteAttachment(reportId: string, attachmentId: string): Promise<{ message: string }> {
    return (
      await apiClient.delete(`/ngo/cases/${reportId}/attachments/${attachmentId}`)
    ).data;
  },

  /* Phase 5: intelligence */
  async overridePriority(reportId: string, priority: ReportPriority): Promise<CaseDetail> {
    return (await apiClient.patch<CaseDetail>(`/ngo/reports/${reportId}/priority`, { priority })).data;
  },
  async overrideAnalysis(reportId: string, fields: Record<string, unknown>): Promise<CaseDetail> {
    return (await apiClient.patch<CaseDetail>(`/ngo/reports/${reportId}/analysis`, fields)).data;
  },
  async recommendedVolunteers(reportId: string): Promise<RecommendedVolunteer[]> {
    return (await apiClient.get<{ recommended: RecommendedVolunteer[] }>(
      `/ngo/reports/${reportId}/recommended-volunteers`,
    )).data.recommended;
  },
  async duplicates(reportId: string): Promise<DuplicateSuggestion[]> {
    return (await apiClient.get<{ duplicates: DuplicateSuggestion[] }>(
      `/ngo/reports/${reportId}/duplicates`,
    )).data.duplicates;
  },
  async mergeDuplicate(reportId: string, duplicateId: string): Promise<{ message: string }> {
    return (await apiClient.post(`/ngo/reports/${reportId}/merge`, { duplicate_id: duplicateId })).data;
  },
  async semanticSearch(q: string): Promise<SemanticSearchResult> {
    return (await apiClient.get<SemanticSearchResult>("/ngo/search", { params: { q } })).data;
  },
};

export const notificationsApi = {
  async list(params: { unread_only?: boolean } = {}): Promise<NotificationList> {
    return (await apiClient.get<NotificationList>("/notifications", { params })).data;
  },
  async markRead(id: string): Promise<{ message: string }> {
    return (await apiClient.post(`/notifications/${id}/read`)).data;
  },
  async markAllRead(): Promise<{ message: string }> {
    return (await apiClient.post("/notifications/read-all")).data;
  },
};
