"use client";

// components/admin/form-field.tsx
//
// Стандартное поле формы: Label сверху → контрол → ошибка/подсказка.
//
// Унифицирует расползшиеся варианты («flex flex-col gap-2»,
// «space-y-1.5», сырой <label className="text-sm font-medium">),
// и даёт единый вид ошибок валидации (красный текст + aria-invalid
// уже на усмотрение контрола).

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: ReactNode;
  /** Текст ошибки (подсветка label + вывод под полем). */
  error?: string | null;
  /** Нейтральная подсказка под полем. */
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
