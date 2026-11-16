"use client";

import { useState, useEffect } from "react";
import type { SupportCategoryItem, CategoryFormData } from "@/hooks/admin/use-support-templates";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";

export function CategoryModal({
  open,
  onOpenChange,
  category,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: SupportCategoryItem | null;
  onSave: (data: CategoryFormData) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (category) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(category.name);
      setSlug(category.slug);
      setIsActive(category.is_active);
      setSortOrder(category.sort_order);
    } else {
      setName("");
      setSlug("");
      setIsActive(true);
      setSortOrder(0);
    }
  }, [open, category]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      slug: slug.trim() || undefined,
      is_active: isActive,
      sort_order: sortOrder,
    });
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={category ? "Редактирование категории" : "Новая категория"}
      submit={{
        label: category ? "Сохранить" : "Создать",
        icon: Save,
        isLoading,
        disabled: !name.trim(),
        onClick: handleSave,
      }}
    >
      <FormField label="Название">
        <Input placeholder="Например: Оплата" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>

      <FormField label="Slug (только латиница, цифры, дефис. Оставьте пустым для автогенерации)">
        <Input placeholder="payment" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={category?.is_system} />
        {category?.is_system && (
          <p className="text-xs text-yellow-600">Системная категория — slug нельзя изменить</p>
        )}
      </FormField>

      {/* Строка «активна + порядок» — намеренно горизонтальная, не FormField */}
      <div className="flex items-center justify-between gap-6 pt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
          <span className="text-sm">Активна</span>
        </label>
        <div className="flex items-center gap-2">
          <Label className="text-xs m-0">Порядок:</Label>
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="max-w-20" />
        </div>
      </div>
    </FormModal>
  );
}
