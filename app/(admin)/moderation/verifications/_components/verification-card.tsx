"use client";

// app/(admin)/moderation/verifications/_components/verification-card.tsx
//
// Карточка одной заявки верификации.
// Используется в обоих режимах (queue и grid) — структура ответа одинаковая,
// отличие только в наборе полей (queue: без moderator; grid: с moderator).
//
// UI:
//  - слева: фото-верификации (кликабельное — PhotoView зум, без отдельной
//    кнопки "открыть оригинал": правая кнопка мыши → "открыть в новой вкладке"
//    работает нативно).
//  - справа: кликабельный UserBadge (ведёт на профиль юзера) + StatusBadge,
//    ниже — аккуратный bordered grid с данными заявки.
//  - Колонка "Модерация": approved → зелёная CheckCircle + дата,
//    rejected → красная XCircle + дата, pending → прочерк.
//  - снизу: кнопки действий (Approve / Reject) — только для pending.

import { CheckCircle, XCircle, Clock, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useApproveVerification,
  getRejectReasonLabel,
  type VerificationItem,
} from "@/hooks/admin/use-verifications";
import { UserBadge } from "@/components/admin/user-badge";

// ============================================================
// Хелперы UI
// ============================================================

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: VerificationItem["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-500/40 bg-yellow-500/10">
        <Clock className="w-3 h-3 mr-1" /> Ожидает
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge variant="outline" className="text-green-600 border-green-500/40 bg-green-500/10">
        <CheckCircle className="w-3 h-3 mr-1" /> Одобрена
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-red-600 border-red-500/40 bg-red-500/10">
      <XCircle className="w-3 h-3 mr-1" /> Отклонена
    </Badge>
  );
}

/**
 * Ячейка данных в bordered grid.
 * label — мелкий серый заголовок сверху.
 * children — значение (выравнивается по левому краю, моно если нужен).
 */
function InfoCell({
  label,
  children,
  className = "",
  highlight = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Подсветка ячейки (для кода верификации — чтобы модератор сразу видел). */
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-2.5 border-border ${highlight ? "bg-primary/5" : ""} ${className}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * Колонка "Модерация":
 *  - approved → зелёная CheckCircle + дата.
 *  - rejected → красная XCircle + дата.
 *  - pending → прочерк (модерации ещё не было).
 */
function ModerationCell({ verification }: { verification: VerificationItem }) {
  if (verification.status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
        <CheckCircle className="w-3.5 h-3.5" />
        <span className="font-medium">{formatDateTime(verification.moderated_at)}</span>
      </span>
    );
  }
  if (verification.status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
        <XCircle className="w-3.5 h-3.5" />
        <span className="font-medium">{formatDateTime(verification.moderated_at)}</span>
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

// ============================================================
// Карточка
// ============================================================

export function VerificationCard({
  verification,
  onReject,
}: {
  verification: VerificationItem;
  onReject: (v: VerificationItem) => void;
}) {
  const approveMutation = useApproveVerification();
  const photo = verification.photo;
  const user = verification.user;
  const isPending = verification.status === "pending";
  const isRejected = verification.status === "rejected";

  return (
    <div className="border border-border rounded-lg bg-card p-4 flex flex-col md:flex-row gap-4">
      {/* Фото верификации — кликабельное (PhotoView zoom) */}
      <div className="md:w-58 shrink-0">
        {photo ? (
          <PhotoProvider>
            <PhotoView src={photo.original_url || photo.large_url || photo.medium_url}>
              <div className="relative aspect-square rounded-md overflow-hidden bg-muted cursor-zoom-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.medium_url || photo.thumb_url}
                  alt="Verification photo"
                  className="w-full h-full object-cover transition-transform hover:scale-[1.02]"
                />
              </div>
            </PhotoView>
          </PhotoProvider>
        ) : (
          <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-muted-foreground text-sm">
            Нет фото
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Шапка: кликабельный UserBadge + StatusBadge */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            {user ? (
              <Link href={`/users/${verification.user_id}`} className="block">
                <UserBadge user={user} />
              </Link>
            ) : (
              <Link
                href={`/users/${verification.user_id}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <UserIcon className="w-4 h-4" /> Юзер #{verification.user_id}
              </Link>
            )}
          </div>
          <StatusBadge status={verification.status} />
        </div>

        {/* Bordered grid данных */}
        <div className="grid grid-cols-2 border border-border rounded-md overflow-hidden bg-card">
          <InfoCell label="ID заявки" className="border-r border-b">
            <span className="font-mono font-bold">#{verification.id}</span>
          </InfoCell>
          <InfoCell label="ID юзера" className="border-b">
            <span className="font-mono">#{verification.user_id}</span>
          </InfoCell>

          {verification.code && (
            <InfoCell
              label="Код верификации"
              className={`border-r ${isRejected ? "border-b" : "border-b"}`}
              highlight
            >
              <span className="font-mono font-bold tracking-[0.2em] text-base">
                {verification.code}
              </span>
            </InfoCell>
          )}
          <InfoCell
            label="Подана"
            className={verification.code ? "border-b" : "border-b border-r"}
          >
            <span className="font-medium">{formatDateTime(verification.created_at)}</span>
          </InfoCell>

          <InfoCell label="Модерация" className="border-r">
            <ModerationCell verification={verification} />
          </InfoCell>
          <InfoCell label="Статус">
            <span className="capitalize">{verification.status}</span>
          </InfoCell>
        </div>

        {/* Причина отклонения — отдельным блоком под grid, только для rejected */}
        {isRejected && verification.reject_reason && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-sm">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-muted-foreground">Причина отклонения:</span>
            <span className="font-medium text-red-600 dark:text-red-400">
              {getRejectReasonLabel(verification.reject_reason)}
            </span>
          </div>
        )}

        {/* Кнопки действий — только для pending */}
        {isPending && (
          <div className="flex gap-2 flex-wrap justify-end mt-auto pt-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onReject(verification)}
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Отклонить
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => approveMutation.mutate({ id: verification.id })}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              Одобрить
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
