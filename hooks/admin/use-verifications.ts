"use client";

// hooks/admin/use-verifications.ts
//
// TanStack Query-хуки для модерации верификаций (раздел Moderation → Verifications).
//
// Конвенция query-ключей:
//   ["admin", "verifications", params]      — список (mode=queue/grid)
//   ["admin", "verifications", "counts"]    — счётчики (stable, не зависит от фильтров)
//
// Мутации (approve/reject) инвалидируют СРАЗУ ВСЕ связанные ключи через
// префикс ["admin", "verifications"], а также sidebar-counts и dashboard
// (pendingVerifications может измениться).

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import {
  useAdminListQuery,
  useAdminItemQuery,
  useAdminMutation,
} from "./use-admin-api";

// ============================================================
// Типы
// ============================================================

export type VerificationStatus = "pending" | "approved" | "rejected";
export type VerificationMode = "queue" | "grid";

/** User badge в ответе модерации — UserBadgeData + role (withRole=true на бэке). */
export type VerificationUser = UserBadgeData & {
  role?: string;
};

/** Фото верификации (короткая форма для модерации). */
export type VerificationPhoto = {
  id: number;
  status: string;
  is_primary: boolean;
  type: "profile" | "verification";
  thumb_url: string;
  medium_url: string;
  large_url: string;
  original_url: string;
} | null;

/** Карточка верификации (общая для queue и grid). */
export type VerificationItem = {
  id: number;
  user_id: number;
  photo_id: number | null;
  code: string | null;
  status: VerificationStatus;
  reject_reason: VerificationRejectReason | null;
  moderated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  photo?: VerificationPhoto;
  moderator?: UserBadgeData | null;
  user?: VerificationUser | null;
};

export type VerificationCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

type VerificationsListResponse = MetaPaginated<VerificationItem> & {
  mode: VerificationMode;
  stats: VerificationCounts;
  status: VerificationStatus;
};

type VerificationsListParams = {
  status: VerificationStatus;
  q?: string;
  page?: number;
  per_page?: number;
};

// ============================================================
// Причины отклонения (sync с App\Models\Verification::REASON_*)
// ============================================================

export type VerificationRejectReason =
  | "blurry"
  | "fake"
  | "no_code"
  | "minor"
  | "other";

export const VERIFICATION_REJECT_REASONS: Array<{
  value: VerificationRejectReason;
  label: string;
}> = [
  { value: "blurry",  label: "Размытое / плохое качество" },
  { value: "fake",    label: "Поддельное / не соответствует профилю" },
  { value: "no_code", label: "Не виден код верификации" },
  { value: "minor",   label: "Несовершеннолетний на фото" },
  { value: "other",   label: "Другое нарушение правил" },
];

export function getRejectReasonLabel(reason: string | null): string {
  if (!reason) return "—";
  return (
    VERIFICATION_REJECT_REASONS.find((r) => r.value === reason)?.label ?? reason
  );
}

// ============================================================
// Хуки чтения
// ============================================================

export function useVerificationsList(params: VerificationsListParams) {
  return useAdminListQuery<VerificationsListParams, VerificationsListResponse>(
    ["admin", "verifications"],
    "/admin/verifications",
    {
      status: params.status,
      q: params.q,
      page: params.page,
      per_page: params.per_page,
    },
    { staleTime: 0 },
  );
}

/**
 * Stable query для counts — не зависит от filter/search/page.
 * refetchInterval 30с — auto-refresh для moderation queue.
 */
export function useVerificationCounts() {
  return useAdminItemQuery<{ stats: VerificationCounts }>(
    ["admin", "verifications", "counts"],
    "/admin/verifications/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ============================================================
// Хуки действий
// ============================================================

/** Approve: POST /admin/verifications/{id}/approve */
export const useApproveVerification = () =>
  useAdminMutation<{ id: number }, { message: string }>({
    mutationFn: ({ id }) =>
      api.post(`/admin/verifications/${id}/approve`).then((r) => r.data),
    invalidate: [
      ["admin", "verifications"],
      ["admin", "sidebar", "counts"],
      ["admin", "dashboard"],
    ],
    errorText: "Ошибка при одобрении заявки",
  });

/** Reject: POST /admin/verifications/{id}/reject { reason } */
export const useRejectVerification = () =>
  useAdminMutation<
    { id: number; reason: VerificationRejectReason },
    { message: string }
  >({
    mutationFn: ({ id, reason }) =>
      api.post(`/admin/verifications/${id}/reject`, { reason }).then((r) => r.data),
    invalidate: [
      ["admin", "verifications"],
      ["admin", "sidebar", "counts"],
      ["admin", "dashboard"],
    ],
    errorText: "Ошибка при отклонении заявки",
  });
