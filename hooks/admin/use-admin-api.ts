"use client";

// hooks/admin/use-admin-api.ts
//
// Фабрики типовых запросов админки.
//
// До фабрик каждый hook копировал один и тот же скелетон:
//
//   useQuery({ queryKey: ["admin", "xxx", params],
//     queryFn: async ({ queryKey }) => {
//       const [, , p] = queryKey as [string, string, P];
//       const search = new URLSearchParams();
//       search.set("status", p.status);
//       if (p.q) search.set("q", p.q); ...
//       const { data } = await api.get(`/admin/xxx?${search}`);
//       return data;
//     },
//     placeholderData: (prev) => prev, staleTime: 15_000 });
//
// и каждый мутационный хук — связку useQueryClient + toast.success
// (data.message) + invalidateQueries + toast.error(extractErrorMessage).
// Скелетон повторялся ~60 раз для запросов и ~115 раз для мутаций.
//
// Контракт фабрик:
//   • queryKey = [...keyPrefix, params] — формат ключей прежний,
//     кэш и инвалидации при миграции не ломаются;
//   • пустые параметры (null/undefined/"") в query не попадают
//     (axios их отбрасывает);
//   • placeholderData: (prev) => prev — списки не мигают при
//     переключении фильтров/страниц;
//   • мутация: тост успеха (message бэкенда) → инвалидация префиксов
//     ключей → тост ошибки с причиной с бэкенда.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import api, { extractErrorMessage } from "@/lib/api";

/** Выбрасывает пустые значения, чтобы они не уходили в query-string. */
function cleanParams<T extends object>(params: T) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    ),
  );
}

interface AdminListQueryOptions {
  staleTime?: number;
  refetchInterval?: number;
  enabled?: boolean;
  /** Кастомная политика ретраев (напр. false для проверок уникальности). */
  retry?: number | false;
}

/**
 * Типовой список: GET url с параметрами, ключ кэша [...keyPrefix, params].
 *
 * Специальные значения фильтров («all», page=1) caller превращает
 * в undefined прямо в аргументе — фабрика их выбросит:
 *
 *   useAdminListQuery(["admin", "reports", "list"], "/admin/reports", {
 *     status: statusFilter,                       // «all» тоже валидный фильтр
 *     type: typeFilter !== "all" ? typeFilter : undefined,
 *     page: page > 1 ? page : undefined,
 *   });
 */
export function useAdminListQuery<TParams extends object, TResp>(
  keyPrefix: readonly unknown[],
  url: string,
  params: TParams,
  options: AdminListQueryOptions = {},
) {
  return useQuery<TResp>({
    queryKey: [...keyPrefix, params],
    queryFn: async () => {
      const { data } = await api.get<TResp>(url, { params: cleanParams(params) });
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: options.staleTime ?? 15_000,
    refetchInterval: options.refetchInterval,
    enabled: options.enabled,
    retry: options.retry,
  });
}

/** Стабильный (не зависящий от фильтров) одиночный GET — например, счётчики. */
export function useAdminItemQuery<TResp>(
  key: readonly unknown[],
  url: string,
  options: AdminListQueryOptions = {},
) {
  return useQuery<TResp>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get<TResp>(url);
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: options.staleTime ?? 15_000,
    refetchInterval: options.refetchInterval,
    enabled: options.enabled,
    retry: options.retry,
  });
}

type MutationResponse = { message?: string };

/** Вариант тоста успеха — не всегда действие "успешно" (частичные итоги — info/warning). */
export type SuccessToast =
  | string
  | {
      variant: "success" | "info" | "warning";
      text: string;
      description?: string;
    };

interface AdminMutationConfig<TVars, TResp extends MutationResponse> {
  /** Сам запрос. */
  mutationFn: (vars: TVars) => Promise<TResp>;
  /** Текст ошибки, если бэкенд не прислал своё описание. */
  errorText: string;
  /** Префиксы ключей кэша для инвалидации, напр. [["admin", "photos"]]. */
  invalidate?: readonly (readonly unknown[])[];
  /** Свой тост успеха вместо data.message (вариант/описание/условный текст). */
  success?: (data: TResp, vars: TVars) => SuccessToast;
  /** Дополнительная логика после тоста и инвалидации. */
  onSuccess?: (data: TResp, vars: TVars, qc: QueryClient) => void;
  /** Логика при ошибке (снять pending-флаг и т.п.) — до тоста. */
  onError?: (err: unknown, vars: TVars) => void;
}

/**
 * Типовая мутация: тост успеха → инвалидация → тост ошибки с причиной.
 *
 *   export function useApprovePhoto() {
 *     return useAdminMutation<number, { message: string }>({
 *       mutationFn: (id) => api.post(`/admin/photos/${id}/approve`).then(r => r.data),
 *       errorText: "Ошибка одобрения фото",
 *       invalidate: [["admin", "photos"], ["user-photos"]],
 *     });
 *   }
 */
export function useAdminMutation<TVars, TResp extends MutationResponse>(
  config: AdminMutationConfig<TVars, TResp>,
) {
  const qc = useQueryClient();
  return useMutation<TResp, unknown, TVars>({
    mutationFn: config.mutationFn,
    onSuccess: (data, vars) => {
      const custom = config.success?.(data, vars);
      if (typeof custom === "string") {
        toast.success(custom);
      } else if (custom) {
        const { variant, text, description } = custom;
        if (variant === "info") toast.info(text, { description });
        else if (variant === "warning") toast.warning(text, { description });
        else toast.success(text, { description });
      } else {
        toast.success(data.message ?? "Готово");
      }
      for (const key of config.invalidate ?? []) {
        qc.invalidateQueries({ queryKey: [...key] });
      }
      config.onSuccess?.(data, vars, qc);
    },
    onError: (err: unknown, vars) => {
      config.onError?.(err, vars);
      toast.error(extractErrorMessage(err, config.errorText));
    },
  });
}
