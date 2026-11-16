"use client";

// components/admin/form-modal.tsx
//
// Единый скелет модалки с формой: три зоны (шапка / скроллящееся
// тело / футер на плашке) вместо четырёх конкурировавших вариантов
// (p-0-трёхзонка, дефолтный паддинг, DialogFooter с отрицательными
// маргинами, стоковый DialogFooter).
//
// Типовая модалка теперь выглядит так:
//
//   <FormModal
//     open={open} onOpenChange={setOpen}
//     title="Новый подарок" description="Появится в каталоге"
//     submit={{ label: "Создать", icon: Save, onClick: handleSave, isLoading }}
//   >
//     <FormField label="Название" error={errors.name}>
//       <Input value={name} onChange={...} />
//     </FormField>
//   </FormModal>
//
// Футер: слева опциональный slot (например, Switch активности),
// справа «Отмена» (outline) + основная кнопка. Иконка-спиннер при
// загрузке подменяет иконку кнопки.

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SubmitConfig {
  /** Текст кнопки («Создать» / «Сохранить» / «Отклонить»). */
  label: string;
  /** Иконка (заменяется на спиннер при isLoading). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Деструктивное действие (удаление/возврат/блокировка). */
  destructive?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  /** onClick для модалок без <form> (onSubmit — для модалок с формой). */
  onClick?: () => void;
  type?: "button" | "submit";
}

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Ширина модалки; по умолчанию max-w-md. */
  className?: string;
  children: React.ReactNode;
  /** Конфиг основной кнопки; footer-вариант «без действий» — не передавай. */
  submit?: SubmitConfig;
  /** Контент слева от кнопок (например, Switch «активен»). */
  footerStart?: React.ReactNode;
  /** Полная замена правой части футера (кнопки вручную). */
  footerEnd?: React.ReactNode;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
  submit,
  footerStart,
  footerEnd,
}: FormModalProps) {
  const SubmitIcon = submit?.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden",
          className,
        )}
      >
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto little-scroll flex-1">{children}</div>

        {(footerStart || submit || footerEnd) && (
          <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20 shrink-0">
            <div className="flex items-center gap-3">{footerStart}</div>
            <div className="flex items-center gap-2">
              {footerEnd ?? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    disabled={submit?.isLoading}
                  >
                    Отмена
                  </Button>
                  {submit && (
                    <Button
                      type={submit.type ?? "button"}
                      variant={submit.destructive ? "destructive" : "default"}
                      size="sm"
                      onClick={submit.onClick}
                      disabled={submit.isLoading || submit.disabled}
                    >
                      {submit.isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        SubmitIcon && <SubmitIcon className="w-4 h-4" />
                      )}
                      {submit.label}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
