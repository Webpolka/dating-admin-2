// app/(admin)/system/geoip/_components/geoip-locations-table-client.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useGeoLocationsList,
  useGeoLocationsCounts,
  useToggleGeoRegistration,
  useToggleGeoFeed,
  type GeoType,
  type GeoLocationItem,
} from "@/hooks/admin/use-geoip-locations";
import { buildUrl, getInitialUrlParam } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { Globe, FilterX } from "lucide-react";
import { SEARCH_DEBOUNCE_MS, PER_PAGE, TYPE_FILTERS, TYPE_LABELS } from "./_shared";
import { ListPagination } from "@/components/admin/list-pagination";

export function GeoIpLocationsTableClient({ backUrl }: { backUrl: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // F2: initial state через getInitialUrlParam (после mount) — предотвращает
  // hydration mismatch и устаревший snapshot useSearchParams.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<GeoType>("country");
  const [page, setPage] = useState(1);
  const [blockedFilter, setBlockedFilter] = useState<'none' | 'reg' | 'feed'>('none');

  const [urlInitialized, setUrlInitialized] = useState(false);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Initial URL read (после mount).
  useEffect(() => {
           // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setDebouncedSearch(getInitialUrlParam("q"));
    const urlType = getInitialUrlParam("type") as GeoType;
    if (urlType && ["country", "region", "city"].includes(urlType)) setTypeFilter(urlType);
    setPage(parseInt(getInitialUrlParam("page") || "1", 10));
    const urlBlocked = getInitialUrlParam("blocked") as 'none' | 'reg' | 'feed';
    if (urlBlocked && ["none", "reg", "feed"].includes(urlBlocked)) setBlockedFilter(urlBlocked);
    setUrlInitialized(true);
  }, []);

  // URL-sync — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        type: typeFilter !== "country" ? typeFilter : undefined,
        page: page > 1 ? page : undefined,
        blocked: blockedFilter !== 'none' ? blockedFilter : undefined,
      }),
      { scroll: false },
    );
  }, [search, typeFilter, page, blockedFilter, pathname, router, urlInitialized]);

  // F4: debounce 400ms.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data: countsData } = useGeoLocationsCounts();
  const counts = countsData?.data;

  const { data, isLoading, isFetching, isError, error, refetch } = useGeoLocationsList({
    type: typeFilter,
    q: debouncedSearch,
    page,
    per_page: PER_PAGE,
    blocked: blockedFilter,
  });

  // При поиске ID — backend вернёт фактический type найденной локации,
  // синхронизируем таб (только при активном поиске по ID)
  useEffect(() => {
    if (!data?.type) return;
    const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
    if (isIdSearch && data.type !== typeFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTypeFilter(data.type);
    }
  }, [data?.type, typeFilter, debouncedSearch]);

  const toggleRegMutation = useToggleGeoRegistration();
  const toggleFeedMutation = useToggleGeoFeed();

  const items: GeoLocationItem[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  const isHighlightedId = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch)
    ? parseInt(debouncedSearch, 10)
    : null;

  useEffect(() => {
    if (highlightRowRef.current && isHighlightedId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlightedId, items]);

  const handleTypeFilterChange = (newType: GeoType) => {
    setTypeFilter(newType);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
    setBlockedFilter('none');
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
    setBlockedFilter('none');
  };

  const hasFilters = search !== "" || blockedFilter !== 'none';

  const isFirstLoad = isLoading && !data;
  const isRefetching = isFetching && !isFirstLoad;
  const showEmpty = !isLoading && !isFetching && items.length === 0 && !isError;

  // Счётчики заблокированных для текущего типа
  const currentCounts = counts?.[typeFilter];
  const blockedRegCount = currentCounts?.blocked_reg ?? 0;
  const blockedFeedCount = currentCounts?.blocked_feed ?? 0;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <PageHeader
        icon={Globe}
        title="Geo IP локации"
        description="Управление блокировками стран, регионов и городов."
        onBack={() => router.push(backUrl)}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {/* Фильтры */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs
          tabs={TYPE_FILTERS}
          value={typeFilter}
          onChange={handleTypeFilterChange}
          getCount={(v) => counts?.[v]?.total}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            disabled={!hasFilters}
            className="gap-1.5"
          >
            <FilterX className="w-4 h-4" />
            Сбросить
          </Button>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по имени, ISO или ID..."
          />
        </div>
      </div>

      {/* Таблица */}
      <TableShell isFetching={isRefetching}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>ISO</TableHead>
              <TableHead>Координаты</TableHead>
              <TableHead>Принадлежность</TableHead>
              <TableHead className="text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span>Регистрация</span>
                  {blockedRegCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setBlockedFilter(prev => prev === 'reg' ? 'none' : 'reg')}
                      className={cn(
                        "text-[11px] font-medium hover:underline cursor-pointer text-destructive",
                        blockedFilter === 'reg' && "font-bold underline",
                      )}
                    >
                      Заблокировано: {blockedRegCount}
                    </button>
                  )}
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span>Лента (Feed)</span>
                  {blockedFeedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setBlockedFilter(prev => prev === 'feed' ? 'none' : 'feed')}
                      className={cn(
                        "text-[11px] font-medium hover:underline cursor-pointer text-yellow-500 dark:text-yellow-400",
                        blockedFilter === 'feed' && "text-yellow-600 dark:text-yellow-400 font-bold underline",
                      )}
                    >
                      Скрыто: {blockedFeedCount}
                    </button>
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={8} />
            ) : isError ? (
              // F5: отдельная ветка ошибки загрузки.
              <TableErrorRow
                colSpan={8}
                title="Не удалось загрузить локации"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={8}
                title="Локации не найдены"
                hint="Попробуйте изменить фильтр или поисковый запрос"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              items.map((item, index) => {
                const isHighlighted = item.id === isHighlightedId;

                return (
                  <TableRow
                    key={item.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      "border-b border-border transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300",
                      isHighlighted && "bg-primary/10",
                      !isHighlighted && item.is_registration_blocked && "bg-destructive/5",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell className={cn(
                      "text-xs font-mono whitespace-nowrap tabular-nums",
                      isHighlighted ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      #{item.id}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {item.name}
                      {item.original_name && item.original_name !== item.name && (
                        <span className="text-xs text-muted-foreground ml-2">({item.original_name})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.iso_code ? (
                        <code className="text-xs px-1.5 py-0.5 bg-muted rounded uppercase">
                          {item.iso_code}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground tabular-nums">
                      {item.latitude !== null && item.longitude !== null ? (
                        <span>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.parent_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* F6: Switch сразу реагирует (optimistic update в хуке).
                            disabled только если ОПРЕДЕЛЁННЫЙ switch в ошибке. */}
                        <Switch
                          checked={item.is_registration_blocked}
                          onCheckedChange={() => toggleRegMutation.mutate(item.id)}
                          disabled={toggleRegMutation.isPending && toggleRegMutation.variables === item.id}
                        />
                        {item.is_registration_blocked ? (
                          <Badge variant="destructive" className="text-[10px]">Заблокир</Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">Доступен</Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={item.is_feed_blocked}
                          onCheckedChange={() => toggleFeedMutation.mutate(item.id)}
                          disabled={toggleFeedMutation.isPending && toggleFeedMutation.variables === item.id}
                        />
                        {item.is_feed_blocked ? (
                          <Badge variant="warning" className="text-[10px]">Скрытый</Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">В ленте</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
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

