// hooks/admin/use-interests.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// ============================================
// Типы
// ============================================

export interface InterestValidationErrors {
  name?: string[];
  category_id?: string[];
  search_boost?: string[];
  [key: string]: string[] | undefined;
}

export interface InterestCategoryRef {
  id: number;
  name: string;
  slug: string;
}

export interface InterestList {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
  category: InterestCategoryRef | null;
  search_boost: number;
  users_count: number;
  created_at: string;
  updated_at: string;
}

/** Детализация интереса = элемент списка (бэкенд не отдаёт доп. полей). */
export type InterestDetail = InterestList;

export interface InterestCounts {
  all: number;
  uncategorized: number;
  boosted: number;
}

/**
 * Фильтр по категории:
 *  - 'all'           — все интересы
 *  - 'uncategorized' — без категории (category_id IS NULL)
 *  - 'boosted'       — в бусте (search_boost > 0)
 *  - number          — конкретная категория (category_id = N)
 */
export type InterestCategoryFilter = "all" | "uncategorized" | "boosted" | number;

export interface InterestPayload {
  name: string;
  category_id: number | null;
  search_boost: number;
}

export type BulkInterestAction = "delete" | "set_category";

// ============================================
// Список
// ============================================

type InterestListResponse = MetaPaginated<InterestList> & {
  counts: InterestCounts;
};

interface InterestListParams {
  q?: string;
  category_id?: InterestCategoryFilter;
  page?: number;
  per_page?: number;
}

export function useInterestsCounts() {
  // staleTime: 0 — счётчики должны рефетчиться сразу при инвалидации
  // (иначе при staleTime: 60_000 invalidateQueries помечает stale, но
  //  рефетч срабатывает только при следующем монтировании/фокусе окна).
  // gcTime не задаётся: 5 минут — дефолт QueryClient.
  return useAdminItemQuery<{ data: InterestCounts }>(
    ["admin", "interests", "counts"],
    "/admin/interests/counts",
    { staleTime: 0 },
  );
}

export function useInterestsList(params: InterestListParams) {
  // category_id уходит как есть (в т.ч. "all"/"uncategorized"/"boosted" —
  // валидные значения фильтра бэка); пустые q/page/per_page фабрика
  // отбрасывает сама.
  return useAdminListQuery<InterestListParams, InterestListResponse>(
    ["admin", "interests", "list"],
    "/admin/interests",
    params,
    { staleTime: 0 },
  );
}

// Не переведён на фабрику: detail-запрос по id без placeholderData
// (конвенция из use-users.ts — фабрика держала бы прошлый интерес
// при переключении id вместо спиннера).
export function useInterest(id: number | null) {
  return useQuery<{ data: InterestDetail }>({
    queryKey: ["admin", "interests", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: InterestDetail }>(`/admin/interests/${id}`);
      return data;
    },
    enabled: id !== null,
    staleTime: 0,
  });
}

// ============================================
// Мутации
// ============================================

// Инвалидации всех мутаций интересов: список + счётчики + категории.
// Счётчики на табах конкретных категорий («Хобби» = 13) берутся из
// useInterestCategories.interests_count — этот запрос тоже надо сбрасывать,
// иначе табы категорий залипают после delete / set_category / create.
const INTERESTS_INVALIDATE = [
  ["admin", "interests", "list"],
  ["admin", "interests", "counts"],
  ["admin", "interests", "categories"],
] as const;

export function useCreateInterest() {
  // message опционален: мутация возвращает распакованный data.data (консьюмеры
  // формы ждут InterestDetail), тост задан статично — data.message не читается.
  return useAdminMutation<InterestPayload, InterestDetail & { message?: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ data: InterestDetail; message: string }>(
        "/admin/interests",
        payload
      );
      return data.data;
    },
    success: () => "Интерес создан",
    errorText: "Ошибка создания интереса",
    invalidate: INTERESTS_INVALIDATE,
  });
}

export function useUpdateInterest() {
  return useAdminMutation<
    { id: number; payload: InterestPayload },
    InterestDetail & { message?: string }
  >({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put<{ data: InterestDetail; message: string }>(
        `/admin/interests/${id}`,
        payload
      );
      return data.data;
    },
    success: () => "Интерес обновлен",
    errorText: "Ошибка обновления интереса",
    invalidate: INTERESTS_INVALIDATE,
    onSuccess: (_data, vars, qc) => {
      qc.invalidateQueries({ queryKey: ["admin", "interests", "detail", vars.id] });
    },
  });
}

export function useBoostInterest() {
  return useAdminMutation<
    { id: number; searchBoost: number },
    { message: string; search_boost: number }
  >({
    mutationFn: ({ id, searchBoost }) =>
      api
        .post<{ message: string; search_boost: number }>(`/admin/interests/${id}/boost`, {
          search_boost: searchBoost,
        })
        .then((r) => r.data),
    errorText: "Ошибка изменения буста",
    invalidate: INTERESTS_INVALIDATE,
  });
}

export function useDeleteInterest() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/interests/${id}`).then((r) => r.data),
    success: () => "Интерес удален",
    errorText: "Ошибка удаления",
    invalidate: INTERESTS_INVALIDATE,
  });
}

export function useBulkInterests() {
  return useAdminMutation<
    {
      ids: number[];
      action: BulkInterestAction;
      category_id?: number | null;
    },
    { message: string; count: number; counts: InterestCounts }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ message: string; count: number; counts: InterestCounts }>(
        "/admin/interests/bulk",
        payload
      );
      return data;
    },
    errorText: "Ошибка массового действия",
    invalidate: INTERESTS_INVALIDATE,
    onSuccess: (data, _vars, qc) => {
      // Бэк уже вернул свежие counts — кладём их в кэш сразу (мгновенное
      // обновление табов «Все»/«Без категории»/«В бусте» без лишнего запроса).
      if (data.counts) {
        qc.setQueryData<{ data: InterestCounts }>(
          ["admin", "interests", "counts"],
          { data: data.counts }
        );
      }
    },
  });
}
