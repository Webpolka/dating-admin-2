"use client";

// app/(admin)/users/[id]/_components/tabs/admin-logs-tab.tsx
//
// Таб «Действия админов»: журнал AdminLog по этому пользователю — кто из
// сотрудников и что делал с юзером (баны, правки профиля, финансы...).
//
// Per-user листинг: GET /admin/users/{userId}/admin-logs?page=
// (UserListingsController::adminLogs). В отличие от глобального журнала
// /system/admin-log, здесь не нужен object_type/object_url — контекст и так
// «действия над этим юзером», зато meta (title/icon/iconColor/badge) приходит
// готовым с бэка (AdminLogMeta::get — зеркалятся в UserAdminLogItem.meta).
//
// Зеркало blade-эталона: вертикальный таймлайн как в events-tab (точка-круг
// с иконкой meta.icon + класс meta.iconColor), заголовок meta.title, бейдж
// meta.badge, моно-бейдж raw action, автор (admin | null → «Система»), IP,
// дата. <details>-аккордеон раскрывает дифф before/after (JSON, как в
// /system/admin-log).
//
// ИСТОРИЯ ФИКСОВ: файл по ошибке содержал копию auth-logs-tab (экспортировал
// AuthLogsTab вместо AdminLogsTab), из-за чего admin-logs/page.tsx падал с
// TS2305 no exported member. Таб восстановлен по типам lib/api/users.ts
// (UserAdminLogsResponse + хук useUserAdminLogs).

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, Ban, BookOpen, Cake, CheckCircle2, ChevronRight,
  Circle, Crown, DollarSign, Edit, FileText, Flag, Globe2, Headphones,
  Image as ImageIcon, Layers, LifeBuoy, LogIn, LogOut, Megaphone,
  MessageCircle, MessageSquare, Newspaper, Settings2, Shield, ShieldAlert,
  ShieldCheck, Star, Undo2, Unlock, User, UserCog, Users, Wallet, XCircle,
  type LucideProps,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MiniPagination } from "@/components/admin/mini-pagination";
import { TabError, TabLoading } from "@/components/admin/tab-states";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";
import { useUserAdminLogs } from "@/hooks/admin/use-users";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { UserAdminLogItem } from "@/lib/api/users";

interface AdminLogsTabProps {
  userId: number;
}

/**
 * Мапа: имя иконки (строкой из AdminLogMeta::get()['icon']) → компонент lucide.
 *
 * Бэк отдаёт имена в kebab-case; набор расширен иконками категорий глобального
 * журнала /system/admin-log (user/photo/diary/transaction/...) и иконками
 * user_events (crown/star/cake/...). Для неизвестных имён — Circle
 * (default AdminLogMeta, см. комментарий в events-tab.tsx).
 *
 * ВАЖНО: иконку берём прямым обращением к ICON_MAP[...], без функции-обёртки —
 * вызов функции в рендере, возвращающей компонент, линтер считает «созданием
 * компонента в рендере» (react-hooks/static-components), а обращение к
 * элементу модульной константы стабильно и проходит линт.
 */
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  // действия над юзером/профилем
  user:            User,
  "user-cog":      UserCog,
  users:           Users,
  shield:          Shield,
  "shield-check":  ShieldCheck,
  "shield-x":      ShieldCheck,
  "shield-alert":  ShieldAlert,
  ban:             Ban,
  unlock:          Unlock,
  "undo-2":        Undo2,
  "x-circle":      XCircle,
  "alert-triangle": AlertTriangle,
  flag:            Flag,
  // контент
  image:            ImageIcon,
  edit:             Edit,
  "file-text":      FileText,
  newspaper:        Newspaper,
  "book-open":      BookOpen,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  // финансы
  wallet:          Wallet,
  "dollar-sign":   DollarSign,
  // система
  settings:        Settings2,
  globe:           Globe2,
  lifebuoy:        LifeBuoy,
  layers:          Layers,
  megaphone:       Megaphone,
  headphones:      Headphones,
  "log-in":        LogIn,
  "log-out":       LogOut,
  // имена в стиле user_events (shared enum-нейминг бэка)
  crown:           Crown,
  star:            Star,
  "check-circle":  CheckCircle2,
  cake:            Cake,
  activity:        Activity,
  // default AdminLogMeta
  circle:          Circle,
};

/** Разрешённые варианты Badge (зеркало badgeVariants из ui/badge.tsx). */
const BADGE_VARIANTS = [
  "default", "secondary", "destructive", "outline",
  "ghost", "link", "warning", "success",
] as const;

/** Бэк присылает variant строкой — валидируем, мусор → secondary. */
function toBadgeVariant(variant: string): (typeof BADGE_VARIANTS)[number] {
  return (BADGE_VARIANTS as readonly string[]).includes(variant)
    ? (variant as (typeof BADGE_VARIANTS)[number])
    : "secondary";
}

export function AdminLogsTab({ userId }: AdminLogsTabProps) {
  const basePath = `/users/${userId}/admin-logs`;
  const { searchParams, replace } = useTabUrl(basePath);

  const page = parsePageParam(searchParams);

  const { data, isLoading, isError, refetch } = useUserAdminLogs(userId, { page });

  // Порядок гардов важен: сначала isLoading/isError, и только потом !data
  // (комбинированный guard съедал ошибку — см. tab-states.tsx).
  if (isLoading) return <TabLoading label="Загрузка журнала действий..." />;
  if (isError) return <TabError label="Не удалось загрузить журнал действий" onRetry={refetch} />;
  if (!data) return <TabLoading label="Загрузка журнала действий..." />;

  const logs = data.data;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" /> Все действия над пользователем: &nbsp; {data.total}
      </h3>

      {logs.length === 0 ? (
        <div className="p-4 bg-muted/20 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
          Над этим пользователем ещё не выполнялось действий из админки.
        </div>
      ) : (
        // Вертикальный таймлайн: псевдо-линия через before:absolute по левому краю.
        <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {logs.map((log) => (
            <AdminLogRow key={log.id} log={log} />
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
        <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
        <Link
          href="/system/admin-log"
          className="hover:text-foreground underline underline-offset-2"
        >
          Полный журнал действий — в разделе «Система → Журнал действий»
        </Link>
      </div>
    </div>
  );
}

// ============================================
// СТРОКА ТАЙМЛАЙНА (точка + заголовок + автор + дифф before/after)
// ============================================

function AdminLogRow({ log }: { log: UserAdminLogItem }) {
  const [expanded, setExpanded] = useState(false);
  // Прямой lookup в модульной мапе (не через функцию) — иначе линтер ругается
  // на «создание компонента в рендере», см. комментарий у ICON_MAP.
  const Icon = ICON_MAP[log.meta.icon] ?? Circle;
  const hasDiff = Boolean(
    (log.before && Object.keys(log.before).length > 0) ||
      (log.after && Object.keys(log.after).length > 0),
  );

  return (
    <div className="flex gap-4 items-start relative">
      {/* Точка таймлайна: круг с иконкой (поверх линии) */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 ${log.meta.iconColor}`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Содержимое */}
      <div className="flex-1 pt-1 min-w-0 space-y-2">
        {/* Заголовок + бейдж действия + raw action + дата */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-sm font-medium truncate">{log.meta.title}</span>
            <Badge variant={toBadgeVariant(log.meta.badge.variant)} className="text-xs px-1.5 py-0">
              {log.meta.badge.label}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
              {log.action}
            </span>
          </div>
          <span            
            className="text-xs text-muted-foreground whitespace-nowrap"
            title={log.created_at ? formatDateTime(log.created_at) : undefined}
          >
            {log.created_at ? formatRelativeTime(log.created_at) : "—"}
          </span>
        </div>

        {/* Автор + IP */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            {log.admin ? (
              <Link
                href={`/users/${log.admin.id}`}
                className="font-medium text-foreground hover:text-primary"
                title={log.admin.email}
              >
                {log.admin.name}
              </Link>
            ) : (
              <span className="italic">Система</span>
            )}
          </span>
          {log.ip_address && (
            <span className="font-mono" title="IP действия">
              {log.ip_address}
            </span>
          )}
        </div>

        {/* Дифф before/after (аккордеон, как в events-tab и /system/admin-log) */}
        {hasDiff && (
          <details
            open={expanded}
            onToggle={(e) => setExpanded((e.currentTarget as HTMLDetailsElement).open)}
            className="group mt-2"
          >
            <summary className="cursor-pointer text-xs text-blue-500 hover:underline flex items-center gap-1 select-none list-none">
              <ChevronRight
                className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              />
              Показать изменения
            </summary>
            <div className="mt-2 bg-muted/20 border border-border rounded-md p-3 space-y-2">
              {log.before && (
                <div className="text-xs">
                  <span className="text-red-500 font-bold">BEFORE:</span>
                  <pre className="text-muted-foreground whitespace-pre-wrap font-mono mt-1 break-all">
                    {JSON.stringify(log.before, null, 2)}
                  </pre>
                </div>
              )}
              {log.after && (
                <div className="text-xs">
                  <span className="text-green-500 font-bold">AFTER:</span>
                  <pre className="text-muted-foreground whitespace-pre-wrap font-mono mt-1 break-all">
                    {JSON.stringify(log.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
} 