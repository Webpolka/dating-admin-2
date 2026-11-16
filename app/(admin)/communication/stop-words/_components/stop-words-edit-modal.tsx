// app/(admin)/communication/stop-words/_components/stop-words-edit-modal.tsx
"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type {
  StopWordItem,
  StopWordAction as StopWordActionType,
  StopWordCategory as StopWordCategoryType,
} from "@/hooks/admin/use-stop-words";
import { CATEGORY_OPTIONS, ACTION_OPTIONS } from "./stop-words-shared";

// ============================================================
// Модалка редактирования одного стоп-слова
// ============================================================
export function EditStopWordModal({
  open,
  onOpenChange,
  word,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: StopWordItem | null;
  onSave: (payload: {
    word: string;
    category: StopWordCategoryType;
    action: StopWordActionType;
    replacement: string;
    is_active: boolean;
  }) => void;
  isLoading: boolean;
}) {
  const [editWord, setEditWord] = useState("");
  const [editCategory, setEditCategory] = useState<StopWordCategoryType>("mat");
  const [editAction, setEditAction] = useState<StopWordActionType>("mask");
  const [editReplacement, setEditReplacement] = useState("***");
  const [editIsActive, setEditIsActive] = useState(true);

  // Синхронизируем local state при открытии/смене слова
  useEffect(() => {
    if (open && word) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditWord(word.word);
      setEditCategory(word.category);
      setEditAction(word.action);
      setEditReplacement(word.replacement || "***");
      setEditIsActive(word.is_active);
    }
  }, [open, word]);

  const handleSave = () => {
    if (!editWord.trim()) return;
    onSave({
      word: editWord.trim(),
      category: editCategory,
      action: editAction,
      replacement: editAction === "mask" ? editReplacement : "***",
      is_active: editIsActive,
    });
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Редактировать стоп-слово"
      className="max-w-lg"
      submit={{
        label: "Сохранить",
        icon: Save,
        isLoading,
        disabled: !editWord.trim(),
        onClick: handleSave,
      }}
    >
      {!word ? (
        <div className="py-4 text-center text-muted-foreground">Загрузка...</div>
      ) : (
        <>
          <FormField label="Слово или фраза">
            <Input
              value={editWord}
              onChange={(e) => setEditWord(e.target.value.slice(0, 255))}
              className="font-mono text-sm"
              maxLength={255}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Категория">
              <Select
                value={editCategory}
                onValueChange={(v: string | null) => v && setEditCategory(v as StopWordCategoryType)}
              >
                <SelectTrigger className="w-full">
                  {CATEGORY_OPTIONS.find(o => o.value === editCategory)?.label}
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
                value={editAction}
                onValueChange={(v: string | null) => v && setEditAction(v as StopWordActionType)}
              >
                <SelectTrigger className="w-full">
                  {ACTION_OPTIONS.find(o => o.value === editAction)?.label}
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
          {editAction === "mask" && (
            <FormField label="Замена (replacement)">
              <Input
                value={editReplacement}
                onChange={(e) => setEditReplacement(e.target.value.slice(0, 10))}
                placeholder="***"
                maxLength={10}
                className="font-mono"
              />
            </FormField>
          )}

          {/* Active toggle — намеренно горизонтальная строка, не FormField */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={editIsActive}
              onCheckedChange={(v) => setEditIsActive(v === true)}
              id="edit-is-active"
            />
            <Label htmlFor="edit-is-active" className="text-sm font-normal cursor-pointer">
              Активно (применять фильтр)
            </Label>
          </div>
        </>
      )}
    </FormModal>
  );
}
