// hooks/admin/use-photo-comments.ts
"use client";

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====
//
// Стратегия модерации (Вариант A):
//   - Статусов 3: pending / approved / rejected. Спам — это причина отклонения, не статус.
//   - Виртуальный «karantine» — это soft-deleted запись (trashed=true), в БД статуса нет.
//   - Причины отклонения (только при status='rejected'):
//       пользовательские — profanity / insult / off_topic / spam / other
//       системная        — parent_rejected (каскад от rejected-родителя)
//
// API-контракт строго соответствует backend'у:
//   - POST /admin/photo-comments/{id}/reject  body { reason } — единственный путь отклонить.
//   /spam endpoint убран: чтобы пометить спамом, модератор выбирает «Спам» в dropdown причины.
export type PhotoCommentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "karantine"; // виртуальный — soft-deleted

export type PhotoCommentRejectReason =
  // Пользовательские (модератор выбирает в dropdown)
  | "profanity"
  | "insult"
  | "off_topic"
  | "spam"
  | "other"
  // Системные (каскад от rejected-родителя)
  | "parent_rejected";

// Юзер на карточке (упрощённый) — тот же UserBadgeData из lib/types.
export type CommentUser = UserBadgeData;

// Один комментарий (root или ответ)
export type PhotoCommentItem = {
  id: number;
  photo_id: number;
  user_id: number | null;
  parent_id: number | null;
  content: string;
  status: PhotoCommentStatus;
  reject_reason: string | null;
  moderated_by: number | null;
  moderated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  trashed: boolean;
  is_pinned: boolean;
  likes_count: number;
  replies_count: number;
  // Сводка о родителе — нужна фронту для guard'а кликабельности:
  // прятать кнопку restore/approve на дочернем, если родитель rejected/trashed.
  // Для корневых комментариев (parent_id === null) — всегда null.
  parent: { id: number; status: string; trashed: boolean } | null;
  user: CommentUser | null;
  replies: PhotoCommentItem[];
};

// Фото с деревом комментариев
export type PhotoWithComments = {
  id: number;
  user_id: number | null;
  is_primary: boolean;
  is_intimate: boolean;
  status: string;
  trashed: boolean;
  thumb_url: string;
  medium_url: string;
  large_url: string;
  original_url: string;
  album: { id: number; name: string } | null;
  user: CommentUser | null;
  pending_count: number;
  comments: PhotoCommentItem[];
};

export type PhotoCommentCounts = {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
  karantine: number;
  total: number;
};

type PhotoCommentsListResponse = MetaPaginated<PhotoWithComments> & {
  mode: "list";
  stats: PhotoCommentCounts;
  status: PhotoCommentStatus | "all";
};

type PhotoCommentsListParams = {
  status: PhotoCommentStatus | "all";
  q?: string;
  page?: number;
  per_page?: number;
};

// ===== Хуки чтения =====
export function usePhotoCommentsList(params: PhotoCommentsListParams) {
  // status уходит всегда (в т.ч. "all"); пустые q/page/per_page
  // фабрика отбрасывает сама.
  return useAdminListQuery<PhotoCommentsListParams, PhotoCommentsListResponse>(
    ["admin", "photo-comments"],
    "/admin/photo-comments",
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
 * QueryKey ["admin","photo-comments","counts"] не меняется при смене вкладок →
 * counts не скачут (как в photos, stop-words, support-chats).
 *
 * refetchInterval: 30 сек — auto-refresh для moderation queue.
 * staleTime: 10 сек. Плавная смена фильтров без мерцания (фабрика
 * держит прошлые данные).
 */
export function usePhotoCommentCounts() {
  return useAdminItemQuery<{ stats: PhotoCommentCounts }>(
    ["admin", "photo-comments", "counts"],
    "/admin/photo-comments/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ===== Хуки одиночных действий =====
export function useApproveComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/photo-comments/${id}/approve`).then((r) => r.data),
    errorText: "Ошибка одобрения комментария",
    invalidate: [["admin", "photo-comments"]],
  });
}

export function useRejectComment() {
  return useAdminMutation<{ id: number; reason: PhotoCommentRejectReason }, { message: string }>({
    mutationFn: ({ id, reason }) =>
      api.post<{ message: string }>(`/admin/photo-comments/${id}/reject`, { reason }).then((r) => r.data),
    errorText: "Ошибка отклонения комментария",
    invalidate: [["admin", "photo-comments"]],
  });
}

export function useSoftDeleteComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/photo-comments/${id}/soft-delete`).then((r) => r.data),
    errorText: "Ошибка перемещения в карантин",
    invalidate: [["admin", "photo-comments"]],
  });
}

export function useRestoreComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/photo-comments/${id}/restore`).then((r) => r.data),
    errorText: "Ошибка восстановления комментария",
    invalidate: [["admin", "photo-comments"]],
  });
}

export function useDestroyComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/photo-comments/${id}`).then((r) => r.data),
    errorText: "Ошибка удаления комментария",
    invalidate: [["admin", "photo-comments"]],
  });
}

// ===== Хуки действий по фото / глобальные =====
//
// Массовые мутации: тост зависит от ответа (info при count = 0),
// поэтому задают success-колбэк фабрики. Инвалидация: ["admin","photo-comments"].

export function useApproveRemainingComments() {
  return useAdminMutation<number, { count: number; message: string }>({
    mutationFn: async (photoId) => {
      const { data } = await api.post<{ count: number; message: string }>(`/admin/photo-comments/photo/${photoId}/approve-remaining`);
      return data;
    },
    // count = 0 — «нечего обрабатывать» → info вместо success.
    success: (data) => (data.count > 0
      ? { variant: "success" as const, text: data.message }
      : { variant: "info" as const, text: data.message }),
    invalidate: [["admin", "photo-comments"]],
    errorText: "Ошибка массового одобрения",
  });
}

export function useRejectRemainingComments() {
  return useAdminMutation<number, { count: number; message: string }>({
    mutationFn: async (photoId) => {
      const { data } = await api.post<{ count: number; message: string }>(`/admin/photo-comments/photo/${photoId}/reject-remaining`);
      return data;
    },
    // count = 0 — «нечего обрабатывать» → info вместо success.
    success: (data) => (data.count > 0
      ? { variant: "success" as const, text: data.message }
      : { variant: "info" as const, text: data.message }),
    invalidate: [["admin", "photo-comments"]],
    errorText: "Ошибка массового отклонения",
  });
}

// ===== Хуки глобальных действий =====

export function useApproveAllPendingComments() {
  return useAdminMutation<void, { count: number; message: string }>({
    mutationFn: async () => {
      const { data } = await api.post<{ count: number; message: string }>(`/admin/photo-comments/approve-all`);
      return data;
    },
    // count = 0 — «нечего обрабатывать» → info вместо success.
    success: (data) => (data.count > 0
      ? { variant: "success" as const, text: data.message }
      : { variant: "info" as const, text: data.message }),
    invalidate: [["admin", "photo-comments"]],
    errorText: "Ошибка массового одобрения",
  });
}

export function useRejectAllPendingComments() {
  return useAdminMutation<void, { count: number; message: string }>({
    mutationFn: async () => {
      const { data } = await api.post<{ count: number; message: string }>(`/admin/photo-comments/reject-all`);
      return data;
    },
    // count = 0 — «нечего обрабатывать» → info вместо success.
    success: (data) => (data.count > 0
      ? { variant: "success" as const, text: data.message }
      : { variant: "info" as const, text: data.message }),
    invalidate: [["admin", "photo-comments"]],
    errorText: "Ошибка массового отклонения",
  });
}

// ===== Лейблы причин отказа (для UI — dropdown) =====
//
// Только ПОЛЬЗОВАТЕЛЬСКИЕ причины — те, что модератор может выбрать в dropdown.
// parent_rejected (системная, ставится бэкендом при каскаде) сюда НЕ входит:
// модератор не может её выбрать, но UI её отображает на уже отклонённых каскадных ответах.
export const COMMENT_REJECT_REASONS: Array<{
  value: PhotoCommentRejectReason;
  label: string;
  color: string;
}> = [
  { value: "profanity", label: "Мат / Нецензурная лексика", color: "bg-red-500/10 text-red-500" },
  { value: "insult", label: "Оскорбление", color: "bg-destructive/10 text-destructive" },
  { value: "off_topic", label: "Не по теме", color: "bg-yellow-500/10 text-yellow-500" },
  { value: "spam", label: "Спам", color: "bg-orange-500/10 text-orange-500" },
  { value: "other", label: "Другое", color: "bg-secondary text-secondary-foreground" },
];

// Лейбл причины по значению (для бейджа на отклонённом комментарии).
// Включает системную parent_rejected — чтобы UI мог её отобразить на каскадных детях.
export function getCommentRejectReasonLabel(reason: string | null): string | null {
  if (!reason) return null;

  const allReasons: Record<string, string> = {
    profanity: "Мат / Нецензурная лексика",
    insult: "Оскорбление",
    off_topic: "Не по теме",
    spam: "Спам",
    other: "Другое",
    parent_rejected: "Отклонён (по родителю)",
  };

  return allReasons[reason] ?? reason;
}

// Цвет причины по значению (для бейджа).
export function getCommentRejectReasonColor(reason: string | null): string | null {
  if (!reason) return null;

  const allColors: Record<string, string> = {
    profanity: "bg-red-500/10 text-red-500",
    insult: "bg-destructive/10 text-destructive",
    off_topic: "bg-yellow-500/10 text-yellow-500",
    spam: "bg-orange-500/10 text-orange-500",
    other: "bg-secondary text-secondary-foreground",
    // Нейтральный синий для каскадной причины — это не «вина» автора,
    // а автоматическое решение по родителю.
    parent_rejected: "bg-blue-500/10 text-blue-500",
  };

  return allColors[reason] ?? null;
}
