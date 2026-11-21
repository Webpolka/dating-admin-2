// components/ui/date-picker.tsx
"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /**
   * Минимальная selectable дата. Даты раньше этой — disabled в календаре.
   * Например: new Date() — нельзя выбрать прошедшую дату.
   * Если null/undefined — ограничений нет.
   */
  minDate?: Date | null;
  /** Запретить выбор (полностью disable). */
  disabled?: boolean;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Выберите дату",
  minDate,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;

  // react-day-picker Matcher: даты раньше minDate — disabled.
  // Округляем minDate до начала дня, чтобы "сегодня" оставалось selectable.
  const disabledMatcher = minDate
    ? { before: new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) }
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
         <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
        {date ? format(date, "dd.MM.yyyy", { locale: ru }) : <span>{placeholder}</span>}
          <CalendarIcon className="h-4 w-4" />
        </Button>
      }/>
    <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange?.(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          locale={ru}
          disabled={disabledMatcher}
        />
      </PopoverContent>
    </Popover>
  );
}
