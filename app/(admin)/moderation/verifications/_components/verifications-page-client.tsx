"use client";

// app/(admin)/moderation/verifications/_components/verifications-page-client.tsx
//
// Страница модерации верификаций.
// Архитектура 1:1 как photos-page-client:
//  - URL-sync фильтров (status/q/page) — shareable URLs.
//  - Debounced search (400мс).
//  - StatusTabs с live-счётчиками (из отдельного stable query).
//  - ListPagination.
//  - RejectModal — выбор причины.
//
// В отличие от photos — нет режима quarantine (нет soft-delete) и нет
// отдельного UserCard-режима: queue и grid используют одну карточку
// VerificationCard (структура ответа одинаковая).

import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  useVerificationsList,
  useVerificationCounts,
  type VerificationItem,
} from "@/hooks/admin/use-verifications";

import { VerificationCard } from "./verification-card";
import { RejectModal } from "./reject-modal";
import {
  STATUS_TABS,
  PAGE_TITLE,
  PAGE_DESCRIPTION,
  PAGE_ICON,
  SEARCH_DEBOUNCE_MS,
} from "./verifications-shared";

import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import { buildUrl } from "@/lib/url-params";
import { Loader2 } from "lucide-react";

export function VerificationsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "pending",
  );
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  const [rejectTarget, setRejectTarget] = useState<VerificationItem | null>(null);

  // Запоминаем, какой статус юзер ЗАПРОСИЛ (кликнул в табе),
  // чтобы отличить «бэкенд авто-сменил статус при поиске по ID»
  // от «юзер кликнул таб».
  const requestedStatusRef = useRef<string>(statusFilter);

  // URL-sync.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== "pending" ? statusFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, page, pathname, router]);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useVerificationsList({
    status: statusFilter as "pending" | "approved" | "rejected",
    q: debouncedSearch,
    page,
  });

  // Авто-detect статуса при поиске по ID.
  useEffect(() => {
    if (!data?.status) return;
    if (data.status !== requestedStatusRef.current) {
      requestedStatusRef.current = data.status;
      setStatusFilter(data.status);
    }
  }, [data?.status]);

  const items = useMemo(() => (data?.data ?? []) as VerificationItem[], [data]);
  const meta = data?.meta;

  // Counts — из отдельного stable query.
  const { data: countsData } = useVerificationCounts();
  const stats = countsData?.stats;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  const handleSetStatus = (status: string) => {
    requestedStatusRef.current = status;
    setStatusFilter(status);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    requestedStatusRef.current = "pending";
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("pending");
    setPage(1);
  };

  const hasFilters = search !== "" || statusFilter !== "pending";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PAGE_ICON}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {/* Табы + Поиск */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <StatusTabs
          tabs={STATUS_TABS}
          value={statusFilter as "pending" | "approved" | "rejected"}
          onChange={handleSetStatus}
          getCount={(v) => (stats as Record<string, number> | undefined)?.[v]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="ID заявки, ID юзера или имя..."
        />
      </div>

      {/* Список */}
      {isFirstLoad ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загрузка...
        </div>
      ) : showEmpty ? (
        <div className="text-center py-12 text-muted-foreground">
          {hasFilters ? (
            <>
              <p>Ничего не найдено.</p>
              <button
                onClick={handleResetFilters}
                className="text-primary hover:underline mt-2 text-sm"
              >
                Сбросить фильтры
              </button>
            </>
          ) : (
            <p>{statusFilter === "pending" ? "Очередь пуста." : "Нет заявок в этом статусе."}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((v) => (
            <VerificationCard
              key={v.id}
              verification={v}
              onReject={setRejectTarget}
            />
          ))}
        </div>
      )}

      {/* Пагинация */}
      {meta && meta.last_page > 1 && (
        <ListPagination
          currentPage={meta.current_page}
          lastPage={meta.last_page}
          from={meta.from}
          to={meta.to}
          total={meta.total}          
          onChangePage={setPage}
          disabled={isFetching}
        />
      )}

      {/* Модалка reject */}
      <RejectModal
        verification={rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      />
    </div>
  );
}
