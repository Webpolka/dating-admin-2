"use client";

// app/(admin)/finance/promo-codes/_components/create-modal.tsx
//
// Модалка создания ИЛИ редактирования промокода.
// Режим определяется props editPromo:
//  - editPromo = null → CREATE mode: пустые поля, submit "Создать".
//  - editPromo = PromoCodeItem → EDIT mode: поля подставлены, submit "Сохранить".
//
// ПОЛИТИКА (Stripe/Shopify best practice):
//  - code, discount_type, discount_value, duration_days, user_id — IMMUTABLE всегда.
//  - В edit mode разрешены только: max_uses (увеличить), expires_at (продлить),
//    is_active (toggle).
//  - В create mode — semantic поля активны (нужно же их задать при создании).
//
// UI:
//  - expires_at → shadcn DatePicker (react-day-picker + Calendar + ru-locale).
//  - user_id → UserSearchInput (dropdown через createPortal — не обрезается модалкой).
//  - Grid 2-col компоновка semantic полей, чтобы не было длинной портянки.

import { useEffect, useState } from "react";
import { Sparkles, Plus, Save, Lock } from "lucide-react";

import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { UserSearchInput } from "@/components/admin/user-search-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  useCreatePromoCode,
  useUpdatePromoCode,
  PROMO_CODE_TYPES,
  type PromoCodeFormData,
  type PromoCodeItem,
  type PromoCodeTypeValue,
} from "@/hooks/admin/use-promo-codes";
import type { SearchUserItem } from "@/hooks/admin/use-search-users";
import { extractValidationErrors } from "@/lib/api";

function genCodePreview(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

/** ISO → YYYY-MM-DD для DatePicker. */
function isoToDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CreateModal({
  open,
  onOpenChange,
  editPromo = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPromo?: PromoCodeItem | null;
}) {
  const isEditMode = !!editPromo;

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<PromoCodeTypeValue>("percent");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [durationDays, setDurationDays] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>(""); // YYYY-MM-DD
  const [selectedUser, setSelectedUser] = useState<SearchUserItem | null>(null);
  const [isActive, setIsActive] = useState(true);
  // Server-side validation errors (из 422 ответа бека).
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const createMutation = useCreatePromoCode();
  const updateMutation = useUpdatePromoCode();
  const mutation = isEditMode ? updateMutation : createMutation;

  // Очистка errors при закрытии модалки.
  useEffect(() => {
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

  // При открытии/смене editPromo — синхронизируем state.
  useEffect(() => {
    if (!open) return;
    if (editPromo) {
      setCode(editPromo.code);
      setDiscountType(editPromo.discount_type);
      setDiscountValue(editPromo.discount_value ? String(editPromo.discount_value) : "");
      setDurationDays(editPromo.duration_days ? String(editPromo.duration_days) : "");
      setMaxUses(editPromo.max_uses ? String(editPromo.max_uses) : "");
      setExpiresAt(isoToDateOnly(editPromo.expires_at));
      setSelectedUser(editPromo.user
        ? {
            id: editPromo.user.id,
            name: editPromo.user.name,
            email: editPromo.user.email,
            avatar_url: editPromo.user.avatar_url,
            is_online: false,
            status: "active",
            deleted_at: null,
            has_active_premium: false,
            has_active_vip: false,
            is_verified: false,
          }
        : null);
      setIsActive(editPromo.is_active);
    } else {
      setCode("");
      setDiscountType("percent");
      setDiscountValue("");
      setDurationDays("");
      setMaxUses("");
      setExpiresAt("");
      setSelectedUser(null);
      setIsActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPromo]);

  const selectedType = PROMO_CODE_TYPES.find((t) => t.value === discountType);
  const givesFreeDays = selectedType?.gives_free_days ?? false;

  // Минимальная selectable дата для DatePicker — UI constraint (не валидация).
  // Бек всё равно проверяет after:now, но DatePicker не даёт выбрать прошедшую.
  const minExpiresAt = (() => {
    if (isEditMode && editPromo && editPromo.expires_at && editPromo.used_count > 0) {
      return new Date(editPromo.expires_at);
    }
    return new Date();
  })();

  const handleConfirm = () => {
    setErrors({}); // сброс перед запросом

    if (isEditMode && editPromo) {
      // UPDATE — только 3 поля.
      const data: { is_active?: boolean; max_uses?: number; expires_at?: string } = {
        is_active: isActive,
      };
      if (maxUses) data.max_uses = parseInt(maxUses, 10);
      if (expiresAt) data.expires_at = new Date(expiresAt + "T23:59:59").toISOString();

      updateMutation.mutate(
        { id: editPromo.id, data },
        {
          onSuccess: () => {
            setErrors({});
            onOpenChange(false);
          },
          onError: (err) => {
            const fieldErrors = extractValidationErrors(err);
            if (fieldErrors) setErrors(fieldErrors);
          },
        },
      );
      return;
    }

    // CREATE.
    const data: PromoCodeFormData = {
      discount_type: discountType,
      is_active: isActive,
    };
    if (code.trim()) data.code = code.trim().toUpperCase();
    if (!givesFreeDays && discountValue) data.discount_value = parseFloat(discountValue);
    if (givesFreeDays && durationDays) data.duration_days = parseInt(durationDays, 10);
    if (maxUses) data.max_uses = parseInt(maxUses, 10);
    if (expiresAt) data.expires_at = new Date(expiresAt + "T23:59:59").toISOString();
    if (selectedUser) data.user_id = selectedUser.id;

    createMutation.mutate(data, {
      onSuccess: () => {
        setErrors({});
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
      title={isEditMode ? "Редактировать промокод" : "Создать промокод"}
      description={
        isEditMode
          ? "Semantic-поля (код, тип, размер, юзер) — неизменяемы. Можно менять только лимит, дату истечения и активность."
          : "Если поле «Код» пустое — бек сгенерирует случайный автоматически."
      }
      className="sm:max-w-2xl"
      submit={{
        label: isEditMode ? "Сохранить" : "Создать",
        icon: isEditMode ? Save : Plus,
        isLoading: mutation.isPending,
        onClick: handleConfirm,
      }}
    >
      {isEditMode && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-sm text-blue-700 dark:text-blue-400">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Semantic-поля промокода заморожены (как в Stripe/Shopify). Если
            ошиблись при создании — создайте новый промокод и деактивируйте этот.
          </span>
        </div>
      )}

      {/* Код + кнопка генерации — full width */}
      <FormField
        label="Код"
        error={errors.code?.[0]}
        hint={isEditMode ? "🔒 Immutable" : "Латиница, цифры, дефис. Пусто → автогенерация."}
      >
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              clearFieldError("code");
            }}
            placeholder="Например: VIP2026"
            maxLength={50}
            className="font-mono"
            disabled={isEditMode}
          />
          {!isEditMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCode(genCodePreview())}
              title="Сгенерировать случайный код"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Сгенерировать
            </Button>
          )}
        </div>
      </FormField>

      {/* Тип + размер/длительность — grid 2-col */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Тип скидки"
          required
          error={errors.discount_type?.[0]}
          hint={isEditMode ? "🔒 Immutable" : undefined}
        >
          <Select
            value={discountType}
            onValueChange={(v: string | null) => {
              if (v && !isEditMode) {
                setDiscountType(v as PromoCodeTypeValue);
                clearFieldError("discount_type");
              }
            }}
          >
            <SelectTrigger className="w-full" disabled={isEditMode}>
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
            hint={isEditMode ? "🔒 Immutable" : undefined}
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
              disabled={isEditMode}
            />
          </FormField>
        ) : (
          <FormField
            label="Длительность (дней)"
            required
            error={errors.duration_days?.[0]}
            hint={isEditMode ? "🔒 Immutable" : undefined}
          >
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
              disabled={isEditMode}
            />
          </FormField>
        )}
      </div>

      {/* Лимит + дата истечения — grid 2-col */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Лимит использований"
          error={errors.max_uses?.[0]}
          hint={isEditMode && editPromo && editPromo.used_count > 0
            ? `Только увеличить (уже ${editPromo.used_count}).`
            : "Пусто = безлимитный."}
        >
          <Input
            type="number"
            min={isEditMode && editPromo && editPromo.used_count > 0 ? String(editPromo.used_count) : "1"}
            value={maxUses}
            onChange={(e) => {
              setMaxUses(e.target.value);
              clearFieldError("max_uses");
            }}
            placeholder="Например: 1000"
          />
        </FormField>
        <FormField
          label="Истекает"
          error={errors.expires_at?.[0]}
          hint={isEditMode && editPromo && editPromo.used_count > 0
            ? "Только продлить."
            : "Пусто = бессрочно."}
        >
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
      <FormField
        label="Персональный юзер"
        error={errors.user_id?.[0]}
        hint={isEditMode ? "🔒 Immutable" : "Поиск по ID или имени. Пусто = общий код."}
      >
        <UserSearchInput
          onSelect={(u) => {
            setSelectedUser(u);
            clearFieldError("user_id");
          }}
          selectedUser={selectedUser}
          onClear={() => setSelectedUser(null)}
          disabled={isEditMode}
        />
      </FormField>

      <FormField label="Активен">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm text-muted-foreground">
            {isActive ? "Активен" : "Отключен"}
          </span>
        </div>
      </FormField>
    </FormModal>
  );
} 