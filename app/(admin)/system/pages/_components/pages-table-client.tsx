// app/(admin)/system/pages/_components/pages-table-client.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { cn, staggerStyle } from "@/lib/utils";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuGroup, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  FileText, Plus, X, MoreHorizontal, Pencil, Copy,
  Trash2, Send, FileEdit,
} from "lucide-react";
import { pagesApi, type PageListItem } from "@/lib/api/pages";
import { extractErrorMessage } from "@/lib/api";
import { buildUrl, getInitialUrlParam } from "@/lib/url-params";
import { formatDateTime } from "@/lib/format";
import { getStatusBadge, PAGE_STATUS } from "@/config/status-badges";
import { SEARCH_DEBOUNCE_MS, PER_PAGE, STATUS_FILTERS, BULK_ACTION_LABELS } from "./_shared";

export function PagesTableClient() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const [urlInitialized, setUrlInitialized] = useState(false);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setDebouncedSearch(getInitialUrlParam("q"));
    const urlStatus = getInitialUrlParam("status");
    if (urlStatus && ["all", "active", "draft"].includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
    const urlPage = parseInt(getInitialUrlParam("page") || "1", 10);
    if (!isNaN(urlPage) && urlPage > 0) setPage(urlPage);
    setUrlInitialized(true);
  }, []);

  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, page, pathname, router, urlInitialized]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      if (search && /^\d+$/.test(search)) {
        setStatusFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["pages", page, debouncedSearch, statusFilter],
    queryFn: () => pagesApi.getPages({
      search: debouncedSearch,
      status: statusFilter,
      page,
      per_page: PER_PAGE,
    }),
    placeholderData: (prev) => prev,
    staleTime: 0,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => pagesApi.toggleStatus(id),
    onSuccess: (d) => {
      toast.success(d.message);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (err: unknown) => toast.error(extractErrorMessage(err, "Ошибка смены статуса")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => pagesApi.duplicate(id),
    onSuccess: (d) => {
      toast.success(d.message);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (err: unknown) => toast.error(extractErrorMessage(err, "Ошибка дублирования")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => pagesApi.delete(id),
    onSuccess: (d) => {
      toast.success(d.message);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setDeleteId(null);
    },
    onError: (err: unknown) => toast.error(extractErrorMessage(err, "Ошибка удаления")),
  });

  const bulkMutation = useMutation({
    mutationFn: () => pagesApi.bulkAction(selected, bulkAction),
    onSuccess: (d) => {
      toast.success(d.message);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setSelected([]);
      setSelectAll(false);
      setBulkAction("");
      setBulkConfirmOpen(false);
    },
    onError: (err: unknown) => toast.error(extractErrorMessage(err, "Ошибка массового действия")),
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked && data?.pages) {
      setSelected(data.pages.map((p: PageListItem) => p.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelected([...selected, id]);
    } else {
      setSelected(selected.filter((s) => s !== id));
      setSelectAll(false);
    }
  };

  const handleApplyBulkClick = () => {
    if (selected.length === 0 || !bulkAction) return;
    setBulkConfirmOpen(true);
  };

  const handleConfirmBulk = () => {
    if (selected.length === 0 || !bulkAction) return;
    bulkMutation.mutate();
  };

  const handleClearSelection = () => {
    setSelected([]);
    setSelectAll(false);
    setBulkAction("");
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  const hasFilters = search !== "" || statusFilter !== "all";

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const highlightedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  useEffect(() => {
    if (highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedId, data]);

  const hasSelection = selected.length > 0;
  const bulkActionLabel = bulkAction ? BULK_ACTION_LABELS[bulkAction] : null;

  const isFirstLoad = isLoading && !data;
  const isRefetching = isFetching && !isFirstLoad;
  const showEmpty = !isLoading && !isFetching && (!data?.pages || data.pages.length === 0) && !isError;

  const lastPage = data?.last_page || 1;
  const currentPage = data?.current_page || 1;

  // from/to в ответе Laravel-пагинатор не отдаёт — выводим сами:
  // все страницы, кроме последней, полные, поэтому непоследняя страница
  // начинается с (page - 1) * per_page + 1, а последняя — от total - n + 1.
  const itemsOnPage = data?.pages.length ?? 0;
  const from = itemsOnPage > 0
    ? (currentPage < lastPage
        ? (currentPage - 1) * (data?.per_page ?? PER_PAGE) + 1
        : (data?.total ?? 0) - itemsOnPage + 1)
    : null;
  const to = from !== null ? from + itemsOnPage - 1 : null;

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={FileText}
        title="Страницы"
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          <Link href="/system/pages/create">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Создать страницу
            </Button>
          </Link>
        }
      />

      {/* Фильтры + Поиск + Bulk */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs
          tabs={STATUS_FILTERS}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          getCount={(v) => (data?.counts ? (data.counts as Record<string, number>)[v] : undefined)}
        />

        <div className="flex items-center gap-5">
          {hasSelection && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium whitespace-nowrap">
                Выбрано: <span className="text-primary">{selected.length}</span>
              </span>
              <Separator orientation="vertical" className="h-6" />
              <Select
                value={bulkAction}
                onValueChange={(value: string | null) => {
                  if (value) setBulkAction(value);
                }}
              >
                <SelectTrigger className="w-50">
                  {bulkActionLabel ? (
                    <span>{bulkActionLabel}</span>
                  ) : (
                    <span className="text-muted-foreground">Выберите действие...</span>
                  )}
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="activate">Опубликовать</SelectItem>
                  <SelectItem value="draft">Снять с публикации</SelectItem>
                  <SelectItem value="delete">Удалить</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleApplyBulkClick}
                disabled={!bulkAction || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? "Применяется..." : "Применить"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <X className="w-4 h-4" /> Снять
              </Button>
            </div>
          )}

          <SearchInput
            value={search}
            onChange={(v) => {
              // Крестик очистки — мгновенный сброс поиска (как раньше).
              if (v === "") {
                handleClearSearch();
                return;
              }
              setSearch(v);
            }}
            placeholder="Поиск по названию или id..."
          />
        </div>
      </div>

      {/* Таблица */}
      <TableShell isFetching={isRefetching}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={(checked) => handleSelectAll(checked === true)}
                />
              </TableHead>
              <TableHead className="w-10">ID</TableHead>
              <TableHead>Заголовок</TableHead>
              <TableHead>URL (Slug)</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Создано</TableHead>
              <TableHead>Обновлено</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={8} />
            ) : isError ? (
              <TableErrorRow
                colSpan={8}
                title="Не удалось загрузить страницы"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={8}
                title="Страницы не найдены"
                hint="Попробуйте изменить фильтр или поисковый запрос"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              data?.pages?.map((p: PageListItem, index: number) => {
                const isHighlighted = p.id === highlightedId;
                const isSelected = selected.includes(p.id);

                const rowClassName = cn(
                  isHighlighted && "bg-primary/10",
                  !isHighlighted && isSelected && "bg-muted/30",
                );

                const statusKey = p.is_active ? "active" : "draft";
                const statusBadge = getStatusBadge(PAGE_STATUS, statusKey);

                return (
                  <TableRow
                    key={p.id}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    className={cn(
                      rowClassName,
                      "animate-in fade-in slide-in-from-bottom-1 duration-300"
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOne(p.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs font-mono whitespace-nowrap tabular-nums",
                      isHighlighted ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      #{p.id}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-48 md:max-w-88">
                        <Link
                          href={`/system/pages/${p.id}/edit`}
                          className="block truncate font-medium text-sm hover:text-primary hover:underline"
                        >
                          {p.title}
                        </Link>
                        {p.meta_description && (
                          <div className="truncate text-xs text-muted-foreground mt-0.5">{p.meta_description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs px-1.5 py-0.5 bg-muted rounded">/{p.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </TableCell>
                    {/* Создано */}
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                      {p.created_at ? formatDateTime(p.created_at) : "—"}
                    </TableCell>
                    {/* Обновлено — жёлтым, если есть последнее действие */}
                    <TableCell className="text-xs whitespace-nowrap tabular-nums">
                      {p.updated_at && p.created_at && p.updated_at !== p.created_at ? (
                        <span className="text-amber-600 dark:text-amber-500">
                          {formatDateTime(p.updated_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        }/>
                        <DropdownMenuContent align="end" className="min-w-42">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Действия</DropdownMenuLabel>
                            <DropdownMenuItem render={
                              <Link href={`/system/pages/${p.id}/edit`} className="cursor-pointer">
                                <Pencil className="w-4 h-4 mr-2" /> Редактировать
                              </Link>
                            }/>
                            <DropdownMenuItem onClick={() => duplicateMutation.mutate(p.id)}>
                              <Copy className="w-4 h-4 mr-2" /> Дублировать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {p.is_active ? (
                              <DropdownMenuItem onClick={() => toggleMutation.mutate(p.id)}>
                                <FileEdit className="w-4 h-4 mr-2" /> В черновики
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => toggleMutation.mutate(p.id)}>
                                <Send className="w-4 h-4 mr-2" /> Опубликовать
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(p.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Удалить
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableShell>

      <ListPagination
        currentPage={currentPage}
        lastPage={lastPage}
        from={from}
        to={to}
        total={data?.total}
        onChangePage={setPage}
        disabled={isFetching}
      />

      {/* Confirm: Bulk */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title="Подтвердите действие"
        description={`Применить «${bulkAction ? BULK_ACTION_LABELS[bulkAction] : ""}» к ${selected.length} страницам?`}
        confirmText="Применить"
        cancelText="Отмена"
        variant={bulkAction === "delete" ? "destructive" : "default"}
        isLoading={bulkMutation.isPending}
        onConfirm={handleConfirmBulk}
      />

      {/* Confirm: Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Удалить страницу?"
        description="Это действие нельзя отменить. Страница будет удалена навсегда."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId !== null) deleteMutation.mutate(deleteId);
        }}
      />
    </div>
  );
}