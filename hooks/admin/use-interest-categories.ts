// hooks/admin/use-interest-categories.ts
"use client";

import api from "@/lib/api";
import { useAdminItemQuery, useAdminMutation } from "./use-admin-api";

export interface InterestCategory {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  interests_count: number;
  created_at: string;
  updated_at: string;
}

export interface InterestCategoryPayload {
  name: string;
  icon?: string | null;
  sort_order?: number;
}

export function useInterestCategories() {
  // staleTime: 0 — interests_count в категориях должен рефетчиться сразу
  // при инвалидации от мутаций интересов.
  return useAdminItemQuery<{ data: InterestCategory[] }>(
    ["admin", "interests", "categories"],
    "/admin/interests/categories",
    { staleTime: 0 },
  );
}

export function useCreateInterestCategory() {
  // message опционален: мутация возвращает распакованную категорию (имя для
  // тоста), тост задан колбэком — data.message не читается.
  return useAdminMutation<InterestCategoryPayload, InterestCategory & { message?: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ data: InterestCategory; message: string }>(
        "/admin/interests/categories",
        payload
      );
      return data.data;
    },
    success: (category) => `Категория "${category.name}" создана`,
    // Раньше onError глотал причину с бэкенда (статичный тост) — фабрика
    // показывает message бэкенда.
    errorText: "Ошибка создания категории",
    invalidate: [["admin", "interests", "categories"]],
  });
}

export function useUpdateInterestCategory() {
  return useAdminMutation<
    { id: number; payload: Partial<InterestCategoryPayload> },
    InterestCategory & { message?: string }
  >({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put<{ data: InterestCategory; message: string }>(
        `/admin/interests/categories/${id}`,
        payload
      );
      return data.data;
    },
    success: () => "Категория обновлена",
    errorText: "Ошибка обновления категории",
    invalidate: [["admin", "interests", "categories"]],
  });
}

export function useDeleteInterestCategory() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/interests/categories/${id}`).then((r) => r.data),
    success: () => "Категория удалена",
    errorText: "Ошибка удаления категории",
    invalidate: [
      ["admin", "interests", "categories"],
      // Интересы в удалённой категории стали uncategorized — перечитать и их.
      ["admin", "interests"],
    ],
  });
}
