"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useSupportCategoriesList,
  useCreateSupportCategory,
  useUpdateSupportCategory,
  useDeleteSupportCategory,
  type SupportCategoryItem,
  type CategoryFormData,
} from "@/hooks/admin/use-support-templates";
import { getInitialUrlParam } from "@/lib/url-params";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn, staggerStyle } from "@/lib/utils";
import { SEARCH_DEBOUNCE_MS } from "./_shared";
import { CategoryModal } from "./category-modal";
import { SearchInput } from "@/components/admin/search-input";
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function CategoriesTab() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<SupportCategoryItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupportCategoryItem | null>(null);

  const [urlInitialized, setUrlInitialized] = useState(false);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setUrlInitialized(true);
  }, []);

  useEffect(() => {
    if (!urlInitialized) return;
    const params = new URLSearchParams();
    params.set("tab", "categories");
    if (search) params.set("q", search);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [search, router, urlInitialized]);

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isError, error, refetch } = useSupportCategoriesList(debouncedSearch);
  const items: SupportCategoryItem[] = useMemo(() => data?.data ?? [], [data]);

  const showEmpty = !isLoading && items.length === 0 && !isError;

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  useEffect(() => {
    if (searchedId && items.length > 0) {
      const match = items.find((c) => c.id === searchedId);
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

  const createMutation = useCreateSupportCategory();
  const updateMutation = useUpdateSupportCategory();
  const deleteMutation = useDeleteSupportCategory();
  const isMutating = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => { setEditingCategory(null); setShowModal(true); };
  const openEdit = (category: SupportCategoryItem) => { setEditingCategory(category); setShowModal(true); };

  const handleSave = (formData: CategoryFormData) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, payload: formData }, { onSuccess: () => setShowModal(false) });
    } else {
      createMutation.mutate(formData, { onSuccess: () => setShowModal(false) });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Создать категорию
        </Button>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по ID, названию или slug..."
        />
      </div>

      <TableShell>
        <Table className="table-fixed w-full min-w-200">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-14">ID</TableHead>
              <TableHead>Название</TableHead>
              <TableHead className="w-35">Slug</TableHead>
              <TableHead className="w-25 text-center">Шаблонов</TableHead>
              <TableHead className="w-22.5 text-center">Статус</TableHead>
              <TableHead className="w-20 text-center">Порядок</TableHead>
              <TableHead className="w-25 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingRow colSpan={7} />
            ) : isError ? (
              <TableErrorRow
                colSpan={7}
                title="Не удалось загрузить категории"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={7}
                title="Категорий не найдено."
              />
            ) : (
              items.map((cat, index) => {
                const isHighlighted = cat.id === highlightId;
                return (
                  <TableRow
                    key={cat.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      "animate-in fade-in slide-in-from-bottom-1 duration-300",
                      isHighlighted && "bg-primary/10",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell className={`text-xs font-mono whitespace-nowrap tabular-nums align-top pt-3 ${isHighlighted ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      #{cat.id}
                    </TableCell>
                    <TableCell className="align-top pt-3">
                      <button onClick={() => openEdit(cat)} className="text-left font-medium text-sm cursor-pointer hover:underline hover:text-primary transition-colors">
                        {cat.name}
                      </button>
                      {cat.is_system && (
                        <Badge variant="outline" className="ml-2 text-[10px] text-yellow-500 border-yellow-500/30">Системная</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground align-top pt-3">{cat.slug}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground align-top pt-3">
                      <Badge variant="secondary" className="text-[10px]">{cat.templates_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center align-top pt-3">
                      {cat.is_active ? (
                        <Badge variant="success" className="text-[10px]">Активна</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Выкл</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground align-top pt-3">{cat.sort_order}</TableCell>
                    <TableCell className="text-right align-top pt-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(cat)} title="Редактировать">
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        {!cat.is_system && (
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(cat)} title="Удалить">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
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

      <CategoryModal open={showModal} onOpenChange={setShowModal} category={editingCategory} onSave={handleSave} isLoading={isMutating} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Удалить категорию?"
        description={deleteTarget ? `«${deleteTarget.name}» будет удалена. Шаблоны будут перемещены в «Общие».` : ""}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}