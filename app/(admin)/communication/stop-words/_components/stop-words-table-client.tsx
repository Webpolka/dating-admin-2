// app/(admin)/communication/stop-words/_components/stop-words-table-client.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useStopWordsList,
  useStopWordsCounts,
  useCreateBulkStopWords,
  useUpdateStopWord,
  useToggleStopWord,
  useDeleteStopWord,
  useBulkActionStopWords,
  type StopWordItem,
  type StopWordCategory as StopWordCategoryType,
  type StopWordAction as StopWordActionType,
} from "@/hooks/admin/use-stop-words";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
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
  ShieldAlert, Plus, X, Loader2,
  CheckCircle2, Circle, Trash2, Check, Pencil,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { buildUrl } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
// Shared constants + helpers (вынесены из этого файла для читаемости)
import { CATEGORY_OPTIONS, ACTION_OPTIONS, STATUS_OPTIONS, BULK_ACTIONS } from "./stop-words-shared";
// Modals (вынесены в отдельные файлы)
import { AddStopWordsModal } from "./stop-words-add-modal";
import { EditStopWordModal } from "./stop-words-edit-modal";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { TableEmptyRow, TableLoadingRow } from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PER_PAGE = 50;

export function StopWordsTableClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") ?? "all");
  const [actionFilter, setActionFilter] = useState(searchParams.get("action") ?? "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  const [selected, setSelected] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkWords, setBulkWords] = useState("");
  const [modalCategory, setModalCategory] = useState<StopWordCategoryType>("mat");
  const [modalAction, setModalAction] = useState<StopWordActionType>("mask");
  // Replacement для add-modal (#9). По умолчанию '***' — стандартная маска.
  // Админ может изменить (например 'бяка' или '⚠️' для конкретной категории).
  const [modalReplacement, setModalReplacement] = useState("***");

  // Edit modal state (#2). Редактирование одного слова.
  const [editingWord, setEditingWord] = useState<StopWordItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<string | null>(null);

  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Sync URL — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        action: actionFilter !== "all" ? actionFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, categoryFilter, actionFilter, statusFilter, page, pathname, router]);

  // Debounce поиска + сброс страницы при новом запросе.
  useEffect(() => {
    const t = setTimeout(() => setPage(1), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isFetching, refetch } = useStopWordsList({
    q: debouncedSearch,
    category: categoryFilter,
    action: actionFilter,
    status: statusFilter,
    page,
    per_page: PER_PAGE,
  });

  const createBulkMutation = useCreateBulkStopWords();
  const updateMutation = useUpdateStopWord();
  const toggleMutation = useToggleStopWord();
  const deleteMutation = useDeleteStopWord();
  const bulkMutation = useBulkActionStopWords();

  const items: StopWordItem[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  // Counts — из отдельного query со STABLE queryKey (не зависит от filter/page/q).
  // Раньше брали из data.counts — но data пересоздавалась при смене filter,
  // и counts на момент fetch показывали 0 → скачкообразный UI.
  const { data: countsData } = useStopWordsCounts();
  const counts = countsData;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  // ID-подсветка: если в поиске введено число — это ID записи
  const isHighlightedId = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch)
    ? parseInt(debouncedSearch, 10)
    : null;

  useEffect(() => {
    if (highlightRowRef.current && isHighlightedId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlightedId, items]);

  // Сброс выбора при смене фильтров/страницы
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected([]);
    setSelectAll(false);
  }, [debouncedSearch, categoryFilter, actionFilter, statusFilter, page]);

  const hasFilters = search !== "" || categoryFilter !== "all" || actionFilter !== "all" || statusFilter !== "all";

  const handleResetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setActionFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  // Выбрать все на текущей странице
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelected(checked ? items.map((w) => String(w.id)) : []);
  };

  // Переключение одной строки
  const handleSelectRow = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(String(id));
      } else {
        next.delete(String(id));
      }
      // Сбрасываем "выбрать все" если хотя бы одна строка снята
      if (next.size < items.length) setSelectAll(false);
      else setSelectAll(true);
      return Array.from(next);
    });
  };

  // Подтверждение удаления одного слова
  const handleConfirmDelete = () => {
    if (confirmDeleteId === null) return;
    deleteMutation.mutate(confirmDeleteId, { onSettled: () => setConfirmDeleteId(null) });
  };

  // Подтверждение массового действия
  const handleConfirmBulk = () => {
    if (!confirmBulkAction || selected.length === 0) return;
    bulkMutation.mutate(
      { ids: selected.map(Number), action: confirmBulkAction as "activate" | "deactivate" | "delete" },
      {
        onSettled: () => {
          setConfirmBulkAction(null);
          setSelected([]);
          setSelectAll(false);
          setBulkAction("");
        },
      }
    );
  };

  // Сохранение новых слов
  const handleSaveBulkWords = () => {
    if (!bulkWords.trim()) return;
    createBulkMutation.mutate(
      { words: bulkWords, category: modalCategory, action: modalAction },
      {
        onSuccess: () => {
          setShowAddModal(false);
          setBulkWords("");
          setModalReplacement("***"); // сброс replacement после закрытия
        },
      }
    );
  };

  // Открытие edit modal — устанавливаем editingWord и открываем диалог
  const handleOpenEdit = (word: StopWordItem) => {
    setEditingWord(word);
    setShowEditModal(true);
  };

  // Сохранение отредактированного слова
  const handleSaveEdit = (payload: {
    word: string;
    category: StopWordCategoryType;
    action: StopWordActionType;
    replacement: string;
    is_active: boolean;
  }) => {
    if (!editingWord) return;
    updateMutation.mutate(
      { id: editingWord.id, payload },
      {
        onSuccess: () => {
          setShowEditModal(false);
          setEditingWord(null);
        },
      }
    );
  };

  const isMutating = toggleMutation.isPending || deleteMutation.isPending || bulkMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={ShieldAlert}
        title="Стоп-слова и фильтры"
        description={
          <>
            Всего в базе: <span className="text-foreground font-medium">{counts?.total ?? 0}</span> ·
            Активно: <span className="text-primary font-medium">{counts?.active ?? 0}</span>
          </>
        }
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="w-4 h-4" /> Добавить слова
          </Button>
        }
      />

      {/* Фильтры + Поиск + Compact Bulk Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-h-12">
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={categoryFilter}
            onValueChange={(v: string | null) => {
              setCategoryFilter(v ?? "all");
              setPage(1);
              // Синхронизация: при выборе фильтра очищаем поиск
              setSearch("");
            }}
          >
            <SelectTrigger className="w-50 h-9">
              {categoryFilter === "all" ? "Все категории" : CATEGORY_OPTIONS.find(o => o.value === categoryFilter)?.label ?? "Все категории"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={actionFilter}
            onValueChange={(v: string | null) => {
              setActionFilter(v ?? "all");
              setPage(1);
              setSearch("");
            }}
          >
            <SelectTrigger className="w-50 h-9">
              {actionFilter === "all" ? "Любое поведение" : ACTION_OPTIONS.find(o => o.value === actionFilter)?.label ?? "Любое поведение"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Любое поведение</SelectItem>
              {ACTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v: string | null) => {
              setStatusFilter(v ?? "all");
              setPage(1);
              setSearch("");
            }}
          >
            <SelectTrigger className="w-50 h-9">
              {STATUS_OPTIONS.find(s => s.value === statusFilter)?.label ?? "Статус"}
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
              <X className="w-4 h-4" /> Сбросить
            </Button>
          )}
        </div>

        {/* Правая группа: Compact Bulk Panel (если есть выбор) + Поиск */}
        <div className="flex items-center gap-2 flex-wrap">
          {selected.length > 0 && (
            <div
              className="flex items-center gap-2 bg-muted/40 border border-border rounded-md px-2 py-1 animate-in fade-in slide-in-from-right-2 duration-200"
            >
              <span className="text-xs font-medium whitespace-nowrap">
                Выбрано: <span className="text-primary tabular-nums">{selected.length}</span>
              </span>

              <Select
                value={bulkAction}
                onValueChange={(v: string | null) => setBulkAction(v ?? "")}
              >
                <SelectTrigger className="h-8 min-w-40 w-auto text-xs">
                  {bulkAction ? BULK_ACTIONS.find(a => a.value === bulkAction)?.label : "Действие..."}
                </SelectTrigger>
                <SelectContent>
                  {BULK_ACTIONS.map((a) => (
                    <SelectItem
                      key={a.value}
                      value={a.value}
                      className={a.value === "delete" ? "text-destructive focus:text-destructive" : ""}
                    >
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="default"
                className="h-8 px-3"
                disabled={!bulkAction || isMutating}
                onClick={() => setConfirmBulkAction(bulkAction)}
              >
                {isMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Применить
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => { setSelected([]); setSelectAll(false); setBulkAction(""); }}
                title="Снять выделение"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              // Синхронизация: при вводе в поиск — сбрасываем все фильтры
              if (v !== "") {
                setCategoryFilter("all");
                setActionFilter("all");
                setStatusFilter("all");
              }
            }}
            placeholder="Поиск по слову или id..."
          />
        </div>
      </div>

      {/* Таблица */}
      <TableShell isFetching={isFetching}>
        <Table className="table-fixed w-full min-w-220">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={(v) => handleSelectAll(Boolean(v))}
                  aria-label="Выбрать все"
                />
              </TableHead>
              <TableHead className="w-14">ID</TableHead>
              <TableHead>Слово / Фраза / Regex</TableHead>
              <TableHead className="w-35">Категория</TableHead>
              <TableHead className="w-40">Поведение</TableHead>
              <TableHead className="w-23 text-center">Активно</TableHead>
              <TableHead className="w-22 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={7} />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={7}
                title="Слова не найдены. Добавьте первые!"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              items.map((word, index) => {
                const isHighlighted = word.id === isHighlightedId;
                const isSelected = selected.includes(String(word.id));

                return (
                  <TableRow
                    key={word.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      "border-b border-border transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300",
                      isHighlighted && "bg-primary/10",
                      isSelected && "bg-muted/30",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => handleSelectRow(word.id, Boolean(v))}
                        aria-label={`Выбрать слово ${word.word}`}
                      />
                    </TableCell>

                    <TableCell className={`text-xs font-mono whitespace-nowrap tabular-nums align-top pt-3 ${isHighlighted ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      #{word.id}
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded break-all">
                        {word.word}
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDate(word.created_at ?? "")}
                      </div>
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      <span className="text-xs text-muted-foreground">
                        {word.category_label}
                      </span>
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      <Badge variant={word.action_variant}>
                        {word.action_label}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center align-top pt-3">
                      <button
                        onClick={() => toggleMutation.mutate(word.id)}
                        className="cursor-pointer hover:scale-110 transition-transform"
                        title={word.is_active ? "Активно — нажмите чтобы выключить" : "Выключено — нажмите чтобы включить"}
                      >
                        {word.is_active ? (
                          <CheckCircle2 className="w-5 h-5 text-primary inline" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground inline" />
                        )}
                      </button>
                    </TableCell>

                    <TableCell className="text-right align-top pt-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleOpenEdit(word)}
                          title="Редактировать"
                          disabled={isMutating}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmDeleteId(word.id)}
                          title="Удалить"
                          disabled={isMutating}
                        >
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

      {/* Модалка добавления слов */}
      <AddStopWordsModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        bulkWords={bulkWords}
        setBulkWords={setBulkWords}
        modalCategory={modalCategory}
        setModalCategory={setModalCategory}
        modalAction={modalAction}
        setModalAction={setModalAction}
        modalReplacement={modalReplacement}
        setModalReplacement={setModalReplacement}
        onSave={handleSaveBulkWords}
        isLoading={createBulkMutation.isPending}
      />

      {/* Подтверждение удаления одного слова */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Удалить стоп-слово?"
        description="Слово будет удалено навсегда. Эту операцию нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />

      {/* Подтверждение массового действия */}
      <ConfirmDialog
        open={confirmBulkAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmBulkAction(null); }}
        title="Применить массовое действие?"
        description={
          confirmBulkAction === "delete"
            ? `Будет удалено ${selected.length} слов(а). Эту операцию нельзя отменить.`
            : `Будет обработано ${selected.length} слов(а).`
        }
        confirmText={
          confirmBulkAction === "delete" ? "Удалить навсегда"
          : confirmBulkAction === "activate" ? "Активировать"
          : "Деактивировать"
        }
        cancelText="Отмена"
        variant={confirmBulkAction === "delete" ? "destructive" : "default"}
        isLoading={bulkMutation.isPending}
        onConfirm={handleConfirmBulk}
      />

      {/* Edit modal — редактирование одного стоп-слова */}
      <EditStopWordModal
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) setEditingWord(null);
        }}
        word={editingWord}
        onSave={handleSaveEdit}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}