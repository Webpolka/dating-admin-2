// app/(admin)/finance/transactions/_components/transaction-detail-modal.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTransactionDetail } from "@/hooks/admin/use-transactions";
import { UserBadge } from "@/components/admin/user-badge";
import { FormModal } from "@/components/admin/form-modal";
import { Badge } from "@/components/ui/badge";
import { Loader2, Undo2, Ticket } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export function TransactionDetailModal({
  transactionId,
  onClose,
}: {
  transactionId: number | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useTransactionDetail(transactionId, !!transactionId);
  const router = useRouter();
  const tx = data?.data;

  // Извлекаем данные возврата один раз — не плодим as string по всему JSX
  const refundInfo = tx?.status === "refunded" && tx.meta ? {
    reason: tx.meta.refund_reason as string | undefined,
    comment: tx.meta.refund_comment as string | undefined,
    initiatedBy: tx.meta.refund_initiated_by as string | undefined,
  } : null;

  return (
    <FormModal
      open={transactionId !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Детали транзакции ${tx ? `#${tx.id}` : ""}`}
      className="max-w-2xl"
    >
      {isLoading || !tx ? (
        <div className="flex h-full items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Пользователь */}
          <div className="pb-4 border-b border-border">
            <p className="text-xs text-muted-foreground mb-2">Пользователь</p>
            {tx.user ? (
              <button
                onClick={() => {
                  onClose();
                  router.push(`/users/${tx.user!.id}`);
                }}
                className="block text-left"
              >
                <UserBadge user={tx.user} size="sm" showEmail={true} />
              </button>
            ) : (
              <span className="text-sm text-muted-foreground italic">Юзер удален</span>
            )}
          </div>

          {/* Данные */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Сумма</p>
              <p className="font-medium">{tx.formatted_amount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Тип</p>
              <Badge
                variant={tx.type_badge.variant as "default" | "secondary" | "destructive" | "warning" | "outline"}
                className={tx.type_badge.className}
              >
                {tx.type_badge.label}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Статус</p>
              <Badge variant={tx.status_badge.variant as "default" | "secondary" | "destructive" | "warning" | "success"}>
                {tx.status_badge.label}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Провайдер</p>
              <p className="font-medium uppercase">{tx.provider ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ID провайдера</p>
              <p className="font-mono text-xs break-all bg-muted p-2 rounded">
                {tx.provider_transaction_id ?? "—"}
              </p>
            </div>
            {tx.credits_amount && (
              <div>
                <p className="text-xs text-muted-foreground">
                  {tx.type === "refund" || tx.status === "refunded" ? "Списано кредитов" : "Начислено кредитов"}
                </p>
                <p className={`font-medium ${tx.status === "refunded" ? "text-destructive" : ""}`}>
                  {tx.credits_amount}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Создана</p>
              <p className="font-medium">{tx.created_at && formatDateTime(tx.created_at)}</p>
            </div>
            {tx.updated_at && tx.updated_at !== tx.created_at && (
              <div>
                <p className="text-xs text-muted-foreground">Последнее действие</p>
                <p className="font-medium text-amber-600 dark:text-amber-500">
                  {formatDateTime(tx.updated_at)}
                </p>
              </div>
            )}
          </div>

          {/* Блок возврата */}
          {refundInfo && (refundInfo.reason || refundInfo.comment || refundInfo.initiatedBy) && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-md p-4 space-y-2">
              <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                <Undo2 className="w-3.5 h-3.5" />
                Возврат оформлен
              </p>
              {refundInfo.reason && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Причина:</span>
                  <span className="font-medium">{refundInfo.reason}</span>
                </div>
              )}
              {refundInfo.comment && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Комментарий:</span>
                  <p className="mt-1 text-foreground">{refundInfo.comment}</p>
                </div>
              )}
              {refundInfo.initiatedBy && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Кем:</span>
                  <span className="font-medium">{refundInfo.initiatedBy}</span>
                </div>
              )}
            </div>
          )}

          {/* Промокод — если был применён */}
          {tx.promo_code_id && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-md p-4 space-y-2">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5" />
                Промокод применён
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Промокод:</span>
                <Link
                  href={`/finance/promo-codes/${tx.promo_code_id}`}
                  className="font-mono text-blue-500 hover:underline font-medium"
                  onClick={() => onClose()}
                >
                  #{tx.promo_code_id}
                </Link>
              </div>
              {tx.promo_code_discount && tx.promo_code_discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Скидка:</span>
                  <span className="text-red-500 font-medium">−{tx.promo_code_discount} ₽</span>
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          {tx.meta && Object.keys(tx.meta).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Сырые данные (Meta):</p>
              <pre className="little-scroll text-[10px] bg-muted/50 p-3 rounded-md overflow-auto max-h-40 border border-border font-mono whitespace-pre-wrap">
                {JSON.stringify(tx.meta, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </FormModal>
  );
}
