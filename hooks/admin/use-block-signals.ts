// hooks/admin/use-block-signals.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====

// НЕ UserBadgeData: у юзера-сигнала есть поля статистики блокировок
// (total_blocks_count / recent_blocks_count / last_block_at) — оставлен
// локальным типом. Вложенный blocker в Blocker тоже не UserBadgeData:
// status сужен до union вместо string.
export type BlockSignalUser = {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  is_online: boolean;
  status: "active" | "banned" | "shadowbanned" | "deactivated";
  deleted_at: string | null;
  has_active_premium: boolean;
  has_active_vip: boolean;
  is_verified: boolean;
  total_blocks_count: number;
  recent_blocks_count: number;
  // ISO timestamp последней блокировки — для отображения «когда последний раз
  // его заблокировали». null только если UserBlock'ов нет вообще (что при
  // havingRaw threshold >= 2 невозможно, но тип перестраховывается).
  last_block_at: string | null;
};

export type BlockSignalCounts = {
  total: number;   // юзеры с ≥3 блокировок
  medium: number;  // 3-9 блокировок
  high: number;    // ≥10 блокировок
  danger: number;  // ≥5 за последние 7 дней
};

export type BlockSignalsListResponse = MetaPaginated<BlockSignalUser> & {
  threshold: number;
  // Counts убраны из list response — см. useBlockSignalCounts (stable queryKey).
};

export type BlockSignalListParams = {
  q?: string;
  threshold?: number;
  page?: number;
  per_page?: number;
};

export type Blocker = {
  id: number;
  reason: string | null;
  reason_label: string | null;
  reason_color: string | null;
  created_at: string | null;
  blocker: {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    is_online: boolean;
    status: "active" | "banned" | "shadowbanned" | "deactivated";
    deleted_at: string | null;
    has_active_premium: boolean;
    has_active_vip: boolean;
    is_verified: boolean;
  } | null;
};

export type BlockersListResponse = {
  data: Blocker[];
  user_id: number;
};

// ===== Хуки чтения =====
export function useBlockSignalsList(params: BlockSignalListParams) {
  // Старый код собирал query-string через if (p.x) search.set(...) —
  // falsy-значения (0/NaN/""/"") не уходили в запрос. `|| undefined`
  // воспроизводит это точно: фабрика выбросит undefined из query.
  return useAdminListQuery<BlockSignalListParams, BlockSignalsListResponse>(
    ["admin", "block-signals"],
    "/admin/block-signals",
    {
      q: params.q,
      threshold: params.threshold || undefined,
      page: params.page || undefined,
      per_page: params.per_page || undefined,
    },
  );
}

/**
 * Stable query для counts — не зависит от filter/search/page/threshold.
 * QueryKey ["admin","block-signals","counts"] не меняется → counts не скачут
 * при смене порога или страницы. Раньше counts были в list-response →
 * каждая page-loading перезаписывала их.
 *
 * refetchInterval 30s — автообновление счётчиков, чтобы админ видел
 * новые «опасные» юзеры без перезагрузки страницы.
 */
export function useBlockSignalCounts() {
  return useAdminItemQuery<{ stats: BlockSignalCounts }>(
    ["admin", "block-signals", "counts"],
    "/admin/block-signals/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// Не переведён на фабрику: пер-юзер список «кто заблокировал» без
// placeholderData (конвенция detail-запросов из use-users.ts — фабрика
// держала бы прошлые данные при смене userId).
export function useBlockersList(userId: number | null, enabled: boolean) {
  return useQuery<BlockersListResponse>({
    queryKey: ["admin", "block-signals", "blockers", userId],
    queryFn: async () => {
      const { data } = await api.get<BlockersListResponse>(
        `/admin/block-signals/${userId}/blockers`
      );
      return data;
    },
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

// ===== Хуки действий =====
export function useBanBlockSignal() {
  return useAdminMutation<
    { userId: number; type: "shadow" | "temp" | "permanent" },
    { message: string }
  >({
    mutationFn: ({ userId, type }) =>
      api
        .post<{ message: string }>(`/admin/block-signals/${userId}/ban`, { type })
        .then((r) => r.data),
    // Backend может вернуть 200 + message "уже забанен" (idempotency
    // early-return) — это успех, тост покажет message бэкенда.
    errorText: "Ошибка бана пользователя",
    // Инвалидируем весь префикс: список (бан сменил status юзера в строке)
    // + counts (юзер мог попасть/выпасть из «опасных» по новому статусу).
    invalidate: [["admin", "block-signals"]],
  });
}
