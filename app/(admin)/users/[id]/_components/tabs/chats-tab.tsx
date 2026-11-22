"use client";

// app/(admin)/users/[id]/_components/tabs/chats-tab.tsx
//
// Таб «Чаты»: приватные чаты с участием пользователя.
//
// Per-user листинг: GET /admin/users/{userId}/chats?page=
// (UserActivityListingsController::chats — composite-строка: partner + participant_state).
//
// Структура строки — по шаблону ReportRow: шапка → тело → подвал.

import { ExternalLink, EyeOff, BellOff, Ban, Lock, MessageCircle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { MiniPagination } from "@/components/admin/mini-pagination";
import { TabError, TabLoading } from "@/components/admin/tab-states";
import { UserBadge } from "@/components/admin/user-badge";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";
import { useUserChats } from "@/hooks/admin/use-users";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import type { UserBadgeData } from "@/lib/types";
import type { UserChatItem } from "@/lib/api/users";

interface ChatsTabProps {
  userId: number;
}

export function ChatsTab({ userId }: ChatsTabProps) {
  const basePath = `/users/${userId}/chats`;
  const { searchParams, replace } = useTabUrl(basePath);

  const page = parsePageParam(searchParams);

  const { data, isLoading, isError, refetch } = useUserChats(userId, { page });

  if (isLoading) return <TabLoading label="Загрузка чатов..." />;
  if (isError) return <TabError label="Не удалось загрузить чаты" onRetry={refetch} />;
  if (!data) return <TabLoading label="Загрузка чатов..." />;

  const chats = data.data;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MessageCircle className="w-4 h-4" /> Все чаты пользователя: &nbsp; {data.total}
      </h3>

      {chats.length === 0 ? (
        <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
          Пользователь пока не начал ни одного диалога.
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((row) => (
            <ChatRow key={row.participant_id} row={row} userId={userId} />
          ))}
        </div>
      )}

      <MiniPagination
        currentPage={data.current_page}
        lastPage={data.last_page}
        from={data.from}
        to={data.to}
        total={data.total}
        onChangePage={(next) => replace((p) => (next <= 1 ? p.delete("page") : p.set("page", String(next))))}
      />

      <div className="text-xs text-muted-foreground">
        <ExternalLink className="w-3.5 h-3.5 inline mr-1" />
        <Link
          href="/communication/chats"
          className="hover:text-foreground underline underline-offset-2"
        >
          Читать сообщения и управлять чатами в разделе «Чаты»
        </Link>
      </div>
    </div>
  );
}

// ============================================
// СТРОКА ЧАТА — по шаблону ReportRow
// ============================================

function ChatRow({ row, userId }: { row: UserChatItem; userId: number }) {
  const chat = row.chat;
  if (!chat) return null;

  const chatRoute =
    chat.type === "support"
      ? `/communication/support?q=${chat.id}`
      : `/communication/chats?q=${chat.id}`;

  const st = row.participant_state;
  const lastMsg = chat.last_message;

  // Есть ли хоть один статус для подвала.
  const hasStatusBadges =
    st.unread_count > 0 || st.is_hidden || st.is_muted || st.is_blocked || chat.is_locked;

  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      {/* Шапка: Chat #id + type badge + дата справа */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link
          href={chatRoute}
          className="font-mono text-blue-500 hover:underline shrink-0"
          title="Открыть переписку"
        >
          Chat #{chat.id}
        </Link>
        <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">
          {chat.type === "support" ? "Поддержка" : "Приватный"}
        </Badge>
        {chat.last_message_at && (
          <span title={formatDateTime(chat.last_message_at)} className="ml-auto whitespace-nowrap">
            {formatRelativeTime(chat.last_message_at)}
          </span>
        )}
      </div>

      {/* Тело: partner слева, последнее сообщение справа */}
      <div className="flex justify-between items-start gap-3">
        {/* Левая часть: собеседник */}
        <div className="min-w-0">
          {row.partner ? (
            <Link href={`/users/${row.partner.id}`} className="block hover:opacity-80 transition-opacity">
              <UserBadge user={row.partner as UserBadgeData} size="sm" />
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground italic">Собеседник удалён</span>
          )}
        </div>

        {/* Правая часть: последнее сообщение (превью) */}
        <div className="min-w-0 max-w-[200px] shrink-0 text-right">
          {lastMsg ? (
            <p className="text-xs text-muted-foreground italic truncate">
              {lastMsg.type === "system" ? "⚙ Системное" : `"${lastMsg.body}"`}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">Нет сообщений</span>
          )}
        </div>
      </div>

      {/* Подвал: бейджи статусов — только если есть хоть один */}
      {hasStatusBadges && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-1.5">
          {st.unread_count > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">
              {st.unread_count} непроч.
            </Badge>
          )}
          {st.is_hidden && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1" title="Чат скрыт (в архиве)">
              <EyeOff className="w-3 h-3" /> Архив
            </Badge>
          )}
          {st.is_muted && (
            <Badge variant="warning" className="text-xs px-1.5 py-0 gap-1" title="Уведомления отключены">
              <BellOff className="w-3 h-3" /> Мьют
            </Badge>
          )}
          {st.is_blocked && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 gap-1" title="Юзер заблокировал собеседника">
              <Ban className="w-3 h-3" /> Блок
            </Badge>
          )}
          {chat.is_locked && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 gap-1" title="Чат заблокирован администрацией">
              <Lock className="w-3 h-3" /> Заблок.
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
