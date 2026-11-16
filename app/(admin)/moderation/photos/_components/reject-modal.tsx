// app/(admin)/moderation/photos/_components/reject-modal.tsx
"use client";

import { useEffect, useState } from "react";
import {
  useRejectPhoto,
  PHOTO_REJECT_REASONS,
  type PhotoItem,
  type PhotoRejectReason,
} from "@/hooks/admin/use-photos";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { ShieldX } from "lucide-react";

export function RejectModal({
  photo,
  onOpenChange,
}: {
  photo: PhotoItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<PhotoRejectReason | "">("");
  const rejectMutation = useRejectPhoto();

  useEffect(() => {
    if (!photo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason("");
    }
  }, [photo]);

 const handleConfirm = () => {
  if (!photo || !reason) return;
  rejectMutation.mutate(
    { id: photo.id, reason: reason as PhotoRejectReason },
    {
      onSuccess: () => {
        onOpenChange(false);
      },
    }
  );
};

  return (
    <FormModal
      open={photo !== null}
      onOpenChange={onOpenChange}
      title="Отклонить фото?"
      submit={{
        label: "Отклонить фото",
        icon: ShieldX,
        destructive: true,
        isLoading: rejectMutation.isPending,
        disabled: !reason,
        onClick: handleConfirm,
      }}
    >
      {photo && (
        <div className="bg-muted/30 border border-border rounded-md p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ID фото:</span>
            <span className="font-mono font-bold">#{photo.id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ID юзера:</span>
            <span className="font-medium">#{photo.user_id}</span>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Выберите причину отклонения. Пользователь получит уведомление.
      </p>

      <FormField label="Причина отклонения">
        <Select
          value={reason}
          onValueChange={(v: string | null) => v && setReason(v as PhotoRejectReason)}
        >
          <SelectTrigger className="w-full">
            {PHOTO_REJECT_REASONS.find(r => r.value === reason)?.label ?? "Выберите причину..."}
          </SelectTrigger>
          <SelectContent>
            {PHOTO_REJECT_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </FormModal>
  );
}
