// app/(admin)/finance/subscription-plans/_components/plan-modal.tsx
"use client";

import { useState, useEffect } from "react";
import type {
  SubscriptionPlanItem,
  PlanFormData,
  PlanTier,
} from "@/hooks/admin/use-subscription-plans";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";

export function PlanModal({
  open,
  onOpenChange,
  plan,
  tier,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlanItem | null;
  tier: PlanTier;
  onSave: (data: PlanFormData, onError: (errors: Record<string, string[]>) => void) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");              // string для корректного ввода дробей
  const [oldPrice, setOldPrice] = useState("");        // string
  const [durationDays, setDurationDays] = useState("30"); // string
  const [sortOrder, setSortOrder] = useState("0");     // string
  const [appleProductId, setAppleProductId] = useState("");
  const [googleProductId, setGoogleProductId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Сброс формы при открытии/закрытии модалки или смене plan.
  // React 19 ругается на setState в effect — подавляем, т.к. это правильный
  // паттерн синхронизации state с props. Альтернатива — key={plan?.id}
  // на родителе, но это пересоздаёт весь компонент.
  useEffect(() => {
    if (!open) return;
    if (plan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(plan.name);      
      setSlug(plan.slug);      
      setPrice(String(plan.price));      
      setOldPrice(plan.old_price !== null ? String(plan.old_price) : "");      
      setDurationDays(String(plan.duration_days));      
      setSortOrder(String(plan.sort_order));      
      setAppleProductId(plan.apple_product_id ?? "");      
      setGoogleProductId(plan.google_product_id ?? "");      
      setIsActive(plan.is_active);
    } else {      
      setName("");      
      setSlug("");      
      setPrice("");      
      setOldPrice("");      
      setDurationDays("30");      
      setSortOrder("0");      
      setAppleProductId("");      
      setGoogleProductId("");      
      setIsActive(true);
   }
    
    setFieldErrors({});
  }, [open, plan]);

  const handleNameChange = (value: string) => {
    setName(value);
    // Авто-генерация slug только при создании (не при редактировании).
    if (!plan) {
      setSlug(value.toLowerCase()
        .replace(/[^a-z0-9\-_ ]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // F10: frontend-валидация (раньше была только серверная).
    const errors: Record<string, string[]> = {};
    if (!name.trim()) errors.name = ["Название обязательно"];
    if (!slug.trim()) errors.slug = ["Slug обязателен"];
    else if (!/^[a-z0-9\-_]+$/.test(slug.trim())) errors.slug = ["Только строчные латинские буквы, цифры, дефис и подчёркивание"];
    if (!price || isNaN(Number(price)) || Number(price) < 0) errors.price = ["Цена обязательна"];
    // duration_days — минимум 1 день. Раньше проверял только backend.
    if (!durationDays || Number(durationDays) < 1) errors.duration_days = ["Минимум 1 день"];

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    onSave(
      {
        name: name.trim(),
        slug: slug.trim(),
        price: Number(price),
        old_price: oldPrice ? Number(oldPrice) : null,
        duration_days: Number(durationDays) || 30,
        sort_order: Number(sortOrder) || 0,
        apple_product_id: appleProductId.trim() || null,
        google_product_id: googleProductId.trim() || null,
        is_active: isActive,
      },
      (backendErrors) => setFieldErrors(backendErrors)
    );
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${plan ? "Редактировать тариф" : "Новый тариф"} (${tier})`}
      className="sm:max-w-xl"
      footerStart={
        <>
          <Switch checked={isActive} onCheckedChange={(v) => setIsActive(v)} />
          <span className="text-sm font-medium">Тариф в продаже</span>
        </>
      }
      footerEnd={
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Отмена
          </Button>
          {/* form="plan-form": кнопка в футере ассоциирована с формой тела —
              и клик, и Enter в инпутах проходят через единый onSubmit. */}
          <Button type="submit" form="plan-form" size="sm" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {plan ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="plan-form" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Название" error={fieldErrors.name?.[0]}>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={`${tier.charAt(0).toUpperCase() + tier.slice(1)} на 1 месяц`}
            />
          </FormField>
          <FormField label="Слаг (URL)" error={fieldErrors.slug?.[0]}>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={`${tier}_1_month`}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FormField label="Цена (₽)" error={fieldErrors.price?.[0]}>
            <Input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
            />
          </FormField>
          <FormField label="Старая цена (₽)">
            <Input
              type="text"
              inputMode="decimal"
              value={oldPrice}
              onChange={(e) => setOldPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Опционально"
            />
          </FormField>
          <FormField label="Срок (дни)" error={fieldErrors.duration_days?.[0]}>
            <Input
              type="text"
              inputMode="numeric"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Сортировка">
            <Input
              type="text"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </FormField>
          <FormField label="Apple Product ID">
            <Input
              value={appleProductId}
              onChange={(e) => setAppleProductId(e.target.value)}
              placeholder={`com.app.${tier}`}
            />
          </FormField>
          <FormField label="Google Product ID">
            <Input
              value={googleProductId}
              onChange={(e) => setGoogleProductId(e.target.value)}
              placeholder={`${tier}_1_month`}
            />
          </FormField>
        </div>
      </form>
    </FormModal>
  );
}
