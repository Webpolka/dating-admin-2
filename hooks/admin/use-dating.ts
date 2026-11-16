// hooks/admin/use-dating.ts
"use client";

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====
export type DatingMode = "swipes" | "matches";
export type SwipeType = "like" | "dislike" | "superlike";
export type MatchStatus = "active" | "unmatched";

// Юзер на карточке свайпа/мэтча — тот же UserBadgeData из lib/types.
export type DatingUser = UserBadgeData;

export type SwipeItem = {
  id: number;
  type: SwipeType;
  rewinded: boolean;
  created_at: string | null;
  user: DatingUser | null;
  targetUser: DatingUser | null;
};

export type MatchItem = {
  id: number;
  status: MatchStatus;
  unmatched_by: number | null;
  unmatched_at: string | null;
  created_at: string | null;
  user1: DatingUser | null;
  user2: DatingUser | null;
};

export type DatingStats = {
  total_likes: number;
  total_dislikes: number;
  total_superlikes: number;
  total_swipes: number;
  total_matches: number;
};

type DatingListResponse = MetaPaginated<SwipeItem | MatchItem> & {
  mode: DatingMode;
  stats: DatingStats;
  filters: {
    type: string;
    q: string;
    dateFrom: string;
    dateTo: string;
  };
};

type DatingListParams = {
  mode: DatingMode;
  type?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  per_page?: number;
};

// ===== Хуки чтения =====
export function useDatingList(params: DatingListParams) {
  // mode уходит всегда; type "all" — «нет фильтра», в query не попадает;
  // пустые q/dateFrom/dateTo/page/per_page фабрика отбрасывает сама.
  return useAdminListQuery<DatingListParams, DatingListResponse>(
    ["admin", "dating"],
    "/admin/dating",
    {
      mode: params.mode,
      type: params.type !== "all" ? params.type : undefined,
      q: params.q,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      per_page: params.per_page,
    },
    { staleTime: 0 },
  );
}

// ===== Хуки действий =====
export function useDestroySwipe() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/dating/swipes/${id}`).then((r) => r.data),
    errorText: "Ошибка удаления свайпа",
    invalidate: [["admin", "dating"]],
  });
}

export function useDestroyMatch() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/dating/matches/${id}`).then((r) => r.data),
    errorText: "Ошибка разрыва мэтча",
    invalidate: [["admin", "dating"]],
  });
}

export function useRestoreMatch() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/dating/matches/${id}/restore`).then((r) => r.data),
    errorText: "Ошибка восстановления мэтча",
    invalidate: [["admin", "dating"]],
  });
}

/**
 * Stable query для counts — не зависит от filter/search/page.
 * QueryKey ["admin","dating","counts"] не меняется при смене вкладок →
 * counts не скачут (как в photos, photo-comments, stop-words).
 *
 * refetchInterval: 30 сек — auto-refresh.
 * staleTime: 10 сек. Плавная смена фильтров без мерцания (фабрика
 * держит прошлые данные).
 */
export function useDatingCounts() {
  return useAdminItemQuery<{ stats: DatingStats }>(
    ["admin", "dating", "counts"],
    "/admin/dating/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ===== UI маппинги для Enum'ов =====
export const SWIPE_TYPES: Record<
  SwipeType,
  { label: string; color: string }
> = {
  like: { label: "Лайк", color: "bg-green-500/10 text-green-500" },
  dislike: { label: "Дизлайк", color: "bg-red-500/10 text-red-500" },
  superlike: { label: "Суперлайк", color: "bg-yellow-500/10 text-yellow-500" },
};

export const MATCH_STATUSES: Record<
  MatchStatus,
  { label: string; color: string }
> = {
  active: { label: "Активен", color: "bg-green-500/10 text-green-500" },
  unmatched: { label: "Разорван", color: "bg-red-500/10 text-red-500" },
};
