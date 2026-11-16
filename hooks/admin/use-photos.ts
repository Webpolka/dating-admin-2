// hooks/admin/use-photos.ts
"use client";

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";
import type { PhotoRejectReason } from "@/lib/photos";

// Реэкспорт причин отказа из lib/photos.ts (ЧАСТЬ 7: вынесено для консистентности
// с lib/blocks.ts и lib/reports.ts). Обратно-совместимо — moderation/photos
// и PhotoCard продолжают импортировать PHOTO_REJECT_REASONS / getRejectReasonLabel
// / PhotoRejectReason отсюда. Новые потребители должны импортировать из @/lib/photos.
export {
  PHOTO_REJECT_REASONS,
  getRejectReasonLabel,
  type PhotoRejectReason,
} from "@/lib/photos";

// ===== Типы =====
export type PhotoStatus = "pending" | "approved" | "rejected";
export type PhotoMode = "queue" | "grid";

// Юзер на карточке фото (упрощённый — для шапки) — тот же UserBadgeData из lib/types.
export type PhotoUser = UserBadgeData;

export type PhotoAlbum = { id: number; name: string } | null;

export type PhotoItem = {
  id: number;
  user_id: number;
  status: PhotoStatus;
  is_primary: boolean;
  is_intimate: boolean;
  type: "profile" | "verification";
  reject_reason: string | null;
  trashed: boolean;
  moderated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  thumb_url: string;
  medium_url: string;
  large_url: string;
  original_url: string;
  album: PhotoAlbum;
  user?: PhotoUser | null;
};

// Карточка юзера в режиме очереди (UserBadgeData + поля очереди).
export type UserCard = {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  is_online: boolean;
  status: string;
  deleted_at: string | null;
  has_active_premium: boolean;
  has_active_vip: boolean;
  is_verified: boolean;
  pending_photos_count: number;
  created_at: string | null;
  photos: PhotoItem[];
};

export type PhotoCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  quarantine: number;
};

type PhotosListResponse = MetaPaginated<UserCard | PhotoItem> & {
  mode: PhotoMode;
  stats: PhotoCounts;
  status: PhotoStatus | "quarantine";
};

type PhotosListParams = {
  status: PhotoStatus | "quarantine" | "all";
  q?: string;
  page?: number;
  per_page?: number;
};

// ===== Хуки чтения =====
export function usePhotosList(params: PhotosListParams) {
  // status уходит всегда (в т.ч. "all"/"quarantine" — валидные значения
  // фильтра бэка); пустые q/page/per_page фабрика отбрасывает сама.
  return useAdminListQuery<PhotosListParams, PhotosListResponse>(
    ["admin", "photos"],
    "/admin/photos",
    {
      status: params.status,
      q: params.q,
      page: params.page,
      per_page: params.per_page,
    },
    { staleTime: 0 },
  );
}

/**
 * Stable query для counts — не зависит от filter/search/page.
 * QueryKey ["admin","photos","counts"] не меняется при смене вкладок →
 * counts не скачут (как было в support-chats и stop-words).
 *
 * refetchInterval: 30 сек — auto-refresh для moderation queue.
 * staleTime: 10 сек — разумная freshness.
 */
export function usePhotoCounts() {
  return useAdminItemQuery<{ stats: PhotoCounts }>(
    ["admin", "photos", "counts"],
    "/admin/photos/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ===== Хуки действий =====
//
// ЧАСТЬ 7: каждая мутация фото инвалидирует и глобальную очередь
// ["admin","photos"], и пер-юзер таб «Фото» (["user-photos"]). userId мутация
// не знает (работает по photo.id), поэтому инвалидируется весь префикс —
// refetch случится только у смонтированного таба (он один).

export function useApprovePhoto() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/photos/${id}/approve`).then((r) => r.data),
    errorText: "Ошибка одобрения фото",
    invalidate: [["admin", "photos"], ["user-photos"]],
  });
}

export function useRejectPhoto() {
  return useAdminMutation<{ id: number; reason: PhotoRejectReason }, { message: string }>({
    mutationFn: ({ id, reason }) =>
      api.post<{ message: string }>(`/admin/photos/${id}/reject`, { reason }).then((r) => r.data),
    errorText: "Ошибка отклонения фото",
    invalidate: [["admin", "photos"], ["user-photos"]],
  });
}

export function useSetPrimaryPhoto() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/photos/${id}/set-primary`).then((r) => r.data),
    errorText: "Ошибка установки аватара",
    invalidate: [["admin", "photos"], ["user-photos"]],
  });
}

export function useSoftDeletePhoto() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/photos/${id}/soft-delete`).then((r) => r.data),
    errorText: "Ошибка перемещения в карантин",
    invalidate: [["admin", "photos"], ["user-photos"]],
  });
}

export function useRestorePhoto() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/photos/${id}/restore`).then((r) => r.data),
    errorText: "Ошибка восстановления фото",
    invalidate: [["admin", "photos"], ["user-photos"]],
  });
}

export function useDestroyPhoto() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) => api.delete<{ message: string }>(`/admin/photos/${id}`).then((r) => r.data),
    errorText: "Ошибка удаления фото",
    invalidate: [["admin", "photos"], ["user-photos"]],
  });
}

// Массовые мутации: тост зависит от ответа (info при count = 0),
// поэтому задают success-колбэк фабрики. Инвалидации те же: ["admin","photos"] + ["user-photos"].

export function useApproveAllForUser() {
  return useAdminMutation<number, { count: number; message: string }>({
    mutationFn: async (userId) => {
      const { data } = await api.post<{ count: number; message: string }>(
        `/admin/photos/user/${userId}/approve-all`
      );
      return data;
    },
    // count = 0 — это не успех, а «нечего обрабатывать» → info вместо success.
    success: (data) => (data.count > 0
      ? { variant: "success" as const, text: data.message }
      : { variant: "info" as const, text: data.message }),
    invalidate: [["admin", "photos"], ["user-photos"]],
    errorText: "Ошибка массового одобрения",
  });
}

export function useRejectAllForUser() {
  return useAdminMutation<number, { count: number; message: string }>({
    mutationFn: async (userId) => {
      const { data } = await api.post<{ count: number; message: string }>(
        `/admin/photos/user/${userId}/reject-all`
      );
      return data;
    },
    // count = 0 — это не успех, а «нечего обрабатывать» → info вместо success.
    success: (data) => (data.count > 0
      ? { variant: "success" as const, text: data.message }
      : { variant: "info" as const, text: data.message }),
    invalidate: [["admin", "photos"], ["user-photos"]],
    errorText: "Ошибка массового отклонения",
  });
}

// Лейблы причин отказа (PHOTO_REJECT_REASONS, getRejectReasonLabel, тип
// PhotoRejectReason) перенесены в lib/photos.ts (ЧАСТЬ 7) — см. реэкспорт
// вверху файла. Обратно-совместимо: старые импорты из этого модуля работают.
