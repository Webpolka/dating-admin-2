// app/(admin)/finance/gifts/_components/_shared.ts
//
// Общие константы для страницы подарков.
// Вынесено из gifts-page-client.tsx (было 1298 строк, разбито на 5 файлов + shared).

import type { GiftCategory, GiftType } from "@/hooks/admin/use-gifts";
import { Eye, History, Lock, Package } from "lucide-react";

import type { SectionTabDef } from "@/components/admin/section-tabs";
import type { StatusTabDef } from "@/components/admin/status-tabs";

// Debounce для поиска. 400мс — оптимально для админки (как в транзакциях/тарифах).
export { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

// Количество записей на странице.
export const PER_PAGE = 15;

export const CATEGORY_OPTIONS: Array<{ value: GiftCategory; label: string }> = [
  { value: "romantic", label: "Романтика" },
  { value: "cars", label: "Авто" },
  { value: "male", label: "Для него" },
  { value: "female", label: "Для неё" },
  { value: "18+", label: "18+" },
  { value: "fun", label: "Приколы" },
];

// Типы подарков: main (обычные), premium (VIP), services (услуги — буст, невидимка и т.д.)
// color — Tailwind-классы для бейджа.
export const TYPE_OPTIONS: Array<{ value: GiftType; label: string; color: string }> = [
  { value: "main", label: "Основной", color: "bg-secondary text-secondary-foreground" },
  { value: "premium", label: "Премиум", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  { value: "services", label: "Услуги", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
];

export type Tab = "catalog" | "history";

// Табы-разделы страницы (SectionTabs).
export const GIFT_TABS: Array<SectionTabDef<Tab>> = [
  { value: "catalog", label: "Каталог", icon: Package },
  { value: "history", label: "История дарений", icon: History },
];

// Фильтр приватности в истории дарений (StatusTabs).
export const PRIVACY_FILTERS: Array<StatusTabDef<string>> = [
  { value: "all", label: "Все" },
  { value: "public", label: "Публичные", icon: Eye },
  { value: "private", label: "Приватные", icon: Lock, iconColor: "text-yellow-500" },
];


/**
 * Синхронное чтение параметра из window.location.search для initial
 * state в CatalogTab/HistoryTab — реэкспорт из lib/url-params.ts
 * (единая реализация; раньше функция дублировалась здесь копипастой).
 */
export { getInitialUrlParam } from "@/lib/url-params";