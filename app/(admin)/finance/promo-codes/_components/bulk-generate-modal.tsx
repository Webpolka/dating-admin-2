"use client";

// app/(admin)/finance/promo-codes/_components/bulk-generate-modal.tsx
//
// Модалка bulk-генерации N промокодов с одинаковыми параметрами.
// По образцу CreateModal, но:
//  - нет поля code (генерируется автоматически).
//  - есть count (1-1000) + code_prefix (опционально).
//  - grid 2-col компоновка.
//  - DatePicker + UserSearchInput (как в CreateModal).

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { UserSearchInput } from "@/components/admin/user-search-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  useBulkGeneratePromoCodes,
  PROMO_CODE_TYPES,
  type BulkGenerateFormData,
  type PromoCodeTypeValue,
} from "@/hooks/admin/use-promo-codes";
import type { SearchUserItem } from "@/hooks/admin/use-search-users";
import { extractValidationErrors } from "@/lib/api";
import { toast } from "sonner";

export function BulkGenerateModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [count, setCount] = useState<string>("10");
  const [codePrefix, setCodePrefix] = useState<string>("");
  const [discountType, setDiscountType] = useState<PromoCodeTypeValue>("percent");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [durationDays, setDurationDays] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>(""); // YYYY-MM-DD
  const [selectedUser, setSelectedUser] = useState<SearchUserItem | null>(null);
  const [isActive, setIsActive] = useState(true);
  // Server-side validation errors (из 422 ответа бека).
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const mutation = useBulkGeneratePromoCodes();

  // Очистка errors при закрытии модалки.
  useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setErrors({});
  }, [open]);

  // Очистка error одного поля при его изменении.
  const clearFieldError = (field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const selectedType = PROMO_CODE_TYPES.find((t) => t.value === discountType);
  const givesFreeDays = selectedType?.gives_free_days ?? false;

  // Минимальная selectable дата — сегодня (UI constraint, не валидация).
  // Бек всё равно проверяет after:now, но DatePicker не даёт выбрать прошедшую.
  const minExpiresAt = new Date();

  const reset = () => {
    setCount("10");
    setCodePrefix("");
    setDiscountType("percent");
    setDiscountValue("");
    setDurationDays("");
    setMaxUses("");
    setExpiresAt("");
    setSelectedUser(null);
    setIsActive(true);
  };

  const handleConfirm = () => {
    setErrors({}); // сброс перед запросом

    const countNum = parseInt(count, 10);
    if (!countNum || countNum < 1 || countNum > 1000) {
      toast.error("Количество кодов: от 1 до 1000.");
      return;
    }

    const data: BulkGenerateFormData = {
      count: countNum,
      discount_type: discountType,
      is_active: isActive,
    };
    if (codePrefix.trim()) data.code_prefix = codePrefix.trim().toUpperCase();
    if (!givesFreeDays && discountValue) data.discount_value = parseFloat(discountValue);
    if (givesFreeDays && durationDays) data.duration_days = parseInt(durationDays, 10);
    if (maxUses) data.max_uses = parseInt(maxUses, 10);
    if (expiresAt) data.expires_at = new Date(expiresAt + "T23:59:59").toISOString();
    if (selectedUser) data.user_id = selectedUser.id;

    mutation.mutate(data, {
      onSuccess: (res) => {
        setErrors({});
        if (res.created === res.requested) {
          toast.success(res.message);
        } else {
          toast.warning(res.message);
        }
        reset();
        onOpenChange(false);
      },
      onError: (err) => {
        const fieldErrors = extractValidationErrors(err);
        if (fieldErrors) setErrors(fieldErrors);
      },
    });
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Сгенерировать пачку промокодов"
      description="Создаст N кодов с одинаковыми параметрами. Коды генерируются автоматически (с опциональным префиксом)."
      className="sm:max-w-2xl"
      submit={{
        label: "Сгенерировать",
        icon: Sparkles,
        isLoading: mutation.isPending,
        onClick: handleConfirm,
      }}
    >
      {/* Count + Prefix — grid 2-col */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Количество кодов" required error={errors.count?.[0]} hint="От 1 до 1000.">
          <Input
            type="number"
            min="1"
            max="1000"
            value={count}
            onChange={(e) => {
              setCount(e.target.value);
              clearFieldError("count");
            }}
            placeholder="Например: 100"
          />
        </FormField>
        <FormField label="Префикс кода" error={errors.code_prefix?.[0]} hint="Например BLACKFRIDAY → BLACKFRIDAY-XXXX. Пусто = без префикса.">
          <Input
            value={codePrefix}
            onChange={(e) => {
              setCodePrefix(e.target.value.toUpperCase());
              clearFieldError("code_prefix");
            }}
            placeholder="Например: WELCOME"
            maxLength={20}
            className="font-mono"
          />
        </FormField>
      </div>

      {/* Тип + размер/длительность — grid 2-col */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Тип скидки" required error={errors.discount_type?.[0]}>
          <Select
            value={discountType}
            onValueChange={(v: string | null) => {
              if (v) {
                setDiscountType(v as PromoCodeTypeValue);
                clearFieldError("discount_type");
              }
            }}
          >
            <SelectTrigger className="w-full">
              {PROMO_CODE_TYPES.find((t) => t.value === discountType)?.label}
            </SelectTrigger>
            <SelectContent>
              {PROMO_CODE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {!givesFreeDays ? (
          <FormField
            label={discountType === "percent" ? "Скидка (%)" : "Скидка (₽)"}
            required
            error={errors.discount_value?.[0]}
          >
            <Input
              type="number"
              min="0"
              step={discountType === "percent" ? "1" : "0.01"}
              value={discountValue}
              onChange={(e) => {
                setDiscountValue(e.target.value);
                clearFieldError("discount_value");
              }}
              placeholder={discountType === "percent" ? "Например: 50" : "Например: 250"}
            />
          </FormField>
        ) : (
          <FormField label="Длительность (дней)" required error={errors.duration_days?.[0]}>
            <Input
              type="number"
              min="1"
              max="3650"
              value={durationDays}
              onChange={(e) => {
                setDurationDays(e.target.value);
                clearFieldError("duration_days");
              }}
              placeholder="Например: 30"
            />
          </FormField>
        )}
      </div>

      {/* Лимит + дата истечения — grid 2-col */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Лимит использований" error={errors.max_uses?.[0]} hint="Пусто = безлимитный.">
          <Input
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => {
              setMaxUses(e.target.value);
              clearFieldError("max_uses");
            }}
            placeholder="Например: 1000"
          />
        </FormField>
        <FormField label="Истекает" error={errors.expires_at?.[0]} hint="Пусто = бессрочно.">
          <DatePicker
            value={expiresAt}
            onChange={(v) => {
              setExpiresAt(v);
              clearFieldError("expires_at");
            }}
            placeholder="Выбрать дату"
            minDate={minExpiresAt}
          />
        </FormField>
      </div>

      {/* Персональный юзер — full width */}
      <FormField label="ID юзера (персональный)" error={errors.user_id?.[0]} hint="Если задан — все N кодов будут выданы одному юзеру.">
        <UserSearchInput
          onSelect={(u) => {
            setSelectedUser(u);
            clearFieldError("user_id");
          }}
          selectedUser={selectedUser}
          onClear={() => setSelectedUser(null)}
        />
      </FormField>

      <FormField label="Активны сразу">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm text-muted-foreground">
            {isActive ? "Активны сразу после создания" : "Создать в отключенном состоянии"}
          </span>
        </div>
      </FormField>
    </FormModal>
  );
} 