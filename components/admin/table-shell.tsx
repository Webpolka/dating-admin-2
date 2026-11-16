"use client";

// components/admin/table-shell.tsx
//
// Единый каркас таблицы: рамка + фон карточки + горизонтальный скролл
// + опциональный оверлей «дозагрузки» (лёгкий спиннер поверх данных
// при refetch, чтобы таблица не прыгала).
//
// Заменяет три конкурирующих варианта обёртки, живших в проекте:
//   1) rounded-md border border-border bg-card overflow-x-auto
//   2) ... + relative и самодельный backdrop-blur-[2px] оверлей
//   3) bg-card border border-border rounded-lg overflow-hidden relative
// Теперь вариант и наличие оверлея не зависят от того, кто писал страницу.

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface TableShellProps {
  /** <Table> (или карточки/список — любой скроллящийся контент). */
  children: React.ReactNode;
  /** Показать оверлей-спиннер (обычно isFetching из useQuery). */
  isFetching?: boolean;
  /** Доп. классы обёртки (например, кастомная мин. ширина). */
  className?: string;
}

export function TableShell({ children, isFetching = false, className }: TableShellProps) {
  return (
    <div className={cn("relative rounded-md border border-border bg-card overflow-x-auto", className)}>
      {children}
      {isFetching && (
        <div className="absolute inset-0 z-10 flex items-start justify-center pt-10 bg-card/40 backdrop-blur-[2px] animate-in fade-in duration-200">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
