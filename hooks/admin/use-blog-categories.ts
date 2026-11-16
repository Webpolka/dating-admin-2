// hooks/admin/use-blog-categories.ts
"use client";

import api from "@/lib/api";
import { useAdminItemQuery, useAdminMutation } from "./use-admin-api";

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
  posts_count: number;
}

export function useBlogCategories() {
  // staleTime: 0 — posts_count должно рефетчиться сразу при инвалидации
  // от мутаций постов.
  return useAdminItemQuery<{ data: BlogCategory[] }>(
    ["admin", "blog", "categories"],
    "/admin/blog/categories",
    { staleTime: 0 },
  );
}


export function useCreateBlogCategory() {
  // message опционален: мутация возвращает распакованную категорию (имя для
  // тоста), тост задан колбэком — data.message не читается.
  return useAdminMutation<string, BlogCategory & { message?: string }>({
    mutationFn: async (name) => {
      const { data } = await api.post<{ data: BlogCategory; message: string }>(
        "/admin/blog/categories",
        { name }
      );
      return data.data;
    },
    success: (category) => `Рубрика "${category.name}" создана`,
    // Раньше onError глотал причину с бэкенда (статичный тост) — фабрика
    // показывает message бэкенда.
    errorText: "Ошибка создания рубрики",
    invalidate: [["admin", "blog", "categories"]],
  });
}

export function useDeleteBlogCategory() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/blog/categories/${id}`).then((r) => r.data),
    success: () => "Рубрика удалена",
    errorText: "Ошибка удаления рубрики",
    invalidate: [["admin", "blog", "categories"]],
  });
}
