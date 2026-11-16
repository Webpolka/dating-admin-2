// hooks/admin/use-fraud-alerts.ts
"use client";

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

export type FraudSeverity = "low" | "medium" | "high";
export type FraudStatus = "open" | "resolved" | "false_positive";

export interface FraudAlertItem {
  id: number;
  trigger_type: string;
  trigger_label: string;
  trigger_color: string;
  severity: FraudSeverity;
  severity_label: string;
  severity_variant: string;
  status: FraudStatus;
  status_label: string;
  status_variant: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  is_open: boolean;
  user: UserBadgeData | null;
  admin: { id: number; name: string } | null;
}

export interface FraudCounts {
  total: number;
  open: number;
  resolved: number;
  false_positive: number;
  high_priority: number;
}

type FraudAlertListResponse = MetaPaginated<FraudAlertItem> & {
  // Counts убраны из list response — см. useFraudCounts (stable queryKey).
  status: FraudStatus | "all";
};

interface FraudAlertParams {
  q?: string;
  status?: string;
  severity?: string;
  page?: number;
  per_page?: number;
}

export function useFraudAlertsList(params: FraudAlertParams) {
  // Параметры уходят на бэк как есть (status/severity передаются валидными
  // значениями фильтров), пустые q/page/per_page фабрика отбрасывает сама.
  return useAdminListQuery<FraudAlertParams, FraudAlertListResponse>(
    ["admin", "fraud", "list"],
    "/admin/fraud-alerts",
    params,
  );
}

/**
 * Stable query для counts — не зависит от filter/search/page/severity.
 * QueryKey ["admin","fraud","counts"] не меняется → counts не скачут
 * при смене статуса/опасности/страницы. Раньше counts были в list-response →
 * каждая page-loading перезаписывала их.
 *
 * refetchInterval 30s — автообновление счётчиков, чтобы админ видел
 * новые «опасные» алерты без перезагрузки страницы.
 */
export function useFraudCounts() {
  return useAdminItemQuery<{ stats: FraudCounts }>(
    ["admin", "fraud", "counts"],
    "/admin/fraud-alerts/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ===== Хуки действий =====
//
// Тост успеха — message бэкенда (включая idempotency-ответы "Алерт уже
// закрыт" — это успех, не ошибка). Ошибка — extractErrorMessage: достаёт
// человекочитаемое сообщение из response.data.message (422/429/500) или
// сетевую ошибку.

export function useResolveAndBan() {
  return useAdminMutation<{ id: number; type: string }, { message: string }>({
    mutationFn: ({ id, type }) =>
      api.post<{ message: string }>(`/admin/fraud-alerts/${id}/resolve-and-ban`, { type }).then((r) => r.data),
    errorText: "Ошибка применения бана",
    // Инвалидируем весь префикс: список (статус алерта сменился) + counts
    // (может появиться новый open алерт или закрыться существующий).
    invalidate: [["admin", "fraud"]],
  });
}

export function useResolveWithWarning() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/fraud-alerts/${id}/resolve-with-warning`).then((r) => r.data),
    errorText: "Ошибка отправки предупреждения",
    invalidate: [["admin", "fraud"]],
  });
}

export function useMarkAsFalsePositive() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/fraud-alerts/${id}/false-positive`).then((r) => r.data),
    errorText: "Ошибка отметки ложного срабатывания",
    invalidate: [["admin", "fraud"]],
  });
}
