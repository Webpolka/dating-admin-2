// app/(admin)/communication/support/_components/support-chat-list.tsx
"use client";

import { type RefObject } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ListPagination } from "@/components/admin/list-pagination";
import { UserBadge } from "@/components/admin/user-badge";
import { StatusTabs } from "@/components/admin/status-tabs";
import { SearchInput } from "@/components/admin/search-input";
import { Loader2 } from "lucide-react";
import type { SupportChatListItem } from "@/hooks/admin/use-support-chats";
import { stripMarkdown } from "@/components/admin/message-content";
import {
  DeletedUserBadge, ErrorState, extractErrorMessageSafe,
  SUPPORT_CHAT_FILTERS, type ChatFilter,
} from "./support-shared";

// ============================================================
// Список тикетов поддержки (левая панель)
// ============================================================
export function SupportChatList({
  items,
  counts,
  page,
  lastPage,
  isFetching,
  isError,
  error,
  isFirstLoad,
  showEmpty,
  filter,
  activeChatId,
  activeListItemRef,
  onSelectChat,
  onSetFilter,
  onSetPage,
  onRetry,
  search,
  onSearchChange,
  onClearSearch,
}: {
  items: SupportChatListItem[];
  counts: { all: number; active: number; unread: number; archived: number } | undefined;
  page: number;
  lastPage: number | undefined;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  isFirstLoad: boolean;
  showEmpty: boolean;
  filter: ChatFilter;
  activeChatId: number | null;
  activeListItemRef: RefObject<HTMLDivElement | null>;
  onSelectChat: (chatId: number) => void;
  onSetFilter: (filter: ChatFilter) => void;
  onSetPage: (page: number | ((p: number) => number)) => void;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
}) {
  return (
    <div className="lg:col-span-1 lg:border-r border-border lg:pr-4 flex flex-col h-[calc(100vh-16rem)]">
      {/* Фильтры */}
      <div className="mb-3 shrink-0">
        <StatusTabs
          tabs={SUPPORT_CHAT_FILTERS}
          value={filter}
          onChange={onSetFilter}
          getCount={(v) =>
            v === "all" ? counts?.all ?? 0
            : v === "unread" ? counts?.unread ?? 0
            : v === "active" ? counts?.active ?? 0
            : counts?.archived ?? 0
          }
        />
      </div>

      {/* Поиск */}
      <SearchInput
        value={search}
        onChange={(v) => {
          // Крестик очистки — полный сброс поиска (как раньше).
          if (v === "") {
            onClearSearch();
            return;
          }
          onSearchChange(v);
        }}
        placeholder="Поиск по имени или id тикета..."
        className="w-full mb-3"
      />

      {/* Список тикетов */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 little-scroll">
        {isFirstLoad ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <ErrorState
            onRetry={onRetry}
            message={extractErrorMessageSafe(error, "Не удалось загрузить тикеты")}
          />
        ) : showEmpty ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {filter === "unread" && <p>Непрочитанных тикетов нет</p>}
            {filter === "archived" && <p>Архив пуст</p>}
            {filter === "active" && <p>Активных тикетов нет</p>}
            {filter === "all" && <p>Тикетов пока нет</p>}
          </div>
        ) : (
          items.map((chat) => {
            const partner = chat.partner;
            const lastMsg = chat.last_message;
            const isActive = chat.id === activeChatId;
            const hasUnread = chat.staff_unread_count > 0;

            return (
              <div
                key={chat.id}
                ref={isActive ? activeListItemRef : undefined}
                onClick={() => onSelectChat(chat.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors relative overflow-hidden border ${
                  isActive
                    ? "border-primary ring-2 ring-primary/50"
                    : hasUnread
                      ? "bg-red-500/5 border-red-500/30 hover:bg-red-500/10"
                      : "bg-muted/30 hover:bg-muted border-transparent"
                }`}
              >
                {hasUnread && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />}

                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {partner ? (
                        <UserBadge user={partner} size="sm" showEmail={true} />
                      ) : (
                        <DeletedUserBadge size="sm" />
                      )}
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      {chat.last_message_at && (
                        <span className={`text-[10px] whitespace-nowrap ${hasUnread ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: false, locale: ru })}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded-sm whitespace-nowrap font-mono">
                        #{chat.id}
                      </span>
                      {hasUnread && (
                        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                          {chat.staff_unread_count}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={`text-xs line-clamp-2 ${hasUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {lastMsg ? (
                      lastMsg.type === "system" ? "Системное сообщение" : stripMarkdown(lastMsg.body ?? "").slice(0, 120)
                    ) : (
                      <span className="italic">Нет сообщений</span>
                    )}
                  </p>

                  {/* Subtle «кто последний раз прочитал» — для прочитанных тикетов.
                      Помогает понять кто из команды уже работал с тикетом. */}
                  {!hasUnread && chat.staff_last_read_by && (
                    <p className="text-[10px] text-muted-foreground/70 truncate italic">
                      Прочитал {chat.staff_last_read_by.name}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Пагинация */}
      {lastPage !== undefined && lastPage > 1 && (
        <div className="shrink-0 pt-4 mt-2 border-t border-border">
          <ListPagination
            currentPage={page}
            lastPage={lastPage}
            onChangePage={onSetPage}
            disabled={isFetching}
          />
        </div>
      )}
    </div>
  );
}