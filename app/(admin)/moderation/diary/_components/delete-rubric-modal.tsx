// app/(admin)/moderation/diary/_components/delete-rubric-modal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  useDestroyRubric,
  type DiaryRubric,
} from "@/hooks/admin/use-diaries";
import { FormModal } from "@/components/admin/form-modal";
import { FormField } from "@/components/admin/form-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Trash2, AlertTriangle } from "lucide-react";

// Sentinel value для "Оставить без рубрики" — shadcn Select не работает с value=""
const NONE_VALUE = "__none__";

export function DeleteRubricModal({
  open,
  onOpenChange,
  rubric,
  allRubrics,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rubric: DiaryRubric | null;
  allRubrics: { id: number; name: string }[];
}) {
  const [reassignValue, setReassignValue] = useState<string>(NONE_VALUE);

  const destroyMutation = useDestroyRubric();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setReassignValue(NONE_VALUE);
  }, [open]);

  const handleConfirm = () => {
    if (!rubric) return;
    const reassignId = reassignValue === NONE_VALUE ? null : Number(reassignValue);
    destroyMutation.mutate(
      { id: rubric.id, reassignId },
      {
        // onSuccess — диалог закрывается ТОЛЬКО при успехе.
        // При ошибке остаётся открытым, модератор видит toast и может retry.
        onSuccess: () => onOpenChange(false)
      }
    );
  };

  // Доступные рубрики для переноса — исключаем удаляемую
  const availableForReassign = rubric
    ? allRubrics.filter(r => r.id !== rubric.id)
    : allRubrics;

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Удаление рубрики"
      submit={{
        label: "Удалить рубрику",
        icon: Trash2,
        destructive: true,
        isLoading: destroyMutation.isPending,
        onClick: handleConfirm,
      }}
    >
      <p className="text-sm text-muted-foreground">
        Вы собираетесь удалить рубрику <span className="font-bold text-foreground">«{rubric?.name}»</span>.
      </p>

      {rubric && rubric.diaries_count > 0 ? (
        <>
          <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-foreground">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              В этой рубрике находится <span className="font-bold">{rubric.diaries_count}</span> записей.
              Выберите, куда их перенести, иначе они останутся без рубрики.
            </div>
          </div>

          <FormField label="Перенести записи в:">
            <Select
              value={reassignValue}
              onValueChange={(v) => setReassignValue(v ?? NONE_VALUE)}
            >
              <SelectTrigger>
                {reassignValue === NONE_VALUE
                  ? "Оставить без рубрики"
                  : availableForReassign.find(r => String(r.id) === reassignValue)?.name ?? "Оставить без рубрики"
                }
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Оставить без рубрики</SelectItem>
                {availableForReassign.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </>
      ) : (
        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
          В этой рубрике нет записей. Можно удалять безопасно.
        </div>
      )}
    </FormModal>
  );
}
