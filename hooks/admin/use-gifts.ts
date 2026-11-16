// hooks/admin/use-gifts.ts
"use client";

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useAdminListQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====
export type GiftCategory = "romantic" | "cars" | "male" | "female" | "18+" | "fun";
export type GiftType = "main" | "premium" | "services";

export type GiftItem = {
  id: number;
  name: string;
  slug: string;
  image_url: string;
  raw_image: string;
  price: number;
  category: string;
  category_label: string | null;
  category_color: string | null;
  type: GiftType;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

// F3: GiftUser = UserBadgeData из lib/types. Раньше был отдельный
// тип с теми же полями → приводил к `as unknown as UserBadgeData` касту
// в компонентах при передаче в <UserBadge>.
export type GiftUser = UserBadgeData;

export type UserGiftItem = {
  id: number;
  snapshot_name: string;
  snapshot_image_url: string;
  snapshot_price: number;
  message: string | null;
  is_private: boolean;
  is_read: boolean;
  is_hidden: boolean;
  created_at: string | null;
  sender: GiftUser | null;
  receiver: GiftUser | null;
  gift: {
    id: number;
    name: string;
    image_url: string;
    type: GiftType;
    category: string | null;
    category_label: string | null;
    category_color: string | null;
  } | null;
};

export type GiftsListResponse = MetaPaginated<GiftItem> & {
  counts: {
    catalog: number;
    history: number;
    all: number;
    public: number;
    private: number;
  };
};

export type HistoryListResponse = MetaPaginated<UserGiftItem> & {
  counts: {
    catalog: number;
    history: number;
    all: number;
    public: number;
    private: number;
  };
};

export type GiftsListParams = {
  q?: string;
  category?: string;
  type?: string;
  page?: number;
  per_page?: number;
};

export type HistoryListParams = {
  q?: string;
  privacy?: string;
  page?: number;
  per_page?: number;
};

export type GiftFormData = {
  name: string;
  slug: string;
  image_url: string;
  price: number;
  category: GiftCategory | null;
  type: GiftType;
  is_active: boolean;
};

// ===== Хуки: Каталог =====

/**
 * Список подарков с фильтрами + поиск по name/slug/id.
 * staleTime: 15 сек — подарки меняются нечасто, держим короткий TTL
 * для актуальности при переключении табов.
 * category/type "all" — «нет фильтра», в query не попадает.
 */
export function useGiftsList(params: GiftsListParams) {
  return useAdminListQuery<GiftsListParams, GiftsListResponse>(
    ["admin", "gifts"],
    "/admin/gifts",
    {
      q: params.q,
      category: params.category !== "all" ? params.category : undefined,
      type: params.type !== "all" ? params.type : undefined,
      page: params.page,
      per_page: params.per_page,
    },
  );
}

export function useCreateGift() {
  return useAdminMutation<GiftFormData, { message: string; data: GiftItem }>({
    mutationFn: (payload) =>
      api.post<{ message: string; data: GiftItem }>(`/admin/gifts`, payload).then((r) => r.data),
    errorText: "Ошибка создания подарка",
    invalidate: [["admin", "gifts"]],
  });
}

export function useUpdateGift() {
  return useAdminMutation<{ id: number; payload: GiftFormData }, { message: string; data: GiftItem }>({
    mutationFn: ({ id, payload }) =>
      api.put<{ message: string; data: GiftItem }>(`/admin/gifts/${id}`, payload).then((r) => r.data),
    errorText: "Ошибка обновления подарка",
    invalidate: [["admin", "gifts"]],
  });
}

// Мутация оставлена на useMutation (не useAdminMutation): тост зависит от
// ответа — toast.warning, когда подарок нельзя удалить (есть отправленные),
// а фабрика умеет только toast.success. Инвалидация та же: ["admin","gifts"].
export function useDeleteGift() {
  return useAdminMutation<number, { message: string; deleted: boolean; sent_count: number }>({
    mutationFn: async (id) => {
      const { data } = await api.delete<{ message: string; deleted: boolean; sent_count: number }>(`/admin/gifts/${id}`);
      return data;
    },
    // deleted=false — подарок уже купали → только деактивация, warning вместо success.
    success: (data) => (data.deleted
      ? { variant: "success" as const, text: data.message }
      : { variant: "warning" as const, text: data.message }),
    invalidate: [["admin", "gifts"]],
    errorText: "Ошибка удаления подарка",
  });
}

export function useToggleGiftStatus() {
  return useAdminMutation<number, { message: string; is_active: boolean }>({
    mutationFn: (id) =>
      api.post<{ message: string; is_active: boolean }>(`/admin/gifts/${id}/toggle`).then((r) => r.data),
    errorText: "Ошибка смены статуса",
    invalidate: [["admin", "gifts"]],
  });
}

// ===== Хуки: История дарений =====

/**
 * История дарений с фильтром приватности + поиск по имени/id.
 * privacy "all" — «нет фильтра», в query не попадает.
 */
export function useGiftsHistoryList(params: HistoryListParams) {
  return useAdminListQuery<HistoryListParams, HistoryListResponse>(
    ["admin", "gifts", "history"],
    "/admin/gifts/history",
    {
      q: params.q,
      privacy: params.privacy !== "all" ? params.privacy : undefined,
      page: params.page,
      per_page: params.per_page,
    },
  );
}

export function useHideUserGift() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/gifts/history/${id}/hide`).then((r) => r.data),
    errorText: "Ошибка скрытия подарка",
    invalidate: [["admin", "gifts"]],
  });
}

export function useRestoreUserGift() {
  return useAdminMutation<number, { message: string }>({
    mutationFn: (id) =>
      api.post<{ message: string }>(`/admin/gifts/history/${id}/restore`).then((r) => r.data),
    errorText: "Ошибка восстановления подарка",
    invalidate: [["admin", "gifts"]],
  });
}

// extractValidationErrors больше отсюда не реэкспортируется — импортируйте
// его напрямую из @/lib/api (все потребители уже так и делают).
