// app/(admin)/communication/support/_components/support-chats-page-client.tsx
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getInitialUrlParam, buildUrl } from "@/lib/url-params";
import {
  useSupportChatsList,
  useSupportChatsCounts,
  useStartSupportChatWithUser,
} from "@/hooks/admin/use-support-chats";
import { type SearchUserItem } from "@/hooks/admin/use-search-users";
import { UserSearchInput } from "@/components/admin/user-search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Loader2, Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SupportChatList } from "./support-chat-list";
import { SupportChatDetailPanel, SupportChatDetailEmpty } from "./support-chat-detail-panel";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { type ChatFilter } from "./support-shared";

const PER_PAGE = 20;

// ============================================================
// Главная страница: список тикетов слева + переписка справа
// ============================================================
export function SupportChatsPageClient() {
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("unread");
  const [page, setPage] = useState(1);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [urlInitialized, setUrlInitialized] = useState(false);

  const activeListItemRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialized = useRef(false);

  // Initial URL read (после mount).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setDebouncedSearch(getInitialUrlParam("q"));
    const urlFilter = getInitialUrlParam("filter") as ChatFilter;
    if (urlFilter && ["all", "unread", "active", "archived"].includes(urlFilter)) {
      setFilter(urlFilter);
    }
    const urlPage = parseInt(getInitialUrlParam("page") || "1", 10);
    if (!isNaN(urlPage) && urlPage > 0) setPage(urlPage);
    setUrlInitialized(true);
  }, []);

  // Sync URL — пишем только q, filter, page. buildUrl не оставляет
  // голый «?», когда параметров нет.
  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        filter: filter !== "unread" ? filter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, filter, page, router, pathname, urlInitialized]);

  // Debounce search. Таймер в ref — отменяется мгновенно при смене фильтра.
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      if (search !== "") {
        setFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useSupportChatsList({
    q: debouncedSearch,
    filter,
    page,
    per_page: PER_PAGE,
  });

  const queryClient = useQueryClient();

  const items = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  // Counts — из отдельного query со STABLE queryKey (не зависит от filter/page/q).
  // Раньше брали из data.counts — но data пересоздавалась при смене filter,
  // и counts на момент fetch показывали 0 → скачкообразный UI.
  // Теперь useSupportChatsCounts держит counts стабильно.
  const { data: countsData } = useSupportChatsCounts();
  const counts = countsData;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0 && !isError;

  // Поиск по ID
  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  useEffect(() => {
    if (searchedId && items.length > 0) {
      const match = items.find((c) => c.id === searchedId);
      if (match && match.id !== activeChatId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveChatId(match.id);
      }
    }
  }, [searchedId, items, activeChatId]);

  // Автовыбор первого чата при первичной загрузке
  useEffect(() => {
    if (hasInitialized.current) return;
    if (!data || activeChatId !== null) return;
    if (searchedId !== null) return;

    const unread = items.find((c) => c.staff_unread_count > 0 && !c.is_archived);
    if (unread) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveChatId(unread.id);
      hasInitialized.current = true;
      return;
    }
    const active = items.find((c) => !c.is_archived);
    if (active) {
      setActiveChatId(active.id);
      hasInitialized.current = true;
    }
  }, [data, items, activeChatId, searchedId]);

  useEffect(() => {
    if (activeListItemRef.current) {
      activeListItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeChatId]);

  // --- Handlers ---
  const handleSelectChat = (chatId: number) => setActiveChatId(chatId);

  const handleSetFilter = (newFilter: ChatFilter) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setFilter(newFilter);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
    setActiveChatId(null);
  };

  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  /**
   * Синхронизация фильтра после archive/unarchive.
   *
   * Сценарии:
   *   1. unarchive (chat стал active) на фильтре "archived"
   *      → чат исчезнет из списка архива → панель показывает то, чего нет в фильтре
   *      → переключаемся на "active" (где чат теперь живёт), панель остаётся открытой
   *
   *   2. archive (chat стал archived) на фильтре "active" или "unread"
   *      → чат исчезнет из активных → та же проблема
   *      → переключаемся на "all" (где чат виден независимо от archive status)
   *
   *   3. Совпадающий фильтр (archive на "archived", unarchive на "active"/"unread"/"all")
   *      → чат остаётся в списке → ничего не делаем
   *
   * activeChatId НЕ сбрасываем — панель остаётся открытой, юзер видит результат
   * своего действия. Только фильтр переключается чтобы чат остался видимым в списке.
   *
   * Альтернатива была — сбрасывать activeChatId (панель → empty state). Но это
   * хуже UX: юзер заархивировал и сразу потерял контекст. Лучше переключить фильтр.
   */
  const handleArchiveStatusChange = (_chatId: number, isArchived: boolean) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (isArchived) {
      // archive: chat ушёл в архив. Если текущий фильтр не показывает архивные —
      // переключаемся на "all" (там видны и active, и archived).
      if (filter === "active" || filter === "unread") {
        setFilter("all");
        setSearch("");
        setDebouncedSearch("");
        setPage(1);
      }
      // Если уже на "archived" или "all" — чат остаётся видимым, ничего не делаем.
    } else {
      // unarchive: chat вернулся в active. Если текущий фильтр "archived" —
      // переключаемся на "active" (где чат теперь живёт).
      if (filter === "archived") {
        setFilter("active");
        setSearch("");
        setDebouncedSearch("");
        setPage(1);
      }
      // Если на "active"/"unread"/"all" — чат остаётся видимым, ничего не делаем.
    }
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["admin", "support-chats", "detail"] }),
    ]);
  }, [refetch, queryClient]);

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={LifeBuoy}
        title="Чат поддержки"
        badge={
          <>
            {counts && counts.active > 0 && (
              <Badge>{counts.active} активных</Badge>
            )}
            {counts && counts.unread > 0 && (
              <Badge variant="destructive">{counts.unread} требуют ответа</Badge>
            )}
          </>
        }
        description="Служебный чат администрации"
        onBack={() => router.back()}
        onRefresh={handleRefresh}
        isFetching={isFetching}
        actions={
          <Button size="sm" onClick={() => setShowNewTicketModal(true)}>
            <Plus className="w-4 h-4" /> Написать пользователю
          </Button>
        }
      />

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-card border border-border rounded-lg p-4 min-h-[calc(100vh-16rem)]">
        <SupportChatList
          items={items}
          counts={counts}
          page={page}
          lastPage={meta?.last_page ?? 1}
          isFetching={isFetching}
          isError={isError}
          error={error}
          isFirstLoad={isFirstLoad}
          showEmpty={showEmpty}
          filter={filter}
          activeChatId={activeChatId}
          activeListItemRef={activeListItemRef}
          onSelectChat={handleSelectChat}
          onSetFilter={handleSetFilter}
          onSetPage={setPage}
          onRetry={refetch}
          search={search}
          onSearchChange={setSearch}
          onClearSearch={handleClearSearch}
        />

        <div className="lg:col-span-2 flex flex-col bg-muted/10 rounded-lg p-4 h-[calc(100vh-16rem)] overflow-hidden">
          {activeChatId ? (
            <SupportChatDetailPanel
              chatId={activeChatId}
              onArchiveStatusChange={handleArchiveStatusChange}
            />
          ) : (
            <SupportChatDetailEmpty />
          )}
        </div>
      </div>

      <NewTicketModal
        open={showNewTicketModal}
        onOpenChange={setShowNewTicketModal}
        onStarted={(chatId) => {
          setShowNewTicketModal(false);
          setActiveChatId(chatId);
          setFilter("active");
          setSearch("");
          setDebouncedSearch("");
          setPage(1);
        }}
      />
    </div>
  );
}

// ============================================================
// Модалка "Написать пользователю"
// ============================================================
function NewTicketModal({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (chatId: number) => void;
}) {
  const [selectedUser, setSelectedUser] = useState<SearchUserItem | null>(null);
  const startMutation = useStartSupportChatWithUser();

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedUser(null);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!selectedUser) return;
    startMutation.mutate(selectedUser.id, {
      onSuccess: (data) => {
        onStarted(data.chat_id);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Найти пользователя
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <UserSearchInput
            onSelect={(user) => setSelectedUser(user)}
            selectedUser={selectedUser}
            onClear={() => setSelectedUser(null)}
            disabled={startMutation.isPending}
          />

          {selectedUser && (
            <Button
              onClick={handleConfirm}
              disabled={startMutation.isPending}
              className="w-full"
            >
              {startMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Начать чат с {selectedUser.name}
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Найдите пользователя, чтобы начать чат поддержки.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}