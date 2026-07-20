/** Shared API types mirroring the backend Pydantic schemas. */

// `citizen` is a legacy role retained for historical accounts only; it is no
// longer assignable. Public registration creates `volunteer`; `ngo`/`admin`
// are provisioned administratively.
export type UserRole = "citizen" | "ngo" | "volunteer" | "admin";

export type ReportStatus =
  | "pending"
  | "verified"
  | "claimed"
  | "volunteer_assigned"
  | "volunteer_accepted"
  | "on_route"
  | "reached_location"
  | "rescue_completed"
  | "shelter_assigned"
  | "closed"
  | "in_progress"
  | "resolved"
  | "rejected";

export type AssignmentStatus =
  | "assigned"
  | "accepted"
  | "declined"
  | "on_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "removed";

export type AnnouncementAudience = "everyone" | "ngo" | "volunteer";

export type VolunteerStatus = "pending" | "active" | "inactive";

export interface AdminVolunteer {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: VolunteerStatus;
  assignment_mode: VolunteerAssignmentMode;
  ngo_id: string | null;
  ngo_name: string | null;
  skills: string[];
  completed_rescues: number;
  created_at: string;
}

export type NotificationType = "success" | "error" | "warning" | "info";

export type ReportPriority = "critical" | "high" | "medium" | "stable";

export type SituationType = "medical"
  | "child_protection" | "shelter" | "food" | "safety" | "other";

export type TimelineState = "complete" | "active" | "upcoming";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface PublicStats {
  total_reports: number;
  rescues_completed: number;
  verified_ngos: number;
  active_volunteers: number;
}

export interface PublicNgo {
  id: string;
  name: string;
  focus_area: string | null;
  location: string | null;
  website: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface ReportImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  position: number;
}

export interface TimelineEvent {
  key: string;
  title: string;
  description: string | null;
  state: TimelineState;
  timestamp: string | null;
}

export interface ReportCreateResponse {
  tracking_id: string;
  status: ReportStatus;
  created_at: string;
  report_id: string;
  /** Short-lived capability authorising the follow-up image upload. In-memory only. */
  upload_token: string;
}

/**
 * Public tracking view. Served unauthenticated, so it carries progress only —
 * no description, no precise coordinates, no photos. `locality` is a coarsened
 * area, not an address. Mirrors ReportTrackingOut in the backend.
 */
export interface ReportTracking {
  tracking_id: string;
  situation: SituationType;
  priority: ReportPriority;
  status: ReportStatus;
  locality: string | null;
  created_at: string;
  updated_at: string;
  timeline: TimelineEvent[];
}

export interface ReportCreateInput {
  situation: SituationType;
  /** Reporter-declared; null = not answered. Forces CRITICAL priority server-side. */
  subject_is_minor?: boolean | null;
  priority?: ReportPriority;
  description: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reporter_name?: string | null;
  reporter_phone?: string | null;
}

export interface GeocodeResult {
  display_name: string;
  latitude: number;
  longitude: number;
}

/** Normalized error shape surfaced to the UI. */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

/* ---- Phase 3: NGO portal ---- */

export interface Ngo {
  id: string;
  name: string;
  focus_area: string | null;
  location: string | null;
  description: string | null;
  is_verified: boolean;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  operating_hours: string | null;
  emergency_contact: string | null;
  shelter_locations: string | null;
  logo_url: string | null;
  service_latitude: number | null;
  service_longitude: number | null;
  service_radius_km: number;
  created_at: string;
}

export interface NgoUpdateInput {
  name?: string;
  focus_area?: string | null;
  location?: string | null;
  description?: string | null;
  website?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  operating_hours?: string | null;
  emergency_contact?: string | null;
  shelter_locations?: string | null;
  service_latitude?: number | null;
  service_longitude?: number | null;
  service_radius_km?: number;
}

export interface NgoReportListItem {
  id: string;
  tracking_id: string;
  situation: SituationType;
  priority: ReportPriority;
  status: ReportStatus;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  children_present: boolean;
  people_count: number | null;
  distance_km: number | null;
  claimed_by_ngo_id: string | null;
  claimed_by_name: string | null;
  image_count: number;
  created_at: string;
}

export interface PaginatedReports {
  items: NgoReportListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CaseTimelineItem {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  actor_id: string | null;
  is_public: boolean;
  created_at: string;
}

export interface CaseDetail {
  id: string;
  tracking_id: string;
  situation: SituationType;
  priority: ReportPriority;
  status: ReportStatus;
  description: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  children_present: boolean;
  people_count: number | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  distance_km: number | null;
  claimed_by_ngo_id: string | null;
  claimed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  images: ReportImage[];
  timeline: CaseTimelineItem[];
  ai_summary: string | null;
  ai_analysis: AiAnalysis | null;
  priority_score: number | null;
  priority_auto: boolean;
  duplicate_of_id: string | null;
}

export interface AiAnalysis {
  age_range?: string | null;
  gender?: string | null;
  children_present?: boolean;
  visible_injuries?: boolean;
  needs_medical?: boolean;
  needs_food_or_shelter?: boolean;
  description?: string | null;
  confidence?: Record<string, number>;
  source?: string;
}

export interface DuplicateSuggestion {
  report_id: string;
  tracking_id: string;
  distance_km: number;
  time_gap_hours: number;
  text_similarity: number;
  confidence: number;
  summary: string;
  status: string;
}

export interface RecommendedVolunteer {
  volunteer_id: string;
  name: string | null;
  is_available: boolean;
  active_assignments: number;
  completed_rescues: number;
  distance_km: number | null;
  skills: string[];
  score: number;
}

export interface SemanticSearchResult {
  query: string;
  parsed: Record<string, unknown>;
  count: number;
  results: {
    id: string;
    tracking_id: string;
    situation: string;
    priority: string;
    status: string;
    address: string | null;
    summary: string | null;
    children_present: boolean;
    created_at: string;
  }[];
}

export interface PlatformInsight {
  kind: string;
  headline: string;
  detail: string;
  severity: "info" | "warning";
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  threshold_minutes: number;
  run_count: number;
}

export interface Volunteer {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  availability: string | null;
  skills: string[];
  status: VolunteerStatus;
  is_available: boolean;
  completed_rescues: number;
  rating: number | null;
  active_assignments: number;
}

export interface Assignment {
  id: string;
  report_id: string;
  volunteer_id: string;
  volunteer_name: string | null;
  assigned_by_id: string | null;
  status: AssignmentStatus;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CaseNote {
  id: string;
  report_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseAttachment {
  id: string;
  report_id: string;
  url: string;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  category: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: NotificationItem[];
  unread_count: number;
}

export interface TimeSeriesPoint {
  label: string;
  value: number;
}

export interface DashboardData {
  pending_nearby: number;
  claimed_cases: number;
  active_rescues: number;
  completed_rescues: number;
  available_volunteers: number;
  avg_response_minutes: number | null;
  success_rate: number;
  weekly_rescues: TimeSeriesPoint[];
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

export interface AnalyticsData {
  kpis: {
    total_rescues: number;
    avg_response_minutes: number | null;
    active_volunteers: number;
    success_rate: number;
    cases_this_month: number;
  };
  daily_reports: TimeSeriesPoint[];
  weekly_rescues: TimeSeriesPoint[];
  volunteer_workload: TimeSeriesPoint[];
  heatmap: HeatmapPoint[];
}

/* ---- Phase 4: Volunteer portal ---- */

export type VolunteerAssignmentMode = "independent" | "ngo_affiliated";

export interface VolunteerProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  availability: string | null;
  status: VolunteerStatus;
  is_available: boolean;
  assignment_mode: VolunteerAssignmentMode;
  ngo_id: string | null;
  ngo_name: string | null;
  skills: string[];
  certifications: string[];
  languages: string[];
  emergency_contact: string | null;
  working_radius_km: number | null;
  schedule: string | null;
  avatar_url: string | null;
  completed_rescues: number;
  total_hours: number;
  rating: number | null;
}

export interface VolunteerProfileUpdate {
  phone?: string | null;
  role_title?: string | null;
  availability?: string | null;
  is_available?: boolean;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  emergency_contact?: string | null;
  working_radius_km?: number | null;
  schedule?: string | null;
}

export interface AssignmentReportInfo {
  id: string;
  tracking_id: string;
  situation: SituationType;
  priority: ReportPriority;
  status: ReportStatus;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string;
}

export interface VolAssignment {
  id: string;
  status: AssignmentStatus;
  responded_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  report: AssignmentReportInfo;
}

export interface VolDashboard {
  today: VolAssignment[];
  active: VolAssignment | null;
  upcoming: VolAssignment[];
  completed_count: number;
  total_hours: number;
  is_available: boolean;
  acceptance_rate: number;
}

export interface VolPerformance {
  total_rescues: number;
  monthly_rescues: number;
  acceptance_rate: number;
  total_hours: number;
  avg_response_minutes: number | null;
  badges: string[];
}

/* ---- Phase 4: Admin console ---- */

export interface AdminKpis {
  total_reports: number;
  active_cases: number;
  closed_cases: number;
  registered_ngos: number;
  registered_volunteers: number;
  active_users: number;
  pending_verifications: number;
}

export interface AdminDashboardData {
  kpis: AdminKpis;
  report_trend: TimeSeriesPoint[];
  user_growth: TimeSeriesPoint[];
  recent_registrations: { id: string; name: string; role: string; created_at: string }[];
  heatmap: HeatmapPoint[];
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminNgo {
  id: string;
  name: string;
  focus_area: string | null;
  location: string | null;
  is_verified: boolean;
  contact_email: string | null;
  owner_id: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  pinned: boolean;
  published: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SearchHit {
  kind: string;
  id: string;
  label: string;
  sublabel: string | null;
  href: string | null;
}

/* ---- Real-time events ---- */

export interface RealtimeEvent {
  type: string;
  payload: Record<string, unknown>;
}
