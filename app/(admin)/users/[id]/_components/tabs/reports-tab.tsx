"use client";

// app/(admin)/users/[id]/_components/tabs/reports-tab.tsx
//
// Таб «Жалобы»: две колонки — жалобы, которые ПОЛЬЗОВАТЕЛЬ подал,
// и жалобы, поданные НА НЕГО. Пагинация обеих живёт в URL
// (?made_page=N&received_page=N).
//
// ВАЖНО про импорты (исправлено в ЧАСТИ 3.5):
//   - тип пагинатора — конкретный ReportsPaginated (НЕ дженерик
//     Paginated<T>, которого в репо не существует)
//   - timeAgo → formatRelativeTime из @/lib/format (timeAgo нет в репо)
//
// URL-стейт (сделано в ЧАСТИ 4): ручной useRouter + useSearchParams +
// new URLSearchParams + router.replace заменён на useTabUrl + parsePageParam —
// ровно тот паттерн, для которого хук и создавался (см. его header-comment).
// Имена параметров (made_page / received_page) и поведение сохранены.

import Link from "next/link";
import { Flag, AlertOctagon, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { UserBadge } from "@/components/admin/user-badge";
import { MiniPagination } from "@/components/admin/mini-pagination";
import { TabLoading, TabError } from "@/components/admin/tab-states";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";
import { useUserReports } from "@/hooks/admin/use-users";
import {
  getReportReason,
  getReportResolution,
  getReportStatus,
} from "@/lib/reports";
import type { ReportListItem, ReportsPaginated } from "@/lib/api/users";

interface ReportsTabProps {
  userId: number;
}

export function ReportsTab({ userId }: ReportsTabProps) {
  const basePath = `/users/${userId}/reports`;
  const { searchParams, replace } = useTabUrl(basePath);

  const madePage = parsePageParam(searchParams, "made_page");
  const receivedPage = parsePageParam(searchParams, "received_page");

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useUserReports(userId, { made_page: madePage, received_page: receivedPage });

  if (isLoading) {
    return <TabLoading label="Загрузка жалоб..." />;
  }

  if (isError) {
    return <TabError label="Не удалось загрузить жалобы" onRetry={refetch} />;
  }

  if (!data) {
    return <TabLoading label="Загрузка жалоб..." />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ReportsColumn
        title="Пожаловался на"
        icon={Flag}
        iconColor="text-blue-500"
        paginator={data.made}
        onChangePage={(p) =>
          replace((params) => (p <= 1 ? params.delete("made_page") : params.set("made_page", String(p))))
        }
        emptyText="Пользователь не подавал жалоб."
      />

      <ReportsColumn
        title="Жалобы на пользователя"
        icon={AlertOctagon}
        iconColor="text-destructive"
        paginator={data.received}
        onChangePage={(p) =>
          replace((params) =>
            p <= 1 ? params.delete("received_page") : params.set("received_page", String(p)),
          )
        }
        emptyText="Жалоб на пользователя не поступало."
      />
    </div>
  );
}

// ============================================
// КОЛОНКА ЖАЛОБ
// ============================================

function ReportsColumn({
  title,
  icon: Icon,
  iconColor,
  paginator,
  onChangePage,
  emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  paginator: ReportsPaginated;
  onChangePage: (page: number) => void;
  emptyText: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {title} ({paginator.total})
      </h3>

      {paginator.data.length === 0 ? (
        <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginator.data.map((report) => (
              <ReportRow key={report.id} report={report} />
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
// СТРОКА ЖАЛОБЫ
// ============================================

function ReportRow({ report }: { report: ReportListItem }) {
  const reason = getReportReason(report.reason);
  const status = getReportStatus(report.status);
  const resolution = getReportResolution(report.resolution);

  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      {/* Шапка: ID + дата + тип объекта */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/moderation/reports?q=${report.id}`}
          className="text-xs font-mono text-blue-500 hover:underline"
          title="Найти в общей очереди"
        >
          #{report.id}
        </Link>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {report.reportable_type && (
            <Badge variant="outline" className="text-[10px]">
              {report.reportable_type}
            </Badge>
          )}
          {report.created_at && (
            <span title={formatDateTime(report.created_at)}>
              {formatRelativeTime(report.created_at)}
            </span>
          )}
        </div>
      </div>

      {/* Связанный юзер (жалобщик или нарушитель — зависит от колонки) */}
      {report.user ? (
        <Link href={`/users/${report.user.id}`} className="block hover:opacity-80 transition-opacity">
          <UserBadge user={report.user} size="sm" />
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground italic">Удалён / Аноним</span>
        </div>
      )}

      {/* Причина + статус + резолюция */}
      <div className="flex flex-wrap items-center gap-1.5">
        {reason && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${reason.color}`}
            title={report.description ?? undefined}
          >
            {reason.label}
          </span>
        )}

        {status && (
          <Badge variant={status.badgeVariant} className="text-[10px]">
            {status.label}
          </Badge>
        )}

        {resolution && (
          <span className={`text-[10px] ${resolution.color}`}>
            Решение: {resolution.label}
          </span>
        )}
      </div>

      {/* Описание */}
      {report.description && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">
          «{report.description}»
        </p>
      )}

      {/* Админ, который разбирал */}
      {report.admin && (
        <div className="text-[10px] text-muted-foreground">
          Разобрал: <span className="text-foreground">{report.admin.name}</span>
        </div>
      )}
    </div>
  );
}
