// hooks/admin/use-blog-posts.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

export type BlogPostStatus = "draft" | "published" | "archived";

export type BlogPostStatusVariant = "warning" | "success" | "secondary";


export interface BlogPostValidationErrors {
  title?: string[];
  slug?: string[];
  excerpt?: string[];
  body?: string[];
  category_id?: string[];
  status?: string[];
  is_featured?: string[];
  cover_media_id?: string[];
  [key: string]: string[] | undefined;
}

export interface BlogPostList {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  status: BlogPostStatus;
  status_label: string;
  status_variant: BlogPostStatusVariant;
  is_featured: boolean;
  views_count: number;
  category_id: number | null;
  cover_media_id: number | null;
  category: { id: number; name: string; slug: string } | null;
  cover_url: string;
  cover_thumb: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostDetail extends BlogPostList {
  body: string;
  cover_sm_url: string | null;
  author: { id: number; name: string } | null;
}

export interface BlogPostCounts {
  all: number;
  published: number;
  draft: number;
  archived: number;
  uncategorized: number;
}


// ============================================
// СПИСОК ПОСТОВ
// ============================================
type BlogPostListResponse = MetaPaginated<BlogPostList> & {
  counts: BlogPostCounts;
};

export type BlogStatusFilter = "all" | "published" | "draft" | "archived" | "uncategorized";

interface BlogPostListParams {
  q?: string;
  status?: BlogStatusFilter;
  page?: number;
  per_page?: number;
}


// ============================================
// ОТДЕЛЬНЫЙ ХУК ДЛЯ СЧЕТЧИКОВ
// ============================================
export function useBlogPostCounts() {
  // gcTime не задаётся: 5 минут — дефолт QueryClient.
  return useAdminItemQuery<{ data: BlogPostCounts }>(
    ["admin", "blog", "posts", "counts"],
    "/admin/blog/posts/counts",
    { staleTime: 60_000 },
  );
}

/**
 * Список постов. status уходит как есть (в т.ч. "all" — валидное значение
 * фильтра бэка); пустые q/page/per_page фабрика отбрасывает сама.
 */
export function useBlogPostsList(params: BlogPostListParams) {
  return useAdminListQuery<BlogPostListParams, BlogPostListResponse>(
    ["admin", "blog", "posts", "list"],
    "/admin/blog/posts",
    params,
    { staleTime: 0 },
  );
}

// Не переведён на фабрику: detail-запрос по id без placeholderData
// (конвенция из use-users.ts — фабрика держала бы прошлый пост
// при переключении id вместо спиннера).
export function useBlogPost(id: number | null) {
  return useQuery<{ data: BlogPostDetail }>({
    queryKey: ["admin", "blog", "posts", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: BlogPostDetail }>(`/admin/blog/posts/${id}`);
      return data;
    },
    enabled: id !== null,
    staleTime: 0,
  });
}

export interface BlogPostPayload {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  category_id: number | null;
  status: BlogPostStatus;
  is_featured: boolean;
  cover_media_id: number | null;
}

// ============================================
// ВСЕ МУТАЦИИ — инвалидируют И список И счётчики
// ============================================

const BLOG_POSTS_INVALIDATE = [
  ["admin", "blog", "posts", "list"],
  ["admin", "blog", "posts", "counts"],
] as const;

export function useSetFeaturedBlogPost() {
  return useAdminMutation<number, { message: string; is_featured: boolean }>({
    mutationFn: (id) =>
      api
        .post<{ message: string; is_featured: boolean }>(`/admin/blog/posts/${id}/feature`)
        .then((r) => r.data),
    errorText: "Ошибка смены закрепления",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}

export function useCreateBlogPost() {
  // message опционален: мутация возвращает распакованный data.data (форма
  // ждёт BlogPostDetail), тост задан статично — data.message не читается.
  return useAdminMutation<BlogPostPayload, BlogPostDetail & { message?: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ data: BlogPostDetail; message: string }>(
        "/admin/blog/posts",
        payload
      );
      return data.data;
    },
    success: () => "Пост создан",
    errorText: "Ошибка создания поста",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}

export function useUpdateBlogPost() {
  return useAdminMutation<
    { id: number; payload: BlogPostPayload },
    BlogPostDetail & { message?: string }
  >({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put<{ data: BlogPostDetail; message: string }>(
        `/admin/blog/posts/${id}`,
        payload
      );
      return data.data;
    },
    success: () => "Пост обновлен",
    errorText: "Ошибка обновления поста",
    invalidate: BLOG_POSTS_INVALIDATE,
    onSuccess: (_data, vars, qc) => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "posts", "detail", vars.id] });
    },
  });
}

export function useDuplicateBlogPost() {
  return useAdminMutation<number, BlogPostDetail & { message?: string }>({
    mutationFn: async (id) => {
      const { data } = await api.post<{ data: BlogPostDetail; message: string }>(
        `/admin/blog/posts/${id}/duplicate`
      );
      return data.data;
    },
    success: () => "Пост продублирован",
    errorText: "Ошибка дублирования",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}


export function useToggleBlogPostStatus() {
  return useAdminMutation<number, { message: string; status: BlogPostStatus }>({
    mutationFn: (id) =>
      api
        .post<{ message: string; status: BlogPostStatus }>(`/admin/blog/posts/${id}/toggle`)
        .then((r) => r.data),
    success: () => "Статус обновлен",
    errorText: "Ошибка смены статуса",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}


export function useArchiveBlogPost() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/blog/posts/${id}/archive`).then((r) => r.data),
    success: () => "Пост перемещен в архив",
    errorText: "Ошибка архивации",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}

export function useRestoreBlogPost() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/blog/posts/${id}/restore`).then((r) => r.data),
    success: () => "Пост восстановлен",
    errorText: "Ошибка восстановления",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}


export function useDeleteBlogPost() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/blog/posts/${id}`).then((r) => r.data),
    success: () => "Пост удален",
    errorText: "Ошибка удаления",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}

export type BulkBlogAction = "publish" | "draft" | "archive" | "delete";

export function useBulkBlogPosts() {
  return useAdminMutation<
    { ids: number[]; action: BulkBlogAction; is_archive_tab: boolean },
    { message: string; counts: BlogPostCounts }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ message: string; counts: BlogPostCounts }>(
        "/admin/blog/posts/bulk",
        payload
      );
      return data;
    },
    errorText: "Ошибка массового действия",
    invalidate: BLOG_POSTS_INVALIDATE,
  });
}
