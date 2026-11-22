"use client";

// app/(admin)/users/[id]/_components/tabs/blocks-tab.tsx
//
// Таб «Блокировки»: юзерские блокировки «юзер → юзер» (фича приложения).
// Две колонки: кого заблокировал ПОЛЬЗОВАТЕЛЬ и кто заблокировал ЕГО.
// Пагинация обеих живёт в URL (?blocked_page=N&blockers_page=N).
//
// Причины блокировок — App\Enums\UserBlockReason на бэке
// (spam, insult, creepy, scam, other) — зеркалятся в lib/blocks.ts.
//
// Структура карточки BlockRow — по шаблону ReportRow (reports-tab):
// шапка (ID + дата) → тело (юзер + бейджи) → подвал (действие).

import { useState } from "react";
import Link from "next/link";
import { UserX, ShieldX, Trash2, Loader2, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/admin/user-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { MiniPagination } from "@/components/admin/mini-pagination";
import { TabLoading, TabError } from "@/components/admin/tab-states";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getBlockReason } from "@/lib/blocks";
import type { UserBlockListItem, UserBlocksPaginated } from "@/lib/api/users";
import { useUserBlocks, useUnblockUser } from "@/hooks/admin/use-users";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";

interface BlocksTabProps {
  userId: number;
}

export function BlocksTab({ userId }: BlocksTabProps) {
  const basePath = `/users/${userId}/blocks`;
  const { searchParams, replace } = useTabUrl(basePath);

  const blockedPage = parsePageParam(searchParams, "blocked_page");
  const blockersPage = parsePageParam(searchParams, "blockers_page");

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useUserBlocks(userId, {
    blocked_page: blockedPage,
    blockers_page: blockersPage,
  });

  if (isLoading) {
    return <TabLoading label="Загрузка блокировок..." />;
  }

  if (isError) {
    return <TabError label="Не удалось загрузить блокировки" onRetry={refetch} />;
  }

  if (!data) {
    return <TabLoading label="Загрузка блокировок..." />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <BlocksColumn
        title="Все кого заблокировал пользователь:"
        icon={UserX}
        iconColor="text-blue-500"
        paginator={data.blocked}
        userId={userId}
        onChangePage={(p) =>
          replace((params) =>
            p <= 1 ? params.delete("blocked_page") : params.set("blocked_page", String(p)),
          )
        }
        emptyText="Пользователь никого не блокировал."
      />

      <BlocksColumn
        title="Пользователи которые заблокировали:"
        icon={ShieldX}
        iconColor="text-destructive"
        paginator={data.blockers}
        userId={userId}
        onChangePage={(p) =>
          replace((params) =>
            p <= 1 ? params.delete("blockers_page") : params.set("blockers_page", String(p)),
          )
        }
        emptyText="Пользователя никто не блокировал."
      />
    </div>
  );
}

// ============================================
// КОЛОНКА БЛОКИРОВОК
// ============================================

function BlocksColumn({
  title,
  icon: Icon,
  iconColor,
  paginator,
  userId,
  onChangePage,
  emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  paginator: UserBlocksPaginated;
  userId: number;
  onChangePage: (page: number) => void;
  emptyText: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {title} &nbsp; {paginator.total}
      </h3>

      {paginator.data.length === 0 ? (
        <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginator.data.map((block) => (
              <BlockRow key={block.id} block={block} userId={userId} />
            ))}
          </div>

          <MiniPagination
            currentPage={paginator.current_page}
            lastPage={paginator.last_page}
            from={paginator.from}
            to={paginator.to}
            total={paginator.total}
            onChangePage={onChangePage}
          />
        </>
      )}
    </div>
  );
}

// ============================================
// СТРОКА БЛОКИРОВКИ — по шаблону ReportRow
// ============================================

function BlockRow({ block, userId }: { block: UserBlockListItem; userId: number }) {
  const unblock = useUnblockUser();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reason = getBlockReason(block.reason);

  const handleUnblock = () => {
    unblock.mutate(
      { userId, blockId: block.id },
      { onSettled: () => setConfirmOpen(false) },
    );
  };

  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      {/* Шапка: Block #ID + дата справа */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono text-muted-foreground shrink-0">
          Block #{block.id}
        </span>
        {block.created_at && (
          <span title={formatDateTime(block.created_at)} className="ml-auto whitespace-nowrap">
            Создана: {formatRelativeTime(block.created_at)}
          </span>
        )}
      </div>

      {/* Тело: UserBadge слева, причина badge справа */}
      <div className="flex justify-between items-start gap-3">
        {/* Левая часть: юзер */}
        <div className="min-w-0">
          {block.user ? (
            <Link href={`/users/${block.user.id}`} className="block hover:opacity-80 transition-opacity">
              <UserBadge user={block.user} size="sm" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground italic">Удалён</span>
            </div>
          )}
        </div>

        {/* Правая часть: причина блокировки */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {reason ? (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${reason.color}`}
            >
              {reason.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Причина не указана</span>
          )}
        </div>
      </div>

      {/* Подвал: кнопка принудительного снятия — border-t */}
      <div className="border-t border-border/50 pt-1.5 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={unblock.isPending}
          className="text-destructive hover:text-destructive"
          title="Снять блокировку"
        >
          {unblock.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <Unlock className="w-3.5 h-3.5 mr-1.5" />
          )}
          Снять блокировку
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Снять блокировку?"
        description={
          block.user
            ? `Принудительно разблокировать ${block.user.name}? Обычно это не требуется — блокировки создаются самими пользователями.`
            : "Принудительно снять эту блокировку?"
        }
        confirmText="Снять"
        variant="destructive"
        isLoading={unblock.isPending}
        onConfirm={handleUnblock}
      />
    </div>
  );
}
