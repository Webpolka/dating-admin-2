// app/(admin)/finance/transactions/_components/refund-modal.tsx
"use client";

import { useState, useEffect } from "react";
import type { TransactionItem, RefundReason } from "@/hooks/admin/use-transactions";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Undo2 } from "lucide-react";
import { REFUND_REASONS } from "./_shared";

export function RefundModal({
  transaction,
  onOpenChange,
  isLoading,
  onConfirm,
}: {
  transaction: TransactionItem | null;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  onConfirm: (reason: RefundReason, comment?: string) => void;
}) {
  const [reason, setReason] = useState<RefundReason | "">("");
  const [comment, setComment] = useState("");

  // Сброс формы при закрытии модалки (transaction === null).
  // React 19 ругается на setState в effect — подавляем, т.к. это правильный
  // паттерн синхронизации state с props. Альтернатива — key={transaction?.id}
  // на родителе, но это пересоздаёт весь компонент.
  useEffect(() => {
    if (!transaction) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason("");      
      setComment("");
    }
  }, [transaction]);

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason as RefundReason, comment.trim() || undefined);
  };

  return (
    <FormModal
      open={transaction !== null}
      onOpenChange={onOpenChange}
      title="Оформить возврат"
      submit={{
        label: "Подтвердить возврат",
        icon: Undo2,
        destructive: true,
        isLoading,
        disabled: !reason,
        onClick: handleConfirm,
      }}
    >
      {transaction && (
        <div className="bg-muted/30 border border-border rounded-md p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ID транзакции:</span>
            <span className="font-mono font-bold">#{transaction.id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Сумма:</span>
            <span className="font-bold">{transaction.formatted_amount}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground">Тип:</span>
            <Badge
              variant={transaction.type_badge.variant as "default" | "secondary" | "destructive" | "warning" | "outline"}
              className={transaction.type_badge.className}
            >
              {transaction.type_badge.label}
            </Badge>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Вы уверены? Деньги будут возвращены пользователю.
      </p>

      <div className="space-y-3">
        <FormField label="Причина возврата (обязательно)">
          <Select
            value={reason}
            onValueChange={(v: string | null) => v && setReason(v as RefundReason)}
          >
            <SelectTrigger className="w-full">
              {REFUND_REASONS.find(r => r.value === reason)?.label ?? "Выберите причину..."}
            </SelectTrigger>
            <SelectContent>
              {REFUND_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Комментарий (опционально, минимум 5 символов)">
          <Textarea
            rows={2}
            placeholder="Например: Банк отклонил 3-D Secure..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none text-sm"
          />
        </FormField>
      </div>
    </FormModal>
  );
}
