// app/(admin)/moderation/diary/_components/rubric-form-modal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  useStoreRubric,
  useUpdateRubric,
  useCheckRubricName,
  type DiaryRubric,
} from "@/hooks/admin/use-diaries";
import { extractValidationErrors } from "@/lib/api";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Check, AlertCircle } from "lucide-react";

type FieldErrors = {
  name?: string;
  description?: string;
  sort_order?: string;
};

export function RubricFormModal({
  open,
  onOpenChange,
  editingRubric,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRubric: DiaryRubric | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const storeMutation = useStoreRubric();
  const updateMutation = useUpdateRubric();
  const isPending = storeMutation.isPending || updateMutation.isPending;

  // Realtime проверка дубля названия. ignore_id = текущий ID рубрики
  // (при редактировании — чтобы не совпадало с самой собой).
  // Hook внутри себя делает debounce 300ms.
  const nameCheck = useCheckRubricName(name, editingRubric?.id);

  // Если realtime-проверка нашла дубль — блокируем submit и показываем ошибку.
  // Если name совпадает с исходным названием редактируемой рубрики — дубль не считается.
  const isNameUnchanged = editingRubric && name.trim() === editingRubric.name;
  const nameConflict = !isNameUnchanged && nameCheck.available === false && name.trim().length >= 2;

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldErrors({});
      if (editingRubric) {
        setName(editingRubric.name);
        setDescription(editingRubric.description ?? "");
        setIsActive(editingRubric.is_active);
        setSortOrder(editingRubric.sort_order);
      } else {
        setName("");
        setDescription("");
        setIsActive(true);
        // Для новой рубрики — sort_order = последний + 1, чтобы она была внизу списка
        setSortOrder(0);
      }
    }
  }, [open, editingRubric]);

  const handleSubmit = () => {
    setFieldErrors({});

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      is_active: isActive,
      sort_order: Number(sortOrder) || 0,
    };

    // Лёгкая клиентская валидация перед отправкой
    if (!payload.name) {
      setFieldErrors({ name: "Введите название рубрики" });
      return;
    }
    if (payload.name.length > 255) {
      setFieldErrors({ name: "Название не должно превышать 255 символов" });
      return;
    }

    const onError = (err: unknown) => {
      const backendErrors = extractValidationErrors(err);
      if (backendErrors) {
        // Маппим server errors по полям
        setFieldErrors({
          name: backendErrors.name?.[0],
          description: backendErrors.description?.[0],
          sort_order: backendErrors.sort_order?.[0],
        });
      }
      // Если не validation errors — toast уже показан в hook onError
    };

    if (editingRubric) {
      updateMutation.mutate(
        { id: editingRubric.id, ...payload },
        {
          onSuccess: () => onOpenChange(false),
          onError,
        }
      );
    } else {
      storeMutation.mutate(payload, {
        onSuccess: () => onOpenChange(false),
        onError,
      });
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={editingRubric ? "Редактировать системную рубрику" : "Создать системную рубрику"}
      description="Название должно быть уникальным среди системных рубрик."
      className="max-w-lg"
      submit={{
        label: editingRubric ? "Сохранить" : "Создать",
        icon: Save,
        isLoading: isPending,
        disabled: !name.trim() || nameConflict,
        onClick: handleSubmit,
      }}
    >
      {/* Название */}
      <FormField label="Название" htmlFor="r-name" required>
        <Input
          id="r-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: undefined }));
          }}
          placeholder="Например: Путешествия"
          autoFocus
          aria-invalid={!!fieldErrors.name || nameConflict}
        />
        {/* Приоритет показа ошибок: server validation errors > realtime conflict > hint */}
        {fieldErrors.name ? (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {fieldErrors.name}
          </p>
        ) : nameConflict ? (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Рубрика с таким названием уже существует
            {nameCheck.conflict_name && nameCheck.conflict_name !== name.trim() && (
              <span className="opacity-70"> (найдено: «{nameCheck.conflict_name}»)</span>
            )}
          </p>
        ) : name.trim().length >= 2 && nameCheck.isChecking ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Проверка уникальности…
          </p>
        ) : name.trim().length >= 2 && nameCheck.available === true && !isNameUnchanged ? (
          <p className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
            <Check className="w-3 h-3" /> Название свободно
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Уникальное среди системных рубрик.
          </p>
        )}
      </FormField>

      {/* Описание */}
      <FormField label="Описание" htmlFor="r-desc">
        <Textarea
          id="r-desc"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (fieldErrors.description) setFieldErrors(prev => ({ ...prev, description: undefined }));
          }}
          rows={3}
          className="resize-none"
          placeholder="О чём эта рубрика..."
          aria-invalid={!!fieldErrors.description}
        />
        {fieldErrors.description && (
          <p className="text-xs text-destructive">{fieldErrors.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {description.length}/2000
        </p>
      </FormField>

      {/* Сортировка + Активна — в один ряд (grid-cols-2) */}
      <div className="grid items-start grid-cols-2 gap-4">
        <FormField
          label="Сортировка"
          htmlFor="r-sort"
          error={fieldErrors.sort_order}
          hint="от 0 до 100"
        >
          <Input
            id="r-sort"
            type="number"
            min={0}
            max={100}
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(Number(e.target.value));
              if (fieldErrors.sort_order) setFieldErrors(prev => ({ ...prev, sort_order: undefined }));
            }}
            aria-invalid={!!fieldErrors.sort_order}
          />
        </FormField>
        <FormField label="Активна" htmlFor="r-active">
          <div className="flex items-center gap-2 h-9">
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              id="r-active"
            />
            <span className="text-xs text-muted-foreground">
              {isActive ? "Видна всем" : "Скрыта"}
            </span>
          </div>
        </FormField>
      </div>
    </FormModal>
  );
}
