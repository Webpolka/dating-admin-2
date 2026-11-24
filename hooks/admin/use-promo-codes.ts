"use client";

// hooks/admin/use-promo-codes.ts
//
// TanStack Query-хуки для управления промокодами (раздел Finance → Promo Codes).
//
// Конвенция query-ключей:
//   ["admin", "promo-codes", params]      — список (с фильтрами)
//   ["admin", "promo-codes", "counts"]    — счётчики (stable)
//   ["admin", "promo-code", id]           — детальный просмотр с usages
//
// Мутации инвалидируют СРАЗУ ВСЕ связанные ключи через префикс ["admin", "promo-codes"],
// а также sidebar-counts и dashboard (active codes может измениться).

import api from "@/lib/api";
import type { MetaPaginated, UserBadgeData } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery, useAdminMutation } from "./use-admin-api";

// ============================================================
// Типы (sync с App\Enums\V1\PromoCodeType и App\Models\PromoCode)
// ============================================================

export type PromoCodeTypeValue = "percent" | "fixed" | "premium" | "vip";

export type PromoCodeItem = {
  id: number;
  code: string;
  discount_type: PromoCodeTypeValue;
  discount_type_label: string;
  discount_value: number;
  duration_days: number | null;
  max_uses: number | null;
  used_count: number;
  remaining_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
  is_expired: boolean;
  is_personal: boolean;
  is_fully_used: boolean;
  gives_free_days: boolean;
  created_at: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
  } | null;
};

export type PromoCodeCounts = {
  total: number;
  active: number;
  inactive: number;
  expired: number;
  personal: number;
  fully_used: number;
  total_usages: number;
  total_discount: number;
};

export type PromoCodeUsageItem = {
  id: number;
  applied_discount: number;
  created_at: string | null;
  user?: UserBadgeData | null;
  transaction?: {
    id: number;
    amount: number;
    status: string;
    type: string;
    created_at: string | null;
    original_amount: number | null;
  } | null;
};

export type PromoCodeDetail = PromoCodeItem & {
  updated_at: string | null;
  usages: PromoCodeUsageItem[];
  stats: {
    total_usages: number;
    total_discount_sum: number;
  };
};

type PromoCodesListResponse = MetaPaginated<PromoCodeItem> & {
  counts: PromoCodeCounts;
};

export type PromoCodesListParams = {
  q?: string;
  type?: string;
  status?: string;
  scope?: string;
  page?: number;
  per_page?: number;
};

// ============================================================
// Типы для форм (sync с FormRequests на беке)
// ============================================================

export type PromoCodeFormData = {
  code?: string; // опционально — если пустой, бек сгенерирует
  discount_type: PromoCodeTypeValue;
  discount_value?: number;
  duration_days?: number | null;
  max_uses?: number | null;
  expires_at?: string | null; // ISO datetime-local
  user_id?: number | null;
  is_active?: boolean;
};

export type BulkGenerateFormData = {
  count: number;
  discount_type: PromoCodeTypeValue;
  discount_value?: number;
  duration_days?: number | null;
  max_uses?: number | null;
  expires_at?: string | null;
  user_id?: number | null;
  is_active?: boolean;
  code_prefix?: string;
};

// ============================================================
// Константы для UI (sync с App\Enums\V1\PromoCodeType::label())
// ============================================================

export const PROMO_CODE_TYPES: Array<{
  value: PromoCodeTypeValue;
  label: string;
  gives_free_days: boolean;
}> = [
  { value: "percent", label: "Скидка %", gives_free_days: false },
  { value: "fixed", label: "Скидка ₽", gives_free_days: false },
  { value: "premium", label: "Бесплатные дни Premium", gives_free_days: true },
  { value: "vip", label: "Бесплатные дни VIP", gives_free_days: true },
];

export function getPromoTypeLabel(type: string | null): string {
  if (!type) return "—";
  return PROMO_CODE_TYPES.find((t) => t.value === type)?.label ?? type;
}

// ============================================================
// Хуки чтения
// ============================================================

export function usePromoCodesList(params: PromoCodesListParams) {
  return useAdminListQuery<PromoCodesListParams, PromoCodesListResponse>(
    ["admin", "promo-codes"],
    "/admin/promo-codes",
    {
      q: params.q,
      type: params.type,
      status: params.status,
      scope: params.scope,
      page: params.page,
      per_page: params.per_page,
    },
    { staleTime: 0 },
  );
}

export function usePromoCodeCounts() {
  return useAdminItemQuery<{ stats: PromoCodeCounts }>(
    ["admin", "promo-codes", "counts"],
    "/admin/promo-codes/counts",
    { staleTime: 10_000, refetchInterval: 60_000 },
  );
}

export function usePromoCodeDetail(id: number | null, usagePage = 1) {
  return useAdminItemQuery<{ data: PromoCodeDetail; meta: { current_usage_page: number; last_usage_page: number; per_usage_page: number; total_usages_pages: number } }>(
    ["admin", "promo-code", id, usagePage],
    id ? `/admin/promo-codes/${id}?usage_page=${usagePage}` : "",
    { staleTime: 15_000, enabled: !!id },
  );
}

// ============================================================
// Хуки действий
// ============================================================

/** Создать промокод. */
export const useCreatePromoCode = () =>
  useAdminMutation<PromoCodeFormData, { message: string; data: PromoCodeItem }>({
    mutationFn: (data) =>
      api.post("/admin/promo-codes", data).then((r) => r.data),
    invalidate: [
      ["admin", "promo-codes"],
      ["admin", "sidebar", "counts"],
    ],
    errorText: "Ошибка создания промокода",
  });

/** Обновить промокод. */
export const useUpdatePromoCode = () =>
  useAdminMutation<
    { id: number; data: Partial<PromoCodeFormData> },
    { message: string; data: PromoCodeItem }
  >({
    mutationFn: ({ id, data }) =>
      api.put(`/admin/promo-codes/${id}`, data).then((r) => r.data),
    invalidate: [
      ["admin", "promo-codes"],
      ["admin", "promo-code"],
    ],
    errorText: "Ошибка обновления промокода",
  });

/** Удалить промокод (или деактивировать, если уже использовали). */
export const useDeletePromoCode = () =>
  useAdminMutation<
    { id: number },
    { message: string; deleted: boolean; used_count: number }
  >({
    mutationFn: ({ id }) =>
      api.delete(`/admin/promo-codes/${id}`).then((r) => r.data),
    invalidate: [
      ["admin", "promo-codes"],
      ["admin", "promo-code"],
      ["admin", "sidebar", "counts"],
    ],
    errorText: "Ошибка удаления промокода",
  });

/** Toggle is_active. */
export const useTogglePromoCode = () =>
  useAdminMutation<{ id: number }, { message: string; is_active: boolean }>({
    mutationFn: ({ id }) =>
      api.post(`/admin/promo-codes/${id}/toggle`).then((r) => r.data),
    invalidate: [
      ["admin", "promo-codes"],
      ["admin", "promo-code"],
      ["admin", "sidebar", "counts"],
    ],
    errorText: "Ошибка переключения промокода",
  });

/** Bulk generate N кодов. */
export const useBulkGeneratePromoCodes = () =>
  useAdminMutation<
    BulkGenerateFormData,
    { message: string; created: number; requested: number; collisions?: number }
  >({
    mutationFn: (data) =>
      api.post("/admin/promo-codes/bulk-generate", data).then((r) => r.data),
    invalidate: [
      ["admin", "promo-codes"],
      ["admin", "sidebar", "counts"],
    ],
    errorText: "Ошибка генерации промокодов",
  });
