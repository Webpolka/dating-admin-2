"use client";

import { useState } from "react";

import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DELETION_REASONS, type DeletionReason } from "@/lib/api/users";

interface DeactivateUserDialogProps {
  target: { userId: number; userName: string } | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (reason: DeletionReason) => void;
}

export function DeactivateUserDialog({
  target,
  isPending,
  onClose,
  onSubmit,
}: DeactivateUserDialogProps) {
  const [reason, setReason] = useState<DeletionReason | "">("");

  if (!target) return null;

  const canSubmit = reason !== "";

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && !isPending && onClose()}
      title="Деактивация аккаунта"
      description={`Аккаунт ${target.userName} будет деактивирован (soft delete). Можно восстановить позже.`}
      className="sm:max-w-md"
      submit={{
        label: "Деактивировать",
        destructive: true,
        isLoading: isPending,
        disabled: !canSubmit,
        onClick: () => reason !== "" && onSubmit(reason as DeletionReason),
      }}
    >
      <FormField label="Причина деактивации" required>
        <Select
          value={reason}
          onValueChange={(v) => setReason(v as DeletionReason)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) =>
                v === ""
                  ? "Выберите причину..."
                  : DELETION_REASONS.find((r) => r.value === v)?.label ?? v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DELETION_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </FormModal>
  );
}
