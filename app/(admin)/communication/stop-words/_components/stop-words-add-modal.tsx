// app/(admin)/communication/stop-words/_components/stop-words-add-modal.tsx
"use client";

import { Save } from "lucide-react";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { StopWordAction as StopWordActionType, StopWordCategory as StopWordCategoryType } from "@/hooks/admin/use-stop-words";
import { CATEGORY_OPTIONS, ACTION_OPTIONS } from "./stop-words-shared";

// ============================================================
// Модалка массового добавления стоп-слов
// ============================================================
export function AddStopWordsModal({
  open,
  onOpenChange,
  bulkWords,
  setBulkWords,
  modalCategory,
  setModalCategory,
  modalAction,
  setModalAction,
  modalReplacement,
  setModalReplacement,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bulkWords: string;
  setBulkWords: (v: string) => void;
  modalCategory: StopWordCategoryType;
  setModalCategory: (v: StopWordCategoryType) => void;
  modalAction: StopWordActionType;
  setModalAction: (v: StopWordActionType) => void;
  modalReplacement: string;
  setModalReplacement: (v: string) => void;
  onSave: () => void;
  isLoading: boolean;
}) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Добавить стоп-слова"
      className="max-w-lg"
      submit={{
        label: "Добавить",
        icon: Save,
        isLoading,
        disabled: !bulkWords.trim(),
        onClick: onSave,
      }}
    >
      <FormField
        label="Слова или фразы"
        hint="Система автоматически пропустит дубликаты."
      >
        <Textarea
          rows={5}
          placeholder={"Введите слова через запятую или с новой строки...\nНапример:\nказино\nтелеграм, тг, @scammer"}
          value={bulkWords}
          onChange={(e) => setBulkWords(e.target.value)}
          className="resize-none font-mono text-sm"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Категория">
          <Select
            value={modalCategory}
            onValueChange={(v: string | null) => v && setModalCategory(v as StopWordCategoryType)}
          >
            <SelectTrigger className="w-full">
              {CATEGORY_OPTIONS.find(o => o.value === modalCategory)?.label}
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Поведение">
          <Select
            value={modalAction}
            onValueChange={(v: string | null) => v && setModalAction(v as StopWordActionType)}
          >
            <SelectTrigger className="w-full">
              {ACTION_OPTIONS.find(o => o.value === modalAction)?.label}
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Replacement — только для mask action */}
      {modalAction === "mask" && (
        <FormField
          label="Замена (replacement)"
          hint="Текст, на который заменяется стоп-слово в сообщении. По умолчанию ***. Максимум 10 символов."
        >
          <Input
            value={modalReplacement}
            onChange={(e) => setModalReplacement(e.target.value.slice(0, 10))}
            placeholder="***"
            maxLength={10}
            className="font-mono"
          />
        </FormField>
      )}
    </FormModal>
  );
}
