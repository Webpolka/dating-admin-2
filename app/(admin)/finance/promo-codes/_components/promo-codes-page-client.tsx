"use client";

// app/(admin)/finance/promo-codes/_components/promo-codes-page-client.tsx
//
// Главный клиент раздела промокодов.
// Архитектура как photos-page-client / verifications-page-client:
//  - URL-sync фильтров (status/q/type/scope/page) — shareable URLs.
//  - Debounced search (400мс).
//  - StatusTabs с live-счётчиками.
//  - Dropdowns для типа и scope.
//  - ListPagination.
//  - Модалки: CreateModal + BulkGenerateModal.

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  usePromoCodesList,
  usePromoCodeCounts,
  type PromoCodeItem,
} from "@/hooks/admin/use-promo-codes";

import { PromoCodeCard } from "./promo-code-card";
import { CreateModal } from "./create-modal";
import { BulkGenerateModal } from "./bulk-generate-modal";
import {
  STATUS_TABS,
  TYPE_OPTIONS,
  SCOPE_OPTIONS,
  PAGE_TITLE,
  PAGE_DESCRIPTION,
  PAGE_ICON,
  SEARCH_DEBOUNCE_MS,
} from "./promo-codes-shared";

import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { buildUrl } from "@/lib/url-params";
import { Plus, Sparkles, Loader2, Inbox } from "lucide-react";

export function PromoCodesPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "all");
  const [scopeFilter, setScopeFilter] = useState(searchParams.get("scope") ?? "all");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<PromoCodeItem | null>(null);

  // URL-sync.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        scope: scopeFilter !== "all" ? scopeFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, typeFilter, scopeFilter, page, pathname, router]);

  // Debounce search. 
  // ВАЖНО: при вводе поиска авто-переключаемся на таб "Все" И сбрасываем
  // type/scope фильтры — поиск должен идти по всем промокодам без ограничений.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      // Если юзер ввёл что-то в поиск и при этом выбран не "Все" —
      // переключаем на "Все", иначе поиск будет только внутри таба.     
      if (search) {
        // Сбрасываем все фильтры — поиск идёт по всему набору.
        if (statusFilter !== "all") setStatusFilter("all");
        if (typeFilter !== "all") setTypeFilter("all");
        if (scopeFilter !== "all") setScopeFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);  
  }, [search, statusFilter, typeFilter, scopeFilter]);

  // При смене таба — очищаем поиск (URL-sync: search и status независимы).
  // Иначе юзер переключил на "Истёкшие", а в поле поиска остался старый запрос —
  // путаница в выдаче.

  const { data, isLoading, isFetching, refetch } = usePromoCodesList({
    q: debouncedSearch,
    status: statusFilter,
    type: typeFilter,
    scope: scopeFilter,
    page,
  });

  const items = useMemo(() => (data?.data ?? []) as PromoCodeItem[], [data]);
  const meta = data?.meta;

  const { data: countsData } = usePromoCodeCounts();
  // ВАЖНО: бек возвращает { stats: PromoCodeCounts }, не { counts: ... }.
  // Раньше обращались к countsData?.counts → undefined → прочерки в табах.
  const counts = countsData?.stats;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  const handleSetStatus = (status: string) => {
    setStatusFilter(status);
    setPage(1);
    // Очистка поиска при смене таба — поиск и статус независимы.
    setSearch("");
    setDebouncedSearch("");
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setScopeFilter("all");
    setPage(1);
  };

  const hasFilters =
    search !== "" || statusFilter !== "all" || typeFilter !== "all" || scopeFilter !== "all";

  // Если поиск — это число (ID), подсвечиваем карточку с этим ID.
  // Бек уже поднимает точное совпадение по ID на верх выдачи
  // (orderByRaw CASE WHEN id = ? THEN 0 ELSE 1 END).
  const searchedId = useMemo(() => {
    const s = debouncedSearch.trim();
    return s && /^\d+$/.test(s) ? parseInt(s, 10) : null;
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
     
      {/* Stats row + actions */}
      <div className="flex items-center justify-between gap-3">
        
        <PageHeader
          icon={PAGE_ICON}
          title={PAGE_TITLE}
          description={PAGE_DESCRIPTION}
          onBack={() => router.back()}
          // onRefresh={refetch}
          // isFetching={isFetching}
        />

        <div className="flex gap-6 flex-wrap text-sm">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs uppercase">Всего кодов</span>
            <span className="font-bold tabular-nums">{counts?.total ?? "—"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs uppercase">Активных</span>
            <span className="font-bold tabular-nums text-green-600">{counts?.active ?? "—"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs uppercase">Использований</span>
            <span className="font-bold tabular-nums">{counts?.total_usages ?? "—"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs uppercase">Всего скидки ₽</span>
            <span className="font-bold tabular-nums">{counts?.total_discount?.toFixed(0) ?? "—"}</span>
          </div>
        </div>        
      </div>    

      <div className="flex justify-between items-center gap-4">
        {/* Фильтры: РЯД 1 — status tabs (отдельной строкой, не перегружено). */}
      <StatusTabs
        tabs={STATUS_TABS}
        value={statusFilter}
        onChange={handleSetStatus}
        getCount={(v) => v === "all"
          ? (counts?.total ?? null)
          : (counts as Record<string, number | undefined> | undefined)?.[v]}
      />

          <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Bulk генерация
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Создать промокод
          </Button>
        </div>
      </div>
      

      {/* Фильтры: РЯД 2 — type + scope dropdowns + search (в одну строку). */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={typeFilter}
            onValueChange={(v: string | null) => {
              setTypeFilter(v ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              {TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label}
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={scopeFilter}
            onValueChange={(v: string | null) => {
              setScopeFilter(v ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-60">
              {SCOPE_OPTIONS.find((o) => o.value === scopeFilter)?.label}
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Код или ID..."
        />
      </div>

      {/* Список */}
      {isFirstLoad ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загрузка...
        </div>
      ) : showEmpty ? (      
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground animate-in fade-in duration-300">
          <Inbox className="w-16 h-16 opacity-25" />
          <p className="text-sm font-medium">
            {hasFilters ? "Ничего не найдено" : "Промокодов пока нет"}
          </p>
          <p className="text-sm">
            {hasFilters
              ? "Попробуйте изменить условия поиска или сбросить фильтры."
              : "Создайте первый промокод или сгенерируйте пачку."
            }
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2">
              Сбросить фильтры
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((p) => (
            <PromoCodeCard
              key={p.id}
              promo={p}
              highlight={searchedId !== null && p.id === searchedId}
              onView={() => router.push(`/finance/promo-codes/${p.id}`)}
              onEdit={(promo) => {
                setEditPromo(promo);
                setCreateOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Пагинация */}
      {meta && meta.last_page > 1 && (
        <ListPagination
          currentPage={meta.current_page}
          lastPage={meta.last_page}
          from={meta.from}
          to={meta.to}
          total={meta.total}
          onChangePage={setPage}
          disabled={isFetching}
        />
      )}

      {/* Модалки */}
      <CreateModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditPromo(null);
        }}
        editPromo={editPromo}
      />
      <BulkGenerateModal open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}
