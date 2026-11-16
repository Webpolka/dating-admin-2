// hooks/admin/use-admin-log.ts
"use client";

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useAdminListQuery, useAdminMutation } from "./use-admin-api";

export interface AdminLogItem {
  id: number;
  created_at: string;
  action: string;
  ip_address: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  object_type: string;
  object_id: number | null;
  is_deleted: boolean;
  is_system: boolean;
  object_url: string | null;
  admin: UserBadgeData | null;
}
export interface AdminLogStats {
  [key: string]: number;
}

export interface AdminLogAdmin {
  id: number;
  name: string;
}

type AdminLogResponse = MetaPaginated<AdminLogItem> & {
  stats: AdminLogStats;
  admins: AdminLogAdmin[];
  total_entries: number;
};

interface AdminLogParams {
  q?: string;
  cat?: string;
  adm?: string;
  date?: string;
  page?: number;
  per_page?: number;
}

export function useAdminLogList(params: AdminLogParams) {
  return useAdminListQuery<AdminLogParams, AdminLogResponse>(
    ["admin", "admin-log", "list"],
    "/admin/audit/logs",
    params,
    { staleTime: 0 },
  );
}

// Статистика журнала не инвалидируется, а кладётся в кэш напрямую
// (setQueryData в onSuccess фабрики) — мгновенное обновление шапки
// без полного рефетча списка.
type AdminLogRefreshResponse = {
  stats: AdminLogStats;
  admins: AdminLogAdmin[];
  total_entries: number;
} & { message?: string }; // message опционален: тост задан статично.

export function useRefreshAdminLog() {
  return useAdminMutation<void, AdminLogRefreshResponse>({
    mutationFn: async () => {
      const { data } = await api.post<AdminLogRefreshResponse>("/admin/audit/logs/refresh");
      return data;
    },
    success: () => "Данные журнала синхронизированы!",
    errorText: "Ошибка обновления",
    onSuccess: (data, _vars, qc) => {
      qc.setQueriesData<AdminLogResponse>(
        { queryKey: ["admin", "admin-log", "list"] },
        (old) => {
          if (!old) return old;
          return { ...old, stats: data.stats, admins: data.admins, total_entries: data.total_entries };
        },
      );
    },
  });
}
