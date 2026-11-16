// hooks/admin/use-media.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminMutation } from "./use-admin-api";

export interface MediaItem {
  id: number;
  file_name: string;
  disk_path: string;
  url: string;
  thumb_url: string;
  sm_url: string;
  lg_url: string;
  is_processing: boolean;
  size: number;
  mime_type: string;
  created_at: string;
}

export interface CropVariant {
  key: string;
  size: string;
  fit: string;
  format: string;
  quality: number;
}

export interface CropRules {
  keep_original: boolean;
  alpha: boolean;
  max_size_mb: number;
  variants: CropVariant[];
}

export type MediaListResponse = MetaPaginated<MediaItem> & {
  collection: string;
  collection_label: string;
  crop_rules: CropRules;
};

interface MediaListParams {
  collection?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

// Не переведён на фабрику: refetchInterval — функция от данных (polling 3 сек,
// пока есть is_processing файлы), фабрика принимает только число.
// Хук для MediaPicker (используется в форме подарков, блоге и т.д.).
export function useMediaList(params: MediaListParams, enabled: boolean = true) {
  return useQuery<MediaListResponse>({
    queryKey: ["admin", "media", params],
    queryFn: async () => {
      const { data } = await api.get<MediaListResponse>("/admin/media", { params });
      return data;
    },
    enabled,
    staleTime: 0,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => {
      const items = query.state.data?.data ?? [];
      const hasProcessing = items.some((m) => m.is_processing);
      return hasProcessing ? 3000 : false;
    },
  });
}

// ===== Мутации пикера =====
//
// Инвалидируется ["admin","media"] — как и раньше (префикс не пересекается
// с ["admin","media-library"]: матчинг ключей идёт по целым элементам).

export function useUploadMedia() {
  return useAdminMutation<{ files: File[]; collection: string }, { message: string }>({
    mutationFn: async (payload) => {
      const formData = new FormData();
      formData.append("collection", payload.collection);
      payload.files.forEach((f) => formData.append("files[]", f));
      const { data } = await api.post<{ message: string }>("/admin/media", formData);
      return data;
    },
    errorText: "Ошибка загрузки файлов",
    invalidate: [["admin", "media"]],
  });
}

export function useDeleteMedia() {
  return useAdminMutation<number, { message?: string }>({
    mutationFn: async (id) => {
      const { data } = await api.delete<{ message?: string }>(`/admin/media/${id}`);
      return data;
    },
    success: () => "Файл удален",
    errorText: "Ошибка удаления",
    invalidate: [["admin", "media"]],
  });
}

export function useBulkDeleteMedia() {
  return useAdminMutation<number[], { message: string }>({
    mutationFn: (ids) =>
      api.post<{ message: string }>("/admin/media/bulk-delete", { ids }).then((r) => r.data),
    errorText: "Ошибка удаления",
    invalidate: [["admin", "media"]],
  });
}
