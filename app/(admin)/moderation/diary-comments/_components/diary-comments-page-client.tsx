// app/(admin)/moderation/diary-comments/_components/diary-comments-page-client.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  useDiaryCommentsList,
  useDiaryCommentCounts,
  type DiaryWithComments,
} from "@/hooks/admin/use-diaries";
import { Button } from "@/components/ui/button";
import {
  MessagesSquare, Loader2, CheckCircle,
} from "lucide-react";

import { DiaryWithCommentsCard } from "./diary-with-comments-card";
import { ListPagination } from "@/components/admin/list-pagination";
import { STATUS_TABS, SEARCH_DEBOUNCE_MS } from "./diary-comments-shared";
import { NewCountBadge, PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { buildUrl } from "@/lib/url-params";

export function DiaryCommentsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? (searchParams.get("diary_id") ? "all" : "pending")
  );
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  // Делаем diary_id полноценным state, чтобы можно было его очистить
  const initialDiaryId = searchParams.get("diary_id");
  const [diaryIdFilter, setDiaryIdFilter] = useState<number | null>(
    initialDiaryId ? parseInt(initialDiaryId, 10) : null
  );

  // URL-sync фильтров — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== "pending" ? statusFilter : undefined,
        page: page > 1 ? page : undefined,
        diary_id: diaryIdFilter ?? undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, page, diaryIdFilter, pathname, router]);

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // При вводе текста → сразу переключаемся на "Все" статус и сбрасываем
  // привязку к посту (искомый ID/слово может быть в любом статусе).
  // Сброс идёт НЕ внутри debounce timer → нет задержки.
  useEffect(() => {
    if (search !== "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter("all");
      setDiaryIdFilter(null);
    }
    setPage(1);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useDiaryCommentsList({
    status: statusFilter as "all" | "pending" | "approved" | "rejected" | "karantine",
    q: debouncedSearch,
    diary_id: diaryIdFilter ?? undefined,
    page,
  });

  const items = useMemo(() => (data?.data ?? []) as DiaryWithComments[], [data]);
  const meta = data?.meta;
  const { data: countsData } = useDiaryCommentCounts();
  const stats = countsData?.stats;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = (isIdSearch && !diaryIdFilter) ? parseInt(debouncedSearch, 10) : null;

  const handleSetStatus = (status: string) => {
    setStatusFilter(status);
    setSearch("");
    setDiaryIdFilter(null); // Сбрасываем привязку к посту при смене таба
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("pending");
    setDiaryIdFilter(null); // Сбрасываем привязку к посту при сбросе
    setPage(1);
  };

  const hasFilters = search !== "" || statusFilter !== "pending" || diaryIdFilter !== null;
  const pendingTotal = stats?.pending ?? 0;
  const isKarantine = statusFilter === "karantine";

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={MessagesSquare}
        title="Комментарии к дневникам"
        badge={<NewCountBadge count={pendingTotal} />}
        description={`Всего: ${stats?.total ?? 0} (в карантине: ${stats?.karantine ?? 0})`}
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
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
          {items.map((diary) => (
            <DiaryWithCommentsCard
              key={diary.id}
              diary={diary}
              searchedId={searchedId}
              statusFilter={statusFilter}
              isKarantine={isKarantine}
            />
          ))}
        </div>
      )}

      <ListPagination
        currentPage={page}
        lastPage={meta?.last_page ?? 1}
        from={meta?.from ?? null}
        to={meta?.to ?? null}
        total={meta?.total}
        onChangePage={setPage}
        disabled={isFetching}
      />
    </div>
  );
}
