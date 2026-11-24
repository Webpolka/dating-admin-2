"use client";

// app/(admin)/users/[id]/_components/tabs/promocodes-tab.tsx
//
// Таб «Промокоды»: история применений промокодов пользователем.
//
// Per-user листинг: GET /admin/users/{userId}/promocodes?page=
//
// Колонки таблицы (полная финансовая прозрачность):
//   1. ID — #usage_id
//   2. Код — кликабельная ссылка на detail page промокода
//   3. Тип — DiscountBadge (Crown/Gem/Percent/₽)
//   4. Скидка — значение (50% / 250₽ / 30 дней)
//   5. Исходная — original_amount (из transaction.meta, цена плана ДО скидки)
//   6. Списано — applied_discount ₽ (snapshot на момент применения)
//   7. Итог — transaction.amount ₽ (final, после скидки) или "Бесплатно"
//   8. Дата — created_at

import { Crown, Gem, Percent, Ticket } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MiniPagination } from "@/components/admin/mini-pagination";
import { TableEmptyRow, TableLoadingRow } from "@/components/admin/table-states";
import { TabError } from "@/components/admin/tab-states";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";
import { useUserPromocodes } from "@/hooks/admin/use-users";
import { formatDateTime } from "@/lib/format";
import type { UserPromocodeItem } from "@/lib/api/users";

interface PromocodesTabProps {
  userId: number;
}

export function PromocodesTab({ userId }: PromocodesTabProps) {
  const basePath = `/users/${userId}/promocodes`;
  const { searchParams, replace } = useTabUrl(basePath);

  const page = parsePageParam(searchParams);

  const { data, isLoading, isError, refetch } = useUserPromocodes(userId, { page });

  if (isError) return <TabError label="Не удалось загрузить промокоды" onRetry={refetch} />;

  const usages = data?.data ?? [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Ticket className="w-4 h-4" /> Использованные промокоды: &nbsp; {data?.total ?? 0}
      </h3>

      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table className="w-full min-w-[60rem]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-14">ID</TableHead>
              <TableHead className="w-32">Код</TableHead>
              <TableHead className="w-28">Тип</TableHead>
              <TableHead className="w-24">Скидка</TableHead>
              <TableHead className="w-24">Исходная</TableHead>
              <TableHead className="w-24">Списано</TableHead>
              <TableHead className="w-24">Транзакция</TableHead>
              <TableHead className="w-24">Итог</TableHead>
              <TableHead className="w-32">Дата</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingRow colSpan={9} />
            ) : usages.length === 0 ? (
              <TableEmptyRow colSpan={9} title="Пользователь не использовал промокоды" />
            ) : (
              usages.map((u) => (
                <PromocodeUsageRow key={u.id} u={u} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && (
        <MiniPagination
          currentPage={data.current_page}
          lastPage={data.last_page}
          from={data.from}
          to={data.to}
          total={data.total}
          onChangePage={(next) => replace((p) => (next <= 1 ? p.delete("page") : p.set("page", String(next))))}
        />
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Ticket className="w-3.5 h-3.5" />       
        «Исходная» = цена плана до скидки (из transaction.meta.original_amount). «Списано» = снапшот скидки на момент применения. «Итог» = реально списано (amount после скидки).
        Для Premium/VIP без оплаты — «Бесплатно» (redeem дней).
      </p>
    </div>
  );
}

// ============================================
// СТРОКА ИСПОЛЬЗОВАНИЯ ПРОМОКОДА
// ============================================

function PromocodeUsageRow({ u }: { u: UserPromocodeItem }) {
  // Данные приходят с бека — фронт НЕ вычисляет.
  // original_amount — из бека (transaction.original_amount из meta).
  // Может прийти как number, null ИЛИ undefined (если бек не отдал поле).
  // Поэтому проверяем typeof === 'number', а не !== null.
  const hasTransaction = !!u.transaction;
  const original = hasTransaction ? u.transaction!.original_amount : null;
  // final = transaction.amount (цена ПОСЛЕ скидки).
  const final = hasTransaction ? u.transaction!.amount : null;
  // isRedeem = premium/vip без транзакции (бесплатные дни).
  const isRedeem = !hasTransaction;

  const type = u.promo_code?.discount_type;
  const value = u.promo_code?.discount_value;
  const durationDays = u.promo_code?.duration_days;

  // Текстовое значение скидки для колонки "Скидка".
  const discountText = (() => {
    if (!type || !value) return "—";
    switch (type) {
      case "percent": return `${value}%`;
      case "fixed": return `${value} ₽`;
      case "premium":
      case "vip": return durationDays ? `${durationDays} дн.` : "—";
      default: return "—";
    }
  })();

  return (
    <TableRow>
      {/* 1. ID */}
      <TableCell className="text-xs font-mono text-muted-foreground">
        #{u.id}
      </TableCell>

      {/* 2. Код — кликабельная ссылка */}
      <TableCell>
        {u.promo_code ? (
          <Link
            href={`/finance/promo-codes/${u.promo_code.id}`}
            className="text-sm font-mono font-medium bg-muted px-2 py-0.5 rounded text-blue-500 hover:underline"
            title="Открыть детали промокода"
          >
            {u.promo_code.code}
          </Link>
        ) : (
          <span className="text-sm font-mono text-muted-foreground italic">Код удалён</span>
        )}
      </TableCell>

      {/* 3. Тип — DiscountBadge с иконкой */}
      <TableCell>
        {type ? (
          <DiscountBadge type={type} value={value ?? 0} durationDays={durationDays ?? null} />
        ) : (
          <Badge variant="secondary">Архив</Badge>
        )}
      </TableCell>

      {/* 4. Скидка — значение (50% / 250₽ / 30 дн.) */}
      <TableCell className="text-xs font-medium text-muted-foreground">
        {discountText}
      </TableCell>

      {/* 5. Исходная — цена до скидки (из meta.original_amount) */}
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {typeof original === "number" ? (
          <span className="line-through">{original.toFixed(2)} ₽</span>
        ) : (
          <span className="text-muted-foreground/50 italic">—</span>
        )}
      </TableCell>

      {/* 6. Списано — applied_discount (snapshot) */}
      <TableCell className="text-xs tabular-nums">
        {u.applied_discount > 0 ? (
          <span className="text-red-500 font-medium">−{u.applied_discount.toFixed(2)} ₽</span>
        ) : (
          <span className="text-muted-foreground/50 italic">—</span>
        )}
      </TableCell>

      {/* 7. Транзакция — ID (кликабельная ссылка) */}
      <TableCell className="text-xs text-center">
        {hasTransaction ? (
          <Link
            href={`/finance/transactions?q=${u.transaction!.id}`}
            className="font-mono text-blue-500 hover:underline"
            title={`#${u.transaction!.id} · ${u.transaction!.status}`}
          >
           Transaction #{u.transaction!.id}
          </Link>
        ) : (
          <span className="text-muted-foreground/50 italic">—</span>
        )}
      </TableCell>

      {/* 8. Итог — transaction.amount (final, после скидки) или "Бесплатно" */}
      <TableCell className="text-xs tabular-nums">
        {isRedeem ? (
          <span className="text-green-500 font-medium">Бесплатно</span>
        ) : typeof final === "number" ? (
          <span className="text-green-500 font-medium">{final.toFixed(2)} ₽</span>
        ) : (
          <span className="text-muted-foreground/50 italic">—</span>
        )}
      </TableCell>

      {/* 8. Дата применения */}
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {u.created_at ? formatDateTime(u.created_at) : "—"}
      </TableCell>
    </TableRow>
  );
}

// ============================================
// БЕЙДЖ ТИПА СКИДКИ — единая система Crown/Gem
// ============================================

function DiscountBadge({
  type,
  value,
  durationDays,
}: {
  type: "percent" | "fixed" | "premium" | "vip";
  value: number;
  durationDays: number | null;
}) {
  const tierClass = "inline-flex items-center gap-1 rounded-md border text-xs px-1.5 py-0.5 font-medium w-fit";

  switch (type) {
    case "percent":
      return (
        <span className={`${tierClass} bg-blue-500/15 text-blue-600 border-blue-500/30`}>
          <Percent className="w-3 h-3" /> %
        </span>
      );
    case "fixed":
      return (
        <span className={`${tierClass} bg-cyan-500/15 text-cyan-600 border-cyan-500/30`}>
          ₽
        </span>
      );
    case "premium":
      return (
        <span className={`${tierClass} bg-orange-500/15 text-orange-600 border-orange-500/30`}>
          <Crown className="w-3 h-3" /> Premium
        </span>
      );
    case "vip":
      return (
        <span className={`${tierClass} bg-sky-500/15 text-sky-600 border-sky-500/30`}>
          <Gem className="w-3 h-3" /> VIP
        </span>
      );
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
}
