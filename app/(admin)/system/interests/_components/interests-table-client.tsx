// app/(admin)/system/interests/_components/interests-table-client.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useInterestsList,
  useInterestsCounts,
  useDeleteInterest,
  useBoostInterest,
  useBulkInterests,
  type InterestCategoryFilter,
  type BulkInterestAction,
  type InterestList,
} from "@/hooks/admin/use-interests";
import { useInterestCategories } from "@/hooks/admin/use-interest-categories";
import { formatDateTime } from "@/lib/format";
import { buildUrl, getInitialUrlParam } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs, type StatusTabDef } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sparkles, Plus, Tags, X, TrendingUp, Settings2 } from "lucide-react";
import { SEARCH_DEBOUNCE_MS, PER_PAGE, CATEGORY_FILTERS_PRESET, BULK_ACTION_LABELS } from "./_shared";
import { InterestRowActions } from "./interest-row-actions";
import { InterestCategoryModal } from "./interest-category-modal";

// Дефолтный буст при нажатии "Поднять в выдаче" (если 0).
const DEFAULT_BOOST_VALUE = 100;

export function InterestsTableClient() {
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<InterestCategoryFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkInterestAction | "">("");

  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InterestList | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  // Категория для bulk set_category (null = "без категории").
  const [bulkCategoryId, setBulkCategoryId] = useState<number | null>(null);

  const [urlInitialized, setUrlInitialized] = useState(false);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Initial URL read.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setDebouncedSearch(getInitialUrlParam("q"));
    const urlCat = getInitialUrlParam("category_id");
    if (urlCat === "uncategorized" || urlCat === "boosted") {
      setCategoryFilter(urlCat);
    } else if (urlCat === "all" || !urlCat) {
      setCategoryFilter("all");
    } else if (/^\d+$/.test(urlCat)) {
      setCategoryFilter(parseInt(urlCat, 10));
    }
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
        category_id: categoryFilter !== "all" ? String(categoryFilter) : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, categoryFilter, page, pathname, router, urlInitialized]);

  // Debounce 400ms.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      if (search && /^\d+$/.test(search)) {
        setCategoryFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data: countsData } = useInterestsCounts();
  const counts = countsData?.data;

  const { data: categoriesData } = useInterestCategories();
  const categories = categoriesData?.data ?? [];

  const { data, isLoading, isFetching, isError, error, refetch } = useInterestsList({
    q: debouncedSearch,
    category_id: categoryFilter,
    page,
    per_page: PER_PAGE,
  });

  const deleteMutation = useDeleteInterest();
  const boostMutation = useBoostInterest();
  const bulkMutation = useBulkInterests();

  const interests: InterestList[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  const isHighlightedId = debouncedSearch && /^\d+$/.test(debouncedSearch)
    ? parseInt(debouncedSearch, 10)
    : null;

  useEffect(() => {
    if (highlightRowRef.current && isHighlightedId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlightedId, interests]);

  const isFirstLoad = isLoading && !data;
  const isRefetching = isFetching && !isFirstLoad;
  const showEmpty = !isLoading && !isFetching && interests.length === 0 && !isError;

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCategoryFilter("all");
    setPage(1);
  };

  const hasFilters = search !== "" || categoryFilter !== "all";

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelected(checked ? interests.map((i) => String(i.id)) : []);
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, String(id)] : prev.filter((s) => s !== String(id))
    );
  };

  const handleClearSelection = () => {
    setSelected([]);
    setSelectAll(false);
    setBulkAction("");
    setBulkCategoryId(null);
  };

  const handleApplyBulkClick = () => {
    if (!bulkAction || selected.length === 0) return;
    // set_category без выбранной категории (null) допустим — "убрать из категории".
    setBulkConfirmOpen(true);
  };

  const handleConfirmBulk = () => {
    if (!bulkAction || selected.length === 0) return;
    bulkMutation.mutate(
      {
        ids: selected.map((s) => parseInt(s, 10)),
        action: bulkAction,
        category_id: bulkAction === "set_category" ? bulkCategoryId : undefined,
      },
      {
        onSuccess: () => {
          setBulkConfirmOpen(false);
          handleClearSelection();
        },
        onError: () => setBulkConfirmOpen(false),
      }
    );
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const handleBoost = (interest: InterestList) => {
    boostMutation.mutate({ id: interest.id, searchBoost: DEFAULT_BOOST_VALUE });
  };

  const handleUnboost = (interest: InterestList) => {
    boostMutation.mutate({ id: interest.id, searchBoost: 0 });
  };

  const bulkActionLabel = bulkAction ? BULK_ACTION_LABELS[bulkAction] : null;
  const hasSelection = selected.length > 0;

  const bulkConfirmDescription =
    bulkAction === "delete"
      ? `Удалить ${selected.length} интересов навсегда? Связи с профилями юзеров будут удалены каскадом.`
      : bulkAction === "set_category"
      ? `Перенести ${selected.length} интересов в категорию «${
          bulkCategoryId
            ? categories.find((c) => c.id === bulkCategoryId)?.name ?? "—"
            : "Без категории"
        }»?`
      : "";

  // Preset-табы + динамические табы по категориям. У всех записей одна
  // и та же форма {value: string, label}: id категории кодируем строкой,
  // пресеты («all»/«uncategorized»/«boosted») приходят из _shared.
  const categoryTabs: StatusTabDef[] = [
    ...CATEGORY_FILTERS_PRESET.map((f) => ({ value: f.value, label: f.label })),
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const handleCategoryFilterChange = (value: string) => {
    // Числовой value — id категории, иначе один из пресетов.
    const next: InterestCategoryFilter = /^\d+$/.test(value)
      ? parseInt(value, 10)
      : (value as InterestCategoryFilter);
    setCategoryFilter(next);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={Tags}
        title="Интересы"
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          <>
            <Button variant="outline" onClick={() => setCategoryModalOpen(true)}>
              <Settings2 className="w-4 h-4" />
              Категории
            </Button>
            <Button onClick={() => router.push("/system/interests/new")}>
              <Plus className="w-4 h-4" />
              Новый интерес
            </Button>
          </>
        }
      />

      {/* Фильтр по категории */}
      <StatusTabs
        tabs={categoryTabs}
        value={String(categoryFilter)}
        onChange={handleCategoryFilterChange}
        getCount={(v) => {
          if (v === "all" || v === "uncategorized" || v === "boosted") {
            return counts ? counts[v] : undefined;
          }
          return categories.find((c) => String(c.id) === v)?.interests_count;
        }}
      />

      <div className="flex items-center justify-between gap-4">
        {/* Правая часть: всегда "Выбрано: N" (приглушено при 0),
            селекты + кнопки появляются только при выборе, поиск прижат вправо. */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span className={`text-sm font-medium whitespace-nowrap tabular-nums ${hasSelection ? "" : "text-muted-foreground/60"}`}>
            Выбрано: <span className={hasSelection ? "text-primary" : ""}>{selected.length}</span>
          </span>

          {hasSelection && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <Select
                value={bulkAction}
                onValueChange={(v: string | null) => setBulkAction((v ?? "") as BulkInterestAction | "")}
              >
                <SelectTrigger className="w-50">
                  {bulkActionLabel ? (
                    <span>{bulkActionLabel}</span>
                  ) : (
                    <span className="text-muted-foreground">Выберите действие...</span>
                  )}
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="set_category">Перенести в категорию</SelectItem>
                  <SelectItem value="delete" className="text-destructive focus:text-destructive">
                    Удалить навсегда
                  </SelectItem>
                </SelectContent>
              </Select>

              {bulkAction === "set_category" && (
                <Select
                  value={bulkCategoryId === null ? "null" : String(bulkCategoryId)}
                  onValueChange={(v: string | null) => {
                    if (v === null || v === "null") setBulkCategoryId(null);
                    else setBulkCategoryId(parseInt(v, 10));
                  }}
                >
                  <SelectTrigger className="w-48">
                    {bulkCategoryId === null ? (
                      <span className="text-muted-foreground">Без категории</span>
                    ) : (
                      <span>{categories.find((c) => c.id === bulkCategoryId)?.name ?? "—"}</span>
                    )}
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="null">Без категории</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button size="sm" onClick={handleApplyBulkClick} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? "Применяется..." : "Применить"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <X className="w-4 h-4" /> Снять
              </Button>
              <Separator orientation="vertical" className="h-6" />
            </>
          )}
        </div>

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
          placeholder="Поиск по имени или id..."
        />
      </div>

      {/* Таблица */}
      <TableShell isFetching={isRefetching}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <Checkbox checked={selectAll} onCheckedChange={(c) => handleSelectAll(Boolean(c))} />
              </TableHead>
              <TableHead className="w-12">ID</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                  Название
                </span>
              </TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-right">Юзеров</TableHead>
              <TableHead className="text-right">Буст</TableHead>
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
                title="Не удалось загрузить интересы"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={8}
                title="Интересы не найдены"
                hint="Попробуйте изменить фильтр или поисковый запрос"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              interests.map((interest, index) => {
                const isHighlighted = interest.id === isHighlightedId;
                const isSelected = selected.includes(String(interest.id));

                // Буст-строки — жёлтая семантическая подсветка (warning).
                const rowClassName = cn(
                  isHighlighted && "bg-primary/10",
                  !isHighlighted && isSelected && "bg-muted/30",
                  !isHighlighted && !isSelected && interest.search_boost > 0 && "bg-yellow-500/5",
                );

                return (
                  <TableRow
                    key={interest.id}
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
                        onCheckedChange={(c) => handleSelectOne(interest.id, Boolean(c))}
                      />
                    </TableCell>
                    <TableCell className={`text-xs font-mono whitespace-nowrap ${isHighlighted ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      #{interest.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {interest.search_boost > 0 && (
                          <span className="shrink-0 text-yellow-500" title={`Буст: ${interest.search_boost}`}>
                            <TrendingUp className="w-4 h-4" />
                          </span>
                        )}
                        <button
                          onClick={() => router.push(`/system/interests/${interest.id}/edit`)}
                          className="font-medium text-sm hover:text-primary hover:underline text-left"
                        >
                          {interest.name}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {interest.category ? (
                        <Badge variant="outline">{interest.category.name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Без категории</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {interest.users_count}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {interest.search_boost > 0 ? (
                        <span className="text-yellow-600 dark:text-yellow-500 font-medium">
                          +{interest.search_boost}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap tabular-nums">
                      {interest.updated_at && interest.created_at && interest.updated_at !== interest.created_at ? (
                        <span className="text-amber-600 dark:text-amber-500">
                          {formatDateTime(interest.updated_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <InterestRowActions
                        interest={interest}
                        onEdit={() => router.push(`/system/interests/${interest.id}/edit`)}
                        onBoost={() => handleBoost(interest)}
                        onUnboost={() => handleUnboost(interest)}
                        onDelete={() => setDeleteTarget(interest)}
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

      {/* Confirm: Bulk */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title="Подтвердите действие"
        description={bulkConfirmDescription}
        confirmText="Применить"
        cancelText="Отмена"
        variant={bulkAction === "delete" ? "destructive" : "default"}
        isLoading={bulkMutation.isPending}
        onConfirm={handleConfirmBulk}
      />

      {/* Confirm: Delete Single */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Удалить интерес навсегда?"
        description={
          deleteTarget
            ? `Интерес «${deleteTarget.name}» будет удалён. У ${deleteTarget.users_count} юзеров он пропадёт из профиля.`
            : undefined
        }
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />

      {/* Category manager modal */}
      <InterestCategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        selectedId={null}
        onSelect={() => {
          /* В списке интересов клик по категории в модалке не выбирает её как фильтр;
             модалка — только для управления. Фильтр выбирается табами выше. */
        }}
      />
    </div>
  );
}
