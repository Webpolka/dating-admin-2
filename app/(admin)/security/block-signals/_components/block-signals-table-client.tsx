// app/(admin)/security/block-signals/_components/block-signals-table-client.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useBlockSignalsList,
  useBlockSignalCounts,
  useBlockersList,
  useBanBlockSignal,
  type BlockSignalUser,
} from "@/hooks/admin/use-block-signals";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { UserBadge } from "@/components/admin/user-badge";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import {
  TableEmptyRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Users, X, Loader2, MoreHorizontal,
  EyeOff, Clock, Gavel, Eye, Flame, TrendingUp, AlertTriangle,
} from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { buildUrl } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
import { THRESHOLD_OPTIONS, DEFAULT_THRESHOLD, PER_PAGE, SEARCH_DEBOUNCE_MS } from "./block-signals-shared";
import { ListPagination } from "@/components/admin/list-pagination";

export function BlockSignalsTableClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") ?? "");
  const [threshold, setThreshold] = useState(searchParams.get("threshold") ?? DEFAULT_THRESHOLD);
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));

  const [confirmBan, setConfirmBan] = useState<{ userId: number; userName: string; type: "shadow" | "temp" | "permanent" } | null>(null);
  const [blockersModalUserId, setBlockersModalUserId] = useState<number | null>(null);

  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Sync URL — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        threshold: threshold !== DEFAULT_THRESHOLD ? threshold : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, threshold, page, pathname, router]);

  // Поиск: debounce + сброс page/threshold ВНУТРИ timer.
  //
  // ВАЖНО: все три state-обновления (debouncedSearch + page + threshold)
  // должны сработать атомарно — внутри одного setTimeout tick.
  //
  // Если разнести их (мгновенно page/threshold, в timer — debouncedSearch),
  // получится два queryKey change подряд:
  //   1) {q: старый, threshold: новый, page: 1} — React Query кидает запрос
  //      с ПРОМЕЖУТОЧНЫМ невалидным состоянием (новый порог + старый поиск)
  //   2) {q: новый, threshold: новый, page: 1} — финальный запрос
  // Между ними (≈400ms) таблица показывает результаты первого (невалидного)
  // запроса → мелькание «сначала все, потом нужное».
  //
  // В reports это работало мгновенно, потому что statusFilter="all" меняет
  // данные по смыслу в большую сторону (расширяет выдачу), а page в reports
  // не сбрасывается при поиске. Здесь же page→1 + threshold→2 создают
  // реально другой queryKey с неактуальным q.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      // Поиск по ID: если у юзера 1-2 блока, порог 3+ его отсечёт.
      // Меняем порог на 2+ вместе с debouncedSearch — иначе будет
      // "не найдено" на 400ms, потом найдено.
      if (search !== "" && /^\d+$/.test(search)) {
        setThreshold("2");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useBlockSignalsList({
    q: debouncedSearch,
    threshold: parseInt(threshold, 10),
    page,
    per_page: PER_PAGE,
  });

  // Counts — из отдельного stable query (не зависит от threshold/search/page).
  // Раньше брали из data?.counts — скачкообразный UI при смене порога.
  const { data: countsData } = useBlockSignalCounts();
  const counts = countsData?.stats;

  const banMutation = useBanBlockSignal();

  const items: BlockSignalUser[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  // Подсветка: если в поиске введено число — это ID юзера, ищем строку с этим ID
  const isHighlightedId = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch)
    ? parseInt(debouncedSearch, 10)
    : null;

  // Скролл к подсвеченной строке после рендера данных
  useEffect(() => {
    if (highlightRowRef.current && isHighlightedId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlightedId, items]);

  const handleConfirmBan = () => {
    if (!confirmBan) return;
    banMutation.mutate(
      { userId: confirmBan.userId, type: confirmBan.type },
      { onSettled: () => setConfirmBan(null) }
    );
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setThreshold(DEFAULT_THRESHOLD);
    setPage(1);
  };

  const hasFilters = search !== "" || threshold !== DEFAULT_THRESHOLD;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <PageHeader
        icon={Users}
        iconClassName="text-destructive"
        title="Сигналы блокировок"
        badge={<Badge variant="destructive">{counts?.total ?? 0}</Badge>}
        description="Пользователи, получающие больше всего блокировок от других юзеров."
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Показывать заблокированных:</span>
            <Select
              value={threshold}
              onValueChange={(v: string | null) => { setThreshold(v ?? DEFAULT_THRESHOLD); setPage(1); }}
            >
              <SelectTrigger className="w-20 h-9">
                {THRESHOLD_OPTIONS.find(o => o.value === threshold)?.label ?? "3+"}
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">раз</span>
          </div>
        }
      />

      {/* Панель фильтров: бейджи counts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Опасные (≥5 за неделю) — самый высокий приоритет, основной бейдж */}
          <Badge variant="outline" className="gap-1.5 h-9 px-3 border-destructive/30 bg-destructive/5">
            <Flame className="w-4 h-4 text-destructive" />
            <span>Опасных (≥5 / неделя):</span>
            <span className="font-bold text-destructive tabular-nums">{counts?.danger ?? 0}</span>
          </Badge>

          {/* Высокий порог (≥10 всего) */}
          <Badge variant="outline" className="gap-1.5 h-9 px-3">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span>≥10 всего:</span>
            <span className="font-bold text-orange-500 tabular-nums">{counts?.high ?? 0}</span>
          </Badge>

          {/* Средний порог (3-9) — для полноты картины */}
          <Badge variant="outline" className="gap-1.5 h-9 px-3">
            <TrendingUp className="w-4 h-4 text-yellow-500" />
            <span>3–9 всего:</span>
            <span className="font-bold text-yellow-500 tabular-nums">{counts?.medium ?? 0}</span>
          </Badge>
        </div>

        {/* Поиск + кнопка «Сбросить» рядом — интуитивнее, чем в блоке с бейджами */}
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-muted-foreground">
              <X className="w-4 h-4" /> Сбросить
            </Button>
          )}

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по имени, email или id..."
          />
        </div>
      </div>

      {/* Таблица */}
      <TableShell isFetching={isFetching}>
        <Table className="table-fixed w-full min-w-220">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-14">ID</TableHead>
              <TableHead className="w-60">Пользователь</TableHead>
              <TableHead className="w-35 text-center">Всего блокировок</TableHead>
              <TableHead className="w-35 text-center">За 7 дней</TableHead>
              <TableHead className="w-40">Последняя блокировка</TableHead>
              <TableHead className="w-35">Статус</TableHead>
              <TableHead className="w-14 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={7} />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={7}
                title="Нет подозрительных пользователей по заданному фильтру."
                onResetFilters={hasFilters ? handleResetFilters : undefined}
              />
            ) : (
              items.map((user, index) => {
                const isDanger = user.recent_blocks_count >= 5;
                const isBanned = user.status === "banned" || user.status === "shadowbanned";
                const isHighlighted = user.id === isHighlightedId;

                return (
                  <TableRow
                    key={user.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      "border-b border-border transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300",
                      isDanger && "bg-destructive/5",
                      isHighlighted && "bg-primary/10",
                    )}
                    style={staggerStyle(index)}
                  >
                    {/* ID */}
                    <TableCell className={cn(
                      "text-xs font-mono whitespace-nowrap tabular-nums align-top pt-3",
                      isHighlighted ? "text-primary font-bold" : "text-muted-foreground",
                    )}>
                      #{user.id}
                    </TableCell>

                    {/* Пользователь */}
                    <TableCell className="align-top pt-3">
                      <button onClick={() => router.push(`/users/${user.id}`)} className="block text-left">
                        <UserBadge user={user} />
                      </button>
                    </TableCell>

                    {/* Всего блокировок */}
                    <TableCell className="text-center align-top pt-3">
                      <span className={`font-bold text-lg tabular-nums ${
                        user.total_blocks_count >= 10 ? "text-destructive" : "text-foreground"
                      }`}>
                        {user.total_blocks_count}
                      </span>
                    </TableCell>

                    {/* За 7 дней */}
                    <TableCell className="text-center align-top pt-3">
                      {isDanger ? (
                        <Badge variant="destructive" className="gap-1">
                          {user.recent_blocks_count}
                          <Flame className="w-3 h-3" />
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {user.recent_blocks_count}
                        </span>
                      )}
                    </TableCell>

                    {/* Последняя блокировка */}
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums align-top pt-3">
                      {user.last_block_at ? (
                        <>
                          <div>{formatDate(user.last_block_at)}</div>
                          <div className="text-[10px] opacity-70">{formatTime(user.last_block_at)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/60 italic">—</span>
                      )}
                    </TableCell>

                    {/* Статус */}
                    <TableCell className="align-top pt-3">
                      <div className="flex flex-col gap-1">
                        {user.status === "active" && (
                          <Badge variant="success">Активен</Badge>
                        )}
                        {user.status === "banned" && (
                          <Badge variant="destructive">В бане</Badge>
                        )}
                        {user.status === "shadowbanned" && (
                          <Badge variant="warning">Теневой бан</Badge>
                        )}
                        {user.deleted_at && (
                          <Badge variant="secondary">Деактивирован</Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Действия */}
                    <TableCell className="text-right align-top pt-3">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setBlockersModalUserId(user.id)}
                          title="Кто его заблокировал"
                        >
                          <Eye className="w-4 h-4 text-blue-500" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-56">
                            <DropdownMenuGroup>
                              {isBanned ? (
                                <>
                                  <DropdownMenuLabel>Уже забанен</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem disabled>
                                    <Gavel className="w-4 h-4" /> Текущий статус: {user.status}
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuLabel>Забанить</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setConfirmBan({ userId: user.id, userName: user.name, type: "shadow" })}>
                                    <EyeOff className="w-4 h-4 text-purple-500" /> Теневой бан
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setConfirmBan({ userId: user.id, userName: user.name, type: "temp" })}>
                                    <Clock className="w-4 h-4 text-yellow-500" /> Бан на 3 дня
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setConfirmBan({ userId: user.id, userName: user.name, type: "permanent" })}>
                                    <Gavel className="w-4 h-4 text-red-500" /> Вечный бан
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* Модалка: кто заблокировал */}
      <BlockersModal
        userId={blockersModalUserId}
        onClose={() => setBlockersModalUserId(null)}
      />

      {/* Подтверждение бана */}
      <ConfirmDialog
        open={confirmBan !== null}
        onOpenChange={(open) => { if (!open) setConfirmBan(null); }}
        title="Подтвердите действие"
        description={confirmBan ? `Забанить пользователя «${confirmBan.userName}»?` : ""}
        confirmText={confirmBan?.type === "permanent" ? "Вечный бан" : confirmBan?.type === "temp" ? "Бан на 3 дня" : "Теневой бан"}
        cancelText="Отмена"
        variant={confirmBan ? "destructive" : "default"}
        isLoading={banMutation.isPending}
        onConfirm={handleConfirmBan}
      />
    </div>
  );
}

// ============================================================
// Модалка: список заблокировавших юзеров
// ============================================================
function BlockersModal({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const router = useRouter();
  const { data, isLoading } = useBlockersList(userId, !!userId);

  const blockers = data?.data ?? [];

  // Клик по юзеру в модалке → переход на профиль + закрытие модалки
  const handleUserClick = (blockerId: number) => {
    onClose();
    router.push(`/users/${blockerId}`);
  };

  return (
    <Dialog open={userId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Eye className="w-5 h-5 text-blue-500" />
            Кто заблокировал
            {blockers.length > 0 && (
              <Badge variant="secondary" className="ml-1 tabular-nums">{blockers.length}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 overflow-y-auto space-y-2 little-scroll">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : blockers.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Блокировок не найдено.
            </p>
          ) : (
            blockers.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border hover:border-primary/50 transition-colors"
              >
                <button
                  onClick={() => block.blocker && handleUserClick(block.blocker.id)}
                  className="block text-left min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  disabled={!block.blocker}
                  title={block.blocker ? `Открыть профиль: ${block.blocker.name}` : "Аккаунт удален"}
                >
                  {block.blocker ? (
                    <UserBadge user={block.blocker} />
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Аккаунт удален</span>
                  )}
                </button>

                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {block.reason && block.reason_label && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-background ${block.reason_color ?? ""}`}>
                      {block.reason_label}
                    </span>
                  )}
                  {block.created_at && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {formatDate(block.created_at)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
