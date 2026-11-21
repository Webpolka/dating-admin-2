"use client";

// app/(admin)/finance/promo-codes/_components/promo-code-card.tsx
//
// Карточка промокода в списке.
//
// UI:
//  - Шапка: код (моно, крупный, copyable) + бейдж типа + бейдж статуса.
//  - Тело: параметры скидки/длительности, даты, лимиты с прогресс-баром
//    used_count/max_uses.
//  - Персональный юзер — null-safe (для общих кодов null).
//  - Действия: Открыть детали, Редактировать, Toggle, Удалить.

import { useState } from "react";
import {
  Ticket, Copy, Check, Pencil, Trash2, Power, User as UserIcon,
  Clock, AlertTriangle, Crown, Gem, Percent, Coins,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useTogglePromoCode,
  useDeletePromoCode,
  type PromoCodeItem,
} from "@/hooks/admin/use-promo-codes";
import { UserBadge } from "@/components/admin/user-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { UserBadgeData } from "@/lib/types";

function StatusBadge({ item }: { item: PromoCodeItem }) {
  if (!item.is_active) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-border bg-muted/30">
        <Power className="w-3 h-3 mr-1" /> Отключен
      </Badge>
    );
  }
  if (item.is_expired) {
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-500/40 bg-yellow-500/10">
        <Clock className="w-3 h-3 mr-1" /> Истёк
      </Badge>
    );
  }
  if (item.is_fully_used) {
    return (
      <Badge variant="outline" className="text-orange-600 border-orange-500/40 bg-orange-500/10">
        <AlertTriangle className="w-3 h-3 mr-1" /> Исчерпан
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-green-600 border-green-500/40 bg-green-500/10">
      <Check className="w-3 h-3 mr-1" /> Активен
    </Badge>
  );
}

function TypeBadge({ type, label }: { type: string; label: string }) {
  const colorClass = (() => {
    switch (type) {
      case "percent": return "text-blue-600 border-blue-500/40 bg-blue-500/10";
      case "fixed": return "text-cyan-600 border-cyan-500/40 bg-cyan-500/10";
      case "premium": return "text-orange-600 border-orange-500/40 bg-orange-500/10";
      case "vip": return "text-purple-600 border-purple-500/40 bg-purple-500/10";
      default: return "text-muted-foreground border-border bg-muted/30";
    }
  })();
  const Icon = type === "percent" ? Percent : type === "fixed" ? Coins : type === "premium" ? Crown : type === "vip" ? Gem : Ticket;
  return (
    <Badge variant="outline" className={colorClass}>
      <Icon className="w-3 h-3 mr-1" /> {label}
    </Badge>
  );
}

function DiscountInfo({ item }: { item: PromoCodeItem }) {
  if (item.gives_free_days) {
    return (
      <span className="font-medium">
        {item.duration_days} дней
      </span>
    );
  }
  if (item.discount_type === "percent") {
    return <span className="font-medium">{item.discount_value}%</span>;
  }
  if (item.discount_type === "fixed") {
    return <span className="font-medium">{item.discount_value} ₽</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

/**
 * Цвет прогресс-бара лимита использований.
 * Пороги как просил брат:
 *  - 0–60% → green (норма, запас есть).
 *  - 60–80% → orange (заканчивается, внимание).
 *  - 80%+ → red (почти исчерпан, срочно).
 */
function getProgressColor(percent: number): string {
  if (percent >= 80) return "bg-red-500";
  if (percent >= 60) return "bg-orange-500";
  return "bg-green-500";
}

export function PromoCodeCard({
  promo,
  onEdit,
  onView,
  highlight = false,
}: {
  promo: PromoCodeItem;
  onEdit: (p: PromoCodeItem) => void;
  onView: (p: PromoCodeItem) => void;
  /** Подсветка карточки (например, найденной по ID в поиске). */
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const toggleMutation = useTogglePromoCode();
  const deleteMutation = useDeletePromoCode();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleDelete = () => {
    // Физическое удаление доступно только для never-used кодов.
    // Использованный промокод нельзя удалить (нарушит FK + финансовую историю):
    // в миграции promo_code_usages FK cascadeOnDelete — все usages удалятся
    // → потеряем snapshot применённых скидок. Поэтому использованный код
    // только деактивируем (через toggle is_active).
    // Кнопка Delete скрыта при used_count > 0 — сюда мы не попадём.
    deleteMutation.mutate({ id: promo.id }, {
      onSuccess: () => setDeleteOpen(false),
    });
  };

  // Прогресс использований (если max_uses задан).
  const usagePercent = promo.max_uses
    ? Math.min(100, Math.round((promo.used_count / promo.max_uses) * 100))
    : null;

  // Для UserBadge в колонке "Назначение" — PromoCodeItem.user не имеет всех
  // полей UserBadgeData (is_online, status, и т.д.). Дополняем defaults —
  // для контекста "кому выдан промокод" онлайн-статус и значки не важны.
  const userBadgeData: UserBadgeData | null = promo.user
    ? {
        id: promo.user.id,
        name: promo.user.name,
        email: promo.user.email,
        avatar_url: promo.user.avatar_url,
        is_online: false,
        status: "active",
        deleted_at: null,
        has_active_premium: false,
        has_active_vip: false,
        is_verified: false,
      }
    : null;

  return (
    <>
    <div
      className={
        "border rounded-lg bg-card p-4 flex flex-col gap-3 shadow-sm transition-all duration-200 " +
        (highlight
          ? "border-primary ring-2 ring-primary/50 scale-[1.02] z-10"
          : "border-border")
      }
    >
      {/* Шапка: код + бейджи */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <code className="font-mono font-bold text-base tracking-wider select-none">
            {promo.code}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            title="Скопировать код"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={promo.discount_type} label={promo.discount_type_label} />
          <StatusBadge item={promo} />
        </div>
      </div>

      {/* Тело: параметры */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-y border-border py-3">
        <div>
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Скидка</div>
          <DiscountInfo item={promo} />
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Использовано</div>
          <div className="font-medium tabular-nums">
            {promo.used_count}
            {promo.max_uses ? ` / ${promo.max_uses}` : " ∞"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Истекает</div>
          <div className="font-medium">
            {promo.expires_at
              ? new Date(promo.expires_at).toLocaleDateString("ru-RU", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                })
              : "∞ бессрочно"}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Назначение</div>
          {promo.is_personal && userBadgeData ? (
            <Link href={`/users/${promo.user!.id}`} className="inline-block hover:opacity-80 transition-opacity">
              <UserBadge user={userBadgeData} />
            </Link>
          ) : promo.is_personal ? (
            <Badge variant="outline" className="text-purple-600 border-purple-500/40 bg-purple-500/10">
              <UserIcon className="w-3 h-3 mr-1" /> Персональный
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground border-border bg-muted/30">
              Для всех
            </Badge>
          )}
        </div>
      </div>

      {/* Прогресс-бар лимита (если max_uses задан).
          Цвета: green <60%, orange 60-80%, red 80%+. */}
      {usagePercent !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Лимит использований</span>
            <span className="tabular-nums">{usagePercent}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={"h-full rounded-full transition-all " + getProgressColor(usagePercent)}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Действия */}
      <div className="flex gap-2 flex-wrap justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(promo)}
        >
          <Ticket className="w-3.5 h-3.5 mr-1.5" />
          Детали ({promo.used_count})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(promo)}
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Изменить
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleMutation.mutate({ id: promo.id })}
          disabled={toggleMutation.isPending}
          title={promo.is_active ? "Деактивировать" : "Активировать"}
        >
          <Power className="w-3.5 h-3.5" />
        </Button>
        {/* Delete — только для never-used кодов (использованный нельзя удалять физически). */}
        {promo.used_count === 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending}
            title="Удалить физически"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>

    {/* Модалка подтверждения удаления */}
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title={`Удалить промокод «${promo.code}»?`}
      description="Код будет удалён физически. Это действие нельзя отменить."
      confirmText="Удалить"
      variant="destructive"
      isLoading={deleteMutation.isPending}
      onConfirm={handleDelete}
    />
    </>
  );
} 