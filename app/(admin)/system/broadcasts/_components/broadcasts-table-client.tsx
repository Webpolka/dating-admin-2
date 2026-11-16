// app/(admin)/system/broadcasts/_components/broadcasts-table-client.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useBroadcastsList,
  useDeleteBroadcast,
  useDuplicateBroadcast,
  useSendBroadcastNow,
  useBulkDeleteBroadcasts,
  type BroadcastItem,
} from "@/hooks/admin/use-broadcasts";
import { getInitialUrlParam, buildUrl } from "@/lib/url-params";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { UserBadge } from "@/components/admin/user-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Radio, Plus, RotateCcw,
  CalendarIcon, Trash2
} from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { cn, staggerStyle } from "@/lib/utils";
import {
  SEARCH_DEBOUNCE_MS, PER_PAGE, STATUS_FILTERS, TYPE_ICONS, TYPE_LABELS,
} from "./_shared";
import { BroadcastStatusBadge } from "./broadcast-status-badge";
import { BroadcastRowActions } from "./broadcast-row-actions";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";

export function BroadcastsTableClient() {
  const router = useRouter();
  const pathname = usePathname();

  // F2: initial state через getInitialUrlParam (после mount) — предотвращает
  // hydration mismatch и устаревший snapshot useSearchParams.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BroadcastItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // F8: per-row pending для sendNow. Set<id> — чтобы независимо блокировать
  // dropdown для конкретной рассылки, а не глобально.
  const [sendingIds, setSendingIds] = useState<Set<number>>(new Set());

  const [urlInitialized, setUrlInitialized] = useState(false);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Initial URL read (после mount).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setDebouncedSearch(getInitialUrlParam("q"));
    setStatusFilter(getInitialUrlParam("status") || "all");
    setTypeFilter(getInitialUrlParam("type") || "all");
    setDateFrom(getInitialUrlParam("date_from"));
    setDateTo(getInitialUrlParam("date_to"));
    setPage(parseInt(getInitialUrlParam("page") || "1", 10));
    setUrlInitialized(true);
  }, []);

  // URL-sync — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, typeFilter, dateFrom, dateTo, page, pathname, router, urlInitialized]);

  // F4: debounce 400ms. Ручной таймер (не useDebouncedValue): он батчит
  // не только поиск, но и сброс страницы + сброс статус/тип/дат при
  // поиске по ID — это одна атомарная операция, разводить её нельзя.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);

      // Если ввели ID — сбрасываем все фильтры, чтобы найти рассылку в любом статусе
      if (search && /^\d+$/.test(search)) {
        setStatusFilter("all");
        setTypeFilter("all");
        setDateFrom("");
        setDateTo("");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useBroadcastsList({
    q: debouncedSearch,
    status: statusFilter,
    type: typeFilter,
    date_from: dateFrom,
    date_to: dateTo,
    page,
    per_page: PER_PAGE,
  });

  const deleteMutation = useDeleteBroadcast();
  const duplicateMutation = useDuplicateBroadcast();
  const sendNowMutation = useSendBroadcastNow();
  const bulkDeleteMutation = useBulkDeleteBroadcasts();

  const items: BroadcastItem[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const counts = data?.counts;

  const isHighlightedId = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch)
    ? parseInt(debouncedSearch, 10)
    : null;

  useEffect(() => {
    if (highlightRowRef.current && isHighlightedId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlightedId, items]);

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const hasFilters = search !== "" || statusFilter !== "all" || typeFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const isFirstLoad = isLoading && !data;
  const isRefetching = isFetching && !isFirstLoad;
  const showEmpty = !isLoading && !isFetching && items.length === 0 && !isError;

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelected(checked ? items.map((b) => String(b.id)) : []);
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, String(id)] : prev.filter((s) => s !== String(id))
    );
  };

  const handleClearSelection = () => {
    setSelected([]);
    setSelectAll(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const handleDuplicate = (broadcast: BroadcastItem) => {
    duplicateMutation.mutate(broadcast.id, {
      onSuccess: (data) => {
        if (data?.data?.id) {
          router.push(`/system/broadcasts/${data.data.id}/edit`);
        }
      },
    });
  };

  // F8: per-row pending для sendNow.
  const handleSendNow = (broadcast: BroadcastItem) => {
    setSendingIds((prev) => {
      const next = new Set(prev);
      next.add(broadcast.id);
      return next;
    });
    sendNowMutation.mutate(broadcast.id, {
      onSettled: () => {
        setSendingIds((prev) => {
          const next = new Set(prev);
          next.delete(broadcast.id);
          return next;
        });
      },
    });
  };

  const handleBulkDelete = () => {
    if (selected.length === 0) return;
    bulkDeleteMutation.mutate(selected.map((s) => parseInt(s, 10)), {
      onSuccess: () => {
        setBulkDeleteOpen(false);
        handleClearSelection();
      },
    });
  };

    // ============================================
  // ДИАПАЗОН ДАТ (date_from / date_to)
  // ============================================
  // Принцип: "по" всегда >= "с". Если юзер выбрал инвертированный
  // диапазон — автоматически подтягиваем вторую границу.
  
  const handleDateFromChange = (dateStr: string) => {
    setDateFrom(dateStr);
    // Если "с" > "по" — подтягиваем "по" к "с".
    if (dateStr && dateTo && dateStr > dateTo) {
      setDateTo(dateStr);
    }
    setSearch("");
    setPage(1);
  };

  const handleDateToChange = (dateStr: string) => {
    // Если "по" < "с" — подтягиваем "по" к "с".
    if (dateStr && dateFrom && dateStr < dateFrom) {
      setDateTo(dateFrom);
    } else {
      setDateTo(dateStr);
    }
    setSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={Radio}
        title="Рассылка уведомлений"
        badge={
          counts && counts.draft > 0
            ? <Badge variant="warning">{counts.draft} черновиков</Badge>
            : undefined
        }
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          <Link href="/system/broadcasts/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Создать рассылку
            </Button>
          </Link>
        }
      />

      {/* Filters + Bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {selected.length > 0 ? (
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Удалить выбранные
            <Badge variant="warning">{selected.length}</Badge>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled className="gap-2 opacity-50">
            <Trash2 className="w-4 h-4" /> Не выбрано
          </Button>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleResetFilters} disabled={!hasFilters} className="gap-1.5">
            <RotateCcw className="w-4 h-4" />
            Сбросить
          </Button>

          <Select
            value={typeFilter}
            onValueChange={(v: string | null) => { setTypeFilter(v ?? "all"); setSearch(""); setPage(1); }}
          >
            <SelectTrigger className="w-32 h-9">
              {typeFilter === "all" ? "Все типы" : TYPE_LABELS[typeFilter] ?? typeFilter}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="in_app">В приложении</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="push">Push</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger render={
              <Button variant="outline" size="sm" className="w-40 justify-between font-normal">
                {dateFrom ? format(new Date(dateFrom), "dd.MM.yyyy") : <span className="text-muted-foreground">С даты</span>}
                <CalendarIcon className="w-4 h-4 opacity-50" />
              </Button>
            } />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom ? new Date(dateFrom) : undefined}
                onSelect={(d) => handleDateFromChange(d ? format(d, "yyyy-MM-dd") : "")}
              />
            </PopoverContent>
          </Popover>

          <span>-</span>

          <Popover>
            <PopoverTrigger render={
              <Button variant="outline" size="sm" className="w-40 justify-between font-normal">
                {dateTo ? format(new Date(dateTo), "dd.MM.yyyy") : <span className="text-muted-foreground">По дату</span>}
                <CalendarIcon className="w-4 h-4 opacity-50" />
              </Button>
            } />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo ? new Date(dateTo) : undefined}
                onSelect={(d) => handleDateToChange(d ? format(d, "yyyy-MM-dd") : "")}
              />
            </PopoverContent>
          </Popover>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по ID или тексту..."
          />
        </div>
      </div>

      {/* Фильтр по статусу */}
      <StatusTabs
        tabs={STATUS_FILTERS}
        value={statusFilter}
        onChange={handleStatusFilterChange}
        getCount={(v) =>
          counts ? (v === "all" ? counts.total : counts[v as keyof typeof counts] ?? 0) : undefined
        }
      />

      {/* Таблица */}
      <TableShell isFetching={isRefetching}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-8">
                <Checkbox checked={selectAll} onCheckedChange={(c) => handleSelectAll(Boolean(c))} />
              </TableHead>
              <TableHead className="w-12">ID</TableHead>
              <TableHead>Рассылка</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Аудитория</TableHead>
              <TableHead className="w-28">Статус</TableHead>
              <TableHead>Автор</TableHead>
              <TableHead>Создано</TableHead>
              <TableHead>Отправлено</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={10} />
            ) : isError ? (
              // F5: отдельная ветка ошибки загрузки.
              <TableErrorRow
                colSpan={10}
                title="Не удалось загрузить рассылки"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={10}
                title="Нет рассылок"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              items.map((broadcast, index) => {
                const isHighlighted = broadcast.id === isHighlightedId;
                const isSelected = selected.includes(String(broadcast.id));
                const rowClassName = cn(
                  "border-b border-border transition-colors",
                  isHighlighted && "bg-primary/10",
                  !isHighlighted && isSelected && "bg-muted/30",
                );

                const TypeIcon = TYPE_ICONS[broadcast.type] || Radio;

                return (
                  <TableRow
                    key={broadcast.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      rowClassName,
                      "animate-in fade-in slide-in-from-bottom-1 duration-300",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => handleSelectOne(broadcast.id, Boolean(c))}
                      />
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs font-mono whitespace-nowrap tabular-nums",
                      isHighlighted ? "text-primary font-bold" : "text-muted-foreground",
                    )}>
                      #{broadcast.id}
                    </TableCell>
                    <TableCell className="max-w-[18rem] align-top">
                      <button
                        onClick={() => router.push(`/system/broadcasts/${broadcast.id}/edit`)}
                        className="block text-left group cursor-pointer w-full"
                      >
                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {broadcast.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {broadcast.message}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <TypeIcon className="w-3 h-3" />
                        {TYPE_LABELS[broadcast.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-42">
                      {broadcast.target_user ? (
                        // F7: убран non-null assertion — broadcast.target_user уже проверен
                        <button
                          onClick={() => router.push(`/users/${broadcast.target_user!.id}`)}
                          className="block text-left"
                        >
                          <UserBadge user={broadcast.target_user} />
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {broadcast.audience_parts.length > 0 ? (
                            broadcast.audience_parts.map((part, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] whitespace-nowrap">
                                {part}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Все пользователи</Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <BroadcastStatusBadge broadcast={broadcast} />
                    </TableCell>
                    <TableCell>
                      {broadcast.admin ? (
                        <button
                          onClick={() => router.push(`/users/${broadcast.admin!.id}`)}
                          className="block text-left"
                        >
                          <UserBadge user={broadcast.admin} showEmail={false} />
                        </button>
                      ) : (
                        <Badge variant="secondary">Система</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div>{formatDate(broadcast.created_at)}</div>
                      <div className="text-[10px] opacity-70">{formatTime(broadcast.created_at)}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                      {broadcast.sent_at ? (
                        <>
                          <div>{formatDate(broadcast.sent_at)}</div>
                          <div className="text-[10px] opacity-70">{formatTime(broadcast.sent_at)}</div>
                        </>
                      ) : broadcast.started_at ? (
                        <>
                          <div>{formatDate(broadcast.started_at)}</div>
                          <div className="text-[10px] opacity-70">{formatTime(broadcast.started_at)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <BroadcastRowActions
                        broadcast={broadcast}
                        isSending={sendingIds.has(broadcast.id)}
                        onEdit={() => router.push(`/system/broadcasts/${broadcast.id}/edit`)}
                        onSendNow={() => handleSendNow(broadcast)}
                        onDuplicate={() => handleDuplicate(broadcast)}
                        onDelete={() => setDeleteTarget(broadcast)}
                      />
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

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Удалить рассылку?"
        description={deleteTarget ? `Рассылка «${deleteTarget.title}» будет удалена без возможности восстановления.` : undefined}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Удалить выбранные рассылки?"
        description={`Будут удалены ${selected.length} рассылок. Рассылки в процессе отправки удалены не будут. Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={bulkDeleteMutation.isPending}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}

