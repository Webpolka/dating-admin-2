// app/(admin)/finance/transactions/_components/transactions-page-client.tsx
"use client";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useTransactionsList,
  useSyncTransaction,
  useRefundTransaction,
  type TransactionItem,
  type DatePeriod,
  type TransactionsStats,
} from "@/hooks/admin/use-transactions";
import { UserBadge } from "@/components/admin/user-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { buildUrl } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
import {
  Landmark, Loader2, RefreshCw, Eye, Undo2, TrendingUp,
} from "lucide-react";
import {
  SEARCH_DEBOUNCE_MS, PER_PAGE,
  STATUS_FILTERS, PERIOD_OPTIONS, TYPE_OPTIONS,
} from "./_shared";
import { useTransactionPending } from "@/hooks/admin/use-transactions-pending";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { TransactionDetailModal } from "./transaction-detail-modal";
import { RefundModal } from "./refund-modal";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";

export function TransactionsPageClient() {
  const isFirstSearchRender = useRef(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "all");
  const [dateFilter, setDateFilter] = useState<DatePeriod>(
    (searchParams.get("period") as DatePeriod) ?? "all"
  );
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  const [viewingId, setViewingId] = useState<number | null>(null);
  const [refundTarget, setRefundTarget] = useState<TransactionItem | null>(null);

  const highlightRef = useRef<HTMLTableRowElement>(null);

  // URL-sync фильтров — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        period: dateFilter !== "all" ? dateFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, typeFilter, dateFilter, page, pathname, router]);

  // Debounce поиска + сброс страницы при новом запросе.

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return; // пропускаем маунт
    }
    const t = setTimeout(() => setPage(1), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isFetching, isError, error, refetch } = useTransactionsList({
    q: debouncedSearch || undefined,
    status: statusFilter,
    type: typeFilter,
    period: dateFilter,
    page,
    per_page: PER_PAGE,
  });

  const items: TransactionItem[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const stats = data?.stats;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0 && !isError;

  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  // Авто-scroll к найденной по ID транзакции.
  useEffect(() => {
    if (highlightRef.current && searchedId) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchedId, items]);

  const syncMutation = useSyncTransaction();
  const refundMutation = useRefundTransaction();
  // Pending-стейт для спиннеров sync/refund. Спиннер крутится от клика
  // до WebSocket-события (а не до ответа POST, как раньше) — это даёт
  // админу понимание "процесс идёт" всё время, пока банк думает.
  const syncIds = useTransactionPending((s) => s.syncIds);
  const refundIds = useTransactionPending((s) => s.refundIds);

  const handleSetStatusFilter = (status: string) => {
    setStatusFilter(status);
    setSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDateFilter("all");
    setPage(1);
  };

  const hasFilters = search !== "" || statusFilter !== "all" || typeFilter !== "all" || dateFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={Landmark}
        title="Финансы и транзакции"
        description="История платежей и списаний"
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          <div className="bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-lg border border-emerald-500/20 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm">
              Выручка: <span className="font-bold">{stats?.revenue ?? "0.00"} ₽</span>
            </span>
          </div>
        }
      />

      {/* Фильтры */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((p) => (
              <Button
                key={p.value}
                variant={dateFilter === p.value ? "default" : "secondary"}
                size="sm"
                onClick={() => { setDateFilter(p.value); setSearch(""); setPage(1); }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onValueChange={(v: string | null) => {
                setTypeFilter(v ?? "all");
                setSearch("");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40 h-9">
                {TYPE_OPTIONS.find(o => o.value === typeFilter)?.label ?? "Тип"}
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); if (v === "") setPage(1); }}
              placeholder="ID, Email или ID от банка..."
            />
          </div>
        </div>

        {/* Фильтр по статусу */}
        <StatusTabs
          tabs={STATUS_FILTERS}
          value={statusFilter as "all" | "pending" | "success" | "failed" | "refunded"}
          onChange={handleSetStatusFilter}
          getCount={(v) =>
            stats ? ((stats[v as keyof TransactionsStats] as number) ?? 0) : undefined
          }
        />
      </div>

      {/* Таблица */}
      <TableShell>
        <Table className="table-fixed w-full min-w-250">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-14">ID</TableHead>
              <TableHead className="w-50">Пользователь</TableHead>
              <TableHead className="w-30">Сумма</TableHead>
              <TableHead className="w-25">Тип</TableHead>
              <TableHead className="w-27.5">Статус</TableHead>
              <TableHead className="w-22.5">Провайдер</TableHead>
              <TableHead className="w-22.5">Промокод</TableHead>
              <TableHead className="w-20">Скидка</TableHead>
              <TableHead className="w-20">Дата</TableHead>
              <TableHead className="w-25 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={10} />
            ) : isError ? (
              <TableErrorRow
                colSpan={10}
                title="Не удалось загрузить транзакции"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={10}
                title="Транзакций не найдено"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              items.map((tx, index) => {
                const isHighlighted = tx.id === searchedId;
                const amountSign = tx.status === "refunded" ? "-" : "";
                const txUser = tx.user;

                return (
                  <TableRow
                    key={tx.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={cn(
                      "border-b border-border transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300",
                      isHighlighted && "bg-primary/10",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell className={cn(
                      "text-xs font-mono whitespace-nowrap tabular-nums align-top pt-3",
                      isHighlighted ? "text-primary font-bold" : "text-muted-foreground",
                    )}>
                      #{tx.id}
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      {txUser ? (
                        <button
                          onClick={() => router.push(`/users/${txUser.id}`)}
                          className="block text-left"
                        >
                          <UserBadge user={txUser} size="sm" showEmail={true} />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Юзер удален</span>
                      )}
                    </TableCell>

                    <TableCell className={cn("text-sm whitespace-nowrap align-top pt-3", tx.amount_class)}>
                      {amountSign}{tx.formatted_amount}
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      <Badge
                        variant={tx.type_badge.variant as "default" | "secondary" | "destructive" | "warning" | "outline"}
                        className={tx.type_badge.className}
                      >
                        {tx.type_badge.label}
                      </Badge>
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      <Badge variant={tx.status_badge.variant as "default" | "secondary" | "destructive" | "warning" | "success"}>
                        {tx.status_badge.label}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground uppercase align-top pt-3">
                      {tx.provider ?? "—"}
                    </TableCell>

                    {/* Промокод — ID (кликабельная ссылка) */}
                    <TableCell className="text-xs align-top pt-3">
                      {tx.promo_code_id ? (
                        <Link
                          href={`/finance/promo-codes/${tx.promo_code_id}`}
                          className="font-mono text-blue-500 hover:underline"
                          title={`Промокод #${tx.promo_code_id}`}
                        >
                          PromoCode #{tx.promo_code_id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                  
                    {/* Скидка — применённая скидка в рублях (из meta, не вычисляется) */}
                    <TableCell className="text-sm tabular-nums align-top pt-2">
                      {tx.promo_code_discount && tx.promo_code_discount > 0 ? (
                        <span className="text-red-500 font-medium">
                          −{tx.promo_code_discount} ₽
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap align-top pt-3">
                      {tx.created_at && formatDateTime(tx.created_at)}
                      {tx.updated_at && tx.updated_at !== tx.created_at && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          ↻ {formatDateTime(tx.updated_at)}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right align-top pt-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setViewingId(tx.id)}
                          title="Посмотреть детали"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {tx.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => syncMutation.mutate(tx.id)}
                            // Спиннер крутится пока syncIds.has(tx.id) —
                            // от клика до WebSocket .sync.processed,
                            // а не только пока POST не ответил.
                            disabled={syncIds.has(tx.id)}
                            title="Проверить в банке"
                          >
                            {syncIds.has(tx.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-primary" />
                            )}
                          </Button>
                        )}

                        {tx.status === "success" && tx.type !== "refund" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setRefundTarget(tx)}
                            // Пока возврат в процессе (Job идёт в банк) —
                            // показываем спиннер и блокируем повторный клик.
                            disabled={refundIds.has(tx.id)}
                            title={refundIds.has(tx.id) ? "Возврат в обработке..." : "Оформить возврат"}
                          >
                            {refundIds.has(tx.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                            ) : (
                              <Undo2 className="w-4 h-4 text-destructive" />
                            )}
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

      <ListPagination
        currentPage={page}
        lastPage={meta?.last_page ?? 1}
        from={meta?.from ?? null}
        to={meta?.to ?? null}
        total={meta?.total}
        onChangePage={setPage}
        disabled={isFetching}
      />

      {/* Модалка деталей — вынесена в отдельный файл */}
      <TransactionDetailModal
        transactionId={viewingId}
        onClose={() => setViewingId(null)}
      />

      {/* Модалка возврата — вынесена в отдельный файл */}
      <RefundModal
        transaction={refundTarget}
        onOpenChange={(open) => { if (!open) setRefundTarget(null); }}
        isLoading={refundMutation.isPending}
        onConfirm={(reason, comment) => {
          if (!refundTarget) return;
          // onSuccess вместо onSettled — модалка закрывается только при успехе.
          // При ошибке остаётся открытой, чтобы админ видел сообщение и мог повторить.
          refundMutation.mutate(
            { id: refundTarget.id, reason, comment },
            {
              onSuccess: () => setRefundTarget(null),
            }
          );
        }}
      />
    </div>
  );
}
