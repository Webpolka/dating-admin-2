// hooks/admin/use-reports.ts
"use client";

import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// UI-маппинги REPORT_REASONS / REPORT_RESOLUTIONS живут в lib/reports.ts
// (синхронизированы с App\Enums\ReportReason / ReportResolution — значения
// label/color идентичны бывшей локальной копии). Отсюда реэкспортируются
// для обратной совместимости: импорт из хука и из lib даёт один и тот же объект.
export { REPORT_REASONS, REPORT_RESOLUTIONS } from "@/lib/reports";

// ===== Типы =====
export type ReportStatus = "pending" | "resolved" | "rejected";
export type ReportableType = "User" | "Photo" | null;
export type ReportReasonType = "spam" | "porn" | "scam" | "insult" | "minor" | "fake" | string;
export type ReportResolutionType =
  | "ban"
  | "temp_ban"
  | "shadowban"
  | "warn"
  | "photo_deleted"
  | "no_action"
  | null;

// НЕ UserBadgeData: у юзера жалобы есть дополнительное поле role.
export type ReportUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  is_online: boolean;
  status: string;
  deleted_at: string | null;
  has_active_premium: boolean;
  has_active_vip: boolean;
  is_verified: boolean;
};

export type ReportPhoto = {
  id: number;
  thumb_url: string;
  medium_url: string;
  original_url: string;
  user: ReportUser | null;
};

export type ReportItem = {
  id: number;
  reason: ReportReasonType;
  description: string | null;
  status: ReportStatus;
  resolution: ReportResolutionType;
  resolution_note: string | null;
  reportable_type: ReportableType;
  reportable_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  reporter: ReportUser | null;
  reported: ReportUser | null;
  photo: ReportPhoto | null; // Только если жалоба на фото
};

export type ReportCounts = {
  pending: number;
  resolved: number;
  rejected: number;
  total: number;
};

type ReportsListResponse = MetaPaginated<ReportItem> & {
  stats: ReportCounts;
  status: ReportStatus | "all";
};

type ReportsListParams = {
  status: ReportStatus | "all";
  type?: string; // all, user, photo
  q?: string;
  page?: number;
  per_page?: number;
};

// ===== Хуки чтения =====
export function useReportsList(params: ReportsListParams) {
  // status уходит всегда (в т.ч. "all" — валидное значение фильтра бэка);
  // type "all" — «нет фильтра», в query не попадает.
  return useAdminListQuery<ReportsListParams, ReportsListResponse>(
    ["admin", "reports"],
    "/admin/reports",
    {
      status: params.status,
      type: params.type !== "all" ? params.type : undefined,
      q: params.q,
      page: params.page,
      per_page: params.per_page,
    },
  );
}

/**
 * Stable query для counts — не зависит от filter/search/page.
 * QueryKey ["admin","reports","counts"] не меняется → counts не скачут.
 */
export function useReportCounts() {
  return useAdminItemQuery<{ stats: ReportCounts }>(
    ["admin", "reports", "counts"],
    "/admin/reports/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ===== Хуки действий =====
export function useResolveReport() {
  return useAdminMutation<{ id: number; resolution: string }, { message: string }>({
    mutationFn: ({ id, resolution }) =>
      api.post<{ message: string }>(`/admin/reports/${id}/resolve`, { resolution }).then((r) => r.data),
    errorText: "Ошибка решения жалобы",
    invalidate: [["admin", "reports"]],
  });
}

export function useRejectReport() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/reports/${id}/reject`).then((r) => r.data),
    errorText: "Ошибка отклонения жалобы",
    invalidate: [["admin", "reports"]],
  });
}

export function useReopenReport() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/reports/${id}/reopen`).then((r) => r.data),
    errorText: "Ошибка возврата жалобы",
    invalidate: [["admin", "reports"]],
  });
}

export function useToggleBanUser() {
  return useAdminMutation<
    { userId: number; type: "permanent" | "temp" | "shadow"; reportId?: number },
    { message: string }
  >({
    mutationFn: ({ userId, type, reportId }) =>
      api
        .post<{ message: string }>(`/admin/reports/user/${userId}/ban`, { type, reportId })
        .then((r) => r.data),
    errorText: "Ошибка изменения статуса бана",
    invalidate: [["admin", "reports"]],
  });
}

export function useRejectReportPhoto() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (photoId) =>
      api.post<{ message: string }>(`/admin/reports/photo/${photoId}/reject`).then((r) => r.data),
    errorText: "Ошибка отклонения фото",
    invalidate: [["admin", "reports"]],
  });
}
