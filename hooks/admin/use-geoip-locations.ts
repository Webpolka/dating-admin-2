// hooks/admin/use-geoip-locations.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import api, { extractErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import type { MetaPaginated } from "@/lib/types";
import { useAdminListQuery, useAdminItemQuery } from "./use-admin-api";

export type GeoType = "country" | "region" | "city";

export interface GeoLocationItem {
  id: number;
  type: GeoType;
  name: string;
  original_name: string;
  iso_code: string | null;
  latitude: number | null;
  longitude: number | null;
  parent_name: string | null;
  is_registration_blocked: boolean;
  is_feed_blocked: boolean;
}

export interface GeoLocationCounts {
  country: { total: number; blocked_reg: number; blocked_feed: number };
  region: { total: number; blocked_reg: number; blocked_feed: number };
  city: { total: number; blocked_reg: number; blocked_feed: number };
}

type GeoLocationListResponse = MetaPaginated<GeoLocationItem> & {
  counts: GeoLocationCounts;
  type: GeoType;
};

interface GeoLocationParams {
  type?: GeoType;
  q?: string;
  page?: number;
  per_page?: number;
  blocked?: 'none' | 'reg' | 'feed';
}

/**
 * Список GeoIP локаций.
 *
 * Параметры уходят на бэк как есть (type/blocked — валидные значения
 * фильтров), пустые q/page/per_page фабрика отбрасывает сама.
 */
export function useGeoLocationsList(params: GeoLocationParams) {
  return useAdminListQuery<GeoLocationParams, GeoLocationListResponse>(
    ["admin", "geoip", "list"],
    "/admin/geoip/locations",
    params,
    { staleTime: 0 },
  );
}

export function useGeoLocationsCounts() {
  return useAdminItemQuery<{ data: GeoLocationCounts }>(
    ["admin", "geoip", "counts"],
    "/admin/geoip/locations/counts",
    { staleTime: 60_000 },
  );
}

// useToggleGeoRegistration / useToggleGeoFeed оставлены на ручном useMutation:
// optimistic update (onMutate + откат в onError + инвалидация в onSettled)
// фабрика не выражает — у неё нет хуков жизненного цикла мутации.

/**
 * Toggle registration block.
 *
 * onMutate: optimistically обновляем кэш — switch сразу переключается,
 * не дожидаясь ответа сервера. onError — откатываем.
 */
export function useToggleGeoRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/admin/geoip/locations/${id}/toggle-registration`);
      return data;
    },
    onMutate: async (id: number) => {
      // Optimistic update — switch сразу переключается.
      await qc.cancelQueries({ queryKey: ["admin", "geoip", "list"] });
      const prevQueries = qc.getQueriesData<GeoLocationListResponse>({ queryKey: ["admin", "geoip", "list"] });
      qc.setQueriesData<GeoLocationListResponse>({ queryKey: ["admin", "geoip", "list"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((item) =>
            item.id === id
              ? { ...item, is_registration_blocked: !item.is_registration_blocked }
              : item
          ),
        };
      });
      return { prevQueries };
    },
    onError: (err, _id, ctx) => {
      // Откатываем optimistic update.
      ctx?.prevQueries?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(extractErrorMessage(err, "Ошибка обновления"));
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "geoip"] });
    },
  });
}

/**
 * Toggle feed block. Аналогично useToggleGeoRegistration.
 */
export function useToggleGeoFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/admin/geoip/locations/${id}/toggle-feed`);
      return data;
    },
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["admin", "geoip", "list"] });
      const prevQueries = qc.getQueriesData<GeoLocationListResponse>({ queryKey: ["admin", "geoip", "list"] });
      qc.setQueriesData<GeoLocationListResponse>({ queryKey: ["admin", "geoip", "list"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((item) =>
            item.id === id
              ? { ...item, is_feed_blocked: !item.is_feed_blocked }
              : item
          ),
        };
      });
      return { prevQueries };
    },
    onError: (err, _id, ctx) => {
      ctx?.prevQueries?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(extractErrorMessage(err, "Ошибка обновления"));
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "geoip"] });
    },
  });
}
