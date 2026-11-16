// app/(admin)/security/fraud-alerts/_components/fraud-alerts-table-client.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useFraudAlertsList,
  useFraudCounts,
  useResolveAndBan,
  useResolveWithWarning,
  useMarkAsFalsePositive,
  type FraudAlertItem,
} from "@/hooks/admin/use-fraud-alerts";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { UserBadge } from "@/components/admin/user-badge";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Siren, X, MoreHorizontal,
  EyeOff, Clock, Gavel, AlertTriangle, ShieldCheck, ChevronDown, UserCheck, Flame,
} from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { buildUrl } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
import { STATUS_FILTERS, SEVERITY_OPTIONS, DEFAULT_STATUS, DEFAULT_SEVERITY, PER_PAGE, SEARCH_DEBOUNCE_MS } from "./fraud-alerts-shared";
import { ListPagination } from "@/components/admin/list-pagination";

export function FraudAlertsTableClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? DEFAULT_STATUS);
  const [severityFilter, setSeverityFilter] = useState(searchParams.get("severity") ?? DEFAULT_SEVERITY);
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  const [confirmAction, setConfirmAction] = useState<{ type: "ban" | "warning" | "false_positive"; alertId: number; banType?: string } | null>(null);
  // Управляемый аккордеон: храним id открытой строки (null = все закрыты)
  // Без <details> — чистый React-state, чтобы CSS Grid-анимация не конфликтовала с нативным поведением браузера
  const [openEvidenceId, setOpenEvidenceId] = useState<number | null>(null);

  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Sync URL — shareable URLs. buildUrl не оставляет голый «?",
  // когда фильтров нет.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== DEFAULT_STATUS ? statusFilter : undefined,
        severity: severityFilter !== DEFAULT_SEVERITY ? severityFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, severityFilter, page, pathname, router]);

  // Поиск: debounce + сброс фильтров/page ВНУТРИ timer.
  //
  // ВАЖНО: все четыре state-обновления (debouncedSearch + page + statusFilter
  // + severityFilter) должны сработать атомарно — внутри одного setTimeout tick.
  //
  // Если разнести их (мгновенно status/severity/page, в timer — debouncedSearch),
  // получится два queryKey change подряд:
  //   1) {q: старый, status: all, severity: all, page: 1} — React Query кидает
  //      запрос с ПРОМЕЖУТОЧНЫМ невалидным состоянием (расширенные фильтры +
  //      старый поиск)
  //   2) {q: новый, status: all, severity: all, page: 1} — финальный запрос
  // Между ними (≈400ms) таблица показывает результаты первого (невалидного)
  // запроса → мелькание «сначала все, потом нужное».
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      // Поиск по ID: искомый алерт может быть в любом статусе/severity,
      // сбрасываем фильтры, чтобы он точно попал в выдачу.
      if (search !== "" && /^\d+$/.test(search)) {
        setStatusFilter("all");
        setSeverityFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useFraudAlertsList({
    q: debouncedSearch,
    status: statusFilter,
    severity: severityFilter,
    page,
    per_page: PER_PAGE,
  });

  // Counts — из отдельного stable query (не зависит от filter/search/page).
  // Раньше брали из data?.counts — скачкообразный UI при смене вкладок.
  const { data: countsData } = useFraudCounts();
  const counts = countsData?.stats;

  const banMutation = useResolveAndBan();
  const warningMutation = useResolveWithWarning();
  const falsePositiveMutation = useMarkAsFalsePositive();

  const items: FraudAlertItem[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  const isHighlightedId = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch)
    ? parseInt(debouncedSearch, 10)
    : null;

  useEffect(() => {
    if (highlightRowRef.current && isHighlightedId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlightedId, items]);

  // Сбрасываем открытый аккордеон при смене фильтров/страницы — чтобы не было зависших раскрытых строк
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenEvidenceId(null);
  }, [debouncedSearch, statusFilter, severityFilter, page]);

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter(DEFAULT_STATUS);
    setSeverityFilter(DEFAULT_SEVERITY);
    setPage(1);
  };

  const hasFilters = search !== "" || statusFilter !== DEFAULT_STATUS || severityFilter !== DEFAULT_SEVERITY;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  const handleConfirm = () => {
    if (!confirmAction) return;

    if (confirmAction.type === "ban") {
      banMutation.mutate({ id: confirmAction.alertId, type: confirmAction.banType || "permanent" });
    } else if (confirmAction.type === "warning") {
      warningMutation.mutate(confirmAction.alertId);
    } else if (confirmAction.type === "false_positive") {
      falsePositiveMutation.mutate(confirmAction.alertId);
    }

    setConfirmAction(null);
  };

  const isMutating = banMutation.isPending || warningMutation.isPending || falsePositiveMutation.isPending;

  const toggleEvidence = (alertId: number) => {
    setOpenEvidenceId((prev) => (prev === alertId ? null : alertId));
  };

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={Siren}
        iconClassName="text-destructive"
        title="Антифрод-мониторинг"
        description={
          <span className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-destructive" />
            Высокий приоритет:
            <span className="text-destructive font-bold tabular-nums">{counts?.high_priority ?? 0}</span>
          </span>
        }
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Фильтр по статусу */}
        <StatusTabs
          tabs={STATUS_FILTERS}
          value={statusFilter as "all" | "open" | "resolved" | "false_positive"}
          onChange={(v) => { setStatusFilter(v); setSearch(""); setPage(1); }}
          getCount={(v) => (counts ? counts[v === "all" ? "total" : v] : undefined)}
        />

        {/* Поиск + кнопка «Сбросить» рядом — интуитивнее, чем в блоке с табами */}
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
              <X className="w-4 h-4" /> Сбросить
            </Button>
          )}

          <Separator orientation="vertical" className="h-6" />

          <Select
            value={severityFilter}
            onValueChange={(v: string | null) => { setSeverityFilter((v ?? DEFAULT_SEVERITY) as typeof severityFilter); setPage(1); }}
          >
            <SelectTrigger className="w-50 h-9">
              {SEVERITY_OPTIONS.find(s => s.value === severityFilter)?.label ?? "Опасность"}
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по имени, email или id..."
          />
        </div>
      </div>

      {/* Таблица */}
      <TableShell isFetching={isFetching}>
        {/*
          table-fixed: ширины берутся из <th>, контент не двигает соседние колонки.
          min-w-220 (880px): фикс. колонки суммарно ~520px, «Триггер» забирает весь
          остаток. На узких экранах таблица скроллится по горизонтали внутри TableShell.
        */}
        <Table className="table-fixed w-full min-w-220">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">ID</TableHead>
              <TableHead className="w-40">Кто нарушил</TableHead>
              <TableHead className="w-100">Триггер</TableHead>
              <TableHead className="w-20">Опасность</TableHead>
              <TableHead className="w-20">Статус</TableHead>
              <TableHead className="w-20">Дата</TableHead>
              <TableHead className="w-20 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={7} />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={7}
                title="Открытых алертов нет. Можно отдохнуть!"
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              items.map((alert, index) => {
                const isHighlighted = alert.id === isHighlightedId;
                const isOpen = alert.is_open;
                const hasMeta = alert.meta && Object.keys(alert.meta as Record<string, unknown>).length > 0;
                const isEvidenceOpen = openEvidenceId === alert.id;
                const alertUser = alert.user;

                return (
                  <TableRow
                    key={alert.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      "border-b border-border transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300",
                      isHighlighted && "bg-primary/10",
                      !isHighlighted && isOpen && alert.severity === "high" && "bg-destructive/5",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell className={cn(
                      "text-xs font-mono whitespace-nowrap tabular-nums align-top pt-3",
                      isHighlighted ? "text-primary font-bold" : "text-muted-foreground",
                    )}>
                      #{alert.id}
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      {alertUser ? (
                        <button onClick={() => router.push(`/users/${alertUser.id}`)} className="block text-left">
                          <UserBadge user={alertUser} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                            D
                          </div>
                          <span className="text-sm text-muted-foreground italic">Аккаунт удален</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Колонка «Триггер»: лейбл + бейдж + «Улики» в одну строку, ниже — плавный Grid-аккордеон */}
                    <TableCell className="align-top pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="font-medium text-sm text-foreground truncate"
                            title={alert.trigger_label}
                          >
                            {alert.trigger_label}
                          </span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm shrink-0 ${alert.trigger_color}`}>
                            {alert.trigger_type}
                          </span>
                        </div>
                        {hasMeta && (
                          <button
                            type="button"
                            onClick={() => toggleEvidence(alert.id)}
                            className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
                            aria-expanded={isEvidenceOpen}
                          >
                            <span>Улики</span>
                            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isEvidenceOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>

                      {/* Плавный CSS-аккордеон на React-стейте: grid-rows 0fr → 1fr интерполируется браузером */}
                      {hasMeta && (
                        <div
                          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                            isEvidenceOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="mt-2 p-3 bg-muted/30 rounded-md border border-border text-xs space-y-1 max-h-70 overflow-y-auto">
                              {Object.entries(alert.meta as Record<string, unknown>).map(([key, val]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="font-mono text-muted-foreground shrink-0">{key}:</span>
                                  <span className="text-foreground font-medium wrap-break-words">
                                    {Array.isArray(val) ? val.join(", ") : String(val)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      <Badge variant={alert.severity_variant as "default" | "secondary" | "destructive" | "warning"}>
                        {alert.severity_label}
                      </Badge>
                    </TableCell>

                    <TableCell className="align-top pt-3">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={alert.status_variant as "default" | "secondary" | "destructive" | "warning" | "success"}>
                          {alert.status_label}
                        </Badge>
                        {alert.admin && (
                          <span className="text-[10px] text-muted-foreground mt-1 truncate" title={alert.admin.name}>
                            {alert.admin.name}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums align-top pt-3">
                      <div>{formatDate(alert.created_at)}</div>
                      <div className="text-[10px] opacity-70">{formatTime(alert.created_at)}</div>
                    </TableCell>

                    <TableCell className="text-right align-top pt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        {/* min-w-64 = 256px (было min-w-42 = 168px), в 1.5 раза шире */}
                        <DropdownMenuContent align="end" className="min-w-64">
                          <DropdownMenuGroup>
                            {isOpen ? (
                              <>
                                <DropdownMenuLabel>Выберите наказание</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {alert.user ? (
                                  <>
                                    <DropdownMenuItem onClick={() => setConfirmAction({ type: "ban", alertId: alert.id, banType: "shadow" })}>
                                      <EyeOff className="w-4 h-4 text-purple-500" /> Теневой бан
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setConfirmAction({ type: "ban", alertId: alert.id, banType: "temp" })}>
                                      <Clock className="w-4 h-4 text-yellow-500" /> Бан на 3 дня
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setConfirmAction({ type: "ban", alertId: alert.id, banType: "permanent" })}>
                                      <Gavel className="w-4 h-4 text-red-500" /> Вечный бан
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setConfirmAction({ type: "warning", alertId: alert.id })}>
                                      <AlertTriangle className="w-4 h-4 text-yellow-500" /> Предупредить в чате
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <DropdownMenuItem onClick={() => setConfirmAction({ type: "ban", alertId: alert.id, banType: "permanent" })}>
                                    <ShieldCheck className="w-4 h-4 text-green-500" /> Закрыть алерт
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setConfirmAction({ type: "false_positive", alertId: alert.id })}>
                                  <ShieldCheck className="w-4 h-4 text-green-500" /> Отметить как ложняк
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuLabel>Алерт закрыт</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {alert.admin && (
                                  <DropdownMenuItem disabled>
                                    <UserCheck className="w-4 h-4" /> Разобрал: {alert.admin.name}
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
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
        currentPage={page}
        lastPage={meta?.last_page ?? 1}
        from={meta?.from ?? null}
        to={meta?.to ?? null}
        total={meta?.total}
        onChangePage={setPage}
        disabled={isFetching}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title="Подтвердите действие"
        description="Вы уверены, что хотите применить это действие к алерту?"
        confirmText="Применить"
        cancelText="Отмена"
        variant={confirmAction?.type === "ban" ? "destructive" : "default"}
        isLoading={isMutating}
        onConfirm={handleConfirm}
      />
    </div>
  );
}