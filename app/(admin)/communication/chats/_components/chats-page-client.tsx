// app/(admin)/communication/chats/_components/chats-page-client.tsx
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { useChatsList } from "@/hooks/admin/use-chats";
import { ChatList } from "./chat-list";
import { ChatDetailPanel, ChatDetailEmpty } from "./chat-detail-panel";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { buildUrl } from "@/lib/url-params";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PER_PAGE = 20;

// ============================================================
// Главная страница: список чатов слева + переписка справа
// ============================================================
export function ChatsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Инициализация из URL — ?q=N (поиск или ссылка из журнала),
  // ?lock=locked|unlocked, ?page=N.
  const initialSearch = searchParams.get("q") ?? "";

  const [search, setSearch] = useState(initialSearch);
  const [lockFilter, setLockFilter] = useState(searchParams.get("lock") ?? "all");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  const activeListItemRef = useRef<HTMLDivElement>(null);

  // --- Sync URL ---
  // activeChatId хранится только в React state, не в URL — это позволяет
  // ссылке из журнала ?q=16 оставаться чистой без дублирования.
  // buildUrl не оставляет голый «?», когда фильтров нет.
  useEffect(() => {
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        lock: lockFilter !== "all" ? lockFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, lockFilter, page, router, pathname]);

  // --- Debounce: сброс страницы и фильтра блокировки при новом запросе ---
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      // Если юзер вводит текст — снимаем фильтр блокировки,
      // иначе может ничего не найтись (искомый чат может быть в locked).
      if (search !== "") {
        setLockFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Поиск с debounce (400мс): мгновенный сброс на пустой строке.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // --- Запрос списка чатов ---
  const { data, isLoading, isFetching, isError, refetch } = useChatsList({
    q: debouncedSearch,
    lock: lockFilter,
    page,
    per_page: PER_PAGE,
  });

  const queryClient = useQueryClient();

  const items = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const counts = data?.counts;

  const isFirstLoad = isLoading && !data;
  const showEmpty = !isLoading && !isFetching && items.length === 0;

  // --- Авто-выбор чата при поиске по ID ---
  const isIdSearch = debouncedSearch !== "" && /^\d+$/.test(debouncedSearch);
  const searchedId = isIdSearch ? parseInt(debouncedSearch, 10) : null;

  useEffect(() => {
    if (searchedId && items.length > 0) {
      const match = items.find((c) => c.id === searchedId);
      if (match && match.id !== activeChatId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация search→select
        setActiveChatId(match.id);
      }
    }
  }, [searchedId, items, activeChatId]);

  // --- Скролл к активному чату в списке ---
  useEffect(() => {
    if (activeListItemRef.current) {
      activeListItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeChatId]);

  // --- Handlers ---
  const handleSelectChat = (chatId: number) => setActiveChatId(chatId);

  const handleSetLockFilter = (filter: string) => {
    // Пустой поиск применяется мгновенно (useDebouncedValue без задержки),
    // поэтому старый запрос не «доедет» до API после смены фильтра.
    setLockFilter(filter);
    setSearch("");
    setPage(1);
    setActiveChatId(null);
  };

  const handleClearSearch = () => {
    setSearch("");
    setActiveChatId(null);
    setPage(1);
  };

  const handleRefresh = useCallback(async () => {
    // Принудительно перезапрашиваем список (минуя staleTime)
    // и инвалидируем детали активного чата — чтобы подхватить новые сообщения.
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["admin", "chats", "detail"] }),
    ]);
  }, [refetch, queryClient]);

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={MessageCircle}
        title="Чаты пользователей"
        description="Просмотр и модерация переписок"
        onBack={() => router.back()}
        onRefresh={handleRefresh}
        isFetching={isFetching}
        actions={
          <SearchInput
            value={search}
            onChange={(v) => {
              // Крестик очистки — полный сброс поиска (как раньше).
              if (v === "") {
                handleClearSearch();
                return;
              }
              setSearch(v);
            }}
            placeholder="Поиск по имени, id чата..."
            className="w-72"
          />
        }
      />

      {/* Split view: список + переписка */}
      <div className="grid grid-cols-1 lg:grid-cols-[30rem_1fr] gap-6 lg:gap-4 bg-card border border-border rounded-lg p-4 min-h-[calc(100vh-16rem)]">
        <ChatList
          items={items}
          counts={counts}
          page={page}
          lastPage={meta?.last_page ?? 1}
          isFetching={isFetching}
          isError={isError}
          isFirstLoad={isFirstLoad}
          showEmpty={showEmpty}
          activeChatId={activeChatId}
          searchedId={searchedId}
          isIdSearch={isIdSearch}
          lockFilter={lockFilter}
          activeListItemRef={activeListItemRef}
          onSelectChat={handleSelectChat}
          onSetLockFilter={handleSetLockFilter}
          onSetPage={setPage}
          onRetry={refetch}
        />

        {/* Правая панель: переписка */}
        <div className="flex flex-col bg-muted/10 rounded-lg p-4">
          {activeChatId ? (
            <ChatDetailPanel chatId={activeChatId} />
          ) : (
            <ChatDetailEmpty />
          )}
        </div>
      </div>
    </div>
  );
}