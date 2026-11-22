"use client";

// app/(admin)/users/_components/ban-user-dialog.tsx
//
// Диалог бана: тип блокировки + причина (+ длительность для temp-бана).
// Используется в ДВУХ местах: список юзеров (users-page-client) и
// шапка карточки юзера (header-actions-menu) — логика бана не дублируется.
//
// Компонент монтируется с key={banTarget.userId}, поэтому useState
// инициализируется заново на каждого юзера — ручной reset не нужен.

import { useState } from "react";
import { Clock } from "lucide-react";

import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BAN_DURATION_PRESETS, BAN_REASONS } from "@/lib/api/users";
import type { BanType, BanReason } from "@/lib/api/users";

interface BanUserDialogProps {
  target: { userId: number; type: BanType } | null;
  isPending: boolean;
  onClose: () => void;
  /** Вызывается с выбранным типом, причиной и (для temp) длительностью в днях. */
  onSubmit: (type: BanType, reason: BanReason, days?: number) => void;
}

const BAN_TYPE_OPTIONS: Array<{ value: BanType; label: string; hint: string }> = [
  { value: "shadow", label: "Теневой бан", hint: "Юзер не догадается: для него всё работает, но его не видят другие" },
  { value: "temp", label: "Временный бан", hint: "Автоматически снимется по истечении срока" },
  { value: "permanent", label: "Вечный бан", hint: "Полная блокировка навсегда" },
];

// Дефолтная длительность temp-бана (та же, что на бэке при days=null).
const DEFAULT_DAYS = 3;

export function BanUserDialog({ target, isPending, onClose, onSubmit }: BanUserDialogProps) {
  const [type, setType] = useState<BanType>(target?.type ?? "shadow");
  const [reason, setReason] = useState<BanReason | "">("");
  const [days, setDays] = useState<number>(DEFAULT_DAYS);

  if (!target) return null;

  // Ручная блокировка закрытия во время запроса — иначе двойные сабмиты.
  const handleOpenChange = (open: boolean) => {
    if (!open && !isPending) onClose();
  };

  const handleSubmit = () => {
    if (reason === "") return;
    onSubmit(type, reason, type === "temp" ? days : undefined);
  };

  const selectedType = BAN_TYPE_OPTIONS.find((t) => t.value === type);

  return (
    <FormModal
      open
      onOpenChange={handleOpenChange}
      title="Блокировка пользователя"
      description="Выбери тип блокировки и обязательную причину — она попадёт в лог администратора и в уведомление пользователю."
      className="sm:max-w-md"
      submit={{
        label: "Заблокировать",
        destructive: true,
        isLoading: isPending,
        disabled: reason === "",
        onClick: handleSubmit,
      }}
    >
      {/* Тип блокировки */}
      <FormField label="Тип блокировки" hint={selectedType?.hint}>
        <Select value={type} onValueChange={(v) => v && setType(v as BanType)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string | null) => BAN_TYPE_OPTIONS.find((t) => t.value === v)?.label ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BAN_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Длительность — только для temp-бана */}
      {type === "temp" && (
        <FormField
          label={
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Длительность
            </span>
          }
        >
          <Select value={String(days)} onValueChange={(v) => v && setDays(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string | null) =>
                  BAN_DURATION_PRESETS.find((p) => String(p.value) === v)?.label ?? v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BAN_DURATION_PRESETS.map((p) => (
                <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      {/* Причина (обязательная) */}
      <FormField label="Причина" required>
        <Select value={reason} onValueChange={(v) => v && setReason(v as BanReason)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string | null) =>
                v === null
                  ? "Выберите причину..."
                  : BAN_REASONS.find((r) => r.value === v)?.label ?? v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BAN_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </FormModal>
  );
}
