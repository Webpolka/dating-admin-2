"use client";

// app/(admin)/users/[id]/_components/tabs/finances-tab.tsx
//
// Таб «Финансы»: финансовый дашборд пользователя.
//
// Единая система бейджей:
//   Premium → Crown оранжевая (bg-orange-500/15 text-orange-600)
//   VIP     → Gem голубая    (bg-sky-500/15 text-sky-600)
//   Status  → success/destructive/warning/secondary (по Transaction::status)
//
// Структура rows — по шаблону ReportRow: шапка → тело → подвал.

import { useEffect, useState } from "react";
import {
  Wallet, Star, Crown, Gem, Receipt, History, ExternalLink,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { MiniPagination } from "@/components/admin/mini-pagination";
import { TabError, TabLoading } from "@/components/admin/tab-states";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";
import { useUserFinances } from "@/hooks/admin/use-users";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type {
  UserFinancesResponse,
  UserTransactionItem,
  UserSubscriptionItem,
} from "@/lib/api/users";

// ============================================
// ЕДИНАЯ СИСТЕМА TIER-БЕДЖЕЙ
// ============================================
// Premium → Crown оранжевая. VIP → Gem голубая.
// Используется везде: StatusesCard, TransactionRow, SubscriptionRow.

const TIER_META: Record<string, {
  label: string;
  icon: typeof Crown;
  className: string;
}> = {
  premium: {
    label: "Premium",
    icon: Crown,
    className: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  },
  vip: {
    label: "VIP",
    icon: Gem,
    className: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  },
};

/** Tier-бейдж с иконкой — единый компонент для всех мест. */
function TierBadge({ tier, size = "sm" }: { tier: string; size?: "sm" | "xs" }) {
  const meta = TIER_META[tier] ?? TIER_META.premium;
  const Icon = meta.icon;
  const sizeClass = size === "xs" ? "text-xs px-1.5 py-0" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-medium ${sizeClass} ${meta.className}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

interface FinancesTabProps {
  userId: number;
}

export function FinancesTab({ userId }: FinancesTabProps) {
  const basePath = `/users/${userId}/finances`;
  const { searchParams, replace } = useTabUrl(basePath);

  const transPage = parsePageParam(searchParams, "trans_page");
  const subPage = parsePageParam(searchParams, "sub_page");

  const { data, isLoading, isError, refetch } = useUserFinances(userId, {
    trans_page: transPage,
    sub_page: subPage,
  });

  if (isLoading) return <TabLoading label="Загрузка финансов..." />;
  if (isError) return <TabError label="Не удалось загрузить финансы" onRetry={refetch} />;
  if (!data) return <TabLoading label="Загрузка финансов..." />;

  const { balance, statuses, transactions, subscriptions } = data;

  return (
    <div className="space-y-6">
      {/* === ВЕРХНЯЯ ПАНЕЛЬ: Баланс + Статусы === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BalanceCard balance={balance} />
        <StatusesCard statuses={statuses} />
      </div>

      {/* === НИЖНЯЯ ПАНЕЛЬ: Транзакции + Подписки === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Левая колонка: Транзакции */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Все транзакции: &nbsp; {transactions.total}
          </h3>

          {transactions.data.length === 0 ? (
            <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
              Транзакций не найдено.
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.data.map((t) => (
                <TransactionRow key={t.id} t={t} />
              ))}
            </div>
          )}

          <MiniPagination
            currentPage={transactions.current_page}
            lastPage={transactions.last_page}
            from={transactions.from}
            to={transactions.to}
            total={transactions.total}
            onChangePage={(next) =>
              replace((p) => (next <= 1 ? p.delete("trans_page") : p.set("trans_page", String(next))))
            }
          />
        </div>

        {/* Правая колонка: Подписки */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="w-4 h-4" /> Все подписки: &nbsp; {subscriptions.total}
          </h3>

          {subscriptions.data.length === 0 ? (
            <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
              Подписок не найдено.
            </div>
          ) : (
            <div className="space-y-2">
              {subscriptions.data.map((s) => (
                <SubscriptionRow key={s.id} s={s} />
              ))}
            </div>
          )}

          <MiniPagination
            currentPage={subscriptions.current_page}
            lastPage={subscriptions.last_page}
            from={subscriptions.from}
            to={subscriptions.to}
            total={subscriptions.total}
            onChangePage={(next) =>
              replace((p) => (next <= 1 ? p.delete("sub_page") : p.set("sub_page", String(next))))
            }
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <ExternalLink className="w-3.5 h-3.5 inline mr-1" />
        <Link
          href={`/finance/transactions`}
          className="hover:text-foreground underline underline-offset-2"
        >
          Открыть раздел «Финансы → Транзакции» (синхронизация, возвраты)
        </Link>
      </div>
    </div>
  );
}

// ============================================
// КАРТОЧКА БАЛАНСА
// ============================================

function BalanceCard({ balance }: { balance: UserFinancesResponse["balance"] }) {
  return (
    <div className="p-4 bg-muted/20 rounded-lg border border-border h-full flex flex-col justify-center">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        Текущий баланс
      </h3>

      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className="w-10 h-10 text-blue-500" />
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{balance.credits}</span>
            <span className="text-xs text-muted-foreground">Единиц</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Star className="w-10 h-10 text-yellow-500 fill-current" />
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{balance.superlikes_remaining}</span>
            <span className="text-xs text-muted-foreground">Суперлайков</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// КАРТОЧКА СТАТУСОВ (Premium / VIP) — с иконками
// ============================================

function StatusesCard({ statuses }: { statuses: UserFinancesResponse["statuses"] }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  const premiumExpired =
    now > 0 && statuses.premium_expires_at !== null &&
    new Date(statuses.premium_expires_at).getTime() < now;
  const vipExpired =
    now > 0 && statuses.vip_expires_at !== null &&
    new Date(statuses.vip_expires_at).getTime() < now;

  return (
    <div className="p-4 bg-muted/20 rounded-lg border border-border h-full flex flex-col justify-center">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
         Активные статусы
      </h3>

      <div className="flex flex-col gap-3">
        {/* Premium — Crown оранжевая */}
        <div className="flex items-center gap-3">
          {statuses.has_active_premium ? (
            <>
              <TierBadge tier="premium" />
              {statuses.premium_expires_at && (
                <span className="text-xs text-muted-foreground">
                  до {formatDateTime(statuses.premium_expires_at)}
                </span>
              )}
            </>
          ) : premiumExpired ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-md border text-xs px-2 py-0.5 font-medium bg-muted text-muted-foreground border-border opacity-60">
                <Crown className="w-3 h-3" /> Premium истёк
              </span>
              <span className="text-xs text-muted-foreground">
                {statuses.premium_expires_at ? new Date(statuses.premium_expires_at).toLocaleDateString("ru-RU") : ""}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">Premium нет</span>
          )}
        </div>

        {/* VIP — Gem голубая */}
        <div className="flex items-center gap-3">
          {statuses.has_active_vip ? (
            <>
              <TierBadge tier="vip" />
              {statuses.vip_expires_at && (
                <span className="text-xs text-muted-foreground">
                  до {formatDateTime(statuses.vip_expires_at)}
                </span>
              )}
            </>
          ) : vipExpired ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-md border text-xs px-2 py-0.5 font-medium bg-muted text-muted-foreground border-border opacity-60">
                <Gem className="w-3 h-3" /> VIP истёк
              </span>
              <span className="text-xs text-muted-foreground">
                {statuses.vip_expires_at ? new Date(statuses.vip_expires_at).toLocaleDateString("ru-RU") : ""}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">VIP нет</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// СТРОКА ТРАНЗАКЦИИ — по шаблону ReportRow
// ============================================

function TransactionRow({ t }: { t: UserTransactionItem }) {
  let amountColor = "text-foreground";
  switch (t.status) {
    case "success":  amountColor = "text-green-500 font-semibold"; break;
    case "refunded": amountColor = "text-red-500 font-semibold"; break;
    case "failed":   amountColor = "text-muted-foreground/50"; break;
    case "pending":  amountColor = "text-yellow-500"; break;
  }

  const eventDate = t.status === "pending" ? t.created_at : t.updated_at;

  const meta = "meta" in t ? t.meta : undefined;
  const planName =
    meta !== null && typeof meta === "object" &&
    "plan_name" in meta && typeof meta.plan_name === "string"
      ? meta.plan_name : null;

  // Определяем tier по type_badge.label ("VIP" / "Premium") — для иконки.
  const tier = t.type_badge?.label === "VIP" ? "vip" : t.type_badge?.label === "Premium" ? "premium" : null;

  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      {/* Шапка: Transaction #id + дата справа */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link
          href={`/finance/transactions?q=${t.id}`}
          className="font-mono text-blue-500 hover:underline shrink-0"
          title="Открыть в журнале транзакций"
        >
          Transaction #{t.id}
        </Link>
        {eventDate && (
          <span title={formatDateTime(eventDate)} className="ml-auto whitespace-nowrap">
            {formatRelativeTime(eventDate)}
          </span>
        )}
      </div>

      {/* Тело: инфо слева, сумма + статус справа */}
      <div className="flex justify-between items-start gap-3">
        {/* Левая часть: tier badge (с иконкой) + plan name / credits */}
        <div className="min-w-0 space-y-1">
          {t.type === "subscription" && tier ? (
            <>
              <TierBadge tier={tier} size="xs" />
              {planName && (
                <span className="text-xs text-muted-foreground block">{planName}</span>
              )}
            </>
          ) : t.type === "credits" ? (
            <>
              <span className="text-sm font-medium">Покупка кредитов</span>
              <span className="text-xs text-muted-foreground block">{t.credits_amount ?? 0} ед.</span>
            </>
          ) : t.type === "refund" ? (
            <span className="text-sm font-medium text-red-500">Возврат</span>
          ) : (
            <span className="text-sm text-muted-foreground">{t.type}</span>
          )}
        </div>

        {/* Правая часть: сумма + статус */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-sm ${amountColor}`}>{t.formatted_amount}</span>
          <Badge variant={t.status_badge.variant as "default"} className="text-xs px-1.5 py-0">
            {t.status_badge.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================
// СТРОКА ПОДПИСКИ — по шаблону ReportRow
// ============================================

function SubscriptionRow({ s }: { s: UserSubscriptionItem }) {
  const eventDate = s.status === "active" ? s.created_at : s.updated_at;

  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      {/* Шапка: Subscription #id + дата справа */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link
          href={`/finance/subscription-plans?q=${s.plan_id}`}
          className="font-mono text-blue-500 hover:underline shrink-0"
          title="Открыть в управлении тарифами"
        >
          SubscriptionPlan #{s.plan_id}
        </Link>
        {eventDate && (
          <span title={formatDateTime(eventDate)} className="ml-auto whitespace-nowrap">
            {formatRelativeTime(eventDate)}
          </span>
        )}
      </div>

      {/* Тело: tier badge + название слева (одной строкой, без дублирования), статус справа */}
      <div className="flex justify-between items-center gap-3">
        {/* Левая часть: tier badge + название тарифа в одну строку */}
        <div className="flex items-center gap-2 min-w-0">
          <TierBadge tier={s.tier} size="xs" />
          <span className="text-sm font-medium truncate">{s.plan?.name ?? "Тариф удалён"}</span>
        </div>

        {/* Правая часть: статус + авто-продление */}
        <div className="flex items-center gap-2 shrink-0">
          {s.is_auto_renew && (
            <span className="text-xs text-muted-foreground">авто</span>
          )}
          <Badge variant={s.status_badge.variant as "default"} className="text-xs px-1.5 py-0">
            {s.status_badge.label}
          </Badge>
        </div>
      </div>

      {/* Подвал: срок в одну строку + чек справа */}
      <div className="text-xs text-muted-foreground border-t border-border/50 pt-1.5 flex items-center justify-between gap-2">
        <span className="whitespace-nowrap">
          С: {s.starts_at ? formatDateTime(s.starts_at) : "—"}
          {"  —  "}
          По: {s.ends_at ? formatDateTime(s.ends_at) : "—"}
        </span>
        {s.transaction_id && (
          <Link
            href={`/finance/transactions?q=${s.transaction_id}`}
            className="font-mono text-blue-500 hover:underline shrink-0"
            title="Найти чек об оплате"
          >
            Transaction #{s.transaction_id}
          </Link>
        )}
      </div>
    </div>
  );
}
