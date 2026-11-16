// app/(admin)/moderation/diary/_components/diaries-page-client.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RubricFormModal } from "./rubric-form-modal";
import { DeleteRubricModal } from "./delete-rubric-modal";

import {
  useDiariesList,
  useRubricsList,
  useDiaryCounts,
  type DiaryItem,
  type DiaryRubric,
} from "@/hooks/admin/use-diaries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BookOpen, Trash2, Plus, EyeOff, X,
} from "lucide-react";

import { DiaryRow } from "./diary-row";
import { RubricRow } from "./rubric-row";
import { STATUS_TABS, DEFAULT_STATUS, DEFAULT_TRASHED, DEFAULT_RUBRIC, PER_PAGE, SEARCH_DEBOUNCE_MS } from "./diary-shared";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { SectionTabs } from "@/components/admin/section-tabs";
import { StatusTabs } from "@/components/admin/status-tabs";
import { TableEmptyRow, TableLoadingRow } from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { buildUrl } from "@/lib/url-params";

export function DiariesPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showRubricModal, setShowRubricModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState<DiaryRubric | null>(null);
  const [deletingRubric, setDeletingRubric] = useState<DiaryRubric | null>(null);

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "diaries");

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? DEFAULT_STATUS);
  const [trashedFilter, setTrashedFilter] = useState(searchParams.get("trashed") ?? DEFAULT_TRASHED);
  const [rubricFilter, setRubricFilter] = useState(searchParams.get("rubric") ?? DEFAULT_RUBRIC);
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  // URL-sync фильтров — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет. Фильтры записей пишем только на вкладке записей.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        tab: activeTab,
        q: search || undefined,
        status: activeTab === "diaries" && statusFilter !== DEFAULT_STATUS ? statusFilter : undefined,
        trashed: activeTab === "diaries" && trashedFilter !== DEFAULT_TRASHED ? trashedFilter : undefined,
        rubric: activeTab === "diaries" && rubricFilter !== DEFAULT_RUBRIC ? rubricFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [activeTab, search, statusFilter, trashedFilter, rubricFilter, page, pathname, router]);

  // Поиск: debounce + сброс фильтров ВНУТРИ timer.
  //
  // ВАЖНО: все пять state-обновлений (debouncedSearch + statusFilter +
  // trashedFilter + rubricFilter + page) должны сработать атомарно —
  // внутри одного setTimeout tick. Иначе получится два queryKey change подряд:
  //   1) {q: старый, status: all, ...} — React Query кидает запрос
  //      с ПРОМЕЖУТОЧНЫМ невалидным состоянием
  //   2) {q: новый, status: all, ...} — финальный запрос
  // Между ними (≈400ms) таблица показывает результаты первого (невалидного)
  // запроса → мелькание «сначала все, потом нужное».
  // Поэтому здесь НЕ useDebouncedValue, а ручной timer.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      if (search) {
        // При поиске сбрасываем все фильтры — искомый ID/имя может быть
        // в любом статусе/trashed/rubric.
        setStatusFilter("all");
        setTrashedFilter("without");
        setRubricFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const isDiaries = activeTab === "diaries";

  // Запросы с enabled flag — только активная вкладка делает запрос.
  // Раньше оба hook'а были активны всегда → 2 запроса на каждый rerender.
  const diariesQuery = useDiariesList(
    {
      status: statusFilter,
      trashed: trashedFilter as "with" | "only" | "without",
      rubric: rubricFilter,
      q: debouncedSearch,
      page,
      per_page: PER_PAGE,
    },
    { enabled: isDiaries }
  );

  const rubricsQuery = useRubricsList(
    { q: debouncedSearch, page, per_page: PER_PAGE },
    { enabled: !isDiaries }
  );

  const query = isDiaries ? diariesQuery : rubricsQuery;
  const { data, isLoading, isFetching, refetch } = query;

  const items = useMemo(() => (data?.data ?? []) as DiaryItem[] | DiaryRubric[], [data]);
  const meta = data?.meta;

  // Counts — из отдельного stable query (не зависит от filter/search/page).
  // Раньше брали из data?.stats — скачкообразный UI при смене вкладок.
  const { data: countsData } = useDiaryCounts();
  const stats = countsData?.stats;

  // all_rubrics приходит из list-response (cached 60s на бэке) — используется
  // только когда активна вкладка постов, для dropdown фильтра рубрики.
  const allRubrics = (isDiaries ? diariesQuery.data?.all_rubrics : rubricsQuery.data?.all_rubrics) ?? [];

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleSetStatus = (status: string) => {
    setStatusFilter(status);
    setTrashedFilter(DEFAULT_TRASHED);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleToggleTrashed = () => {
    setTrashedFilter(prev => prev === "only" ? DEFAULT_TRASHED : "only");
    setStatusFilter("all");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter(DEFAULT_STATUS);
    setTrashedFilter(DEFAULT_TRASHED);
    setRubricFilter(DEFAULT_RUBRIC);
    setPage(1);
  };

  const hasFilters = isDiaries
    ? (search !== "" || statusFilter !== DEFAULT_STATUS || trashedFilter !== DEFAULT_TRASHED || rubricFilter !== DEFAULT_RUBRIC)
    : (search !== "");

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={BookOpen}
        title="Дневники"
        description={
          isDiaries ? (
            stats && (
              // Жёлтый у «В очереди» — семантика «ждёт модерации».
              <span className="tabular-nums">
                Всего: <span className="font-medium">{stats.all}</span> • В очереди:{" "}
                <span className="font-medium text-yellow-600 dark:text-yellow-500">{stats.pending}</span>
              </span>
            )
          ) : (
            "Системные рубрики — общие для всех пользователей"
          )
        }
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {/* Табы-разделы: Записи / Системные рубрики */}
      <SectionTabs
        tabs={[
          { value: "diaries", label: "Записи", count: stats?.all ?? null },
          { value: "rubrics", label: "Системные рубрики", count: stats?.rubrics_count ?? null },
        ]}
        value={activeTab}
        onChange={handleSetTab}
      />

      {/* Фильтры */}
      {isDiaries ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Когда активен «Карантин», ни один статусный таб не подсвечен. */}
            <StatusTabs
              tabs={STATUS_TABS}
              value={trashedFilter === DEFAULT_TRASHED ? statusFilter : ""}
              onChange={handleSetStatus}
              getCount={(v) =>
                stats ? (v === "all" ? stats.all : (stats as Record<string, number>)[v]) : undefined
              }
            />
            {/* «Карантин» — отдельная кнопка-действие (деструктивная), не статусный таб */}
            <Button
              variant={trashedFilter === "only" ? "destructive" : "secondary"}
              size="sm"
              onClick={handleToggleTrashed}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Карантин
              {stats && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1 tabular-nums">
                  {stats.trashed}
                </Badge>
              )}
            </Button>
          </div>

          {/* Фильтр рубрики + Поиск + Сбросить — справа, рядом */}
          <div className="flex items-center gap-2 ml-auto">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
                <X className="w-4 h-4" /> Сбросить
              </Button>
            )}

            <Select
              value={rubricFilter}
              onValueChange={(v: string | null) => { setRubricFilter(v ?? DEFAULT_RUBRIC); setPage(1); }}
            >
              <SelectTrigger className="w-50 h-9">
                {rubricFilter === DEFAULT_RUBRIC ? (
                  "Все рубрики"
                ) : rubricFilter === "none" ? (
                  "Без рубрики"
                ) : (
                  (() => {
                    const r = allRubrics.find(r => String(r.id) === rubricFilter);
                    if (!r) return "Рубрика";
                    return (
                      <span className={`flex items-center gap-1.5 ${!r.is_active ? "text-muted-foreground" : ""}`}>
                        {!r.is_active && <EyeOff className="w-3.5 h-3.5 shrink-0" />}
                        <span className="truncate">{r.name}</span>
                      </span>
                    );
                  })()
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_RUBRIC}>Все рубрики</SelectItem>
                <SelectItem value="none">Без рубрики</SelectItem>
                {allRubrics.map(r => (
                  <SelectItem
                    key={r.id}
                    value={String(r.id)}
                    className={!r.is_active ? "text-muted-foreground" : ""}
                  >
                    <span className="flex items-center gap-1.5">
                      {r.name}
                      {!r.is_active && <EyeOff className="w-3.5 h-3.5 shrink-0" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="ID, название или имя..."
              className="w-70"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          {/* Поиск + Сбросить + Создать рубрику — справа */}
          <Button variant="default" size="sm" onClick={() => { setEditingRubric(null); setShowRubricModal(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Создать системную рубрику
          </Button>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
                <X className="w-4 h-4" /> Сбросить
              </Button>
            )}

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по названию или ID..."
              className="w-70"
            />
          </div>
        </div>
      )}

      {/* Таблица */}
      <TableShell>
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {isDiaries ? (
                <>
                  <TableHead className="w-14">ID</TableHead>
                  <TableHead className="w-56">Автор</TableHead>
                  <TableHead className="w-60">Заголовок</TableHead>
                  <TableHead className="w-44">Рубрика</TableHead>
                  <TableHead className="w-32">Статус</TableHead>
                  <TableHead className="w-24 text-center">Статистика</TableHead>
                  <TableHead className="w-40">Даты</TableHead>
                  <TableHead className="w-24 text-right">Действия</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="w-14">ID</TableHead>
                  <TableHead className="w-14">Сорт.</TableHead>
                  <TableHead className="w-60">Название</TableHead>
                  <TableHead className="w-100">Описание</TableHead>
                  <TableHead className="w-20 text-center">Постов</TableHead>
                  <TableHead className="w-24">Статус</TableHead>
                  <TableHead className="w-24 text-right">Действия</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={isDiaries ? 8 : 7} />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={isDiaries ? 8 : 7}
                title={isDiaries ? "Записи не найдены" : "Рубрики не найдены"}
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : isDiaries ? (
              (items as DiaryItem[]).map((diary, index) => (
                <DiaryRow
                  key={diary.id}
                  diary={diary}
                  isHighlighted={diary.id === searchedId}
                  index={index}
                />
              ))
            ) : (
              (items as DiaryRubric[]).map((rubric, index) => (
                <RubricRow
                  key={rubric.id}
                  rubric={rubric}
                  isHighlighted={rubric.id === searchedId}
                  index={index}
                  onEdit={(r) => { setEditingRubric(r); setShowRubricModal(true); }}
                  onDelete={(r) => setDeletingRubric(r)}
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

      {/* Модалки рубрик */}
      <RubricFormModal
        open={showRubricModal}
        onOpenChange={setShowRubricModal}
        editingRubric={editingRubric}
      />
      <DeleteRubricModal
        open={deletingRubric !== null}
        onOpenChange={(open) => { if (!open) setDeletingRubric(null); }}
        rubric={deletingRubric}
        allRubrics={allRubrics}
      />
    </div>
  );
}
