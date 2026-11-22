"use client";

// app/(admin)/users/[id]/_components/tabs/dating-tab.tsx
//
// Таб «Знакомства»: свайпы и мэтчи пользователя.
//
// Per-user листинг: GET /admin/users/{userId}/dating?swipes_page=&matches_page=
// (UserActivityListingsController::dating, две независимые пагинации).
//
// Структура карточек — по шаблону ReportRow (reports-tab):
// шапка (ID + дата) → тело (юзер + бейджи) → подвал (опционально).

import { Heart, Star, ThumbsDown, Link2, Undo2, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { MiniPagination } from "@/components/admin/mini-pagination";
import { TabError, TabLoading } from "@/components/admin/tab-states";
import { UserBadge } from "@/components/admin/user-badge";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";
import { useUserDating } from "@/hooks/admin/use-users";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import type { UserBadgeData } from "@/lib/types";
import type { MatchItem } from "@/hooks/admin/use-dating";
import type { UserSwipeItem } from "@/lib/api/users";

interface DatingTabProps {
  userId: number;
}

/** Метаданные типа свайпа — иконка + цвет (зеркало SwipeType enum на бэке). */
const SWIPE_META: Record<
  UserSwipeItem["type"],
  { label: string; icon: typeof Heart; className: string }
> = {
  like:      { label: "Лайк",      icon: Heart,      className: "bg-green-500/10 text-green-500" },
  superlike: { label: "Суперлайк", icon: Star,       className: "bg-yellow-500/10 text-yellow-500" },
  dislike:   { label: "Дизлайк",   icon: ThumbsDown, className: "bg-red-500/10 text-red-500" },
};

/** Метаданные статуса мэтча — цвет (зеркало MatchStatus enum на бэке). */
const MATCH_META: Record<MatchItem["status"], { label: string; className: string }> = {
  active:    { label: "Активен",  className: "bg-green-500/10 text-green-500" },
  unmatched: { label: "Разорван", className: "bg-red-500/10 text-red-500" },
};

export function DatingTab({ userId }: DatingTabProps) {
  const basePath = `/users/${userId}/dating`;
  const { searchParams, replace } = useTabUrl(basePath);

  const swipesPage = parsePageParam(searchParams, "swipes_page");
  const matchesPage = parsePageParam(searchParams, "matches_page");

  const { data, isLoading, isError, refetch } = useUserDating(userId, {
    swipes_page: swipesPage,
    matches_page: matchesPage,
  });

  if (isLoading) return <TabLoading label="Загрузка знакомств..." />;
  if (isError) return <TabError label="Не удалось загрузить знакомства" onRetry={refetch} />;
  if (!data) return <TabLoading label="Загрузка знакомств..." />;

  const { swipes, matches } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* === ЛЕВАЯ КОЛОНКА: СВАЙПЫ === */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Heart className="w-4 h-4 text-blue-500" /> Все свайпы пользователя: &nbsp; {swipes.total}
        </h3>

        {swipes.data.length === 0 ? (
          <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
            Пользователь еще никого не оценивал.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {swipes.data.map((s) => {
                const meta = SWIPE_META[s.type] ?? SWIPE_META.dislike;
                const Icon = meta.icon;
                return (
                  <SwipeRow key={s.id} swipe={s} meta={meta} Icon={Icon} />
                );
              })}
            </div>

            <MiniPagination
              currentPage={swipes.current_page}
              lastPage={swipes.last_page}
              from={swipes.from}
              to={swipes.to}
              total={swipes.total}
              onChangePage={(next) =>
                replace((p) => (next <= 1 ? p.delete("swipes_page") : p.set("swipes_page", String(next))))
              }
            />
          </>
        )}
      </div>

      {/* === ПРАВАЯ КОЛОНКА: МЭТЧИ === */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="w-4 h-4 text-destructive" /> Все мэтчи пользователя: &nbsp; {matches.total}
        </h3>

        {matches.data.length === 0 ? (
          <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
            У пользователя нет мэтчей.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {matches.data.map((m) => (
                <MatchRow key={m.id} match={m} userId={userId} />
              ))}
            </div>

            <MiniPagination
              currentPage={matches.current_page}
              lastPage={matches.last_page}
              from={matches.from}
              to={matches.to}
              total={matches.total}
              onChangePage={(next) =>
                replace((p) => (next <= 1 ? p.delete("matches_page") : p.set("matches_page", String(next))))
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// СТРОКА СВАЙПА — по шаблону ReportRow
// ============================================

function SwipeRow({
  swipe,
  meta,
  Icon,
}: {
  swipe: UserSwipeItem;
  meta: { label: string; icon: typeof Heart; className: string };
  Icon: typeof Heart;
}) {
  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      {/* Шапка: Swipe #id + дата справа */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link
          href={`/moderation/dating?mode=swipes&q=${swipe.id}`}
          className="font-mono text-blue-500 hover:underline shrink-0"
          title="Найти в модерации"
        >
          Swipe #{swipe.id}
        </Link>
        {swipe.created_at && (
          <span title={formatDateTime(swipe.created_at)} className="ml-auto whitespace-nowrap">
            {formatRelativeTime(swipe.created_at)}
          </span>
        )}
      </div>

      {/* Тело: UserBadge слева, type badge + rewind справа */}
      <div className="flex justify-between items-start gap-3">
        {/* Левая часть: юзер (кого оценил) */}
        <div className="min-w-0">
          {swipe.targetUser ? (
            <Link href={`/users/${swipe.targetUser.id}`} className="block hover:opacity-80 transition-opacity">
              <UserBadge user={swipe.targetUser as UserBadgeData} size="sm" />
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground italic">Удалён</span>
          )}
        </div>

        {/* Правая часть: тип свайпа + rewind */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${meta.className}`}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
          {swipe.rewinded && (
            <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0">
              <Undo2 className="w-3 h-3" />
              откат
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// СТРОКА МЭТЧА — по шаблону ReportRow
// ============================================

function MatchRow({ match, userId }: { match: MatchItem; userId: number }) {
  // Partner — тот из user1/user2, кто НЕ текущий юзер.
  const partner = match.user1?.id === userId ? match.user2 : match.user1;
  const meta = MATCH_META[match.status] ?? MATCH_META.active;

  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      {/* Шапка: Match #id + дата справа */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link
          href={`/moderation/dating?mode=matches&q=${match.id}`}
          className="font-mono text-blue-500 hover:underline shrink-0"
          title="Найти в модерации"
        >
          Match #{match.id}
        </Link>
        {match.created_at && (
          <span title={formatDateTime(match.created_at)} className="ml-auto whitespace-nowrap">
            {formatRelativeTime(match.created_at)}
          </span>
        )}
      </div>

      {/* Тело: UserBadge слева, status badge справа */}
      <div className="flex justify-between items-start gap-3">
        {/* Левая часть: собеседник */}
        <div className="min-w-0">
          {partner ? (
            <Link href={`/users/${partner.id}`} className="block hover:opacity-80 transition-opacity">
              <UserBadge user={partner as UserBadgeData} size="sm" />
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground italic">Удалён</span>
          )}
        </div>

        {/* Правая часть: статус мэтча */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${meta.className}`}
          >
            <Users className="w-3 h-3" />
            {meta.label}
          </span>
        </div>
      </div>

      {/* Подвал: инфо о разрыве (если unmatched) */}
      {match.status === "unmatched" && match.unmatched_at && (
        <div className="text-xs text-muted-foreground border-t border-border/50 pt-1.5">
          Разорван: {formatRelativeTime(match.unmatched_at)}
        </div>
      )}
    </div>
  );
}
