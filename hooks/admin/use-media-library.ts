// hooks/admin/use-media-library.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminItemQuery, useAdminMutation } from "./use-admin-api";

export interface MediaLibraryItem {
  id: number;
  file_name: string;
  url: string;
  thumb_url: string;
  sm_url: string;
  lg_url: string;
  collection: string;
  is_processing: boolean;
  size: number;
  mime_type: string;
  created_at: string;
}

export type MediaLibraryListResponse = MetaPaginated<MediaLibraryItem> & {
  collection: string;
  collection_label: string;
  crop_rules: {
    keep_original: boolean;
    alpha: boolean;
    max_size_mb: number;
    variants: Array<{
      key: string;
      size: string;
      fit: string;
      format: string;
      quality: number;
    }>;
  };
};

export interface MediaCollectionCounts {
  all: number;
  [key: string]: number;
}

export interface MediaVariantDetail {
  key: string;
  url: string;
  size: string;
  fit: string;
  format: string;
}

export interface MediaItemDetail {
  id: number;
  file_name: string;
  collection: string;
  collection_label: string;
  size: number;
  mime_type: string;
  created_at: string;
  variants: MediaVariantDetail[];
  is_processing: boolean;
  lg_url: string;
  thumb_url: string;
}

interface MediaLibraryParams {
  search?: string;
  collection?: string;
  page?: number;
  per_page?: number;
}

// Не переведён на фабрику: refetchInterval — функция от данных (polling 3 сек,
// пока Job нарезает варианты и есть is_processing файлы), фабрика принимает
// только число.
export function useMediaLibraryList(params: MediaLibraryParams) {
  return useQuery<MediaLibraryListResponse>({
    queryKey: ["admin", "media-library", "list", params],
    queryFn: async () => {
      const { data } = await api.get<MediaLibraryListResponse>("/admin/media", { params });
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchInterval: (query) => {
      const items = query.state.data?.data ?? [];
      const hasProcessing = items.some((m) => m.is_processing);
      return hasProcessing ? 3000 : false;
    },
  });
}

export function useMediaCollectionCounts() {
  return useAdminItemQuery<{ data: MediaCollectionCounts }>(
    ["admin", "media-library", "counts"],
    "/admin/media/counts",
    { staleTime: 60_000 },
  );
}

// Не переведён на фабрику: detail-запрос по id без placeholderData
// (конвенция из use-users.ts).
export function useMediaItemDetail(id: number | null) {
  return useQuery<{ data: MediaItemDetail }>({
    queryKey: ["admin", "media-library", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: MediaItemDetail }>(`/admin/media/${id}`);
      return data;
    },
    enabled: id !== null,
    staleTime: 0,
  });
}

// Инвалидации медиа-библиотеки: и её собственные ключи ["admin","media-library"],
// и пикер ["admin","media"] (use-media.ts читает тот же endpoint /admin/media).

export function useUploadMediaLibrary() {
  return useAdminMutation<{ files: File[]; collection: string }, { message: string }>({
    mutationFn: async (payload) => {
      const formData = new FormData();
      formData.append("collection", payload.collection);
      payload.files.forEach((f) => formData.append("files[]", f));
      const { data } = await api.post<{ message: string }>("/admin/media", formData);
      return data;
    },
    errorText: "Ошибка загрузки файлов",
    invalidate: [["admin", "media-library"], ["admin", "media"]],
  });
}

export function useDeleteMediaLibrary() {
  return useAdminMutation<number, { message?: string }>({
    mutationFn: async (id) => {
      const { data } = await api.delete<{ message?: string }>(`/admin/media/${id}`);
      return data;
    },
    success: () => "Файл удален",
    errorText: "Ошибка удаления",
    invalidate: [["admin", "media-library"], ["admin", "media"]],
  });
}
