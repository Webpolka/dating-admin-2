"use client";

// app/(admin)/finance/promo-codes/[id]/_components/promo-code-detail-client.tsx
//
// Детальный просмотр промокода с историей использований.
// Использует usePromoCodeDetail(id, usagePage) — бек отдаёт usages (текущая
// страница) + aggregate stats (полные, по всем usages).

import { useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Power, Trash2, Copy, Check, Ticket, Lock,
  Crown, Gem, Percent,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { UserBadge } from "@/components/admin/user-badge";
import {
  usePromoCodeDetail,
  useTogglePromoCode,
  useDeletePromoCode,
  getPromoTypeLabel,
  type PromoCodeItem,
} from "@/hooks/admin/use-promo-codes";
import { CreateModal } from "../../_components/create-modal";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ item }: { item: PromoCodeItem }) {
  if (!item.is_active) {
    return <Badge variant="outline" className="text-muted-foreground bg-muted/30">Отключен</Badge>;
  }
  if (item.is_expired) {
    return <Badge variant="outline" className="text-yellow-600 border-yellow-500/40 bg-yellow-500/10">Истёк</Badge>;
  }
  if (item.is_fully_used) {
    return <Badge variant="outline" className="text-orange-600 border-orange-500/40 bg-orange-500/10">Исчерпан</Badge>;
  }
  return <Badge variant="outline" className="text-green-600 border-green-500/40 bg-green-500/10">Активен</Badge>;
}

/**
 * Цвет прогресс-бара: green <60%, orange 60-80%, red 80%+.
 */
function getProgressColor(percent: number): string {
  if (percent >= 80) return "bg-red-500";
  if (percent >= 60) return "bg-orange-500";
  return "bg-green-500";
}

export function PromoCodeDetailClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = usePromise(params);
  const id = parseInt(idStr, 10);
  const router = useRouter();

  const [usagePage, setUsagePage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = usePromoCodeDetail(id, usagePage);
  const toggleMutation = useTogglePromoCode();
  const deleteMutation = useDeletePromoCode();

  if (isLoading && !data) {
    return (
      <div className="p-6 text-muted-foreground">Загрузка...</div>
    );
  }

  if (!data?.data) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-muted-foreground">Промокод не найден.</p>
        <Link href="/finance/promo-codes" className="text-primary hover:underline">
          ← Назад к списку
        </Link>
      </div>
    );
  }

  const promo = data.data;
  const usages = promo.usages ?? [];
  const stats = promo.stats;
  const meta = data.meta;

  const usagePercent = promo.max_uses
    ? Math.min(100, Math.round((promo.used_count / promo.max_uses) * 100))
    : null;

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
    // Физическое удаление — только для never-used кодов.
    // Использованный промокод нельзя удалить: FK cascadeOnDelete снесёт
    // все promo_code_usages → потеря финансового snapshot.
    if (promo.used_count > 0) return;
    if (!confirm(`Удалить промокод «${promo.code}»?\n\nКод будет удалён физически.`)) return;
    deleteMutation.mutate(
      { id: promo.id },
      { onSuccess: () => router.push("/finance/promo-codes") },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Ticket}
        title={`Промокод ${promo.code}`}
        description={getPromoTypeLabel(promo.discount_type)}
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {/* Шапка: код + copy + бейджи + действия */}
      <div className="border border-border rounded-lg bg-card p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <code className="font-mono font-bold text-xl tracking-wider select-none">
              {promo.code}
            </code>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} title="Скопировать">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-muted-foreground">
              {promo.discount_type_label}
            </Badge>
            {promo.is_personal && (
              <Badge variant="outline" className="text-purple-600 border-purple-500/40 bg-purple-500/10">
                Персональный
              </Badge>
            )}
            <StatusBadge item={promo} />
          </div>
        </div>

        {/* Параметры */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-y border-border py-3">
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Скидка / Дни</div>
            <div className="font-medium">
              {promo.gives_free_days
                ? `${promo.duration_days} дней`
                : promo.discount_type === "percent"
                ? `${promo.discount_value}%`
                : `${promo.discount_value} ₽`}
            </div>
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
                ? formatDate(promo.expires_at)
                : "∞ бессрочно"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Создан</div>
            <div className="font-medium">{formatDate(promo.created_at)}</div>
          </div>
        </div>

        {/* Прогресс-бар лимита. Цвета: green <60%, orange 60-80%, red 80%+. */}
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

        {/* Персональный юзер */}
        {promo.is_personal && promo.user && (
          <Link
            href={`/users/${promo.user.id}`}
            className="inline-block"
          >
            <UserBadge user={{
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
            }} />
          </Link>
        )}

        {/* Immutable-баннер: semantic-поля всегда заморожены после создания. */}
        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-sm text-blue-700 dark:text-blue-400">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Semantic-поля (код, тип, размер скидки, юзер) — immutable всегда.
            При редактировании доступны только лимит, дата истечения и активность.
            {promo.used_count > 0 && (
              <> Код уже использовали {promo.used_count} раз — лимит можно только увеличить, дату только продлить.</>
            )}
          </span>
        </div>

        {/* Действия */}
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Изменить
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleMutation.mutate({ id: promo.id })}
            disabled={toggleMutation.isPending}
          >
            <Power className="w-3.5 h-3.5 mr-1.5" />
            {promo.is_active ? "Деактивировать" : "Активировать"}
          </Button>
          {/* Delete — только для never-used кодов. */}
          {promo.used_count === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Удалить
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-border rounded-lg bg-card p-3">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Всего использований</div>
          <div className="text-xl font-bold tabular-nums">{stats?.total_usages ?? promo.used_count}</div>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Сумма скидок ₽</div>
          <div className="text-xl font-bold tabular-nums">{stats?.total_discount_sum?.toFixed(2) ?? "0.00"}</div>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Остаток</div>
          <div className="text-xl font-bold tabular-nums">
            {promo.remaining_uses === null ? "∞" : promo.remaining_uses}
          </div>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Статус</div>
          <div className="text-xl font-bold">
            <StatusBadge item={promo} />
          </div>
        </div>
      </div>

      {/* История использований */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">История использований</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Всего: {stats?.total_usages ?? promo.used_count} · показано {usages.length}
          </p>
        </div>

        {usages.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Ещё никто не использовал этот промокод.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-4 py-2">Юзер</th>
                  <th className="text-right px-4 py-2 whitespace-nowrap">Исходная</th>
                  <th className="text-right px-4 py-2 whitespace-nowrap">Скидка</th>                  
                  <th className="text-right px-4 py-2 whitespace-nowrap">Итог</th>
                  <th className="text-right px-4 py-2 whitespace-nowrap">Транзакция</th>
                  <th className="text-right px-4 py-2 whitespace-nowrap">Дата</th>
                </tr>
              </thead>
              <tbody>
                {usages.map((u) => {
                  const hasTx = !!u.transaction;
            
                  // original_amount — из бека (transaction.original_amount из meta).
                  // Может прийти как number, null ИЛИ undefined (если бек не отдал поле).
                  // Поэтому проверяем typeof === 'number', а не !== null.
                  const original = hasTx ? u.transaction!.original_amount : null;
                  const final = hasTx ? u.transaction!.amount : null;
                  const isRedeem = !hasTx;

                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      {/* Юзер */}
                      <td className="px-4 py-2">
                        {u.user ? (
                          <Link href={`/users/${u.user.id}`}>
                            <UserBadge user={u.user} />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                
                      {/* Исходная — цена до скидки (из meta.original_amount) */}
                      <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">
                
                        {typeof original === "number" ? (
                          <span className="font-medium">{original.toFixed(2)} ₽</span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>

                      {/* Списано — applied_discount */}
                      <td className="px-4 py-2 text-right tabular-nums text-xs">
                        {u.applied_discount > 0 ? (
                          <span className="text-red-500 font-medium">−{u.applied_discount.toFixed(2)} ₽</span>
                        ) : (
                          <span className="text-muted-foreground/50 italic">—</span>
                        )}
                      </td>
                     

                      {/* Итог — transaction.amount (final, после скидки) или "Бесплатно" */}
                      <td className="px-4 py-2 text-right tabular-nums text-xs">
                        {isRedeem ? (
                          <span className="text-green-500 font-medium">Бесплатно</span>

                        ) : typeof final === "number" ? (
                          <Link
                            href={`/finance/transactions?q=${u.transaction!.id}`}
                            className="text-green-500 font-medium hover:underline"
                            title={`Транзакция #${u.transaction!.id} · ${u.transaction!.status}`}
                          >
                            {final.toFixed(2)} ₽
                          </Link>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>

                       {/* Транзакция — ID (кликабельная ссылка) */}
                      <td className="px-4 py-2 text-right text-xs">
                        {hasTx ? (
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
                      </td>


                      {/* Дата */}
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(u.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {meta && meta.last_usage_page > 1 && (
              <div className="border-t border-border p-3">
                <ListPagination
                  currentPage={meta.current_usage_page}
                  lastPage={meta.last_usage_page}
                  total={meta.total_usages_pages}
                  onChangePage={setUsagePage}
                  disabled={isFetching}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Модалка редактирования */}
      <CreateModal
        open={editOpen}
        onOpenChange={setEditOpen}
        editPromo={promo}
      />
    </div>
  );
}
