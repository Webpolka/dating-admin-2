// hooks/admin/use-support-templates.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====
export type SupportTemplateItem = {
  id: number;
  title: string;
  body: string;
  is_active: boolean;
  sort_order: number;
  category_id: number | null;
  category: { id: number; name: string; slug: string } | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SupportCategoryItem = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
  is_system: boolean;
  templates_count: number;
};

export type SupportTemplatesListResponse = MetaPaginated<SupportTemplateItem> & {
  counts: {
    total: number;
    active: number;
    categories: Record<number, number>;
  };
};

export type SupportTemplatesListParams = {
  q?: string;
  category?: string;
  page?: number;
  per_page?: number;
};

export type CategoriesListResponse = {
  data: SupportCategoryItem[];
  counts: {
    total: number;
    active: number;
    categories: Record<number, number>;
  };
};

export type TemplateFormData = {
  category_id: number;
  title: string;
  body: string;
  is_active: boolean;
  sort_order: number;
};

export type CategoryFormData = {
  name: string;
  slug?: string;
  is_active: boolean;
  sort_order: number;
};

// ===== Хуки: Шаблоны =====
export function useSupportTemplatesList(params: SupportTemplatesListParams) {
  // Старый код собирал query-string вручную: q/page/per_page — только
  // непустые, category — всё, кроме "all" («нет фильтра»).
  return useAdminListQuery<SupportTemplatesListParams, SupportTemplatesListResponse>(
    ["admin", "support-templates"],
    "/admin/support-templates",
    {
      q: params.q,
      category: params.category !== "all" ? params.category : undefined,
      page: params.page,
      per_page: params.per_page,
    },
  );
}

// Не переведён на фабрику: detail-запрос по id без placeholderData
// (конвенция из use-users.ts), плюс распаковка data.data.
export function useSupportTemplateDetail(id: number | null, enabled: boolean) {
  return useQuery<SupportTemplateItem>({
    queryKey: ["admin", "support-templates", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: SupportTemplateItem }>(`/admin/support-templates/${id}`);
      return data.data;
    },
    enabled: enabled && !!id,
    staleTime: 0,
  });
}

export function useCreateSupportTemplate() {
  return useAdminMutation<TemplateFormData, { message: string; data: SupportTemplateItem }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ message: string; data: SupportTemplateItem }>(
        `/admin/support-templates`,
        payload
      );
      return data;
    },
    errorText: "Ошибка создания шаблона",
    invalidate: [["admin", "support-templates"]],
  });
}

export function useUpdateSupportTemplate() {
  return useAdminMutation<
    { id: number; payload: TemplateFormData },
    { message: string; data: SupportTemplateItem }
  >({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put<{ message: string; data: SupportTemplateItem }>(
        `/admin/support-templates/${id}`,
        payload
      );
      return data;
    },
    errorText: "Ошибка обновления шаблона",
    invalidate: [["admin", "support-templates"]],
  });
}

export function useDeleteSupportTemplate() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/support-templates/${id}`).then((r) => r.data),
    // Удаление — warning, а не success: шаблон мог использоваться в тикетах.
    success: (data) => ({ variant: "warning" as const, text: data.message }),
    errorText: "Ошибка удаления шаблона",
    invalidate: [["admin", "support-templates"]],
  });
}

// ===== Хуки: Категории =====

// Не переведён на фабрику: queryKey оканчивается сырой строкой поиска
// (["admin","support-templates","categories", search]), а фабрика кладёт
// в ключ объект params — формат ключа пришлось бы менять.
export function useSupportCategoriesList(search: string) {
  return useQuery<CategoriesListResponse>({
    queryKey: ["admin", "support-templates", "categories", search],
    queryFn: async ({ queryKey }) => {
      const [, , , s] = queryKey as [string, string, string, string];
      const searchParams = new URLSearchParams();
      if (s) searchParams.set("q", s);
      const { data } = await api.get<CategoriesListResponse>(`/admin/support-templates/categories?${searchParams.toString()}`);
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useCreateSupportCategory() {
  return useAdminMutation<CategoryFormData, { message: string; data: SupportCategoryItem }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ message: string; data: SupportCategoryItem }>(
        `/admin/support-templates/categories`,
        payload
      );
      return data;
    },
    errorText: "Ошибка создания категории",
    invalidate: [["admin", "support-templates"]],
  });
}

export function useUpdateSupportCategory() {
  return useAdminMutation<
    { id: number; payload: CategoryFormData },
    { message: string; data: SupportCategoryItem }
  >({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put<{ message: string; data: SupportCategoryItem }>(
        `/admin/support-templates/categories/${id}`,
        payload
      );
      return data;
    },
    errorText: "Ошибка обновления категории",
    invalidate: [["admin", "support-templates"]],
  });
}

export function useDeleteSupportCategory() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/support-templates/categories/${id}`).then((r) => r.data),
    // Удаление — warning: у категории могли быть шаблоны.
    success: (data) => ({ variant: "warning" as const, text: data.message }),
    errorText: "Ошибка удаления категории",
    invalidate: [["admin", "support-templates"]],
  });
}
