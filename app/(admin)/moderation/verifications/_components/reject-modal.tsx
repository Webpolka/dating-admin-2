"use client";

// app/(admin)/moderation/verifications/_components/reject-modal.tsx
//
// Модалка выбора причины отклонения заявки верификации.
// По образцу photos/_components/reject-modal.tsx.

import { useEffect, useState } from "react";
import {
  useRejectVerification,
  VERIFICATION_REJECT_REASONS,
  type VerificationItem,
  type VerificationRejectReason,
} from "@/hooks/admin/use-verifications";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { ShieldX } from "lucide-react";

export function RejectModal({
  verification,
  onOpenChange,
}: {
  verification: VerificationItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<VerificationRejectReason | "">("");
  const rejectMutation = useRejectVerification();

  useEffect(() => {
    if (!verification) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason("");
    }
  }, [verification]);

  const handleConfirm = () => {
    if (!verification || !reason) return;
    rejectMutation.mutate(
      { id: verification.id, reason: reason as VerificationRejectReason },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <FormModal
      open={verification !== null}
      onOpenChange={onOpenChange}
      title="Отклонить заявку верификации?"
      submit={{
        label: "Отклонить заявку",
        icon: ShieldX,
        destructive: true,
        isLoading: rejectMutation.isPending,
        disabled: !reason,
        onClick: handleConfirm,
      }}
    >
      {verification && (
        <div className="bg-muted/30 border border-border rounded-md p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ID заявки:</span>
            <span className="font-mono font-bold">#{verification.id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ID юзера:</span>
            <span className="font-medium">#{verification.user_id}</span>
          </div>
          {verification.code && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Код верификации:</span>
              <span className="font-mono font-bold tracking-wider">{verification.code}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Выберите причину отклонения. Пользователь получит уведомление с указанием причины.
      </p>

      <FormField label="Причина отклонения">
        <Select
          value={reason}
          onValueChange={(v: string | null) => v && setReason(v as VerificationRejectReason)}
        >
          <SelectTrigger className="w-full">
            {VERIFICATION_REJECT_REASONS.find((r) => r.value === reason)?.label
              ?? "Выберите причину..."}
          </SelectTrigger>
          <SelectContent>
            {VERIFICATION_REJECT_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </FormModal>
  );
}
