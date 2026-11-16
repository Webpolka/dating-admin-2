// app/(admin)/system/broadcasts/_components/broadcast-confirm-modal.tsx
"use client";

import { FormModal } from "@/components/admin/form-modal";
import { Save } from "lucide-react";
import type { BroadcastType } from "@/hooks/admin/use-broadcasts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: BroadcastType;
  scheduledAt: string;
  audienceSummary: string;
  isEdit: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
}

/**
 * Модалка подтверждения перед сохранением рассылки.
 * Показывает сводку: аудиторию, тип, заголовок, дату планирования.
 */
export function BroadcastConfirmModal({
  open,
  onOpenChange,
  title,
  type,
  scheduledAt,
  audienceSummary,
  isEdit,
  isSubmitting,
  onConfirm,
}: Props) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Проверка перед сохранением"
      submit={{
        label: isSubmitting
          ? "Сохранение..."
          : isEdit
            ? "Сохранить изменения"
            : scheduledAt
              ? "Запланировать"
              : "Сохранить черновик",
        icon: Save,
        isLoading: isSubmitting,
        onClick: onConfirm,
      }}
    >
      <p className="text-sm text-muted-foreground">
        Убедитесь, что параметры рассылки настроены верно.
      </p>

      <div className="bg-muted/30 border border-border rounded-md p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase mb-1">Аудитория:</p>
          <p className="text-sm font-medium">{audienceSummary}</p>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground uppercase mb-1">Тип уведомления:</p>
          <p className="text-sm font-medium">
            {type === "in_app" ? "В приложении (Колокольчик)" : type === "email" ? "Email (Письмо)" : "Push (Уведомление)"}
          </p>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground uppercase mb-1">Заголовок:</p>
          <p className="text-sm font-medium">{title}</p>
        </div>
        {scheduledAt && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground uppercase mb-1">Отправка запланирована:</p>
            <p className="text-sm font-medium">
              {new Date(scheduledAt).toLocaleString("ru-RU")}
            </p>
          </div>
        )}
      </div>
    </FormModal>
  );
}
