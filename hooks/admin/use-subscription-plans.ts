// hooks/admin/use-subscription-plans.ts
"use client";

import api from "@/lib/api";
import { useAdminListQuery, useAdminMutation } from "./use-admin-api";

// ===== Типы =====
export type PlanTier = "premium" | "vip";

export type SubscriptionPlanItem = {
  id: number;
  tier: PlanTier;
  name: string;
  slug: string;
  price: number;
  old_price: number | null;
  currency: string;
  duration_days: number;
  apple_product_id: string | null;
  google_product_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanFormData = {
  name: string;
  slug: string;
  price: number;
  old_price: number | null;
  duration_days: number;
  sort_order: number;
  apple_product_id: string | null;
  google_product_id: string | null;
  is_active: boolean;
};

// Ответ без пагинации: список всех тарифов таба + счётчики по тирам.
type PlansListResponse = {
  data: SubscriptionPlanItem[];
  counts: { premium: number; vip: number };
};

type PlansListParams = {
  tier: PlanTier;
  q?: string;
};

// ===== Хуки =====

/**
 * Список тарифов по табу (premium/vip) + поиск по name/slug/id.
 *
 * staleTime: 15 сек — тарифы меняются редко, но чтобы админ видел
 * актуальные данные при переключении табов, держим короткий TTL.
 * Бесшовная смена таба — фабрика держит прошлые данные.
 * tier уходит всегда (выбор таба), пустой q фабрика отбрасывает сама.
 */
export function useSubscriptionPlansList(params: PlansListParams) {
  return useAdminListQuery<PlansListParams, PlansListResponse>(
    ["admin", "subscription-plans"],
    "/admin/subscription-plans",
    {
      tier: params.tier,
      q: params.q,
    },
  );
}

export function useCreatePlan() {
  return useAdminMutation<PlanFormData & { tier: PlanTier }, { message: string; data: SubscriptionPlanItem }>({
    mutationFn: (payload) =>
      api
        .post<{ message: string; data: SubscriptionPlanItem }>(`/admin/subscription-plans`, payload)
        .then((r) => r.data),
    errorText: "Ошибка создания тарифа",
    invalidate: [["admin", "subscription-plans"]],
  });
}

export function useUpdatePlan() {
  return useAdminMutation<
    { id: number; payload: PlanFormData },
    { message: string; data: SubscriptionPlanItem }
  >({
    mutationFn: ({ id, payload }) =>
      api
        .put<{ message: string; data: SubscriptionPlanItem }>(`/admin/subscription-plans/${id}`, payload)
        .then((r) => r.data),
    errorText: "Ошибка обновления тарифа",
    invalidate: [["admin", "subscription-plans"]],
  });
}

export function useTogglePlanActive() {
  return useAdminMutation<number, { message: string; is_active: boolean }>({
    mutationFn: (id) =>
      api
        .post<{ message: string; is_active: boolean }>(`/admin/subscription-plans/${id}/toggle`)
        .then((r) => r.data),
    errorText: "Ошибка смены статуса",
    invalidate: [["admin", "subscription-plans"]],
  });
}

// extractValidationErrors больше отсюда не реэкспортируется — импортируйте
// его напрямую из @/lib/api (все потребители уже так и делают).
