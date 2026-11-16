// hooks/admin/use-broadcasts.ts
"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { getEcho } from "@/lib/echo";
import { toast } from "sonner";
import type { MetaPaginated } from "@/lib/types";
import { useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// F6: UserBadgeData теперь в lib/types — тут только реэкспорт для
// обратной совместимости (многие компоненты импортят отсюда).
export type { UserBadgeData } from "@/lib/types";
import type { UserBadgeData } from "@/lib/types";

export type BroadcastType = "in_app" | "push" | "email";
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export interface BroadcastItem {
  id: number;
  title: string;
  message: string;
  type: BroadcastType;
  status: BroadcastStatus;
  progress: number;
  sent_count: number;
  failed_count: number;
  total_recipients: number;
  scheduled_at: string | null;
  sent_at: string | null;
  started_at: string | null;
  created_at: string;
  audience_label: string;
  audience_parts: string[];
  target_user: UserBadgeData | null;
  admin: UserBadgeData | null;
}

export interface BroadcastCounts {
  draft: number;
  scheduled: number;
  sending: number;
  sent: number;
  failed: number;
  total: number;
}

export type BroadcastListResponse = MetaPaginated<BroadcastItem> & {
  counts: BroadcastCounts;
};

export interface BroadcastDetail {
  id: number;
  title: string;
  type: BroadcastType;
  message: string;
  email_body: string | null;
  action_url: string | null;
  scheduled_at: string | null;
  status: BroadcastStatus;
  target_audience: Record<string, unknown>;
  // Полные данные target_user (если рассылка на конкретного юзера).
  // Backend подгружает в show() — раньше фронт делал фейкового юзера
  // с пустыми полями, UserBadge показывал placeholder.
  target_user: UserBadgeData | null;
}

interface BroadcastListParams {
  q?: string;
  status?: string;
  type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}


/**
 * Список рассылок.
 *
 * Realtime через WebSocket (Reverb):
 *  - Слушает private-канал admin.broadcasts
 *  - При .status.updated → invalidateQueries (refetch списка)
 *  - Toast только при смене статуса на sent/failed (прогресс не спамит)
 *
 * Polling fallback: каждые 30 сек если есть 'sending'. Реальный realtime
 * идёт через WebSocket — polling сработает только если Reverb упал.
 *
 * Не переведён на фабрику: refetchInterval — функция от данных (polling
 * только пока есть рассылки в статусе 'sending'), фабрика принимает
 * только число. Echo-эффект ниже сохранён дословно.
 */
export function useBroadcastsList(params: BroadcastListParams) {
  const qc = useQueryClient();

  const query = useQuery<BroadcastListResponse>({
    queryKey: ["admin", "broadcasts", "list", params],
    queryFn: async () => {
      const { data } = await api.get<BroadcastListResponse>("/admin/broadcasts", { params });
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchInterval: (query) => {
      const counts = query.state.data?.counts;
      return counts && counts.sending > 0 ? 30000 : false;
    },
  });

  // WebSocket listener на admin.broadcasts.
  useEffect(() => {
    const echo = getEcho();
    const channel = echo.private("admin.broadcasts");

    type BroadcastStatusEvent = {
      broadcast_id: number;
      status: "draft" | "scheduled" | "sending" | "sent" | "failed";
      progress: number;
      sent_count: number;
      failed_count: number;
      total_recipients: number;
    };

       // Отслеживаем предыдущий статус каждой рассылки — чтобы стрелять toast
    // ТОЛЬКО при реальной смене на финальный (sent/failed), а не на каждое
    // событие прогресса. Один объект на все рассылки — живёт пока жив channel.
    const previousStatuses = new Map<number, string>();

    channel.listen(".status.updated", (e: BroadcastStatusEvent) => {
      // Invalidate список — фронт перечитает данные с бэка. Это происходит
      // на КАЖДОЕ событие (включая progress), чтобы счётчики и status badge
      // в строке были актуальны. Это дёшево — RQ кэширует и не рефетчит,
      // если данные свежие.
      qc.invalidateQueries({ queryKey: ["admin", "broadcasts"] });

      const prevStatus = previousStatuses.get(e.broadcast_id);

      // Запоминаем текущий статус для следующего события.
      previousStatuses.set(e.broadcast_id, e.status);

      // Toast ТОЛЬКО при переходе в финальный статус (sent/failed).
      // - 'sending' / 'progress' → молчим (статус в строке сам обновится)
      // - повторный 'sent' (уже был sent) → молчим (защита от дублей)
      // - 'sent' после 'sending' → toast.success
      // - 'failed' после 'sending' → toast.error
      const isFinalTransition =
        (e.status === "sent" && prevStatus !== "sent") ||
        (e.status === "failed" && prevStatus !== "failed");

      if (!isFinalTransition) return;

      if (e.status === "sent") {
        toast.success(`Рассылка #${e.broadcast_id} отправлена`, {
          description: `${e.sent_count} доставлено${e.failed_count > 0 ? `, ${e.failed_count} ошибок` : ""}`,
        });
      } else if (e.status === "failed") {
        toast.error(`Ошибка отправки рассылки #${e.broadcast_id}`, {
          description: e.failed_count > 0 ? `Упало: ${e.failed_count}` : undefined,
        });
      }
    });

    return () => {
      channel.stopListening(".status.updated");
    };
  }, [qc]);

  return query;
}

export function useBroadcastCounts() {
  return useAdminItemQuery<{ data: BroadcastCounts }>(
    ["admin", "broadcasts", "counts"],
    "/admin/broadcasts/counts",
    { staleTime: 60_000 },
  );
}

// Не переведён на фабрику: detail-запрос по id без placeholderData
// (конвенция из use-users.ts).
export function useBroadcastDetail(id: number | null) {
  return useQuery<{ data: BroadcastDetail }>({
    queryKey: ["admin", "broadcasts", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: BroadcastDetail }>(`/admin/broadcasts/${id}`);
      return data;
    },
    enabled: id !== null,
    staleTime: 0,
  });
}


export interface BroadcastPayload {
  title: string;
  type: BroadcastType;
  message?: string;
  email_body?: string;
  action_url?: string;
  scheduled_at?: string;
  selected_user_id?: number | null;
  filters?: {
    gender?: string | null;
    is_premium?: string | null;
    city_id?: string | null;
    city_label?: string | null;
    age_from?: number | null;
    age_to?: number | null;
    last_seen_days?: number | null;
    has_photo?: string | null;
  };
}

// ===== Хуки действий =====
//
// Все мутации рассылок инвалидируют весь префикс ["admin","broadcasts"]:
// список (в т.ч. текущая фильтрация/страница), counts и detail —
// статусы и счётчики табов должны обновиться сразу.

export function useCreateBroadcast() {
  return useAdminMutation<BroadcastPayload, { message: string; data: { id: number } }>({
    mutationFn: (payload) =>
      api.post<{ message: string; data: { id: number } }>(`/admin/broadcasts`, payload).then((r) => r.data),
    errorText: "Ошибка создания рассылки",
    invalidate: [["admin", "broadcasts"]],
  });
}

export function useUpdateBroadcast() {
  return useAdminMutation<
    { id: number; payload: BroadcastPayload },
    { message: string }
  >({
    mutationFn: ({ id, payload }) =>
      api.put<{ message: string }>(`/admin/broadcasts/${id}`, payload).then((r) => r.data),
    errorText: "Ошибка обновления рассылки",
    invalidate: [["admin", "broadcasts"]],
  });
}

export function useSendBroadcastNow() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/broadcasts/${id}/send-now`).then((r) => r.data),
    errorText: "Ошибка запуска рассылки",
    invalidate: [["admin", "broadcasts"]],
  });
}

export function useDuplicateBroadcast() {
  return useAdminMutation<number, { message: string; data: { id: number } }>({
    mutationFn: (id) =>
      api
        .post<{ message: string; data: { id: number } }>(`/admin/broadcasts/${id}/duplicate`)
        .then((r) => r.data),
    errorText: "Ошибка дублирования",
    invalidate: [["admin", "broadcasts"]],
  });
}

export function useDeleteBroadcast() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/broadcasts/${id}`).then((r) => r.data),
    errorText: "Ошибка удаления",
    invalidate: [["admin", "broadcasts"]],
  });
}

export function useBulkDeleteBroadcasts() {
  return useAdminMutation<number[], { message: string }>({
    mutationFn: (ids) =>
      api.post<{ message: string }>("/admin/broadcasts/bulk-delete", { ids }).then((r) => r.data),
    errorText: "Ошибка массового удаления",
    invalidate: [["admin", "broadcasts"]],
  });
}
