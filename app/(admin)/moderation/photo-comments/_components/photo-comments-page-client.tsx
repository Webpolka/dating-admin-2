// app/(admin)/moderation/photo-comments/_components/photo-comments-page-client.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import {
  usePhotoCommentsList,
  usePhotoCommentCounts,
  useApproveAllPendingComments,
  useRejectAllPendingComments,
  type PhotoWithComments,
} from "@/hooks/admin/use-photo-comments";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  MessageCircle, Loader2, CheckCircle, XCircle,
} from "lucide-react";

import { PhotoWithCommentsCard } from "./photo-with-comments-card";
import { STATUS_TABS, SEARCH_DEBOUNCE_MS } from "./photo-comments-shared";
import { ListPagination } from "@/components/admin/list-pagination";
import { NewCountBadge, PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { buildUrl } from "@/lib/url-params";

export function PhotoCommentsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "pending"
  );
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  const [showApproveAll, setShowApproveAll] = useState(false);
  const [showRejectAll, setShowRejectAll] = useState(false);

  // URL-sync фильтров — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
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

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // При вводе текста → сразу переключаемся на "Все" статус
  // (искомый ID/слово может быть в любом статусе — pending/approved/rejected).
  // Сброс идёт НЕ внутри debounce timer → нет задержки.
  useEffect(() => {
    if (search !== "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter("all");
    }
    setPage(1);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = usePhotoCommentsList({
    status: statusFilter as "all" | "pending" | "approved" | "rejected" | "karantine",
    q: debouncedSearch,
    page,
  });

  const approveAllMutation = useApproveAllPendingComments();
  const rejectAllMutation = useRejectAllPendingComments();

  const items = useMemo(() => (data?.data ?? []) as PhotoWithComments[], [data]);
  const meta = data?.meta;
  // Counts — из отдельного stable query (не зависит от filter/search/page).
  // Раньше брали из data?.stats — скачкообразный UI при смене вкладок.
  const { data: countsData } = usePhotoCommentCounts();
  const stats = countsData?.stats;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  const handleSetStatus = (status: string) => {
    setStatusFilter(status);
    setSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("pending");
    setPage(1);
  };

  const hasFilters = search !== "" || statusFilter !== "pending";
  const pendingTotal = stats?.pending ?? 0;

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={MessageCircle}
        title="Модерация комментариев"
        badge={<NewCountBadge count={pendingTotal} />}
        description={`Всего: ${stats?.total ?? 0} (в карантине: ${stats?.karantine ?? 0})`}
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          pendingTotal > 0 && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowApproveAll(true)}
                disabled={approveAllMutation.isPending || rejectAllMutation.isPending}
              >
                {approveAllMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-1" />
                )}
                Одобрить все
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRejectAll(true)}
                disabled={approveAllMutation.isPending || rejectAllMutation.isPending}
              >
                {rejectAllMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <XCircle className="w-4 h-4 mr-1" />
                )}
                Отклонить все
              </Button>
            </>
          )
        }
      />

      {/* Табы + Поиск */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <StatusTabs
          tabs={STATUS_TABS}
          value={statusFilter}
          onChange={handleSetStatus}
          getCount={(v) => stats ? (stats as Record<string, number>)[v] : undefined}
        />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="ID комментария, текст или имя..."
        />
      </div>

      {/* Контент */}
      <PhotoProvider>
        {isFirstLoad ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : showEmpty ? (
          <div className="bg-card border border-border rounded-lg p-16 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">
              {hasFilters ? "Ничего не найдено" : "Нет комментариев"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {hasFilters
                ? `По запросу "${search}" ничего не найдено`
                : "Все комментарии проверены. Отличная работа!"}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4">
                Сбросить фильтры
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((photo) => (
              <PhotoWithCommentsCard
                key={photo.id}
                photo={photo}
                searchedId={searchedId}
                statusFilter={statusFilter}
                isKarantine={statusFilter === "karantine"}
              />
            ))}
          </div>
        )}
      </PhotoProvider>

      <ListPagination
        currentPage={page}
        lastPage={meta?.last_page ?? 1}
        from={meta?.from ?? null}
        to={meta?.to ?? null}
        total={meta?.total}
        onChangePage={setPage}
        disabled={isFetching}
      />

      {/* ConfirmDialog — одобрить все */}
      <ConfirmDialog
        open={showApproveAll}
        onOpenChange={(open) => { if (!open) setShowApproveAll(false); }}
        title="Одобрить все комментарии?"
        description={`Вы уверены? Будут одобрены все ${pendingTotal} ожидающих комментариев.`}
        confirmText="Одобрить все"
        cancelText="Отмена"
        variant="default"
        isLoading={approveAllMutation.isPending}
        onConfirm={() => {
          approveAllMutation.mutate(undefined, {
            // onSuccess — диалог закрывается ТОЛЬКО при успехе.
            // При ошибке остаётся открытым, модератор видит toast и может retry.
            onSuccess: () => setShowApproveAll(false),
          });
        }}
      />

      {/* ConfirmDialog — отклонить все */}
      <ConfirmDialog
        open={showRejectAll}
        onOpenChange={(open) => { if (!open) setShowRejectAll(false); }}
        title="Отклонить все комментарии?"
        description={`Вы уверены? Будут отклонены все ${pendingTotal} ожидающих комментариев. Это действие нельзя отменить.`}
        confirmText="Отклонить все"
        cancelText="Отмена"
        variant="destructive"
        isLoading={rejectAllMutation.isPending}
        onConfirm={() => {
          rejectAllMutation.mutate(undefined, {
            onSuccess: () => setShowRejectAll(false),
          });
        }}
      />
    </div>
  );
}
