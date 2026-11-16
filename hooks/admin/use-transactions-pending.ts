// hooks/admin/use-transactions-pending.ts
//
// Глобальный стор "в процессе" для sync/refund транзакций.
//
// Проблема, которую решает:
//   Раньше спиннер на sync/refund крутился только пока POST /admin/transactions/{id}/sync
//   не вернёт 200 — а это быстро (backend только dispatch'ит Job в очередь).
//   После ответа POST спиннер пропадал, но реально процесс ещё шёл 5-30 секунд
//   (Job идёт в банк, банк отвечает, broadcast'ится WebSocket). Админ не понимал,
//   что происходит в эти 5-30 секунд.
//
// Теперь:
//   - markSyncPending(id) вызывается ПЕРЕД POST в useSyncTransaction.mutationFn
//   - clearSyncPending(id) вызывается в WebSocket listener'е при .sync.processed
//   - clearSyncPending(id) также вызывается в onError мутации (POST упал)
//   - Авто-сброс через 60 сек (если WebSocket не пришёл — Job завис или Reverb лежит)
//
// UI читает syncIds.has(tx.id) — если true, спиннер крутится.
// Это позволяет видеть "процесс идёт" всё время, пока банк не ответил.

import { create } from "zustand";

type PendingState = {
  syncIds: Set<number>;
  refundIds: Set<number>;
  markSyncPending: (id: number) => void;
  markRefundPending: (id: number) => void;
  clearSyncPending: (id: number) => void;
  clearRefundPending: (id: number) => void;
};

// Слайсы sync/refund — близнецы (различаются только множеством id и текстом
// предупреждения), поэтому mark/clear реализованы ОДНОЙ параметризованной
// парой createPendingSlice ниже, а не двумя копипастами.
type PendingKey = "syncIds" | "refundIds";

// 60 секунд — потолок для ожидания ответа банка. Если за 60 сек WebSocket
// не пришёл — что-то не так (Job упал, Reverb лежит, банк молчит).
// Сбрасываем pending, чтобы спиннер не крутился вечно.
const AUTO_RESET_MS = 60_000;

// Минимальная сигнатура zustand-овского set, нужная слайсу
// (полный тип шире: есть replace-режим и прямые Partial-патчи).
type PendingSet = (
  updater: (state: PendingState) => PendingState | Partial<PendingState>,
) => void;

/**
 * Фабрика пары mark/clear для одного слайса pending-множества.
 *
 *   const sync = createPendingSlice(set, "syncIds", "sync");
 *   sync.mark(id)  → добавит id в syncIds и поставит таймер авто-сброса;
 *   sync.clear(id) → снимет таймер (если жив) и удалит id из syncIds.
 */
function createPendingSlice(set: PendingSet, key: PendingKey, label: string) {
  // Таймеры авто-сброса живут ВНЕ store — не триггерят ре-рендеры.
  // Map<id транзакции, timeoutId>.
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  const clear = (id: number) => {
    const prevTimeout = timers.get(id);
    if (prevTimeout) {
      clearTimeout(prevTimeout);
      timers.delete(id);
    }
    set((s) => {
      if (!s[key].has(id)) return s; // не было — нечего удалять, пропускаем ре-рендер
      const next = new Set(s[key]);
      next.delete(id);
      return key === "syncIds" ? { syncIds: next } : { refundIds: next };
    });
  };

  const mark = (id: number) => {
    set((s) => {
      const next = new Set(s[key]);
      next.add(id);
      return key === "syncIds" ? { syncIds: next } : { refundIds: next };
    });

    // Сбрасываем предыдущий таймер (если был) и ставим новый.
    const prevTimeout = timers.get(id);
    if (prevTimeout) clearTimeout(prevTimeout);
    const t = setTimeout(() => {
      clear(id);
      console.warn(`[transaction-pending] ${label} #${id}: auto-reset after ${AUTO_RESET_MS}ms (no WebSocket event)`);
    }, AUTO_RESET_MS);
    timers.set(id, t);
  };

  return { mark, clear };
}

export const useTransactionPending = create<PendingState>((set) => {
  const sync = createPendingSlice(set, "syncIds", "sync");
  const refund = createPendingSlice(set, "refundIds", "refund");

  return {
    syncIds: new Set<number>(),
    refundIds: new Set<number>(),

    markSyncPending: sync.mark,
    clearSyncPending: sync.clear,
    markRefundPending: refund.mark,
    clearRefundPending: refund.clear,
  };
});
