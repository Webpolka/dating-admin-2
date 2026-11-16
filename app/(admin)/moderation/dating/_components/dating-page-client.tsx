// app/(admin)/moderation/dating/_components/dating-page-client.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useDatingList,
  useDatingCounts,
  type SwipeItem,
  type MatchItem,
} from "@/hooks/admin/use-dating";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Heart, X } from "lucide-react";

import { SwipeRow } from "./swipe-row";
import { MatchRow } from "./match-row";
import { MODE_TABS, TYPE_FILTERS, SEARCH_DEBOUNCE_MS } from "./dating-shared";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import { TableEmptyRow, TableLoadingRow } from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { buildUrl } from "@/lib/url-params";

export function DatingPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [viewMode, setViewMode] = useState<"swipes" | "matches">(
    (searchParams.get("mode") as "swipes" | "matches") ?? "swipes"
  );
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  // URL-sync фильтров — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        mode: viewMode,
        q: search || undefined,
        type: typeFilter !== "all" && viewMode === "swipes" ? typeFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, viewMode, typeFilter, dateFrom, dateTo, page, pathname, router]);

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // При вводе текста → сразу сбрасываем type filter на "all"
  // (искомый ID/имя может быть в любом типе свайпа) и уходим на первую
  // страницу. Сброс идёт НЕ внутри debounce timer → нет задержки.
  useEffect(() => {
    if (search !== "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTypeFilter("all");
    }
    setPage(1);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useDatingList({
    mode: viewMode,
    type: typeFilter,
    q: debouncedSearch,
    dateFrom,
    dateTo,
    page,
  });

  const items = useMemo(() => (data?.data ?? []) as SwipeItem[] | MatchItem[], [data]);
  const meta = data?.meta;
  // Counts — из отдельного stable query (не зависит от filter/search/page).
  // Раньше брали из data?.stats — скачкообразный UI при смене вкладок.
  const { data: countsData } = useDatingCounts();
  const stats = countsData?.stats;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  const handleSetViewMode = (mode: "swipes" | "matches") => {
    setViewMode(mode);
    setSearch("");
    setTypeFilter("all");
    setPage(1);
  };

  const handleSetTypeFilter = (type: string) => {
    setTypeFilter(type);
    setSearch("");
    setPage(1);
  };

  // Авто-подстройка дат: если «С» больше «По» — двигаем «По» вперёд,
  // если «По» меньше «С» — двигаем «С» назад.
  const handleSetDateFrom = (v: string) => {
    setDateFrom(v);
    if (v && dateTo && new Date(v) > new Date(dateTo)) {
      setDateTo(v);
    }
    setPage(1);
  };

  const handleSetDateTo = (v: string) => {
    setDateTo(v);
    if (v && dateFrom && new Date(v) < new Date(dateFrom)) {
      setDateFrom(v);
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasFilters = search !== "" || typeFilter !== "all" || dateFrom !== "" || dateTo !== "";

  return (
    <div className="flex flex-col gap-6">
      {/* Шапка */}
      <PageHeader
        icon={Heart}
        title="Модерация знакомств"
        description={`Свайпов: ${stats?.total_swipes ?? 0} • Матчей: ${stats?.total_matches ?? 0}`}
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {/* Панель фильтров */}
      <div className="flex flex-col gap-3">
        {/* Ряд 1: Режим (Свайпы/Матчи) */}
        <StatusTabs
          tabs={MODE_TABS}
          value={viewMode}
          onChange={handleSetViewMode}
          getCount={(v) => (v === "swipes" ? stats?.total_swipes : stats?.total_matches)}
        />

        {/* Ряд 2: Типы свайпов (слева, только в режиме swipes) + Даты и Поиск (справа) */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {viewMode === "swipes" && (
            <StatusTabs
              tabs={TYPE_FILTERS}
              value={typeFilter}
              onChange={handleSetTypeFilter}
              getCount={(v) =>
                v === "all" ? stats?.total_swipes :
                v === "like" ? stats?.total_likes :
                v === "dislike" ? stats?.total_dislikes :
                stats?.total_superlikes
              }
            />
          )}

          {/* Сбросить + Даты + Поиск — справа */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                <X className="w-4 h-4 mr-1" />
                Сбросить
              </Button>
            )}

            <DatePicker value={dateFrom} onChange={handleSetDateFrom} placeholder="С" />
            <span className="text-muted-foreground text-sm">—</span>
            <DatePicker value={dateTo} onChange={handleSetDateTo} placeholder="По" />

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="ID, имя или email..."
            />
          </div>
        </div>
      </div>

      {/* Таблица */}
      <TableShell>
        <Table className="table-fixed w-full min-w-225">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-16">ID</TableHead>
              {viewMode === "swipes" ? (
                <>
                  <TableHead className="w-60">Оценил</TableHead>
                  <TableHead className="w-60">Получил оценку</TableHead>
                  <TableHead className="w-30">Тип</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="w-60">Пользователь 1</TableHead>
                  <TableHead className="w-60">Пользователь 2</TableHead>
                  <TableHead className="w-30">Статус</TableHead>
                </>
              )}
              <TableHead className="w-30">Дата</TableHead>
              <TableHead className="w-20 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={6} />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={6}
                title="Нет данных для отображения"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : viewMode === "swipes" ? (
              (items as SwipeItem[]).map((swipe, index) => (
                <SwipeRow
                  key={swipe.id}
                  swipe={swipe}
                  isHighlighted={swipe.id === searchedId}
                  index={index}
                />
              ))
            ) : (
              (items as MatchItem[]).map((match, index) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  isHighlighted={match.id === searchedId}
                  index={index}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableShell>

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
