"use client";

// components/admin/section-tabs.tsx
//
// Подчёркнутые табы-разделы одной страницы («Шаблоны | Категории»,
// «Записи | Рубрики», «Каталог | История»...).
//
// Отличие от StatusTabs: StatusTabs — кнопки-фильтры одного списка
// (статусы жалобы, типы фото), SectionTabs — переключение между
// разными панелями страницы, стиль underline как в настройках
// профилей. До появления компонента каждая страница писала свой
// вариант (border-b-2 у одних, Button default/outline у других).

import { cn } from "@/lib/utils";

export interface SectionTabDef<V extends string = string> {
  value: V;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Счётчик рядом с названием (напр. число рубрик). */
  count?: number | null;
}

interface SectionTabsProps<V extends string> {
  tabs: ReadonlyArray<SectionTabDef<V>>;
  value: V;
  onChange: (value: V) => void;
  /** Доп. классы контейнера. */
  className?: string;
}

export function SectionTabs<V extends string>({
  tabs,
  value,
  onChange,
  className,
}: SectionTabsProps<V>) {
  return (
    <div className={cn("flex gap-x-4 flex-wrap border-b border-border", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {tab.label}
            {(tab.count ?? null) !== null && (
              <span className="min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-sm bg-muted text-xs text-muted-foreground">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
