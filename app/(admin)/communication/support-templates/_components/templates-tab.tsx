"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useSupportTemplatesList,
  useSupportCategoriesList,
  useDeleteSupportTemplate,
  type SupportTemplateItem,
  type SupportCategoryItem,
} from "@/hooks/admin/use-support-templates";
import { getInitialUrlParam } from "@/lib/url-params";
import { formatDate } from "@/lib/format";
import { stripMarkdown } from "@/components/admin/message-content";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { X, Plus, Pencil, Trash2 } from "lucide-react";
import { cn, staggerStyle } from "@/lib/utils";
import { SEARCH_DEBOUNCE_MS, PER_PAGE } from "./_shared";
import { ListPagination } from "@/components/admin/list-pagination";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function TemplatesTab() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportTemplateItem | null>(null);

  const [urlInitialized, setUrlInitialized] = useState(false);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setCategoryFilter(getInitialUrlParam("category") || "all");
    setPage(parseInt(getInitialUrlParam("page") || "1", 10));
    setUrlInitialized(true);
  }, []);

  const { data: categoriesData } = useSupportCategoriesList("");
  const categories: SupportCategoryItem[] = useMemo(() => categoriesData?.data ?? [], [categoriesData]);

  useEffect(() => {
    if (!urlInitialized) return;
    const params = new URLSearchParams();
    params.set("tab", "templates");
    if (search) params.set("q", search);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (page > 1) params.set("page", String(page));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [search, categoryFilter, page, router, urlInitialized]);

  // Debounce: сброс страницы и категории при новом запросе.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      if (search !== "") {
        setCategoryFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isFetching, isError, error, refetch } = useSupportTemplatesList({
    q: debouncedSearch,
    category: categoryFilter,
    page,
    per_page: PER_PAGE,
  });

  const items: SupportTemplateItem[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const counts = data?.counts;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0 && !isError;

  const handleSetCategoryFilter = (categoryId: string) => {
    setCategoryFilter(categoryId);
    setSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setPage(1);
  };

  const hasFilters = search !== "" || categoryFilter !== "all";

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  useEffect(() => {
    if (searchedId && items.length > 0) {
      const match = items.find((t) => t.id === searchedId);
      if (match) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHighlightId(match.id);
      }
    } else {
      setHighlightId(null);
    }
  }, [searchedId, items]);

  useEffect(() => {
    if (highlightRowRef.current && highlightId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

  const deleteMutation = useDeleteSupportTemplate();

  const openCreate = () => router.push("/communication/support-templates/new");
  const openEdit = (template: SupportTemplateItem) => router.push(`/communication/support-templates/${template.id}/edit`);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Категории — динамический конфиг (из query), поэтому собирается здесь */}
        <StatusTabs
          tabs={[
            { value: "all", label: "Все" },
            ...categories.map((cat) => ({ value: String(cat.id), label: cat.name })),
          ]}
          value={categoryFilter}
          onChange={handleSetCategoryFilter}
          getCount={(v) =>
            v === "all"
              ? counts?.total ?? 0
              : counts?.categories?.[parseInt(v, 10)] ?? 0
          }
        />

        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
              <X className="w-4 h-4" /> Сбросить
            </Button>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Создать шаблон
          </Button>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по ID или тексту..."
          />
        </div>
      </div>

      <TableShell isFetching={isFetching}>
        <Table className="table-fixed w-full min-w-225">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-14">ID</TableHead>
                <TableHead className="w-40">Категория</TableHead>
                <TableHead className="w-50">Название</TableHead>
                <TableHead>Текст (превью)</TableHead>
                <TableHead className="w-30">Создано</TableHead>
                <TableHead className="w-30">Обновлено</TableHead>
                <TableHead className="w-22.5 text-center">Статус</TableHead>
                <TableHead className="w-25 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={8} />
            ) : isError ? (
              <TableErrorRow
                colSpan={8}
                title="Не удалось загрузить шаблоны"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={8}
                title="Шаблонов не найдено."
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              items.map((template, index) => {
                const isHighlighted = template.id === highlightId;
                return (
                  <TableRow
                    key={template.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      "animate-in fade-in slide-in-from-bottom-1 duration-300",
                      isHighlighted && "bg-primary/10",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell className={`text-xs font-mono whitespace-nowrap tabular-nums align-top pt-3 ${isHighlighted ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      #{template.id}
                    </TableCell>
                    <TableCell className="align-top pt-3">
                      {template.category ? (
                        <Badge variant="secondary" className="text-[10px]">{template.category.name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Удалена</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top pt-3">
                      <button onClick={() => openEdit(template)} className="text-left font-medium text-sm cursor-pointer hover:underline hover:text-primary transition-colors">
                        {template.title}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate align-top pt-3 max-w-xs">
                      {stripMarkdown(template.body).slice(0, 180)}
                    </TableCell>
                    {/* Создано */}
                    <TableCell className="align-top pt-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {template.created_at ? formatDate(template.created_at) : "—"}
                    </TableCell>
                    {/* Обновлено — жёлтым, если есть последнее действие */}
                    <TableCell className="align-top pt-3 text-xs whitespace-nowrap tabular-nums">
                      {template.updated_at && template.created_at && template.updated_at !== template.created_at ? (
                        <span className="text-amber-600 dark:text-amber-500">
                          {formatDate(template.updated_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center align-top pt-3">
                      {template.is_active ? (
                        <Badge variant="success" className="text-[10px]">Активен</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Выкл</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top pt-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(template)} title="Редактировать">
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(template)} title="Удалить">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Удалить шаблон?"
        description={deleteTarget ? `«${deleteTarget.title}» будет удалён навсегда.` : ""}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

