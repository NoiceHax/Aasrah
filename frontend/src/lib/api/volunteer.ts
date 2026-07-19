"use client";

import { apiClient } from "./client";
import type {
  AssignmentStatus,
  VolAssignment,
  VolDashboard,
  VolPerformance,
  VolunteerAssignmentMode,
  VolunteerProfile,
  VolunteerProfileUpdate,
} from "./types";

export const volunteerApi = {
  async profile(): Promise<VolunteerProfile> {
    return (await apiClient.get<VolunteerProfile>("/volunteer/profile")).data;
  },
  async updateProfile(input: VolunteerProfileUpdate): Promise<VolunteerProfile> {
    return (await apiClient.patch<VolunteerProfile>("/volunteer/profile", input)).data;
  },
  async uploadAvatar(file: File): Promise<VolunteerProfile> {
    const form = new FormData();
    form.append("file", file);
    return (
      await apiClient.post<VolunteerProfile>("/volunteer/profile/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  },
  async setAvailability(available: boolean): Promise<VolunteerProfile> {
    return (await apiClient.post<VolunteerProfile>(`/volunteer/availability?available=${available}`)).data;
  },
  async setAssignmentMode(
    mode: VolunteerAssignmentMode,
    ngoId?: string | null,
  ): Promise<VolunteerProfile> {
    return (
      await apiClient.put<VolunteerProfile>("/volunteer/assignment-mode", {
        mode,
        ngo_id: mode === "ngo_affiliated" ? (ngoId ?? null) : null,
      })
    ).data;
  },
  async dashboard(): Promise<VolDashboard> {
    return (await apiClient.get<VolDashboard>("/volunteer/dashboard")).data;
  },
  async assignments(): Promise<VolAssignment[]> {
    return (await apiClient.get<VolAssignment[]>("/volunteer/assignments")).data;
  },
  async assignment(id: string): Promise<VolAssignment> {
    return (await apiClient.get<VolAssignment>(`/volunteer/assignments/${id}`)).data;
  },
  async respond(id: string, accept: boolean): Promise<VolAssignment> {
    return (await apiClient.post<VolAssignment>(`/volunteer/assignments/${id}/respond?accept=${accept}`)).data;
  },
  async advance(id: string, to: AssignmentStatus): Promise<VolAssignment> {
    return (await apiClient.post<VolAssignment>(`/volunteer/assignments/${id}/advance?to=${to}`)).data;
  },
  async complete(
    id: string,
    payload: { notes?: string; checklist?: Record<string, boolean>; hours?: number },
  ): Promise<VolAssignment> {
    return (await apiClient.post<VolAssignment>(`/volunteer/assignments/${id}/complete`, payload)).data;
  },
  async uploadCompletionImage(id: string, file: File): Promise<{ message: string }> {
    const form = new FormData();
    form.append("file", file);
    return (
      await apiClient.post(`/volunteer/assignments/${id}/images`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  },
  async performance(): Promise<VolPerformance> {
    return (await apiClient.get<VolPerformance>("/volunteer/performance")).data;
  },
};
