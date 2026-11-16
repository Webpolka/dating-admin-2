// app/(admin)/system/logs/_components/logs-page-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Layers, Bug, Info, Bell, BellRing, AlertTriangle, XCircle, OctagonAlert, Siren,
  FileText, Loader2, Trash2, X, CalendarIcon,
} from "lucide-react";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs, type StatusTabDef } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { logsApi, type LogEntry, type LogsApiResponse } from "@/lib/api/logs";
import { extractErrorMessage } from "@/lib/api";
import { buildUrl, getInitialUrlParam } from "@/lib/url-params";
import { staggerStyle } from "@/lib/utils";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";


const LOG_LEVELS = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];
type LogLevelFilter = "all" | LogLevel;

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

// Цвета для уровней логов (семантическая палитра: серый=debug, синий=info,
// жёлтый=warning, красный=error и т.д.)
const LEVEL_STYLES: Record<LogLevel, string> = {
  'DEBUG': 'text-gray-500 bg-gray-500/10',
  'INFO': 'text-blue-500 bg-blue-500/10',
  'NOTICE': 'text-purple-500 bg-purple-500/10',
  'WARNING': 'text-yellow-500 bg-yellow-500/10',
  'ERROR': 'text-red-500 bg-red-500/10',
  'CRITICAL': 'text-red-700 bg-red-700/10',
  'ALERT': 'text-orange-500 bg-orange-500/10',
  'EMERGENCY': 'text-red-900 bg-red-900/10',
};

// Иконки табов фильтра уровня (цвета — из той же семантической палитры,
// что и LEVEL_STYLES).
const LEVEL_TAB_ICONS: Record<LogLevel, typeof Bug> = {
  DEBUG: Bug,
  INFO: Info,
  NOTICE: Bell,
  WARNING: AlertTriangle,
  ERROR: XCircle,
  CRITICAL: OctagonAlert,
  ALERT: BellRing,
  EMERGENCY: Siren,
};

const LEVEL_ICON_COLORS: Record<LogLevel, string> = {
  DEBUG: 'text-gray-500',
  INFO: 'text-blue-500',
  NOTICE: 'text-purple-500',
  WARNING: 'text-yellow-500',
  ERROR: 'text-red-500',
  CRITICAL: 'text-red-700',
  ALERT: 'text-orange-500',
  EMERGENCY: 'text-red-900',
};

const LEVEL_TABS: ReadonlyArray<StatusTabDef<LogLevelFilter>> = [
  { value: 'all', label: 'Все', icon: Layers, iconColor: 'text-muted-foreground' },
  ...LOG_LEVELS.map((lvl) => ({
    value: lvl,
    label: lvl,
    icon: LEVEL_TAB_ICONS[lvl],
    iconColor: LEVEL_ICON_COLORS[lvl],
  })),
];

export function LogsPageClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const [urlInitialized, setUrlInitialized] = useState(false);

  // F5: URL-sync.
  useEffect(() => {
    const urlLevel = getInitialUrlParam("level");
     // eslint-disable-next-line react-hooks/set-state-in-effect
    if (urlLevel && isLogLevel(urlLevel)) setLevel(urlLevel);
    setSearch(getInitialUrlParam("q"));
    const urlPage = parseInt(getInitialUrlParam("page") || "1", 10);
    if (!isNaN(urlPage) && urlPage > 0) setPage(urlPage);
    setUrlInitialized(true);
  }, []);

  const dateString = date ? format(date, "yyyy-MM-dd") : "";

  // Sync URL — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(
      buildUrl(pathname, {
        level: level !== 'all' ? level : undefined,
        q: search || undefined,
        date: dateString || undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [level, search, page, dateString, urlInitialized, pathname, router]);

  // F3: debounce 400мс: мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // F2: placeholderData вместо deprecated keepPreviousData.
  const queryResult = useQuery({
    queryKey: ['logs', page, level, debouncedSearch, dateString],
    queryFn: () => logsApi.get({ page, level, search: debouncedSearch, date: dateString }),
    placeholderData: (prev) => prev,
  });

  const data: LogsApiResponse | undefined = queryResult.data;
  const isLoading = queryResult.isLoading;
  const isFetching = queryResult.isFetching;
  const isError = queryResult.isError;
  const error = queryResult.error;

  const clearMutation = useMutation({
    mutationFn: () => logsApi.clear(),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setIsAlertOpen(false);
    },
    // F6: extractErrorMessage.
    onError: (err: unknown) => toast.error(extractErrorMessage(err, "Ошибка при очистке логов")),
  });

  const handleClearFilters = () => {
    setLevel('all');
    setSearch('');
    setDate(undefined);
    setPage(1);
  };

  const hasFilters = level !== 'all' || search !== '' || date !== undefined;

  const lastPage = data?.logs.last_page || 1;
  const currentPage = data?.logs.current_page || 1;

  // F1: убрали console.log.
  const isFirstLoad = isLoading && !data?.logs;
  const isRefetching = isFetching && !isFirstLoad;
  const showEmpty = !isLoading && !isFetching && (!data?.logs?.data || data.logs.data.length === 0) && !isError;

  // from/to в ответе логов Laravel-пагинатор не отдаёт — выводим сами:
  // все страницы, кроме последней, полные, поэтому длина непоследней
  // страницы = per_page, а последняя начинается от total - n + 1.
  const itemsOnPage = data?.logs.data.length ?? 0;
  const from = itemsOnPage > 0
    ? (currentPage < lastPage
        ? (currentPage - 1) * itemsOnPage + 1
        : (data?.logs.total ?? 0) - itemsOnPage + 1)
    : null;
  const to = from !== null ? from + itemsOnPage - 1 : null;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <PageHeader
        icon={FileText}
        title="Системные логи"
        description={`Размер файла: ${data?.log_size || '0 B'}`}
        onBack={() => router.push("/dashboard")}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['logs'] })}
        isFetching={isFetching}
        actions={
          <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogTrigger render={
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" />
                Очистить логи
              </Button>
            }/>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Очистка системных логов</AlertDialogTitle>
                <AlertDialogDescription>
                  Вы уверены? Все логи будут удалены безвозвратно. Это действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40"
                >
                  {clearMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Очищаем...
                    </>
                  ) : (
                    "Очистить"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Уровни с нулевым счётчиком не показываем (как и раньше). */}
        <StatusTabs
          tabs={LEVEL_TABS.filter((t) => t.value === 'all' || (data?.stats.levels[t.value] ?? 0) > 0)}
          value={level as LogLevelFilter}
          onChange={(v) => { setLevel(v); setPage(1); }}
          getCount={(v) => v === 'all' ? (data?.stats.total_entries || 0) : (data?.stats.levels[v] || 0)}
        />

        <div className="flex items-center gap-2 ml-auto">
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" /> Сбросить
            </Button>
          )}

          <Popover>
            <PopoverTrigger render={
              <Button variant="outline" size="sm" className="w-53 justify-between font-normal">
                {date ? format(date, "PPP") : <span className="text-muted-foreground">Выберите дату</span>}
                <CalendarIcon className="w-4 h-4 opacity-50" />
              </Button>
            } />
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { setDate(d); setPage(1); }}
                defaultMonth={date}
              />
            </PopoverContent>
          </Popover>

          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Поиск по тексту..."
          />
        </div>
      </div>

      {/* Таблица с логами */}
      <TableShell isFetching={isRefetching}>
        {/* table-fixed: ширины берутся из <th>, «Сообщение» без ширины
            забирает весь остаток. */}
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Время</TableHead>
              <TableHead className="w-28">Уровень</TableHead>
              <TableHead>Сообщение</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={3} />
            ) : isError ? (
              // F4: отдельная ветка ошибки загрузки.
              <TableErrorRow
                colSpan={3}
                title="Не удалось загрузить логи"
                error={error}
                onRetry={() => queryResult.refetch()}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={3}
                title="Логи не найдены"
                onResetFilters={hasFilters ? handleClearFilters : undefined}
              />
            ) : (
              data?.logs?.data?.map((log: LogEntry, index: number) => {
                  const levelStyle = LEVEL_STYLES[log.level as LogLevel] || 'bg-muted text-muted-foreground';

                  return (
                    <TableRow
                      key={index}
                      className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                      style={staggerStyle(index)}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap align-top py-3 tabular-nums">
                        {log.timestamp}
                      </TableCell>
                      <TableCell className="align-top py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${levelStyle}`}>
                          {log.level}
                        </span>
                      </TableCell>
                      <TableCell className="align-top py-3">
                        <Accordion>
                          <AccordionItem value={`item-${index}`} className="border-0">
                            <AccordionTrigger className="hover:no-underline py-0 text-left w-full">
                              <span className="truncate text-sm flex-1 min-w-0 text-left pr-2">
                                {log.message}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-0">
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all font-mono overflow-x-auto p-2 bg-muted/30 rounded">
                                {log.full}
                              </pre>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </TableCell>
                    </TableRow>
                  );
                })
            )}
          </TableBody>
        </Table>
      </TableShell>

      {/* Пагинация */}
      <ListPagination
        currentPage={currentPage}
        lastPage={lastPage}
        from={from}
        to={to}
        total={data?.logs.total ?? 0}
        onChangePage={setPage}
        disabled={isFetching}
      />
    </div>
  );
}
