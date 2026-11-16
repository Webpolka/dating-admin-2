// hooks/admin/use-diaries.ts
"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы для Дневников (Постов) =====
export type DiaryStatus = "draft" | "pending" | "published" | "rejected";
export type TrashedFilter = "with" | "only" | "without";

// НЕ UserBadgeData: у автора дневника есть дополнительное поле role.
export type DiaryUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  is_online: boolean;
  status: string;
  deleted_at: string | null;
  has_active_premium: boolean;
  has_active_vip: boolean;
  is_verified: boolean;
};

export type DiaryRubric = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  user_id: number | null;
  diaries_count: number;
  user: DiaryUser | null;
};

export type DiaryItem = {
  id: number;
  title: string;
  body?: string;
  status: DiaryStatus;
  reject_reason: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  trashed: boolean;
  is_comments_enabled: boolean;
  views_count: number;
  comments_count: number;
  likes_count: number;
  user: DiaryUser | null;
  diary_rubric: {
    id: number;
    name: string;
    is_active: boolean;
    is_personal: boolean;
    user_id: number | null;
  } | null;
};

export type AvailableRubric = {
  id: number;
  name: string;
  user_id: number | null;
  is_personal: boolean;
  is_active: boolean;
};

export type DiaryCounts = {
  all: number;
  published: number;
  pending: number;
  rejected: number;
  trashed: number;
  rubrics_count: number;
};

type DiariesListResponse = MetaPaginated<DiaryItem> & {
  tab: "diaries";
  all_rubrics: { id: number; name: string; is_active: boolean }[];
  status: DiaryStatus | "all";
};

type DiariesListParams = {
  status: string;
  trashed?: TrashedFilter;
  rubric?: string;
  q?: string;
  page?: number;
  per_page?: number;
};

// ===== Типы для Комментарий (Вариант A — спам = причина, не статус) =====
//
// Стратегия модерации (симметрично с photo-comments):
//   - Статусов 3: pending / approved / rejected. Спам — это причина отклонения.
//   - Виртуальный «karantine» — soft-deleted (trashed=true), в БД статуса нет.
//   - Причины отклонения (только при status='rejected'):
//       пользовательские — profanity / insult / off_topic / spam / other
//       системная        — parent_rejected (каскад от rejected-родителя)
//
// API-контракт строго соответствует backend'у:
//   - POST /admin/diary-comments/{id}/reject  body { reason } — единственный путь отклонить.
//   /spam endpoint убран: чтобы пометить спамом, модератор выбирает «Спам» в dropdown.
export type DiaryCommentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "karantine"; // виртуальный — soft-deleted

export type DiaryCommentRejectReason =
  // Пользовательские (модератор выбирает в dropdown)
  | "profanity"
  | "insult"
  | "off_topic"
  | "spam"
  | "other"
  // Системная (каскад от rejected-родителя)
  | "parent_rejected";

export type DiaryCommentItem = {
  id: number;
  diary_id: number;
  user_id: number | null;
  parent_id: number | null;
  content: string;
  status: DiaryCommentStatus;
  reject_reason: string | null;
  moderated_by: number | null;
  moderated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  trashed: boolean;
  likes_count: number;
  replies_count: number;
  // Сводка о родителе — нужна фронту для guard'а кликабельности:
  // прятать кнопку restore/approve на ребёнке, если родитель rejected/trashed.
  // Для корневых комментариев (parent_id === null) — всегда null.
  parent: { id: number; status: string; trashed: boolean } | null;
  user: DiaryUser | null;
  replies: DiaryCommentItem[];
};

export type DiaryWithComments = {
  id: number;
  title: string;
  diary_rubric: { id: number; name: string; is_active: boolean; is_personal: boolean; user_id: number | null } | null;
  user: DiaryUser | null;
  comments: DiaryCommentItem[];
};

export type DiaryCommentCounts = {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
  karantine: number;
  total: number;
};

type DiaryCommentsListResponse = MetaPaginated<DiaryWithComments> & {
  stats: DiaryCommentCounts;
  status: DiaryCommentStatus | "all";
};

type DiaryCommentsListParams = {
  status: DiaryCommentStatus | "all";
  q?: string;
  diary_id?: number;
  page?: number;
  per_page?: number;
};

// ============================================
// ХУКИ ЧТЕНИЯ: ДНЕВНИКИ
// ============================================

export function useDiariesList(params: DiariesListParams, options?: { enabled?: boolean }) {
  // status уходит всегда (в т.ч. "all" — валидное значение фильтра бэка);
  // rubric "all" — «нет фильтра», в query не попадает.
  return useAdminListQuery<DiariesListParams, DiariesListResponse>(
    ["admin", "diary", "list"],
    "/admin/diary",
    {
      status: params.status,
      trashed: params.trashed,
      rubric: params.rubric !== "all" ? params.rubric : undefined,
      q: params.q,
      page: params.page,
      per_page: params.per_page,
    },
    { enabled: options?.enabled },
  );
}

// Не переведён на useAdminItemQuery: фабрика держит прошлые данные
// (keep-previous) — при переходе между дневниками модалка показала бы
// ПРОШЛЫЙ дневник вместо спиннера. Старое поведение сохранено намеренно.
export function useDiaryDetail(id: number | null, enabled: boolean) {
  return useQuery<{ data: DiaryItem; available_rubrics: AvailableRubric[] }>({
    queryKey: ["admin", "diary", "detail", id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/diary/${id}`);
      return data;
    },
    enabled: enabled && !!id,
    staleTime: 15_000,
  });
}

export function useDiaryCounts() {
  return useAdminItemQuery<{ stats: DiaryCounts }>(
    ["admin", "diary", "counts"],
    "/admin/diary/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ============================================
// ХУКИ ЧТЕНИЯ: РУБРИКИ
// ============================================

type RubricsListResponse = MetaPaginated<DiaryRubric> & {
  tab: "rubrics";
  all_rubrics: { id: number; name: string; is_active: boolean }[];
};

export function useRubricsList(
  params: { q?: string; page?: number; per_page?: number },
  options?: { enabled?: boolean },
) {
  // tab=rubrics уходит всегда (тот же endpoint /admin/diary, таб рубрик).
  return useAdminListQuery<
    { tab: "rubrics"; q?: string; page?: number; per_page?: number },
    RubricsListResponse
  >(
    ["admin", "diary", "rubrics"],
    "/admin/diary",
    {
      tab: "rubrics",
      q: params.q,
      page: params.page,
      per_page: params.per_page,
    },
    { enabled: options?.enabled },
  );
}

// Не переведён на фабрику: debounce имени + retry: false + кастомный
// return-шейп (распакованный query.data + isChecking).
export function useCheckRubricName(name: string, ignoreId?: number | null) {
  const [debouncedName, setDebouncedName] = useState(name.trim());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(name.trim()), 300);
    return () => clearTimeout(t);
  }, [name]);

  const query = useQuery<{
    available: boolean;
    conflict_id?: number;
    conflict_name?: string;
  }>({
    queryKey: ["admin", "diary", "rubrics", "check-name", debouncedName, ignoreId ?? null],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("name", debouncedName);
      if (ignoreId) search.set("ignore_id", String(ignoreId));
      const { data } = await api.get(`/admin/diary/rubrics/check-name?${search.toString()}`);
      return data;
    },
    enabled: debouncedName.length >= 2,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
    retry: false,
  });

  return {
    ...query.data,
    isChecking: query.isFetching && !query.data,
  } as {
    available?: boolean;
    conflict_id?: number;
    conflict_name?: string;
    isChecking: boolean;
  };
}

// ============================================
// ХУКИ ДЕЙСТВИЙ: ДНЕВНИКИ
// ============================================

export function useApproveDiary() {
  return useAdminMutation<
    { id: number; diary_rubric_id?: number | null; is_comments_enabled?: boolean },
    { message: string }
  >({
    mutationFn: ({ id, ...meta }) =>
      api.post<{ message: string }>(`/admin/diary/${id}/approve`, meta).then((r) => r.data),
    errorText: "Ошибка одобрения",
    invalidate: [["admin", "diary"]],
  });
}

export function useRejectDiary() {
  return useAdminMutation<
    { id: number; reason: string; diary_rubric_id?: number | null; is_comments_enabled?: boolean },
    { message: string }
  >({
    mutationFn: ({ id, reason, ...meta }) =>
      api.post<{ message: string }>(`/admin/diary/${id}/reject`, { reason, ...meta }).then((r) => r.data),
    errorText: "Ошибка отклонения",
    invalidate: [["admin", "diary"]],
  });
}

export function useUnpublishDiary() {
  return useAdminMutation<
    { id: number; diary_rubric_id?: number | null; is_comments_enabled?: boolean },
    { message: string }
  >({
    mutationFn: ({ id, ...meta }) =>
      api.post<{ message: string }>(`/admin/diary/${id}/unpublish`, meta).then((r) => r.data),
    errorText: "Ошибка снятия с публикации",
    invalidate: [["admin", "diary"]],
  });
}

export function useUpdateDiarySettings() {
  return useAdminMutation<
    { id: number; diary_rubric_id?: number | null; is_comments_enabled?: boolean },
    { message: string }
  >({
    mutationFn: ({ id, ...meta }) =>
      api.post<{ message: string }>(`/admin/diary/${id}/settings`, meta).then((r) => r.data),
    errorText: "Ошибка сохранения настроек",
    invalidate: [["admin", "diary"]],
  });
}

export function useSoftDeleteDiary() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/diary/${id}/soft-delete`).then((r) => r.data),
    errorText: "Ошибка удаления",
    invalidate: [["admin", "diary"]],
  });
}

export function useRestoreDiary() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/diary/${id}/restore`).then((r) => r.data),
    errorText: "Ошибка восстановления",
    invalidate: [["admin", "diary"]],
  });
}

export function useForceDeleteDiary() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) => api.delete<{ message: string }>(`/admin/diary/${id}`).then((r) => r.data),
    errorText: "Ошибка удаления навсегда",
    invalidate: [["admin", "diary"]],
  });
}

// ============================================
// ХУКИ ДЕЙСТВИЙ: РУБРИКИ
// ============================================

export function useStoreRubric() {
  return useAdminMutation<
    { name: string; description?: string; is_active?: boolean; sort_order?: number },
    { message: string; data: DiaryRubric }
  >({
    mutationFn: (payload) =>
      api.post<{ message: string; data: DiaryRubric }>(`/admin/diary/rubrics`, payload).then((r) => r.data),
    errorText: "Ошибка создания рубрики",
    invalidate: [["admin", "diary"]],
  });
}

export function useUpdateRubric() {
  return useAdminMutation<
    { id: number; name?: string; description?: string; is_active?: boolean; sort_order?: number },
    { message: string; data: DiaryRubric }
  >({
    mutationFn: ({ id, ...payload }) =>
      api.put<{ message: string; data: DiaryRubric }>(`/admin/diary/rubrics/${id}`, payload).then((r) => r.data),
    errorText: "Ошибка обновления рубрики",
    invalidate: [["admin", "diary"]],
  });
}

export function useDestroyRubric() {
  return useAdminMutation<
    { id: number; reassignId?: number | null },
    { message: string }
  >({
    mutationFn: ({ id, reassignId }) =>
      api
        .delete<{ message: string }>(`/admin/diary/rubrics/${id}`, {
          data: { reassign_id: reassignId },
        })
        .then((r) => r.data),
    errorText: "Ошибка удаления рубрики",
    invalidate: [["admin", "diary"]],
  });
}

export function useToggleRubricStatus() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/diary/rubrics/${id}/toggle`).then((r) => r.data),
    errorText: "Ошибка изменения статуса",
    invalidate: [["admin", "diary"]],
  });
}

// ============================================
// ХУКИ ЧТЕНИЯ: КОММЕНТАРИИ
// ============================================

export function useDiaryCommentsList(params: DiaryCommentsListParams) {
  // status уходит всегда (в т.ч. "all"); пустые q/diary_id/page/per_page
  // фабрика отбрасывает сама.
  return useAdminListQuery<DiaryCommentsListParams, DiaryCommentsListResponse>(
    ["admin", "diary-comments"],
    "/admin/diary-comments",
    {
      status: params.status,
      q: params.q,
      diary_id: params.diary_id,
      page: params.page,
      per_page: params.per_page,
    },
    { staleTime: 0 },
  );
}

/**
 * Stable query для counts — не зависит от filter/search/page.
 * refetchInterval: 30 сек — auto-refresh для moderation queue.
 * staleTime: 10 сек. Плавная смена фильтров без мерцания (фабрика
 * держит прошлые данные).
 */
export function useDiaryCommentCounts() {
  return useAdminItemQuery<{ stats: DiaryCommentCounts }>(
    ["admin", "diary-comments", "counts"],
    "/admin/diary-comments/counts",
    { staleTime: 10_000, refetchInterval: 30_000 },
  );
}

// ============================================
// ХУКИ ДЕЙСТВИЙ: КОММЕНТАРИИ
// ============================================

export function useApproveDiaryComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/diary-comments/${id}/approve`).then((r) => r.data),
    errorText: "Ошибка одобрения",
    invalidate: [["admin", "diary-comments"]],
  });
}

export function useRejectDiaryComment() {
  return useAdminMutation<{ id: number; reason: DiaryCommentRejectReason }, { message: string }>({
    mutationFn: ({ id, reason }) =>
      api.post<{ message: string }>(`/admin/diary-comments/${id}/reject`, { reason }).then((r) => r.data),
    errorText: "Ошибка отклонения",
    invalidate: [["admin", "diary-comments"]],
  });
}

export function useSoftDeleteDiaryComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/diary-comments/${id}/soft-delete`).then((r) => r.data),
    errorText: "Ошибка перемещения в карантин",
    invalidate: [["admin", "diary-comments"]],
  });
}

export function useRestoreDiaryComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/diary-comments/${id}/restore`).then((r) => r.data),
    errorText: "Ошибка восстановления",
    invalidate: [["admin", "diary-comments"]],
  });
}

export function useDestroyDiaryComment() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.delete<{ message: string }>(`/admin/diary-comments/${id}`).then((r) => r.data),
    errorText: "Ошибка удаления комментария",
    invalidate: [["admin", "diary-comments"]],
  });
}

// ===== UI маппинги для Enum'ов =====
export const DIARY_STATUS_BADGES: Record<string, { variant: string; label: string }> = {
  draft: { variant: "secondary", label: "Черновик" },
  pending: { variant: "warning", label: "Модерация" },
  published: { variant: "success", label: "Опубликован" },
  rejected: { variant: "destructive", label: "Отклонён" },
};

// ===== Лейблы причин отказа комментариев (для UI — dropdown) =====
//
// Только ПОЛЬЗОВАТЕЛЬСКИЕ причины — те, что модератор может выбрать в dropdown.
// parent_rejected (системная, ставится бэкендом при каскаде) сюда НЕ входит:
// модератор не может её выбрать, но UI её отображает на уже отклонённых каскадных ответах.
//
// Симметрично с photo-comments: profanity / insult / off_topic / spam / other.
// spam теперь это причина (не статус) — выбирается в dropdown наравне с остальными.
export const COMMENT_REJECT_REASONS: Array<{
  value: DiaryCommentRejectReason;
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

// Причины отклонения дневника (постов) — синхронизированы с DiaryRejectReason enum на бэке.
export const DIARY_REJECT_REASONS: Array<{ value: string; label: string; color: string }> = [
  { value: "spam", label: "Спам / Реклама", color: "bg-yellow-500/10 text-yellow-500" },
  { value: "porn", label: "Порнография / 18+", color: "bg-red-500/10 text-red-500" },
  { value: "scam", label: "Мошенничество", color: "bg-orange-500/10 text-orange-500" },
  { value: "insult", label: "Оскорбление", color: "bg-destructive/10 text-destructive" },
  { value: "other", label: "Другое", color: "bg-secondary text-secondary-foreground" },
];
