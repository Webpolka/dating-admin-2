// hooks/admin/use-stop-words.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====
export type StopWordAction = "mask" | "reject" | "alert";
export type StopWordCategory = "mat" | "scam" | "prostitution" | "drugs" | "contacts";

export type StopWordItem = {
  id: number;
  word: string;
  category: StopWordCategory;
  category_label: string;
  action: StopWordAction;
  action_label: string;
  action_variant: "default" | "secondary" | "destructive" | "warning";
  replacement: string;
  is_active: boolean;
  created_at: string | null;
};

export type StopWordsListResponse = MetaPaginated<StopWordItem> & {
  counts: { total: number; active: number };
};

export type StopWordsListParams = {
  q?: string;
  category?: string;
  action?: string;
  status?: string;
  page?: number;
  per_page?: number;
};

export type CreateBulkPayload = {
  words: string;
  category: StopWordCategory;
  action: StopWordAction;
};

export type UpdateStopWordPayload = {
  word: string;
  category: StopWordCategory;
  action: StopWordAction;
  replacement?: string;
  is_active?: boolean;
};

export type BulkActionPayload = {
  ids: number[];
  action: "activate" | "deactivate" | "delete";
};

// ===== Хуки =====
export function useStopWordsList(params: StopWordsListParams) {
  // Все фильтры опциональны; "all" — «нет фильтра», в query не попадает
  // (фабрика выбросит undefined/пустые значения сама).
  return useAdminListQuery<StopWordsListParams, StopWordsListResponse>(
    ["admin", "stop-words"],
    "/admin/stop-words",
    {
      q: params.q,
      category: params.category !== "all" ? params.category : undefined,
      action: params.action !== "all" ? params.action : undefined,
      status: params.status !== "all" ? params.status : undefined,
      page: params.page,
      per_page: params.per_page,
    },
  );
}

/**
 * Отдельный query ТОЛЬКО для counts (total/active).
 *
 * Stable queryKey (без filter/page/q params) — не пересоздаётся при
 * смене фильтров → counts не скачут. Дёргает существующий endpoint
 * /admin/stop-words/counts (на бэке уже есть).
 *
 * Не переведён на useAdminItemQuery: queryFn разворачивает вложенный
 * data.data, а фабрика отдаёт ответ как есть.
 */
export function useStopWordsCounts() {
  return useQuery<{ total: number; active: number }>({
    queryKey: ["admin", "stop-words", "counts"],
    queryFn: async () => {
      const { data } = await api.get<{ data: { total: number; active: number } }>(
        `/admin/stop-words/counts`
      );
      return data.data;
    },
    staleTime: 15_000,
  });
}

// Мутация оставлена на useMutation (не useAdminMutation): тост зависит от
// ответа — toast.warning при created_count = 0 и success c description про
// дубликаты, а фабрика умеет только toast.success(data.message).

/** Ответ POST /admin/stop-words (массовое добавление). */
type BulkStopWordsResponse = {
  message: string;
  created_count: number;
  duplicate_count: number;
  total_count: number;
};

export function useCreateBulkStopWords() {
  return useAdminMutation<CreateBulkPayload, BulkStopWordsResponse>({
    mutationFn: async (payload) => {
      const { data } = await api.post<BulkStopWordsResponse>(`/admin/stop-words`, payload);
      return data;
    },
    success: (data) => {
      const { created_count, duplicate_count, total_count } = data;
      // Все введённые слова — дубликаты → warning (жёлтый)
      if (created_count === 0) {
        return { variant: "warning" as const, text: `Все ${total_count} слов уже существуют в базе` };
      }
      // Хоть что-то добавилось → успех (зелёный), но показываем ДВЕ строки:
      //   Добавлено новых слов: N
      //   Пропущено дубликатов: M (жёлтым, только если M > 0)
      return {
        variant: "success" as const,
        text: `Добавлено новых слов: ${created_count}`,
        description: duplicate_count > 0 ? `Пропущено дубликатов: ${duplicate_count}` : undefined,
      };
    },
    invalidate: [["admin", "stop-words"]],
    errorText: "Ошибка создания стоп-слов",
  });
}

export function useUpdateStopWord() {
  return useAdminMutation<
    { id: number; payload: UpdateStopWordPayload },
    { message: string; data: StopWordItem }
  >({
    mutationFn: ({ id, payload }) =>
      api.put<{ message: string; data: StopWordItem }>(`/admin/stop-words/${id}`, payload).then((r) => r.data),
    errorText: "Ошибка обновления слова",
    invalidate: [["admin", "stop-words"]],
  });
}

export function useToggleStopWord() {
  return useAdminMutation<number, { message: string; is_active: boolean }>({
    mutationFn: (id) =>
      api.post<{ message: string; is_active: boolean }>(`/admin/stop-words/${id}/toggle`).then((r) => r.data),
    errorText: "Ошибка смены статуса",
    invalidate: [["admin", "stop-words"]],
  });
}

export function useDeleteStopWord() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/stop-words/${id}`).then((r) => r.data),
    errorText: "Ошибка удаления",
    invalidate: [["admin", "stop-words"]],
  });
}

export function useBulkActionStopWords() {
  return useAdminMutation<BulkActionPayload, { message: string }>({
    mutationFn: (payload) =>
      api.post<{ message: string }>("/admin/stop-words/bulk", payload).then((r) => r.data),
    errorText: "Ошибка массового действия",
    invalidate: [["admin", "stop-words"]],
  });
}
