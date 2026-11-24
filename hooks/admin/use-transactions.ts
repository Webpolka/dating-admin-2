// hooks/admin/use-transactions.ts
"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { getEcho, type EchoInstance } from "@/lib/echo";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useTransactionPending } from "./use-transactions-pending";
import { useAdminListQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====
export type TransactionStatus = "pending" | "success" | "failed" | "refunded";
export type TransactionType = "subscription" | "credits" | "refund";
export type DatePeriod = "all" | "day" | "week" | "month";
export type RefundReason =
  | "user_request"
  | "fraud"
  | "bank_error"
  | "duplicate"
  | "admin_mistake"
  | "other";

export type TransactionUser = UserBadgeData;

export type TransactionItem = {
  id: number;
  user_id: number | null;
  amount: number;
  formatted_amount: string;
  amount_class: string;
  currency: string;
  type: TransactionType;
  type_badge: { variant: string; label: string; className: string };
  status: TransactionStatus;
  status_badge: { variant: string; label: string };
  provider: string | null;
  provider_transaction_id: string | null;
  credits_amount: number | null;
  // Промокод — извлечено из meta (бек отдаёт в списке).
  promo_code_id: number | null;
  promo_code_discount: number | null;
  // original_amount — цена плана до скидки (из meta, НЕ вычисляется на фронте).
  original_amount: number | null;
  created_at: string | null;
  updated_at: string | null;
  user: TransactionUser | null;
};

export type TransactionDetail = TransactionItem & {
  meta: Record<string, unknown> | null;
};

export type TransactionsStats = {
  all: number;
  success: number;
  pending: number;
  failed: number;
  refunded: number;
  revenue: string;
};

type TransactionsListResponse = MetaPaginated<TransactionItem> & {
  stats: TransactionsStats;
};

type TransactionsListParams = {
  q?: string;
  status?: string;
  type?: string;
  period?: string;
  page?: number;
  per_page?: number;
};

type RefundProcessedEvent = {
  transaction_id: number;
  status: string;
  success: boolean;
  reason: string | null;
  updated_at: string | null;
};

type SyncProcessedEvent = {
  transaction_id: number;
  status: string;
  success: boolean;
  message: string;
  updated_at: string | null;
};

// ===== Хуки =====

/**
 * Список транзакций + WebSocket-подписка на admin.transactions.
 *
 * staleTime: 30 сек — данные помечаются устаревшими через 30 сек, а не
 * мгновенно (как было с staleTime: 0). Это снижает количество рефетчей
 * при invalidate. 30 сек — норма для админки, где данные не меняются
 * каждую секунду.
 *
 * Плавная смена страниц/табов без мерцания (фабрика держит прошлые данные).
 * Все фильтры опциональны; "all" — «нет фильтра», в query не попадает.
 *
 * WebSocket listener'ы чистят pending store при .sync.processed /
 * .refund.processed — это убирает спиннер, который крутится с момента
 * клика по sync/refund до реального ответа банка.
 */
export function useTransactionsList(params: TransactionsListParams) {
  const qc = useQueryClient();
  const { clearSyncPending, clearRefundPending } = useTransactionPending();

  const query = useAdminListQuery<TransactionsListParams, TransactionsListResponse>(
    ["admin", "transactions"],
    "/admin/transactions",
    {
      q: params.q,
      status: params.status !== "all" ? params.status : undefined,
      type: params.type !== "all" ? params.type : undefined,
      period: params.period !== "all" ? params.period : undefined,
      page: params.page,
      per_page: params.per_page,
    },
    { staleTime: 30_000 },
  );

  useEffect(() => {
    const echo: EchoInstance = getEcho();
    const channel = echo.private("admin.transactions");

    // Событие: возврат обработан банком (успех или отказ).
    // Чистим pending — спиннер на этой транзакции должен остановиться.
    channel.listen(".refund.processed", (e: RefundProcessedEvent) => {
      clearRefundPending(e.transaction_id);
      qc.invalidateQueries({ queryKey: ["admin", "transactions"] });

      if (e.success) {
        toast.success(`Возврат #${e.transaction_id} обработан банком`, {
          description: e.reason ? `Причина: ${e.reason}` : undefined,
        });
      } else {
        toast.error(`Банк отклонил возврат #${e.transaction_id}`, {
          description: e.reason ?? "Свяжитесь с банком-эквайером",
        });
      }
    });

    // Событие: синхронизация с банком завершена (успех или отказ).
    // Чистим pending — спиннер на этой транзакции должен остановиться.
    channel.listen(".sync.processed", (e: SyncProcessedEvent) => {
      clearSyncPending(e.transaction_id);
      qc.invalidateQueries({ queryKey: ["admin", "transactions"] });

      if (e.success) {
        toast.success(`Платеж #${e.transaction_id} подтвержден банком`, {
          description: e.message,
        });
      } else {
        toast.error(`Банк отклонил платеж #${e.transaction_id}`, {
          description: e.message,
        });
      }
    });

    return () => {
      channel.stopListening(".refund.processed");
      channel.stopListening(".sync.processed");
    };
  }, [qc, clearSyncPending, clearRefundPending]);

  return query;
}

// Не переведён на useAdminItemQuery: фабрика держит прошлые данные
// (keep-previous) — при переключении между транзакциями модалка показала бы
// ПРОШЛУЮ транзакцию вместо спиннера. Старое поведение сохранено намеренно.
export function useTransactionDetail(id: number | null, enabled: boolean) {
  return useQuery<{ data: TransactionDetail }>({
    queryKey: ["admin", "transactions", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: TransactionDetail }>(`/admin/transactions/${id}`);
      return data;
    },
    enabled: enabled && !!id,
    staleTime: 0,
  });
}

// Обе мутации ниже — на фабрике useAdminMutation:
//   - markXxxPending(id) вызывается ВНУТРИ mutationFn (спиннер до POST);
//   - success-колбэк не сбрасывает pending (ждём WebSocket) и тостит с description;
//   - onError чистит pending по vars.

/**
 * Синхронизация транзакции с банком.
 *
 * Поток:
 *  1. mutate(id) → markSyncPending(id) → спиннер начинает крутиться
 *  2. POST /admin/transactions/{id}/sync → 200 OK (быстро, только dispatch Job)
 *  3. onSuccess → toast "Запрос отправлен" (спиннер ПРОДОЛЖАЕТ крутиться)
 *  4. Job идёт в банк (5-30 сек)
 *  5. WebSocket .sync.processed → clearSyncPending(id) → спиннер останавливается
 *     → toast "Платеж подтвержден" или "Банк отклонил"
 *
 * Если POST упал (422/429/network) → onError → clearSyncPending(id) →
 * спиннер останавливается, toast с ошибкой.
 *
 * Защита от зависания: в useTransactionPending.markSyncPending стоит
 * setTimeout на 60 сек — если WebSocket не пришёл, pending сбросится
 * автоматически (Job упал / Reverb лежит / банк молчит).
 */
export function useSyncTransaction() {
  const { markSyncPending, clearSyncPending } = useTransactionPending();

  return useAdminMutation<number, { message: string }>({
    mutationFn: async (id) => {
      // Помечаем pending ДО POST — спиннер начинает крутиться сразу.
      markSyncPending(id);
      const { data } = await api.post<{ message: string }>(
        `/admin/transactions/${id}/sync`
      );
      return data;
    },
    // Спиннер НЕ сбрасываем — ждём WebSocket .sync.processed.
    // Backend уже dispatch'ил Job, но банк ещё не ответил.
    success: (data) => ({
      variant: "success",
      text: data.message,
      description: "Ожидайте ответа банка — статус обновится автоматически",
    }),
    invalidate: [["admin", "transactions"]],
    errorText: "Ошибка отправки запроса в банк",
    // POST упал — pending снимаем, спиннер останавливаем.
    onError: (_err, id) => clearSyncPending(id),
  });
}

/**
 * Оформление возврата.
 *
 * Аналогично useSyncTransaction:
 *  - markRefundPending(id) в mutationFn → спиннер крутится
 *  - clearRefundPending(id) в WebSocket listener'е → спиннер останавливается
 *  - clearRefundPending(id) в onError → если POST упал
 */
export function useRefundTransaction() {
  const { markRefundPending, clearRefundPending } = useTransactionPending();

  return useAdminMutation<
    { id: number; reason: RefundReason; comment?: string },
    { message: string }
  >({
    mutationFn: async ({ id, reason, comment }) => {
      markRefundPending(id);
      const { data } = await api.post<{ message: string }>(
        `/admin/transactions/${id}/refund`,
        { reason, comment }
      );
      return data;
    },
    // Спиннер НЕ сбрасываем — ждём WebSocket .refund.processed.
    success: (data) => ({
      variant: "success",
      text: data.message,
      description: "Ожидайте ответа банка — статус обновится автоматически",
    }),
    invalidate: [["admin", "transactions"]],
    errorText: "Ошибка оформления возврата",
    onError: (_err, { id }) => clearRefundPending(id),
  });
}
